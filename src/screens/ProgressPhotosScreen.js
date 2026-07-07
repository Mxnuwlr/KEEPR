/**
 * screens/ProgressPhotosScreen.js — Fortschrittsfotos (Physique-Tracking)
 *
 * Nutzer macht alle ~4 Wochen Fotos in 4 festen Posen (entspannt/angespannt, vorne/
 * seite/rücken). Bei der Aufnahme wird das letzte Foto derselben Pose halbtransparent
 * als „Geist" über die Live-Kamera gelegt → gleiche Position → vergleichbare Fotos.
 * Speicherung account-gebunden auf dem Pi (geräteübergreifend). KI-Analyse: Phase B.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Image, Alert, ActivityIndicator, Dimensions, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useStore } from '../store';
import { useTheme } from '../theme';

// Guarded — expo-camera braucht Dev-Build; fehlt es, Fallback-Hinweis.
let CameraView = null, useCameraPermissions = null;
try { ({ CameraView, useCameraPermissions } = require('expo-camera')); } catch (e) {}
let ImagePicker = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) {}

export const PROGRESS_POSES = [
  { key: 'front_relaxed', label: 'Vorne entspannt', hint: 'Frontal zur Kamera, ganzer Körper im Bild. Arme locker seitlich, Füße hüftbreit, aufrecht & natürlich stehen — NICHT anspannen.' },
  { key: 'front_flexed', label: 'Vorne angespannt', hint: 'Frontal zur Kamera. Brust raus, Bauch & Arme anspannen (z.B. Arme unten anspannen oder Front-Doppelbizeps). Ganzer Oberkörper sichtbar.' },
  { key: 'side', label: 'Seite', hint: 'Seitlich (90°) zur Kamera, Blick geradeaus, Arme locker an der Seite. Zeigt Bauch-/Rückenprofil & Haltung.' },
  { key: 'back_flexed', label: 'Rücken angespannt', hint: 'Rücken zur Kamera. Arme anwinkeln und Rücken breit machen (Lats spreizen). Ganzer Oberkörper im Bild.' },
];
// Allgemeine Aufnahme-Tipps für vergleichbare Fotos
const FRAMING_TIP = 'Ganzer Körper im Bild · ~2–3 m Abstand · gutes, gleichmäßiges Licht · möglichst gleiche Kleidung, gleicher Ort & Uhrzeit wie beim letzten Mal.';
const TIMER_OPTIONS = [0, 3, 5, 10];
const POSE_LABEL = PROGRESS_POSES.reduce((m, p) => { m[p.key] = p.label; return m; }, {});

const daysSince = (d) => d ? Math.floor((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000) : null;
const fmtDate = (d) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: '2-digit' }); } catch (e) { return d; } };

export default function ProgressPhotosScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { progressPhotos, fetchProgressPhotos, uploadProgressPhoto, deleteProgressPhoto, analyzeProgress, progressAnalysis, fetchProgressAnalysis, user } = useStore();
  // Reminder nur, wenn das Ziel eine Körperveränderung ist (abnehmen/aufbauen/muskel)
  const bodyGoal = useMemo(() => {
    const g = user?.goal;
    const arr = typeof g === 'string' ? g.split(',') : (Array.isArray(g) ? g : []);
    return arr.map((x) => String(x).trim()).some((x) => ['lose', 'gain', 'muscle'].includes(x));
  }, [user]);
  const camPerm = useCameraPermissions ? useCameraPermissions() : [null, async () => ({ granted: false })];
  const permission = camPerm[0]; const requestPermission = camPerm[1];

  const [capturing, setCapturing] = useState(false);
  const [poseIdx, setPoseIdx] = useState(0);
  const [facing, setFacing] = useState('back');
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState(null); // { uri, label, date }
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [enabled, setEnabled] = useState(true); // Erinnerungen an/aus
  const [timerSec, setTimerSec] = useState(0); // Selbstauslöser: 0=aus, 3/5/10s
  const [countdown, setCountdown] = useState(null); // laufender Countdown
  const camRef = useRef(null);
  const cdRef = useRef(null);
  useEffect(() => () => { if (cdRef.current) clearInterval(cdRef.current); }, []);

  useEffect(() => { fetchProgressPhotos(); fetchProgressAnalysis(); }, []);
  // Schalter laden — Default = Körperziel (an), sonst aus; gespeicherte Wahl hat Vorrang
  useEffect(() => {
    AsyncStorage.getItem('progress_photos_enabled').then((v) => {
      setEnabled(v == null ? bodyGoal : v === '1');
    }).catch(() => {});
  }, [bodyGoal]);
  const toggleEnabled = (v) => { setEnabled(v); AsyncStorage.setItem('progress_photos_enabled', v ? '1' : '0').catch(() => {}); };

  // Gruppieren: byPose[pose] = [fotos neueste zuerst]; dates = sortierte Check-in-Tage
  const { byPose, dates, lastDate } = useMemo(() => {
    const bp = {};
    for (const p of PROGRESS_POSES) bp[p.key] = [];
    (progressPhotos || []).forEach((ph) => { if (bp[ph.pose]) bp[ph.pose].push(ph); });
    const ds = [...new Set((progressPhotos || []).map((p) => p.date))].sort().reverse();
    return { byPose: bp, dates: ds, lastDate: ds[0] || null };
  }, [progressPhotos]);

  const since = daysSince(lastDate);
  const due = since == null || since >= 28;

  // letztes Foto einer Pose (für Geist-Overlay)
  const ghostFor = (poseKey) => (byPose[poseKey] && byPose[poseKey][0]) ? byPose[poseKey][0].imageUrl : null;

  const startCapture = async () => {
    if (!CameraView) { Alert.alert('Kamera nicht verfügbar', 'Die Kamera braucht einen Dev-Build (nicht Expo Go).'); return; }
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r?.granted) { Alert.alert('Kein Kamerazugriff', 'Bitte Kamerazugriff erlauben.'); return; }
    }
    setPoseIdx(0); setCapturing(true);
  };

  const today = new Date().toISOString().split('T')[0];

  const savePhoto = async (uri) => {
    await uploadProgressPhoto(uri, today, PROGRESS_POSES[poseIdx].key);
    if (poseIdx < PROGRESS_POSES.length - 1) {
      setPoseIdx(poseIdx + 1);
    } else {
      setCapturing(false);
      Alert.alert('Fertig', 'Alle 4 Fotos gespeichert. In 4 Wochen geht’s weiter.');
    }
  };

  const doCapture = async () => {
    if (!camRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 0.5, skipProcessing: false });
      await savePhoto(photo.uri);
    } catch (e) { Alert.alert('Fehler', e.message || 'Foto konnte nicht gespeichert werden.'); }
    finally { setBusy(false); }
  };

  // Auslöser: mit Selbstauslöser (Countdown) oder sofort
  const onShutter = () => {
    if (busy || countdown != null) return;
    if (timerSec > 0) {
      let n = timerSec;
      setCountdown(n);
      cdRef.current = setInterval(() => {
        n -= 1;
        if (n <= 0) { clearInterval(cdRef.current); cdRef.current = null; setCountdown(null); doCapture(); }
        else setCountdown(n);
      }, 1000);
    } else {
      doCapture();
    }
  };

  // Foto aus der Galerie für die aktuelle Pose wählen
  const pickFromGallery = async () => {
    if (!ImagePicker) { Alert.alert('Galerie nicht verfügbar', 'Braucht einen Dev-Build (nicht Expo Go).'); return; }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm?.granted) { Alert.alert('Kein Zugriff', 'Bitte Zugriff auf die Fotomediathek erlauben.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : undefined });
      if (res.canceled) return;
      const uri = res.assets && res.assets[0] && res.assets[0].uri;
      if (!uri) return;
      setBusy(true);
      await savePhoto(uri);
    } catch (e) { Alert.alert('Fehler', e.message || 'Foto konnte nicht geladen werden.'); }
    finally { setBusy(false); }
  };

  const confirmDelete = (ph) => {
    Alert.alert('Foto löschen?', `${POSE_LABEL[ph.pose]} · ${fmtDate(ph.date)}`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => deleteProgressPhoto(ph.id) },
    ]);
  };

  const runAnalysis = async () => {
    if (dates.length < 1) { Alert.alert('Foto nötig', 'Mach zuerst ein Check-in (Fotos) — dann kann die KI es analysieren.'); return; }
    setAnalyzing(true);
    try { await analyzeProgress(); setShowAnalysis(true); }
    catch (e) { Alert.alert('Analyse fehlgeschlagen', e.message || 'Bitte später nochmal.'); }
    finally { setAnalyzing(false); }
  };

  const W = Dimensions.get('window').width;
  const ghost = capturing ? ghostFor(PROGRESS_POSES[poseIdx].key) : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingTop: insets.top + 8, paddingBottom: S.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        {navigation && <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}><Feather name="chevron-left" size={24} color={C.text} /></TouchableOpacity>}
        <Text style={[T.bodyMed, { color: C.text, flex: 1 }]}>Fortschrittsfotos</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 120 }}>
        {/* An/Aus-Schalter für Erinnerungen */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="bell" size={16} color={C.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={[T.body, { color: C.text }]}>Erinnerungen</Text>
            <Text style={[T.caption, { color: C.textTertiary }]}>{enabled ? 'Alle 4 Wochen ans Check-in erinnern' : 'Aus — keine Anfragen'}</Text>
          </View>
          <Switch value={enabled} onValueChange={toggleEnabled} trackColor={{ true: C.accent }} />
        </View>

        {/* Reminder — nur wenn Erinnerungen an */}
        {enabled && due && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.accent + '14', borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.accent + '40' }}>
            <Feather name="camera" size={16} color={C.accent} />
            <Text style={[T.caption, { color: C.textSecondary, flex: 1 }]}>
              {lastDate ? `Letztes Foto vor ${since} Tagen — Zeit fürs nächste Check-in.` : 'Mach dein erstes Fortschritts-Check-in (4 Fotos).'}
            </Text>
          </View>
        )}

        {/* Aktionen */}
        <TouchableOpacity onPress={startCapture} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.accent, borderRadius: R.lg, paddingVertical: 15 }}>
          <Feather name="camera" size={18} color={C.accentText} />
          <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>Check-in-Foto machen (4 Posen)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={runAnalysis}
          disabled={analyzing}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.lg, paddingVertical: 13, marginTop: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: dates.length >= 1 ? C.accent : C.border, opacity: analyzing ? 0.6 : 1 }}
        >
          {analyzing ? <ActivityIndicator size="small" color={C.accent} /> : <Feather name="cpu" size={16} color={dates.length >= 1 ? C.accent : C.textSecondary} />}
          <Text style={[T.bodyMed, { color: dates.length >= 1 ? C.accent : C.textSecondary, fontWeight: '700' }]}>{analyzing ? 'KI analysiert…' : (progressAnalysis ? 'KI-Analyse aktualisieren' : (dates.length >= 2 ? 'KI-Analyse (Vergleich)' : 'KI-Analyse (Ausgangszustand)'))}</Text>
        </TouchableOpacity>

        {/* So fotografierst du richtig */}
        <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginTop: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Feather name="info" size={14} color={C.tint} />
            <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }]}>So fotografierst du richtig</Text>
          </View>
          <Text style={[T.caption, { color: C.textSecondary, lineHeight: 18, marginBottom: S.sm }]}>{FRAMING_TIP}</Text>
          {PROGRESS_POSES.map((p, i) => (
            <View key={p.key} style={{ flexDirection: 'row', gap: 8, marginTop: i === 0 ? 0 : 6 }}>
              <Text style={[T.caption, { color: C.tint, fontWeight: '700', width: 16 }]}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[T.caption, { color: C.text, fontWeight: '700' }]}>{p.label}</Text>
                <Text style={[T.caption, { color: C.textTertiary, lineHeight: 17 }]}>{p.hint}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Letzte gespeicherte Analyse */}
        {progressAnalysis && (
          <TouchableOpacity onPress={() => setShowAnalysis(true)} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginTop: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Feather name="cpu" size={13} color={C.accent} />
              <Text style={[T.label, { color: C.textTertiary, flex: 1 }]}>LETZTE ANALYSE · {fmtDate(progressAnalysis.firstDate)} → {fmtDate(progressAnalysis.lastDate)}</Text>
              <Feather name="chevron-right" size={16} color={C.textTertiary} />
            </View>
            <Text style={[T.caption, { color: C.textSecondary, lineHeight: 18 }]} numberOfLines={2}>{progressAnalysis.summary}</Text>
            {progressAnalysis.estimates?.koerperfett_aktuell ? (
              <Text style={[T.caption, { color: C.text, marginTop: 4 }]}>KF-Schätzung: {progressAnalysis.estimates.koerperfett_aktuell} <Text style={{ color: C.warning }}>(ungenau)</Text></Text>
            ) : null}
            {Array.isArray(progressAnalysis.regionen) && progressAnalysis.regionen.length > 0 && (
              <TouchableOpacity
                onPress={() => navigation?.navigate('ProgressCompare')}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.tint + '14', borderRadius: R.sm, paddingVertical: 9, marginTop: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '30' }}
              >
                <Feather name="crosshair" size={14} color={C.tint} />
                <Text style={[T.caption, { color: C.tint, fontWeight: '700' }]}>Regionen-Vergleich mit Zoom ansehen</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}

        {/* Verlauf je Pose */}
        {dates.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: S.xxl }}>
            <Feather name="camera" size={36} color={C.tint} style={{ marginBottom: S.sm }} />
            <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center', lineHeight: 20 }]}>Noch keine Fotos. Mach dein erstes Check-in — danach legt die App das letzte Foto beim nächsten Mal als Hilfslinie über die Kamera.</Text>
          </View>
        ) : (
          PROGRESS_POSES.map((pose) => {
            const list = byPose[pose.key] || [];
            return (
              <View key={pose.key} style={{ marginTop: S.lg }}>
                <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: S.sm }]}>{pose.label}</Text>
                {list.length === 0 ? (
                  <Text style={[T.caption, { color: C.textTertiary }]}>Noch kein Foto.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: S.sm }}>
                      {list.map((ph) => (
                        <TouchableOpacity key={ph.id} onPress={() => setViewer({ uri: ph.imageUrl, label: pose.label, date: ph.date })} onLongPress={() => confirmDelete(ph)}
                          style={{ width: 110, alignItems: 'center' }}>
                          <Image source={{ uri: ph.imageUrl }} style={{ width: 110, height: 150, borderRadius: R.md, backgroundColor: C.bgTertiary }} resizeMode="cover" />
                          <Text style={[T.caption, { color: C.textTertiary, marginTop: 4 }]}>{fmtDate(ph.date)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>
            );
          })
        )}
        {dates.length > 0 && <Text style={[T.caption, { color: C.textTertiary, marginTop: S.lg, textAlign: 'center' }]}>Tipp: Foto antippen = groß ansehen · lange drücken = löschen</Text>}
      </ScrollView>

      {/* Kamera-Aufnahme */}
      <Modal visible={capturing} animationType="slide" onRequestClose={() => setCapturing(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {CameraView && (
            <CameraView ref={camRef} style={{ flex: 1 }} facing={facing} />
          )}
          {/* Geist-Overlay: letztes Foto dieser Pose */}
          {ghost && (
            <Image source={{ uri: ghost }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }} resizeMode="cover" />
          )}
          {/* Top-Leiste */}
          <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, paddingHorizontal: S.md, flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setCapturing(false)} hitSlop={10}><Feather name="x" size={26} color="#fff" /></TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{PROGRESS_POSES[poseIdx].label}</Text>
              <Text style={{ color: '#fff', opacity: 0.8, fontSize: 12 }}>Pose {poseIdx + 1}/4 · {PROGRESS_POSES[poseIdx].hint}</Text>
            </View>
            <TouchableOpacity onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} hitSlop={10}><Feather name="refresh-cw" size={22} color="#fff" /></TouchableOpacity>
          </View>
          {ghost && (
            <View style={{ position: 'absolute', top: insets.top + 64, alignSelf: 'center', backgroundColor: '#0008', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>Letztes Foto als Hilfslinie — gleiche Position einnehmen</Text>
            </View>
          )}
          {/* Countdown-Overlay (Selbstauslöser) */}
          {countdown != null && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
              <Text style={{ color: '#fff', fontSize: 120, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 12 }}>{countdown}</Text>
            </View>
          )}
          {/* Bedien-Leiste: Galerie · Auslöser · Timer */}
          <View style={{ position: 'absolute', bottom: insets.bottom + 30, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: S.lg }}>
            <TouchableOpacity onPress={pickFromGallery} disabled={busy || countdown != null} style={{ alignItems: 'center', width: 64, opacity: (busy || countdown != null) ? 0.4 : 1 }}>
              <Feather name="image" size={26} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 10, marginTop: 4 }}>Galerie</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onShutter} disabled={busy || countdown != null} style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: (busy || countdown != null) ? 0.5 : 1, borderWidth: 4, borderColor: '#ffffff88' }}>
              {busy ? <ActivityIndicator color="#000" /> : <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000' }} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTimerSec(TIMER_OPTIONS[(TIMER_OPTIONS.indexOf(timerSec) + 1) % TIMER_OPTIONS.length])} disabled={countdown != null} style={{ alignItems: 'center', width: 64, opacity: countdown != null ? 0.4 : 1 }}>
              <Feather name="clock" size={26} color={timerSec > 0 ? C.accent : '#fff'} />
              <Text style={{ color: timerSec > 0 ? C.accent : '#fff', fontSize: 10, marginTop: 4 }}>{timerSec > 0 ? `${timerSec}s` : 'Timer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Großansicht */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setViewer(null)} style={{ flex: 1, backgroundColor: '#000d', justifyContent: 'center', padding: S.md }}>
          {viewer && (
            <>
              <Image source={{ uri: viewer.uri }} style={{ width: '100%', height: '80%', borderRadius: R.lg }} resizeMode="contain" />
              <Text style={{ color: '#fff', textAlign: 'center', marginTop: S.md }}>{viewer.label} · {fmtDate(viewer.date)}</Text>
            </>
          )}
        </TouchableOpacity>
      </Modal>

      {/* KI-Analyse Ergebnis */}
      <Modal visible={showAnalysis && !!progressAnalysis} transparent animationType="slide" onRequestClose={() => setShowAnalysis(false)}>
        <View style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: S.lg, paddingBottom: insets.bottom + S.lg, maxHeight: '88%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
              <Feather name="cpu" size={18} color={C.accent} />
              <Text style={[T.h3, { color: C.text, flex: 1, marginLeft: S.sm }]}>KI-Analyse</Text>
              <TouchableOpacity onPress={() => setShowAnalysis(false)} hitSlop={8}><Feather name="x" size={22} color={C.textSecondary} /></TouchableOpacity>
            </View>
            {progressAnalysis && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[T.caption, { color: C.textTertiary, marginBottom: S.md }]}>{fmtDate(progressAnalysis.firstDate)} → {fmtDate(progressAnalysis.lastDate)} · {progressAnalysis.poses} Pose(n)</Text>
                {progressAnalysis.summary ? <Text style={[T.body, { color: C.text, lineHeight: 22, marginBottom: S.md }]}>{progressAnalysis.summary}</Text> : null}

                {Array.isArray(progressAnalysis.changes) && progressAnalysis.changes.length > 0 && (
                  <>
                    <Text style={[T.label, { color: C.success, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }]}>Sichtbare Veränderungen</Text>
                    {progressAnalysis.changes.map((c, i) => (
                      <View key={i} style={{ flexDirection: 'row', gap: S.sm, marginBottom: 4 }}>
                        <Feather name="check" size={14} color={C.success} style={{ marginTop: 2 }} />
                        <Text style={[T.caption, { color: C.textSecondary, flex: 1, lineHeight: 18 }]}>{c}</Text>
                      </View>
                    ))}
                  </>
                )}

                {Array.isArray(progressAnalysis.focus) && progressAnalysis.focus.length > 0 && (
                  <>
                    <Text style={[T.label, { color: C.warning, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: S.md, marginBottom: 6 }]}>Woran weiter arbeiten</Text>
                    {progressAnalysis.focus.map((c, i) => (
                      <View key={i} style={{ flexDirection: 'row', gap: S.sm, marginBottom: 4 }}>
                        <Feather name="target" size={14} color={C.warning} style={{ marginTop: 2 }} />
                        <Text style={[T.caption, { color: C.textSecondary, flex: 1, lineHeight: 18 }]}>{c}</Text>
                      </View>
                    ))}
                  </>
                )}

                {progressAnalysis.estimates && (
                  <View style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, marginTop: S.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Text style={[T.label, { color: C.text, fontWeight: '700' }]}>Grobe Schätzung</Text>
                      <View style={{ backgroundColor: C.warning + '22', borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ color: C.warning, fontSize: 10, fontWeight: '700' }}>UNGENAU</Text>
                      </View>
                    </View>
                    {progressAnalysis.estimates.koerperfett_aktuell ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text style={[T.caption, { color: C.textSecondary }]}>KF-Anteil aktuell</Text>
                        <Text style={[T.caption, { color: C.text, fontWeight: '700' }]}>{progressAnalysis.estimates.koerperfett_aktuell}</Text>
                      </View>
                    ) : null}
                    {progressAnalysis.estimates.koerperfett_vorher ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text style={[T.caption, { color: C.textTertiary }]}>KF-Anteil vorher</Text>
                        <Text style={[T.caption, { color: C.textSecondary }]}>{progressAnalysis.estimates.koerperfett_vorher}</Text>
                      </View>
                    ) : null}
                    {progressAnalysis.estimates.koerperfett_trend ? <Text style={[T.caption, { color: C.textSecondary, marginBottom: 2 }]}>KF-Trend: {progressAnalysis.estimates.koerperfett_trend}</Text> : null}
                    {progressAnalysis.estimates.muskelmasse_trend ? <Text style={[T.caption, { color: C.textSecondary }]}>Muskeln: {progressAnalysis.estimates.muskelmasse_trend}</Text> : null}
                  </View>
                )}

                {Array.isArray(progressAnalysis.regionen) && progressAnalysis.regionen.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { setShowAnalysis(false); navigation?.navigate('ProgressCompare'); }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.tint, borderRadius: R.md, padding: 13, marginTop: S.md }}
                  >
                    <Feather name="crosshair" size={16} color={C.tintText} />
                    <Text style={[T.bodyMed, { color: C.tintText }]}>Regionen-Vergleich mit Zoom ansehen</Text>
                  </TouchableOpacity>
                )}

                {progressAnalysis.disclaimer ? (
                  <Text style={[T.caption, { color: C.textTertiary, fontStyle: 'italic', marginTop: S.md, lineHeight: 17 }]}>{progressAnalysis.disclaimer}</Text>
                ) : null}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
