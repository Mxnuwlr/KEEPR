/**
 * components/ActivityCard.js — Trainings-Übersichtskarte im Strava-Feed-Stil
 *
 * Oben schwarzer Kopf (Sportart, Name, Distanz, Zeit, Datum), darunter die
 * komplette Route als Hybrid-Karten-Banner. Live-Button (▶) fährt die Strecke
 * IM Banner ab (animierter Marker), ohne ins Vollbild zu springen.
 *
 * Props: { workout, width, onPress }
 */

// React/RN
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// Internal
import { useTheme } from '../theme';
import { getSportColor } from '../api/client';
import { getSportMci } from '../data/sports';
import RouteMapTiles from './RouteMapTiles';

const fmtHMS = (s) => {
  if (!s) return '–';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

const SPORT_LABEL = { run: 'Laufen', bike: 'Radfahren', swim: 'Schwimmen', row: 'Rudern', hike: 'Wandern', strength: 'Krafttraining', mobility: 'Mobility', other: 'Aktivität' };

export default function ActivityCard({ workout, width, onPress }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const w = workout || {};
  const done = w.exercisesCompleted || w.exercises_completed || {};
  const sport = w.sport_type || 'other';
  const sc = getSportColor(sport);
  const hasRoute = Array.isArray(done.route) && done.route.length > 1;

  const [markerFrac, setMarkerFrac] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const toggleLive = () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; setMarkerFrac(null); return; }
    let i = 0;
    const N = done.route.length;
    const step = Math.max(1, Math.round(N / 120));
    timer.current = setInterval(() => {
      i += step;
      if (i >= N) { setMarkerFrac(1); clearInterval(timer.current); timer.current = null; setTimeout(() => setMarkerFrac(null), 600); return; }
      setMarkerFrac(i / (N - 1));
    }, 60);
  };

  const movingS = (w.duration_minutes || 0) * 60 || done.moving_time_s || 0;
  const distKm = w.distance || (done.distance ? done.distance / 1000 : null);
  const dateStr = (() => { try { return new Date((w.completed_at || w.date).replace(' ', 'T')).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }); } catch (e) { return w.date; } })();

  const stats = [
    distKm ? ['Distanz', `${(+distKm).toFixed(2)} km`] : null,
    movingS ? ['Zeit', fmtHMS(movingS)] : null,
    done.elevation_gain_m ? ['Höhenm.', `${done.elevation_gain_m} m`] : null,
  ].filter(Boolean);

  return (
    <View style={{ borderRadius: R.lg, overflow: 'hidden', backgroundColor: '#141414', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
      {/* Schwarzer Kopf */}
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ padding: S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <MaterialCommunityIcons name={getSportMci(sport)} size={16} color="#bbb" />
          <Text style={{ color: '#bbb', fontSize: 13, flex: 1 }} numberOfLines={1}>
            {dateStr}{done.device ? ` · ${done.device}` : ''}
          </Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 19, fontWeight: '700' }} numberOfLines={1}>{w.focus || w.title || SPORT_LABEL[sport] || 'Einheit'}</Text>
        <View style={{ flexDirection: 'row', gap: S.xl, marginTop: S.sm }}>
          {stats.map(([l, v]) => (
            <View key={l}>
              <Text style={{ color: '#888', fontSize: 12 }}>{l}</Text>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{v}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>

      {/* Hybrid-Karten-Banner mit Live-Button */}
      {hasRoute && (
        <View>
          <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
            <RouteMapTiles route={done.route} width={width} height={180} color="#FC4C02" variant="hybrid" markerFrac={markerFrac} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleLive}
            style={{ position: 'absolute', right: 12, bottom: 12, width: 46, height: 46, borderRadius: 23, backgroundColor: markerFrac != null ? '#FC4C02' : 'rgba(20,20,20,0.8)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name={markerFrac != null ? 'square' : 'play'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
