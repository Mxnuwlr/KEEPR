/**
 * components/ActivityDetail.js — Detailansicht einer absolvierten Einheit (Strava-Stil)
 *
 * Aufbau:
 *   - Echte GPS-Karte (RouteMapTiles) ganz oben
 *   - Titel + Sport + Datum/Uhrzeit/Ort/Gerät
 *   - Großes Kennzahlen-Raster (Distanz, Zeit, Tempo, Höhenmeter, kcal, Puls …)
 *   - Verlaufs-Diagramme: Herzfrequenz, Höhe, Geschwindigkeit (AreaChart)
 *   - Runden-/Split-Tabelle
 *   - Optionale Aktionen (actions) + Löschen
 *
 * Erwartet ein completed_workout-Objekt inkl. exercisesCompleted (Detail-JSON:
 * route, laps, *_stream, avg_watts, …).
 */

// React/RN
import React, { useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// Internal
import { useTheme } from '../theme';
import { getSportColor } from '../api/client';
import { getSportMci } from '../data/sports';
import ActivityMap from './ActivityMap';
import AreaChart from './AreaChart';

const fmtHMS = (s) => {
  if (!s) return '–';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};
const fmtPace = (s) => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '–';

export default function ActivityDetail({ workout, onClose, onDelete, actions }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const mapRef = useRef(null);
  if (!workout) return null;

  const W = Dimensions.get('window').width;
  const w = workout;
  const done = w.exercisesCompleted || w.exercises_completed || {};
  const sport = w.sport_type || 'other';
  const sc = getSportColor(sport);
  const title = w.focus || w.title || 'Einheit';

  const movingS = (w.duration_minutes || 0) * 60 || done.moving_time_s || 0;
  const distKm = w.distance || (done.distance ? done.distance / 1000 : null);
  const isDistance = ['run', 'bike', 'swim', 'row', 'hike'].includes(sport) && distKm;
  const paceSKm = isDistance && movingS && distKm ? movingS / distKm : null;

  // Datum · Uhrzeit · Ort · Gerät
  let when = w.date || '';
  try {
    const dt = new Date((w.completed_at || w.date || '').replace(' ', 'T'));
    if (!isNaN(dt)) when = dt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
      + (w.completed_at && w.completed_at.includes(' ') ? ` · ${dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : '');
  } catch (e) {}
  const subline = [when, done.location, done.device].filter(Boolean).join(' · ');

  // Kennzahlen-Raster (Label + großer Wert, 2 Spalten wie Strava)
  const grid = [];
  if (isDistance) grid.push(['Distanz', `${(+distKm).toFixed(2)} km`]);
  grid.push(['Bewegungszeit', fmtHMS(movingS)]);
  if (done.elapsed_time_s && done.elapsed_time_s > movingS + 30) grid.push(['Verstrichene Zeit', fmtHMS(done.elapsed_time_s)]);
  if (sport === 'run' && paceSKm) grid.push(['Ø Pace', `${fmtPace(paceSKm)} /km`]);
  else if (done.avg_speed_kmh) grid.push(['Ø Geschw.', `${done.avg_speed_kmh} km/h`]);
  if (done.max_speed_kmh) grid.push(['Höchstgeschw.', `${done.max_speed_kmh} km/h`]);
  if (done.elevation_gain_m) grid.push(['Höhenzunahme', `${done.elevation_gain_m} m`]);
  if (done.calories || w.calories) grid.push(['Kalorien', `${done.calories || w.calories} kcal`]);
  if (done.avg_hr || w.avg_hr) grid.push(['Ø Herzfrequenz', `${done.avg_hr || w.avg_hr} bpm`]);
  if (done.max_hr) grid.push(['Max. Herzfrequenz', `${done.max_hr} bpm`]);
  if (done.avg_watts) grid.push(['Ø Leistung', `${done.avg_watts} W`]);
  if (done.weighted_watts) grid.push(['Normalized Power', `${done.weighted_watts} W`]);
  if (done.avg_cadence) grid.push(['Ø Trittfrequenz', `${done.avg_cadence}`]);
  if (done.training_load) grid.push(['Training Load', `${done.training_load}`]);
  if (w.perceived_effort) grid.push(['RPE', `${w.perceived_effort}/10`]);

  const laps = Array.isArray(done.laps) ? done.laps : (Array.isArray(done.splits) ? done.splits : []);
  const hasRoute = Array.isArray(done.route) && done.route.length > 1;
  const xMaxKm = Array.isArray(done.dist_stream) && done.dist_stream.length ? done.dist_stream[done.dist_stream.length - 1] : (isDistance ? +distKm : null);

  const charts = [
    { title: 'Herzfrequenz', data: done.hr_stream, color: '#EF4444', unit: 'bpm', extra: [['Ø', (done.avg_hr || w.avg_hr) && `${done.avg_hr || w.avg_hr} bpm`], ['Max', done.max_hr && `${done.max_hr} bpm`]] },
    { title: 'Höhe', data: done.alt_stream, color: '#9CA3AF', unit: 'm', extra: [['Anstieg', done.elevation_gain_m && `${done.elevation_gain_m} m`], ['Max', Array.isArray(done.alt_stream) && `${Math.max(...done.alt_stream.filter(Boolean))} m`]] },
    { title: 'Geschwindigkeit', data: done.speed_stream, color: '#3B82F6', unit: 'km/h', extra: [['Ø', done.avg_speed_kmh && `${done.avg_speed_kmh} km/h`], ['Max', done.max_speed_kmh && `${done.max_speed_kmh} km/h`]] },
  ].filter(c => Array.isArray(c.data) && c.data.length > 2);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg }}>
      {/* Schließen-Button über der Karte */}
      <TouchableOpacity onPress={onClose} hitSlop={8} style={{ position: 'absolute', top: 54, left: S.md, zIndex: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="chevron-down" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Feste interaktive Karte oben (zoomen/verschieben ohne Scroll-Konflikt) */}
      {hasRoute ? (
        <ActivityMap ref={mapRef} route={done.route} color={sc} height={300} />
      ) : (
        <View style={{ height: 90 }} />
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* Titel + Meta */}
        <View style={{ paddingHorizontal: S.lg, paddingTop: S.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons name={getSportMci(sport)} size={18} color={C.textSecondary} />
            <Text style={[T.caption, { color: C.textSecondary, flex: 1 }]} numberOfLines={1}>{subline}</Text>
          </View>
          <Text style={[T.h2, { color: C.text, marginTop: 4 }]}>{title}</Text>
        </View>

        {/* Kennzahlen-Raster */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: S.lg, marginTop: S.lg }}>
          {grid.map(([label, val], i) => (
            <View key={label} style={{ width: '50%', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, paddingRight: i % 2 === 0 ? S.md : 0 }}>
              <Text style={[T.caption, { color: C.textTertiary }]}>{label}</Text>
              <Text style={{ color: C.text, fontSize: 21, fontWeight: '700', letterSpacing: -0.3, marginTop: 2 }}>{val}</Text>
            </View>
          ))}
        </View>

        {/* Verlaufs-Diagramme */}
        {charts.map((ch) => (
          <View key={ch.title} style={{ marginTop: S.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: S.lg, marginBottom: S.sm }}>
              <Text style={[T.h3, { color: C.text }]}>{ch.title}</Text>
              <View style={{ flexDirection: 'row', gap: S.md }}>
                {ch.extra.filter(([, v]) => v).map(([l, v]) => (
                  <View key={l} style={{ alignItems: 'flex-end' }}>
                    <Text style={[T.label, { color: C.textTertiary }]}>{l}</Text>
                    <Text style={[T.bodyMed, { color: C.text }]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ paddingHorizontal: S.md }}>
              <AreaChart
                data={ch.data} color={ch.color} width={W - S.md * 2} height={140}
                unit={ch.unit} xMaxKm={xMaxKm}
                onScrub={(f) => { if (f == null) mapRef.current?.hide(); else mapRef.current?.showAt(f); }}
              />
            </View>
          </View>
        ))}

        {/* Runden / Splits */}
        {laps.length > 1 && (
          <View style={{ marginTop: S.xl, paddingHorizontal: S.lg }}>
            <Text style={[T.h3, { color: C.text, marginBottom: S.sm }]}>{done.laps ? 'Runden' : 'Splits'}</Text>
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

        {/* Aktionen */}
        {(actions?.length > 0 || onDelete) && (
          <View style={{ paddingHorizontal: S.lg, gap: S.sm, marginTop: S.xl }}>
            {actions?.map((a, i) => (
              <TouchableOpacity key={i} onPress={a.onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: a.primary ? C.accent : C.surface, borderRadius: R.md, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: a.primary ? C.accent : C.border }}>
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
