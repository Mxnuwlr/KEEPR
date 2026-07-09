/**
 * components/ActivityDetail.js — Einheiten-Detail (Strava/Komoot-Stil)
 *
 * Vollbild-Karte im Hintergrund + ziehbares Bottom-Sheet mit den Werten:
 *   - Sheet nach unten ziehen → Karte über den ganzen Bildschirm sichtbar
 *   - Sheet nach oben ziehen → alle Details (Kennzahlen, Diagramme, Runden)
 *   - Karten-Buttons rechts: Ebenen (Standard/Satellit/Hybrid), Zentrieren, Flyover ▶
 *   - Diagramm-Scrub bewegt den Punkt live auf der Karte
 */

// React/RN
import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Animated, PanResponder, Modal, Image } from 'react-native';

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

// Basiskarten mit echter Vorschau-Kachel (fester Ausschnitt) — wie im Strava-Picker
const BASES = [
  { key: 'standard', label: 'Standard', thumb: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/12/2172/1402.png' },
  { key: 'satellit', label: 'Satellit', thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1402/2172' },
  { key: 'hybrid', label: 'Hybrid', thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1402/2172' },
  { key: 'topo', label: 'Gelände', thumb: 'https://a.tile.opentopomap.org/12/2172/1402.png' },
];
const OVERLAYS = [
  { key: 'radwege', label: 'Radwege', icon: 'git-branch' },
  { key: 'relief', label: 'Relief', icon: 'triangle' },
];

export default function ActivityDetail({ workout, onClose, onDelete, actions }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const mapRef = useRef(null);
  const { height: screenH } = Dimensions.get('window');

  const w = workout || {};
  const done = w.exercisesCompleted || w.exercises_completed || {};
  const hasRoute = Array.isArray(done.route) && done.route.length > 1;

  // Bottom-Sheet über HÖHE (unten verankert) — so bleibt der Inhalt immer über
  // dem Home-Indikator sichtbar. Drei Rastpunkte als Höhen.
  const SNAP = hasRoute
    ? { low: Math.round(screenH * 0.16), mid: Math.round(screenH * 0.48), top: screenH - 66 }
    : { low: screenH, mid: screenH, top: screenH };
  const sheetH = useRef(new Animated.Value(SNAP.mid)).current;
  const curH = useRef(SNAP.mid);
  const [base, setBase] = useState('hybrid');
  const [overlays, setOverlays] = useState([]);
  const [layerModal, setLayerModal] = useState(false);
  const [flying, setFlying] = useState(false);

  const snapTo = (h) => {
    curH.current = h;
    Animated.spring(sheetH, { toValue: h, useNativeDriver: false, bounciness: 2, speed: 16 }).start();
    // Route in den sichtbaren (nicht vom Blatt verdeckten) Bereich einpassen: Blatt-Höhe = unteres Padding
    setTimeout(() => mapRef.current?.recenter(h), 260);
  };
  const nearest = (v) => [SNAP.top, SNAP.mid, SNAP.low].reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => hasRoute,
    onMoveShouldSetPanResponder: (e, g) => hasRoute && Math.abs(g.dy) > 4,
    onPanResponderMove: (e, g) => {
      const h = Math.max(SNAP.low, Math.min(SNAP.top, curH.current - g.dy)); // runterziehen (dy>0) → kleiner
      sheetH.setValue(h);
    },
    onPanResponderRelease: (e, g) => {
      const h = Math.max(SNAP.low, Math.min(SNAP.top, curH.current - g.dy));
      let target = nearest(h);
      if (g.vy > 0.6) target = h > SNAP.mid ? SNAP.mid : SNAP.low;       // schneller Wisch runter
      else if (g.vy < -0.6) target = h < SNAP.mid ? SNAP.mid : SNAP.top; // schneller Wisch hoch
      snapTo(target);
    },
  })).current;

  if (!workout) return null;

  const sport = w.sport_type || 'other';
  const sc = getSportColor(sport);
  const title = w.focus || w.title || 'Einheit';
  const W = Dimensions.get('window').width;

  const movingS = (w.duration_minutes || 0) * 60 || done.moving_time_s || 0;
  const distKm = w.distance || (done.distance ? done.distance / 1000 : null);
  const isDistance = ['run', 'bike', 'swim', 'row', 'hike'].includes(sport) && distKm;
  const paceSKm = isDistance && movingS && distKm ? movingS / distKm : null;

  let when = w.date || '';
  try {
    const dt = new Date((w.completed_at || w.date || '').replace(' ', 'T'));
    if (!isNaN(dt)) when = dt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
      + (w.completed_at && w.completed_at.includes(' ') ? ` · ${dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : '');
  } catch (e) {}
  const subline = [when, done.location, done.device].filter(Boolean).join(' · ');

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
  const xMaxKm = Array.isArray(done.dist_stream) && done.dist_stream.length ? done.dist_stream[done.dist_stream.length - 1] : (isDistance ? +distKm : null);
  const charts = [
    { title: 'Herzfrequenz', data: done.hr_stream, color: '#EF4444', unit: 'bpm', extra: [['Ø', (done.avg_hr || w.avg_hr) && `${done.avg_hr || w.avg_hr} bpm`], ['Max', done.max_hr && `${done.max_hr} bpm`]] },
    { title: 'Höhe', data: done.alt_stream, color: '#9CA3AF', unit: 'm', extra: [['Anstieg', done.elevation_gain_m && `${done.elevation_gain_m} m`], ['Max', Array.isArray(done.alt_stream) && `${Math.max(...done.alt_stream.filter(Boolean))} m`]] },
    { title: 'Geschwindigkeit', data: done.speed_stream, color: '#3B82F6', unit: 'km/h', extra: [['Ø', done.avg_speed_kmh && `${done.avg_speed_kmh} km/h`], ['Max', done.max_speed_kmh && `${done.max_speed_kmh} km/h`]] },
  ].filter(c => Array.isArray(c.data) && c.data.length > 2);

  const chooseBase = (name) => { setBase(name); mapRef.current?.applyLayers(name, overlays); };
  const toggleOverlay = (name) => {
    const next = overlays.includes(name) ? overlays.filter(o => o !== name) : [...overlays, name];
    setOverlays(next); mapRef.current?.applyLayers(base, next);
  };
  const toggleFly = () => {
    const next = !flying;
    setFlying(next);
    if (next) { snapTo(SNAP.low); setTimeout(() => { mapRef.current?.recenter(SNAP.low); mapRef.current?.flyover(); }, 340); }
    else mapRef.current?.flyover();
  };
  // Flyover fertig → zurück in den halbhohen „Banner"-Modus
  const onFlyEnd = () => { setFlying(false); snapTo(SNAP.mid); };

  const MapBtn = ({ icon, onPress, active }) => (
    <TouchableOpacity onPress={onPress} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: active ? '#FC4C02' : 'rgba(20,20,20,0.75)', alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={icon} size={19} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg }}>
      {/* Vollbild-Karte im Hintergrund */}
      {hasRoute && (
        <View style={StyleSheet.absoluteFill}>
          <ActivityMap ref={mapRef} route={done.route} color="#FC4C02" layer={base} bottomPad={SNAP.mid} onFlyEnd={onFlyEnd} />
        </View>
      )}

      {/* Zurück-Button oben links */}
      <TouchableOpacity onPress={onClose} hitSlop={8} style={{ position: 'absolute', top: 54, left: S.md, zIndex: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(20,20,20,0.75)', alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="chevron-left" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Karten-Buttons rechts */}
      {hasRoute && (
        <View style={{ position: 'absolute', top: 54, right: S.md, zIndex: 20, gap: 10 }}>
          <MapBtn icon="layers" onPress={() => setLayerModal(true)} />
          <MapBtn icon="crosshair" onPress={() => mapRef.current?.recenter(curH.current)} />
          <MapBtn icon="play" onPress={toggleFly} active={flying} />
        </View>
      )}

      {/* Bottom-Sheet mit Werten — unten verankert, Höhe animiert */}
      <Animated.View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: hasRoute ? sheetH : screenH,
          backgroundColor: C.bg, borderTopLeftRadius: hasRoute ? 20 : 0, borderTopRightRadius: hasRoute ? 20 : 0,
          shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 12,
          overflow: 'hidden',
        }}
      >
        {/* Ziehbarer Griff */}
        <View {...pan.panHandlers} style={{ paddingTop: hasRoute ? 8 : 54, paddingBottom: 4, alignItems: 'center' }}>
          {hasRoute && <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.borderStrong }} />}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
          {/* Titel + Meta */}
          <View style={{ paddingHorizontal: S.lg, paddingTop: 6 }}>
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

          {/* Diagramme */}
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

          {/* Intervall-Balkenprofil (wie bei geplanten Einheiten) */}
          {Array.isArray(done.laps) && done.laps.length > 1 && (() => {
            const metric = (lp) => lp.avg_watts || lp.avg_hr || (lp.distanz_m && lp.zeit_s ? lp.distanz_m / lp.zeit_s : 0) || 0;
            const maxM = Math.max(...done.laps.map(metric), 1);
            const totT = done.laps.reduce((a, lp) => a + (lp.zeit_s || 1), 0) || 1;
            const unit = done.laps.some(l => l.avg_watts) ? 'W' : done.laps.some(l => l.avg_hr) ? 'bpm' : '';
            return (
              <View style={{ marginTop: S.xl, paddingHorizontal: S.lg }}>
                <Text style={[T.h3, { color: C.text, marginBottom: S.sm }]}>Intervalle</Text>
                <View style={{ height: 90, flexDirection: 'row', alignItems: 'flex-end', gap: 2, backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                  {done.laps.slice(0, 60).map((lp, i) => {
                    const hPct = Math.max(0.08, metric(lp) / maxM);
                    const wPct = Math.max(0.5, ((lp.zeit_s || 1) / totT) * 100);
                    const isWork = lp.typ === 'WORK' || metric(lp) > maxM * 0.7;
                    return <View key={i} style={{ flexGrow: wPct, height: `${hPct * 100}%`, backgroundColor: isWork ? '#FC4C02' : sc + '99', borderRadius: 2 }} />;
                  })}
                </View>
                <Text style={[T.caption, { color: C.textTertiary, marginTop: 4 }]}>{done.laps.length} Intervalle{unit ? ` · Balkenhöhe = ${unit === 'W' ? 'Leistung' : 'Puls'}` : ''}</Text>
              </View>
            );
          })()}

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
      </Animated.View>

      {/* Karten-Picker (Kartentypen / Ebenen / Gelände) */}
      <Modal visible={layerModal} transparent animationType="slide" onRequestClose={() => setLayerModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setLayerModal(false)} />
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: S.md, paddingBottom: 40, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: S.lg }}>
              <TouchableOpacity onPress={() => setLayerModal(false)} hitSlop={8}><Feather name="x" size={22} color={C.text} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: S.lg, paddingTop: S.sm }} showsVerticalScrollIndicator={false}>
              {/* Kartentypen */}
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                {BASES.map(b => {
                  const active = base === b.key;
                  return (
                    <TouchableOpacity key={b.key} onPress={() => chooseBase(b.key)} style={{ flex: 1, alignItems: 'center' }}>
                      <Image source={{ uri: b.thumb }} style={{ width: '100%', aspectRatio: 1, borderRadius: R.md, borderWidth: 2, borderColor: active ? '#FC4C02' : C.border, backgroundColor: C.surface }} />
                      <Text style={[T.label, { color: active ? '#FC4C02' : C.textSecondary, marginTop: 6 }]}>{b.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Ebenen / Gelände (Overlays zum Ein-/Ausschalten) */}
              <Text style={[T.h3, { color: C.text, marginTop: S.xl, marginBottom: S.sm }]}>Ebenen</Text>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                {OVERLAYS.map(o => {
                  const active = overlays.includes(o.key);
                  return (
                    <TouchableOpacity key={o.key} onPress={() => toggleOverlay(o.key)} style={{ width: '31%', alignItems: 'center', paddingVertical: S.md, borderRadius: R.md, backgroundColor: active ? '#FC4C02' + '18' : C.surface, borderWidth: 1.5, borderColor: active ? '#FC4C02' : C.border }}>
                      <Feather name={o.icon} size={22} color={active ? '#FC4C02' : C.textSecondary} />
                      <Text style={[T.label, { color: active ? '#FC4C02' : C.textSecondary, marginTop: 6 }]}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[T.caption, { color: C.textTertiary, marginTop: S.lg, lineHeight: 17 }]}>
                Heatmaps sowie Lawinen-/Neigungs-Karten sind proprietäre Strava-Daten und stehen hier nicht zur Verfügung.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
