/**
 * screens/mobility/MobilityAssessmentScreen.js — Mobilitäts-Test (Sensor)
 *
 * Führt durch alle Tests (je Seite). Misst den Bewegungswinkel per Handy-Sensor
 * (useGoniometer), mit manuellem Eingabe-Fallback (falls Sensor nicht verfügbar
 * oder zur Korrektur). Am Ende: Score berechnen + speichern.
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput, PanResponder, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../../store';
import { useTheme } from '../../theme';
import { MOBILITY_TESTS, getZone, computeMobilityScore, testsForProfile, quickTestsForProfile } from '../../data/mobility';
import { useGoniometer } from '../../utils/goniometer';
import { api, getBaseUrl } from '../../api/client';

// Scrub-Video: spult zur Reglerposition (fraction 0..1). Guarded — ohne expo-video → null.
let ScrubVideo = null;
try {
  const { VideoView, useVideoPlayer } = require('expo-video');
  ScrubVideo = function ScrubVideo({ uri, fraction, style }) {
    const player = useVideoPlayer(uri, (p) => { p.muted = true; p.pause(); });
    useEffect(() => {
      if (!player) return;
      const d = player.duration || 0;
      if (d > 0) { try { player.currentTime = Math.max(0, Math.min(d, fraction * d)); } catch (e) {} }
    }, [fraction, player]);
    return <VideoView player={player} style={style} contentFit="contain" nativeControls={false} />;
  };
} catch (e) { ScrubVideo = null; }

// Eigener Touch-Regler 0–100 (kein natives Modul, läuft überall).
function RangeSlider({ value, onChange, color, trackColor, thumbColor }) {
  const widthRef = useRef(0);
  const cb = useRef(onChange); cb.current = onChange;
  const set = (x) => { const w = widthRef.current || 1; cb.current(Math.max(0, Math.min(100, Math.round((x / w) * 100)))); };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
    onPanResponderMove: (e) => set(e.nativeEvent.locationX),
  })).current;
  return (
    <View {...pan.panHandlers} onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }} style={{ height: 44, justifyContent: 'center' }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: trackColor }}>
        <View style={{ height: 6, borderRadius: 3, width: `${value}%`, backgroundColor: color }} />
      </View>
      <View style={{ position: 'absolute', left: `${value}%`, marginLeft: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: thumbColor, borderWidth: 3, borderColor: color }} />
    </View>
  );
}

// Tests in Einzel-Messungen (je Seite) auflösen
function buildSteps(tests) {
  const steps = [];
  for (const t of (tests || MOBILITY_TESTS)) {
    if (t.sides === 'both') {
      steps.push({ test: t, side: 'left', label: 'Linke Seite' });
      steps.push({ test: t, side: 'right', label: 'Rechte Seite' });
    } else {
      steps.push({ test: t, side: 'value', label: null });
    }
  }
  return steps;
}

export default function MobilityAssessmentScreen({ navigation, route }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { saveMobilityResult, user, mobilityResult } = useStore();
  const gonio = useGoniometer();
  // Quick nur möglich, wenn bereits ein Voll-Check als Basis existiert — sonst Voll-Check.
  const mode = (route?.params?.mode === 'quick' && mobilityResult?.results) ? 'quick' : 'full';

  const steps = useMemo(() => buildSteps(
    mode === 'quick'
      ? quickTestsForProfile(user?.sportTypes, mobilityResult?.byZone)
      : testsForProfile(user?.sportTypes)
  ), [user, mode, mobilityResult]);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState({});
  const [measured, setMeasured] = useState(null);
  const [manual, setManual] = useState('');
  const [saving, setSaving] = useState(false);
  const [swSec, setSwSec] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [mediaVideos, setMediaVideos] = useState(() => new Set());
  const swRef = useRef(null);

  useEffect(() => { api.getMobilityMedia().then((m) => setMediaVideos(new Set(m?.video || []))).catch(() => {}); }, []);

  const step = steps[idx];
  const total = steps.length;
  const isTime = step?.test?.type === 'time';
  const isRange = step?.test?.type === 'range';
  const videoSlug = step?.test?.videoSlug || null;
  const hasScrubVideo = isRange && videoSlug && mediaVideos.has(videoSlug) && !!ScrubVideo;
  const scrubUri = videoSlug ? `${getBaseUrl()}/uploads/mobility/${videoSlug}.mp4` : null;

  useEffect(() => {
    gonio.reset(); setMeasured(null); setManual('');
    setSwSec(0); setSwRunning(false); if (swRef.current) clearInterval(swRef.current);
  }, [idx]);
  useEffect(() => () => { if (swRef.current) clearInterval(swRef.current); }, []);

  const takeSensor = async () => {
    if (gonio.running) { setMeasured(gonio.stop()); } else { await gonio.start(); }
  };
  const toggleStopwatch = () => {
    if (swRunning) {
      clearInterval(swRef.current); setSwRunning(false); setMeasured(swSec);
    } else {
      setMeasured(null); setSwSec(0); setSwRunning(true);
      swRef.current = setInterval(() => setSwSec((s) => s + 1), 1000);
    }
  };

  const accept = async () => {
    const val = measured != null ? measured : (parseInt(manual) || null);
    if (val == null || (val <= 0 && step.test.type !== 'range')) return Alert.alert('Wert fehlt', step.test.type === 'range' ? 'Bitte den Regler auf deine Position schieben.' : 'Bitte einen Wert messen oder eingeben.');
    const next = { ...results };
    next[step.test.id] = next[step.test.id] || {};
    next[step.test.id][step.side] = val;
    setResults(next);
    if (idx < total - 1) {
      setIdx(idx + 1);
    } else {
      // Fertig → Score berechnen + speichern
      setSaving(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        // Quick-Check: neue Messungen in den letzten Voll-Check einmischen (Score bleibt
        // umfassend & vergleichbar). Voll-Check: frisch starten.
        const base = mode === 'quick' ? (mobilityResult?.results || {}) : {};
        const prevMeta = base.__meta || {};
        const merged = { ...base, ...next };
        merged.__meta = { mode, fullDate: mode === 'full' ? today : (prevMeta.fullDate || null) };
        const score = computeMobilityScore(merged);
        await saveMobilityResult({
          date: today,
          results: merged,
          overall: score.overall,
          byZone: score.byZone,
          byTest: score.byTest,
        });
        navigation.goBack();
      } catch (e) {
        Alert.alert('Fehler', e.message || 'Konnte nicht gespeichert werden.');
        setSaving(false);
      }
    }
  };

  const liveVal = isRange
    ? (measured != null ? measured : 0)
    : isTime
      ? (swRunning ? swSec : (measured != null ? measured : 0))
      : (gonio.running ? gonio.angle : (measured != null ? measured : 0));
  const unit = isRange ? '%' : isTime ? 's' : '°';
  const activeRun = isTime ? swRunning : gonio.running;
  const valActive = activeRun || (isRange && measured != null);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingTop: insets.top + 8, paddingBottom: S.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}><Feather name="x" size={22} color={C.text} /></TouchableOpacity>
        <Text style={[T.bodyMed, { color: C.text, flex: 1 }]}>{mode === 'quick' ? 'Schnell-Check' : 'Voll-Check'}</Text>
        <Text style={[T.caption, { color: C.textTertiary }]}>{idx + 1} / {total}</Text>
      </View>

      {/* Fortschritt */}
      <View style={{ height: 3, backgroundColor: C.bgTertiary }}>
        <View style={{ height: '100%', width: `${((idx) / total) * 100}%`, backgroundColor: C.accent }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 40 }}>
        <Text style={[T.label, { color: C.tint, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{getZone(step.test.zone)?.label}</Text>
        <Text style={[T.h2, { color: C.text, marginTop: 2 }]}>{step.test.name}</Text>
        {step.label && <Text style={[T.bodyMed, { color: C.textSecondary, marginTop: 2 }]}>{step.label}</Text>}

        {/* Anleitung */}
        <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginTop: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.sm }}>
            <Feather name="smartphone" size={15} color={C.tint} style={{ marginTop: 1 }} />
            <Text style={[T.caption, { color: C.textSecondary, flex: 1, lineHeight: 18 }]}>{step.test.placement}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <Feather name="move" size={15} color={C.tint} style={{ marginTop: 1 }} />
            <Text style={[T.caption, { color: C.textSecondary, flex: 1, lineHeight: 18 }]}>{step.test.movement}</Text>
          </View>
        </View>

        {/* Winkel-Anzeige */}
        <View style={{ alignItems: 'center', marginTop: S.xl }}>
          <Text style={{ color: valActive ? C.accent : C.text, fontSize: 72, fontWeight: '800', letterSpacing: -2 }}>{liveVal}{unit}</Text>
          <Text style={[T.caption, { color: C.textTertiary }]}>
            {isRange
              ? (hasScrubVideo ? 'Schieb den Regler bis zu deiner Position — das Video spult mit.' : 'Schätze ein, wie weit du kommst (0–100 %).')
              : activeRun
                ? (isTime ? 'Stoppe, sobald du das Gleichgewicht verlierst…' : 'Bewege dich langsam bis zum Maximum…')
                : (measured != null ? 'Erfasst — übernehmen oder neu messen' : `Referenz für 100%: ${isTime ? step.test.refSec + 's' : step.test.refDeg + '°'}`)}
          </Text>
        </View>

        {/* Mess-Steuerung: Scrub-Regler (Video), Stoppuhr (Balance) oder Sensor (Winkel) */}
        {isRange ? (
          <View style={{ marginTop: S.lg }}>
            {hasScrubVideo ? (
              <View style={{ width: '100%', aspectRatio: 3 / 4, maxHeight: 360, alignSelf: 'center', borderRadius: R.xl, overflow: 'hidden', backgroundColor: C.bgTertiary, marginBottom: S.md }}>
                <ScrubVideo key={scrubUri} uri={scrubUri} fraction={(measured ?? 0) / 100} style={{ width: '100%', height: '100%' }} />
              </View>
            ) : (
              <View style={{ backgroundColor: C.warning + '12', borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.warning + '40' }}>
                <Text style={[T.caption, { color: C.warning }]}>Noch kein Video für diese Übung — schätze deine Reichweite selbst ein (0–100 %).</Text>
              </View>
            )}
            <RangeSlider value={measured ?? 0} onChange={(v) => { setMeasured(v); setManual(''); }} color={C.accent} trackColor={C.bgTertiary} thumbColor={C.accentText} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
              <Text style={[T.caption, { color: C.textTertiary }]}>0 % (Start)</Text>
              <Text style={[T.caption, { color: C.textTertiary }]}>100 % (volle Bewegung)</Text>
            </View>
          </View>
        ) : isTime ? (
          <TouchableOpacity
            onPress={toggleStopwatch}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: swRunning ? C.danger : C.accent, borderRadius: R.lg, paddingVertical: 15, marginTop: S.lg }}
          >
            <Feather name={swRunning ? 'square' : 'play'} size={18} color={C.accentText} />
            <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>{swRunning ? 'Stopp & übernehmen' : 'Stoppuhr starten'}</Text>
          </TouchableOpacity>
        ) : gonio.available ? (
          <TouchableOpacity
            onPress={takeSensor}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: gonio.running ? C.danger : C.accent, borderRadius: R.lg, paddingVertical: 15, marginTop: S.lg }}
          >
            <Feather name={gonio.running ? 'square' : 'play'} size={18} color={C.accentText} />
            <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>{gonio.running ? 'Stopp & übernehmen Wert' : 'Messung starten'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ marginTop: S.lg, backgroundColor: C.warning + '12', borderRadius: R.md, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.warning + '40' }}>
            <Text style={[T.caption, { color: C.warning }]}>Bewegungssensor nicht verfügbar (braucht den nativen Build). Gib den Winkel unten manuell ein.</Text>
          </View>
        )}

        {/* Manuelle Eingabe / Korrektur (nicht beim Scrub-Regler) */}
        {!isRange && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.md }}>
            <Text style={[T.caption, { color: C.textTertiary }]}>Manuell ({isTime ? 'Sekunden' : 'Grad'}):</Text>
            <TextInput
              style={{ flex: 1, backgroundColor: C.bgSecondary, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, color: C.text, paddingHorizontal: S.md, paddingVertical: 8, fontSize: 15 }}
              value={manual}
              onChangeText={(v) => { setManual(v); setMeasured(null); }}
              keyboardType="number-pad"
              placeholder={`${isTime ? step.test.refSec : step.test.refDeg}`}
              placeholderTextColor={C.textTertiary}
            />
          </View>
        )}

        {/* Übernehmen / Weiter */}
        <TouchableOpacity
          onPress={accept}
          disabled={saving}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.tint, borderRadius: R.lg, paddingVertical: 15, marginTop: S.lg, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? <ActivityIndicator size="small" color={C.tintText} /> : <Feather name={idx < total - 1 ? 'arrow-right' : 'check'} size={18} color={C.tintText} />}
          <Text style={[T.bodyMed, { color: C.tintText, fontWeight: '700' }]}>{idx < total - 1 ? 'Übernehmen & weiter' : 'Test abschließen'}</Text>
        </TouchableOpacity>

        {idx > 0 && !saving && (
          <TouchableOpacity onPress={() => setIdx(idx - 1)} style={{ alignItems: 'center', paddingVertical: S.md }}>
            <Text style={[T.caption, { color: C.textTertiary }]}>Zurück</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
