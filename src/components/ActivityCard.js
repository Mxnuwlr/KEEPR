/**
 * components/ActivityCard.js — Trainings-Übersichtskarte
 *
 * intervals.icu-Kopf (Zeit · Distanz, Puls, Belastung) + Karten-Banner mit der
 * Route (Hybrid) und Live-Button (Flyover im Banner). Tippen öffnet die Detailansicht.
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
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
};

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
    let i = 0; const N = done.route.length; const step = Math.max(1, Math.round(N / 120));
    timer.current = setInterval(() => {
      i += step;
      if (i >= N) { setMarkerFrac(1); clearInterval(timer.current); timer.current = null; setTimeout(() => setMarkerFrac(null), 600); return; }
      setMarkerFrac(i / (N - 1));
    }, 60);
  };

  const movingS = (w.duration_minutes || 0) * 60 || done.moving_time_s || 0;
  const distKm = w.distance || (done.distance ? done.distance / 1000 : null);
  const avgHr = done.avg_hr || w.avg_hr;
  const load = done.training_load;

  return (
    <View style={{ borderRadius: R.md, overflow: 'hidden', backgroundColor: '#141414', borderWidth: StyleSheet.hairlineWidth, borderColor: '#2a2a2a' }}>
      {/* Kopfleiste: Zeit · Distanz */}
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 8, backgroundColor: '#2f5c8f' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{fmtHMS(movingS)}</Text>
          {distKm ? <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{(+distKm).toFixed(0)} km</Text> : null}
        </View>
        {/* Puls + Belastung */}
        <View style={{ alignItems: 'center', paddingVertical: 9, gap: 2 }}>
          {avgHr ? <Text style={{ color: '#FF5A7A', fontSize: 16, fontWeight: '700' }}>{avgHr} bpm</Text> : null}
          {load != null ? <Text style={{ color: '#bbb', fontSize: 13 }}>Belastung {Math.round(load)}</Text> : null}
        </View>
      </TouchableOpacity>

      {/* Karten-Banner mit der Route + Live-Button */}
      {hasRoute && (
        <View>
          <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
            <RouteMapTiles route={done.route} width={width} height={170} color="#FC4C02" variant="hybrid" markerFrac={markerFrac} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleLive}
            style={{ position: 'absolute', right: 12, bottom: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: markerFrac != null ? '#FC4C02' : 'rgba(20,20,20,0.8)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name={markerFrac != null ? 'square' : 'play'} size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Fußzeile: Sportart + Titel */}
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: S.md, paddingVertical: 10 }}>
        <MaterialCommunityIcons name={getSportMci(sport)} size={17} color={sc} />
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>{w.focus || w.title || 'Einheit'}</Text>
        <Feather name="chevron-right" size={16} color="#666" />
      </TouchableOpacity>
    </View>
  );
}
