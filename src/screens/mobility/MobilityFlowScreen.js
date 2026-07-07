/**
 * screens/mobility/MobilityFlowScreen.js — Geführter Mobility-Flow (Player)
 *
 * Läuft wie ein geführtes Video: Übung für Übung mit Countdown-Timer, Cues,
 * Fortschritt, Pause/Weiter/Zurück. Am Ende wird die Einheit geloggt
 * (sport_type 'mobility' → zählt im Plan/Kalender + Kalorien).
 *
 * route.params: { flow, sessionId?, planId?, dayIndex? }
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../../store';
import { useTheme } from '../../theme';
import { getZone } from '../../data/mobility';
import { estimateActivityCalories } from '../../data/sports';
import { getSmoothedWeight } from '../../utils/coaching';

// Video-Clip-Player — guarded: funktioniert erst nach `expo install expo-video` + Dev-Build.
// Fehlt das Modul (z.B. Expo Go), bleibt ClipPlayer null → Fallback auf Poster-Bild/Cues.
let ClipPlayer = null;
try {
  const { VideoView, useVideoPlayer } = require('expo-video');
  ClipPlayer = function ClipPlayer({ uri, style }) {
    const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; p.play(); });
    return <VideoView player={player} style={style} contentFit="contain" nativeControls={false} />;
  };
} catch (e) { ClipPlayer = null; }

// Flow-Übungen in einzelne Timer-Phasen auflösen (Seiten getrennt)
function buildPhases(flow) {
  const phases = [];
  (flow?.exercises || []).forEach((ex) => {
    const sec = Math.max(10, parseInt(ex.durationSec) || 30);
    if (ex.side === 'both') {
      phases.push({ ex, side: 'Links', sec });
      phases.push({ ex, side: 'Rechts', sec });
    } else {
      phases.push({ ex, side: null, sec });
    }
  });
  return phases;
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function MobilityFlowScreen({ navigation, route }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, weightAnalysis, completeWorkout } = useStore();
  const flow = route?.params?.flow;
  const params = route?.params || {};

  const phases = useMemo(() => buildPhases(flow), [flow]);
  const totalSec = useMemo(() => phases.reduce((a, p) => a + p.sec, 0), [phases]);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(phases[0]?.sec || 0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const timer = useRef(null);

  const phase = phases[idx];

  // Countdown — läuft erst, wenn der Nutzer den Flow gestartet hat
  useEffect(() => {
    if (!started || done || paused || !phase) return;
    timer.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(timer.current); goNext(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer.current);
  }, [idx, paused, done, started]);

  useEffect(() => { setRemaining(phases[idx]?.sec || 0); }, [idx]);

  const goNext = () => {
    if (idx < phases.length - 1) setIdx(idx + 1);
    else finish();
  };
  const goPrev = () => { if (idx > 0) setIdx(idx - 1); };

  const finish = async () => {
    clearInterval(timer.current);
    setDone(true);
    try {
      const mins = Math.max(1, Math.round(totalSec / 60));
      const w = getSmoothedWeight(weightAnalysis, user) || user?.weight;
      await completeWorkout({
        sessionId: params.sessionId || null,
        planId: params.planId || null,
        date: new Date().toISOString().split('T')[0],
        dayIndex: params.dayIndex ?? null,
        sportType: 'mobility',
        title: flow?.name || 'Mobility-Flow',
        focus: flow?.name || 'Mobility-Flow',
        durationMinutes: mins,
        calories: estimateActivityCalories('mobility', mins, w),
        manualActivity: !params.sessionId,
      });
    } catch (e) { /* Logging best-effort */ }
  };

  if (!flow || phases.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: S.lg }}>
        <Text style={[T.body, { color: C.textSecondary }]}>Kein Flow geladen.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: S.md }}><Text style={[T.bodyMed, { color: C.tint }]}>Zurück</Text></TouchableOpacity>
      </View>
    );
  }

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: S.lg }}>
        <Feather name="check-circle" size={52} color={C.success} style={{ marginBottom: S.md }} />
        <Text style={[T.h2, { color: C.text, marginBottom: S.xs }]}>Flow abgeschlossen!</Text>
        <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.xl, textAlign: 'center' }]}>
          {flow.name} · {Math.round(totalSec / 60)} Min · als Mobility-Einheit gespeichert.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ backgroundColor: C.accent, borderRadius: R.lg, paddingVertical: 14, paddingHorizontal: 32 }}>
          <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>Fertig</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Übersicht vor dem Start (Übungsliste wie im Kraft-Tab) ──
  if (!started) {
    const exList = flow.exercises || [];
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.sm }}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Feather name="x" size={24} color={C.text} />
          </TouchableOpacity>
          <Text style={[T.bodyMed, { color: C.text, flex: 1, textAlign: 'center' }]} numberOfLines={1}>Übersicht</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
          <Text style={[T.h2, { color: C.text, marginBottom: S.xs }]}>{flow.name}</Text>
          <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.lg }]}>
            {exList.length} Übung{exList.length !== 1 ? 'en' : ''} · {Math.round(totalSec / 60)} Min · {phases.length} Schritte
          </Text>

          <View style={{ gap: S.sm }}>
            {exList.map((ex, i) => {
              const secs = Math.max(10, parseInt(ex.durationSec) || 30);
              const meta = [
                getZone(ex.zone)?.label || ex.zone,
                `${secs} Sek${ex.side === 'both' ? ' / Seite' : ''}`,
              ].filter(Boolean).join(' · ');
              return (
                <View key={i} style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.md, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', gap: S.md }}>
                  <View style={{ width: 30, alignItems: 'center' }}>
                    <Text style={{ color: C.textTertiary, fontSize: 15, fontWeight: '700' }}>{i + 1}</Text>
                  </View>
                  {ex.posterUrl ? (
                    <Image source={{ uri: ex.posterUrl }} style={{ width: 46, height: 46, borderRadius: R.sm, backgroundColor: C.bgTertiary }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: 46, height: 46, borderRadius: R.sm, backgroundColor: C.bgTertiary, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="activity" size={18} color={C.tint} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[T.bodyMed, { color: C.text }]}>{ex.name}</Text>
                    <Text style={[T.caption, { color: C.textSecondary, marginTop: 2 }]}>{meta}</Text>
                    {ex.cues ? <Text style={[T.caption, { color: C.textTertiary, marginTop: 2 }]} numberOfLines={2}>{ex.cues}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Start button */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: S.lg, paddingBottom: insets.bottom + S.md, backgroundColor: C.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }}>
          <TouchableOpacity onPress={() => setStarted(true)} style={{ backgroundColor: C.accent, borderRadius: R.lg, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm }}>
            <Feather name="play" size={18} color={C.accentText} />
            <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '800', fontSize: 16 }]}>Flow starten</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasMedia = !!(phase.ex.videoUrl || phase.ex.posterUrl);
  const progress = (idx + (1 - remaining / (phase.sec || 1))) / phases.length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      {/* Top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.sm }}>
        <TouchableOpacity onPress={() => Alert.alert('Flow beenden?', 'Fortschritt geht verloren.', [{ text: 'Weiter', style: 'cancel' }, { text: 'Beenden', style: 'destructive', onPress: () => navigation.goBack() }])} hitSlop={8}>
          <Feather name="x" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.bodyMed, { color: C.text, flex: 1, textAlign: 'center' }]} numberOfLines={1}>{flow.name}</Text>
        <Text style={[T.caption, { color: C.textTertiary }]}>{idx + 1}/{phases.length}</Text>
      </View>
      {/* Progress */}
      <View style={{ height: 4, backgroundColor: C.bgTertiary, marginHorizontal: S.md, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${Math.min(100, progress * 100)}%`, backgroundColor: C.accent }} />
      </View>

      {/* Main */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.lg }}>
        <Text style={[T.label, { color: C.tint, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
          {getZone(phase.ex.zone)?.label || phase.ex.zone}{phase.side ? ` · ${phase.side}` : ''}
        </Text>
        <Text style={[T.h2, { color: C.text, textAlign: 'center', marginTop: S.xs, marginBottom: S.lg }]}>{phase.ex.name}</Text>

        {hasMedia ? (
          <>
            {/* Medien-Box: Video wenn verfügbar, sonst Standbild */}
            <View style={{ width: '100%', aspectRatio: 3 / 4, maxHeight: 360, alignSelf: 'center', borderRadius: R.xl, overflow: 'hidden', backgroundColor: C.bgTertiary }}>
              {phase.ex.videoUrl && ClipPlayer ? (
                <ClipPlayer key={phase.ex.videoUrl} uri={phase.ex.videoUrl} style={{ width: '100%', height: '100%' }} />
              ) : phase.ex.posterUrl ? (
                <Image source={{ uri: phase.ex.posterUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : null}
            </View>
            {/* Countdown als Pille unter dem Medium */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.lg }}>
              <Feather name="clock" size={18} color={paused ? C.warning : C.accent} />
              <Text style={{ color: paused ? C.warning : C.text, fontSize: 32, fontWeight: '800' }}>{fmt(remaining)}</Text>
            </View>
            {phase.ex.cues ? (
              <Text style={[T.body, { color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: S.sm }]}>{phase.ex.cues}</Text>
            ) : null}
          </>
        ) : (
          <>
            {/* Kein Medium → großer Countdown-Ring + Cues */}
            <View style={{ width: 200, height: 200, borderRadius: 100, borderWidth: 6, borderColor: paused ? C.warning : C.accent, alignItems: 'center', justifyContent: 'center', marginVertical: S.xl }}>
              <Text style={{ color: C.text, fontSize: 56, fontWeight: '800' }}>{fmt(remaining)}</Text>
            </View>
            {phase.ex.cues ? (
              <Text style={[T.body, { color: C.textSecondary, textAlign: 'center', lineHeight: 22 }]}>{phase.ex.cues}</Text>
            ) : null}
          </>
        )}
      </View>

      {/* Controls */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xl, paddingBottom: insets.bottom + S.lg }}>
        <TouchableOpacity onPress={goPrev} disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }} hitSlop={10}>
          <Feather name="skip-back" size={28} color={C.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPaused((p) => !p)}
          style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name={paused ? 'play' : 'pause'} size={32} color={C.accentText} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goNext} hitSlop={10}>
          <Feather name="skip-forward" size={28} color={C.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
