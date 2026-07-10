/**
 * components/ActivityCard.js — Trainings-Übersichtskarte im intervals.icu-Stil
 *
 * Kopfleiste (Zeit · Distanz), Puls + Belastung, darunter das grüne Höhen-/
 * Effort-Profil als gefüllte Fläche, unten Sportart + Titel + Karten-Icon.
 * Tippen öffnet die Detailansicht (Vollbildkarte, Zonen, Diagramme).
 *
 * Props: { workout, width, onPress }
 */

// React/RN
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

// Internal
import { useTheme } from '../theme';
import { getSportColor } from '../api/client';
import { getSportMci } from '../data/sports';

const fmtHMS = (s) => {
  if (!s) return '–';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
};

// Grüne gefüllte Profil-Fläche (Höhe bzw. Puls über die Zeit)
function ProfileStrip({ data, width, height }) {
  const vals = (data || []).filter(v => typeof v === 'number' && !isNaN(v));
  if (vals.length < 2 || !width) return <View style={{ height, backgroundColor: '#1e1e1e' }} />;
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const x = (i) => (i / (vals.length - 1)) * width;
  const y = (v) => height - ((v - min) / range) * (height - 6) - 3;
  let d = `M 0 ${height} L ${x(0).toFixed(1)} ${y(vals[0]).toFixed(1)}`;
  for (let i = 1; i < vals.length; i++) d += ` L ${x(i).toFixed(1)} ${y(vals[i]).toFixed(1)}`;
  d += ` L ${width} ${height} Z`;
  return (
    <View style={{ height, backgroundColor: '#1a2a1a' }}>
      <Svg width={width} height={height}>
        <Path d={d} fill="#3FA34D" fillOpacity={0.85} />
      </Svg>
    </View>
  );
}

export default function ActivityCard({ workout, width, onPress }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const w = workout || {};
  const done = w.exercisesCompleted || w.exercises_completed || {};
  const sport = w.sport_type || 'other';
  const sc = getSportColor(sport);

  const movingS = (w.duration_minutes || 0) * 60 || done.moving_time_s || 0;
  const distKm = w.distance || (done.distance ? done.distance / 1000 : null);
  const avgHr = done.avg_hr || w.avg_hr;
  const load = done.training_load;
  const profileData = Array.isArray(done.alt_stream) && done.alt_stream.length > 2 ? done.alt_stream
    : (Array.isArray(done.hr_stream) && done.hr_stream.length > 2 ? done.hr_stream : null);
  const stripW = width - 2; // minus Rand

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ borderRadius: R.md, overflow: 'hidden', backgroundColor: '#141414', borderWidth: StyleSheet.hairlineWidth, borderColor: '#2a2a2a' }}>
      {/* Kopfleiste: Zeit · Distanz */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 8, backgroundColor: '#2f5c8f' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{fmtHMS(movingS)}</Text>
        {distKm ? <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{(+distKm).toFixed(0)} km</Text> : null}
      </View>

      {/* Puls + Belastung */}
      <View style={{ alignItems: 'center', paddingVertical: 10, gap: 2 }}>
        {avgHr ? <Text style={{ color: '#FF5A7A', fontSize: 16, fontWeight: '700' }}>{avgHr} bpm</Text> : null}
        {load != null ? <Text style={{ color: '#bbb', fontSize: 13 }}>Belastung {Math.round(load)}</Text> : null}
      </View>

      {/* Grünes Profil */}
      <ProfileStrip data={profileData} width={stripW} height={44} />

      {/* Fußzeile: Sportart + Titel + Karten-Icon */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: S.md, paddingVertical: 10 }}>
        <MaterialCommunityIcons name={getSportMci(sport)} size={17} color={sc} />
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>{w.focus || w.title || 'Einheit'}</Text>
        {Array.isArray(done.route) && done.route.length > 1 ? <Feather name="map" size={15} color="#888" /> : null}
      </View>
    </TouchableOpacity>
  );
}
