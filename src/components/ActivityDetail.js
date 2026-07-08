/**
 * components/ActivityDetail.js — Detailansicht einer absolvierten Einheit (Strava-Stil)
 *
 * Vollbild-Overlay mit:
 *   - Header: Sport-Icon, Titel, Datum/Uhrzeit
 *   - Große Primär-Kennzahlen (Distanz / Zeit / Tempo bzw. Pace)
 *   - GPS-Strecken-Karte (RouteMap)
 *   - Sekundär-Grid (Höhenmeter, kcal, Puls, Watt, NP, Load …)
 *   - Runden-/Split-Tabelle
 *   - Optionale Aktionen (z.B. Austauschen/Löschen) über `actions`
 *
 * Erwartet ein completed_workout-Objekt (wie vom Backend), inkl.
 * exercisesCompleted (Detail-JSON: route, laps, avg_watts, …).
 *
 * Props: { workout, onClose, onDelete, actions }
 *   actions: [{ icon, label, onPress, danger }] — untere Button-Reihe
 */

// React/RN
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// Internal
import { useTheme } from '../theme';
import { getSportColor } from '../api/client';
import { getSportMci } from '../data/sports';
import RouteMap from './RouteMap';

const fmtHMS = (s) => {
  if (!s) return '–';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};
const fmtPace = (s) => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '–';

export default function ActivityDetail({ workout, onClose, onDelete, actions }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  if (!workout) return null;

  const w = workout;
  const done = w.exercisesCompleted || w.exercises_completed || {};
  const sport = w.sport_type || 'other';
  const sc = getSportColor(sport);
  const title = w.focus || w.title || 'Einheit';

  const durS = (w.duration_minutes || 0) * 60 || done.moving_time_s || 0;
  const distKm = w.distance || (done.distance ? done.distance / 1000 : null);
  const isDistance = ['run', 'bike', 'swim', 'row', 'hike'].includes(sport) && distKm;
  const paceSKm = isDistance && durS && distKm ? durS / distKm : null;

  // Datum + Uhrzeit
  let when = w.date || '';
  try {
    const dt = new Date((w.completed_at || w.date || '').replace(' ', 'T'));
    if (!isNaN(dt)) when = dt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
      + (w.completed_at && w.completed_at.includes(' ') ? ` · ${dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : '');
  } catch (e) {}

  // Primär-Kennzahlen (große Zahlen wie bei Strava)
  const primary = [];
  if (isDistance) primary.push([`${(+distKm).toFixed(2)}`, 'km']);
  primary.push([fmtHMS(durS), 'Zeit']);
  if (sport === 'run' && paceSKm) primary.push([fmtPace(paceSKm), '/km']);
  else if (['bike', 'row'].includes(sport) && done.avg_speed_kmh) primary.push([`${done.avg_speed_kmh}`, 'km/h']);
  else if (sport === 'swim' && paceSKm) primary.push([fmtPace(paceSKm / 10), '/100m']);
  else if (done.calories || w.calories) primary.push([`${done.calories || w.calories}`, 'kcal']);

  // Sekundär-Grid
  const secondary = [
    ['Ø Puls', (done.avg_hr || w.avg_hr) ? `${done.avg_hr || w.avg_hr} bpm` : null],
    ['Max. Puls', done.max_hr ? `${done.max_hr} bpm` : null],
    ['Ø Watt', done.avg_watts ? `${done.avg_watts} W` : null],
    ['NP', done.weighted_watts ? `${done.weighted_watts} W` : null],
    ['Höhenmeter', done.elevation_gain_m ? `${done.elevation_gain_m} m` : null],
    ['Kalorien', (done.calories || w.calories) ? `${done.calories || w.calories} kcal` : null],
    ['Load', done.training_load ? `${done.training_load}` : null],
    ['RPE', w.perceived_effort ? `${w.perceived_effort}/10` : null],
  ].filter(([, v]) => v);

  const laps = Array.isArray(done.laps) ? done.laps : (Array.isArray(done.splits) ? done.splits : []);
  const hasRoute = Array.isArray(done.route) && done.route.length > 1;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.lg, paddingTop: 60, paddingBottom: S.md }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${sc}20`, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name={getSportMci(sport)} size={22} color={sc} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T.h3, { color: C.text }]} numberOfLines={1}>{title}</Text>
            <Text style={[T.caption, { color: C.textSecondary, marginTop: 1 }]}>{when}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <Feather name="x" size={18} color={C.text} />
          </TouchableOpacity>
        </View>

        {/* Karte */}
        {hasRoute && (
          <View style={{ paddingHorizontal: S.lg, marginBottom: S.md }}>
            <RouteMap route={done.route} height={210} color={sc} />
          </View>
        )}

        {/* Primär-Kennzahlen */}
        <View style={{ flexDirection: 'row', paddingHorizontal: S.lg, marginBottom: S.lg }}>
          {primary.map(([val, label], i) => (
            <View key={label} style={{ flex: 1, alignItems: i === 0 ? 'flex-start' : 'center', borderLeftWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderLeftColor: C.border }}>
              <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>{val}</Text>
              <Text style={[T.caption, { color: C.textTertiary, marginTop: 2 }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Sekundär-Grid */}
        {secondary.length > 0 && (
          <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {secondary.map(([l, v]) => (
                <View key={l} style={{ width: '31%', backgroundColor: C.surface, borderRadius: R.md, paddingVertical: 12, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                  <Text style={[T.bodyMed, { color: C.text, fontSize: 15 }]}>{v}</Text>
                  <Text style={[T.label, { color: C.textTertiary, marginTop: 2 }]}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Runden / Splits */}
        {laps.length > 1 && (
          <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
            <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', marginBottom: S.sm }]}>
              {done.laps ? 'Runden' : 'Splits'}
            </Text>
            <View style={{ backgroundColor: C.surface, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' }}>
              {laps.slice(0, 30).map((lp, li) => (
                <View key={li} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 9, borderBottomWidth: li < Math.min(laps.length, 30) - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: C.border, gap: S.sm }}>
                  <Text style={[T.label, { color: lp.typ === 'WORK' ? sc : C.textTertiary, width: 26 }]}>{lp.km || li + 1}</Text>
                  <Text style={[T.caption, { color: C.text, flex: 1 }]}>
                    {lp.distanz_m ? `${(lp.distanz_m / 1000).toFixed(2)} km` : ''}
                    {lp.pace_s_km ? `  ${fmtPace(lp.pace_s_km)}/km` : ''}
                    {lp.zeit_s ? `  ·  ${fmtHMS(lp.zeit_s)}` : ''}
                  </Text>
                  {lp.avg_watts ? <Text style={[T.caption, { color: C.textSecondary }]}>{lp.avg_watts} W</Text> : null}
                  {lp.avg_hr ? <Text style={[T.caption, { color: C.textSecondary }]}>{lp.avg_hr} bpm</Text> : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {w.notes && !/\[(strava|intervals):/.test(w.notes) && (
          <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
            <Text style={[T.caption, { color: C.textSecondary, fontStyle: 'italic' }]}>"{w.notes}"</Text>
          </View>
        )}

        {/* Aktionen */}
        {(actions?.length > 0 || onDelete) && (
          <View style={{ paddingHorizontal: S.lg, gap: S.sm }}>
            {actions?.map((a, i) => (
              <TouchableOpacity
                key={i}
                onPress={a.onPress}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: a.primary ? C.accent : C.surface, borderRadius: R.md, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: a.primary ? C.accent : C.border }}
              >
                {a.icon && <Feather name={a.icon} size={16} color={a.primary ? C.accentText : C.text} />}
                <Text style={[T.bodyMed, { color: a.primary ? C.accentText : C.text }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
            {onDelete && (
              <TouchableOpacity onPress={onDelete} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12 }}>
                <Feather name="trash-2" size={14} color={C.danger} />
                <Text style={[T.caption, { color: C.danger }]}>Einheit löschen</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
