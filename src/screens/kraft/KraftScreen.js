/**
 * screens/kraft/KraftScreen.js — Kraft-Übersicht (Tab-Screen)
 *
 * Zeigt Routinen, letzte Sessions und KI-Trainingsplan-Einheiten.
 * Verwaltet das Klassifizierungs-Modal für KI-generierte Übungen ohne Muskelgruppe.
 *
 * Besonderheiten:
 *   guessMuscleGroup()   — Heuristik: Name → Muskelgruppe via Keyword-Mapping (MUSCLE_KEYWORDS)
 *                          Reihenfolge: Custom-Exercises → DB-exakt → DB-fuzzy → Keywords
 *   handleStartFromAI()  — Startet Workout aus KI-Trainingsplan-Session
 *                          Bei unbekannten Übungen → Klassifizierungs-Modal
 *   handleClassifyWithAI — Ruft Gemini auf um Muskelgruppen zu bestimmen
 *   Routinen-Folder-View — Gruppierung nach folder_name in `folders`-Map
 */

// React/RN
import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Alert, ActivityIndicator,
} from 'react-native';

// Lokale MUSCLE_COLORS (leicht abweichende Palette von data/exercises.js)
const MUSCLE_COLORS = {
  Brust: '#F87171', Rücken: '#60A5FA', Beine: '#86EFAC', Schultern: '#FDBA74',
  Arme: '#A78BFA', Bauch: '#FCD34D', Gesäß: '#FB923C', Ganzkörper: '#94A3B8',
  Trapez: '#06B6D4', Hamstrings: '#8B5CF6', Waden: '#7C3AED', Unterarme: '#F59E0B',
  Bizeps: '#FF9800', Trizeps: '#F44336',
};
// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

// Internal
import { useTheme } from '../../theme';
import { useKraftStore } from '../../store/kraftStore';
import { useStore } from '../../store';
import { EXERCISES, MUSCLE_GROUPS, MUSCLE_COLORS as DB_MUSCLE_COLORS } from '../../data/exercises';

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

/**
 * Keyword-Mapping für die Muskelgruppen-Heuristik.
 * Wird in guessMuscleGroup() als letzter Fallback nach DB-Abgleich verwendet.
 * Sortiert nach Spezifizität (spezifische zuerst, z.B. 'Hamstrings' vor 'Beine').
 */
const MUSCLE_KEYWORDS = [
  { keys: ['bankdrück', 'liegestütz', 'push-up', 'pushup', 'dips (brust)', 'flieg', 'cable cross', 'pec deck', 'brust'], group: 'Brust' },
  { keys: ['klimmzug', 'chin-up', 'latzug', 'pulldown', 'rudern', 'kreuzheb', 'deadlift', 'hyperext', 'rack pull', 'pendlay', 'rücken', 'lat pullover', 'inverted row', 'meadows'], group: 'Rücken' },
  { keys: ['shrug', 'trapez', 'farmer walk', 'face pull'], group: 'Trapez' },
  { keys: ['schulterdrück', 'military press', 'overhead press', 'arnold press', 'seitheben', 'frontales heben', 'upright row', 'landmine press', 'push press', 'schulter', 'rear delt', 'cable lateral'], group: 'Schultern' },
  { keys: ['bizeps', 'curl', 'scottcurl', 'preacher', 'hammer curl', 'incline dumbbell curl', 'z-bar curl'], group: 'Bizeps' },
  { keys: ['trizeps', 'skull crusher', 'overhead trizeps', 'kickback', 'nahgriff-bank', 'diamond push', 'tate press', 'jm press', 'dips (triz'], group: 'Trizeps' },
  { keys: ['kniebeu', 'squat', 'beinpress', 'beinstreck', 'ausfallschritt', 'lunge', 'step-up', 'pistol', 'goblet', 'hackenschmidt', 'box squat', 'zercher', 'trap bar', 'sumo squat', 'sissy squat', 'jump squat', 'adduktor', 'box jump'], group: 'Beine' },
  { keys: ['romanian deadlift', 'rdl', 'nordic curl', 'beinbeuger', 'hamstring', 'glute ham raise'], group: 'Hamstrings' },
  { keys: ['wadenheben', 'wade', 'calf raise', 'schienbein'], group: 'Waden' },
  { keys: ['hip thrust', 'glute bridge', 'donkey kick', 'kabelzug glute', 'hip abduction', 'cable hip', 'abduktor', 'reverse hyper', 'gesäß', 'single leg deadlift', 'romanian split squat'], group: 'Gesäß' },
  { keys: ['crunch', 'plank', 'russian twist', 'ab wheel', 'hanging knee', 'leg raise', 'dragon flag', 'mountain climber', 'v-up', 'dead bug', 'windshield', 'pallof', 'woodchopper', 'kabelzug crunch', 'serratus', 'bauch', 'cable crunch'], group: 'Bauch' },
  { keys: ['unterarme curl', 'reverse curl', 'zottman', 'farmer', 'unterarm'], group: 'Unterarme' },
  { keys: ['burpee', 'clean & press', 'thruster', 'kettlebell snatch', 'türkisches aufstehen', 'turkish get-up'], group: 'Ganzkörper' },
  { keys: ['kettlebell swing'], group: 'Gesäß' },
  { keys: ['sled push', 'battle rope'], group: 'Beine' },
];

/**
 * Versucht eine Muskelgruppe anhand des Übungsnamens zu ermitteln.
 * Gibt null zurück wenn kein Match gefunden — kein falscher 'Ganzkörper'-Fallback.
 * Lookup-Reihenfolge:
 *   0. Custom-Exercises (User/KI gespeicherte Übungen)
 *   1. Exakter Datenbankabgleich (case-insensitive)
 *   2. Fuzzy: erstes Wort ≥5 Zeichen in DB-Namen suchen
 *   3. Keyword-Mapping (MUSCLE_KEYWORDS)
 *
 * @param {string} name - Übungsname
 * @param {Array} [customExercises=[]] - Gespeicherte Custom-Exercises aus kraftStore
 * @returns {string|null} - Muskelgruppe oder null
 */
function guessMuscleGroup(name, customExercises = []) {
  if (!name) return null;
  const lower = name.toLowerCase();

  // 0. Custom Exercises (vom User / KI hinzugefügt)
  const custom = customExercises.find(e => e.name_de.toLowerCase() === lower);
  if (custom) return custom.muscle_group;

  // 1. Exakter Datenbankabgleich
  const exact = EXERCISES.find(e => e.name_de.toLowerCase() === lower);
  if (exact) return exact.muscle_group;

  // 2. Datenbank-Fuzzy: erstes sinnvolles Wort (≥5 Zeichen)
  const firstWord = lower.split(/[\s(,]/)[0];
  if (firstWord.length >= 5) {
    const fuzzy = EXERCISES.find(e => e.name_de.toLowerCase().includes(firstWord));
    if (fuzzy) return fuzzy.muscle_group;
  }

  // 3. Keyword-Mapping
  for (const { keys, group } of MUSCLE_KEYWORDS) {
    if (keys.some(k => lower.includes(k))) return group;
  }

  return null; // kein Ganzkörper-Fallback
}

function getTodayIndex() { return (new Date().getDay() + 6) % 7; }

function formatDuration(seconds) {
  const m = Math.floor((seconds || 0) / 60);
  const s = (seconds || 0) % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function KraftScreen({ navigation, tabBar }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { routines, sessions, activeWorkout, fetchRoutines, fetchSessions, fetchPRs, startWorkout, customExercises, addCustomExercise, routineOrder, reorderRoutines } = useKraftStore();
  const { trainingPlan, geminiKey } = useStore();

  const [classifyModal, setClassifyModal] = useState(false);
  const [classifyList, setClassifyList] = useState([]); // [{name_de, muscle_group}]
  const [classifyPending, setClassifyPending] = useState(null); // {name, exercises}
  const [classifying, setClassifying] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchRoutines();
    fetchSessions(5);
    fetchPRs();
  }, []));

  // ── KI Muskelgruppen-Bestimmung ───────────────────────────────
  const handleClassifyWithAI = async () => {
    if (!geminiKey) {
      Alert.alert('Kein KI-Key', 'Gemini API Key in den Einstellungen hinterlegen.');
      return;
    }
    setClassifying(true);
    try {
      const names = classifyList.map(e => e.name_de);
      const prompt = `Ordne diesen Übungen die primäre Muskelgruppe zu. Antworte NUR als JSON-Array ohne weiteren Text:\n[{"name":"Übungsname","muscle_group":"Gruppe"}]\n\nErlaubte Gruppen: Brust, Rücken, Trapez, Schultern, Bizeps, Trizeps, Unterarme, Beine, Hamstrings, Waden, Gesäß, Bauch, Ganzkörper\n\nÜbungen:\n${names.map(n => `- ${n}`).join('\n')}`;
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      );
      const data = await resp.json();
      const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```json|```/g, '');
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const results = JSON.parse(match[0]);
        setClassifyList(prev => prev.map(ex => {
          const found = results.find(r => r.name?.toLowerCase() === ex.name_de.toLowerCase());
          return found?.muscle_group ? { ...ex, muscle_group: found.muscle_group } : ex;
        }));
      }
    } catch (e) {
      Alert.alert('Fehler', 'KI konnte Übungen nicht klassifizieren.');
    }
    setClassifying(false);
  };

  const handleClassifyDone = async () => {
    for (const ex of classifyList) {
      if (ex.muscle_group) await addCustomExercise(ex.name_de, ex.muscle_group);
    }
    if (classifyPending) {
      const merged = classifyPending.exercises.map(ex => {
        if (!ex.muscle_group) {
          const c = classifyList.find(c => c.name_de === ex.name_de);
          return { ...ex, muscle_group: c?.muscle_group || '' };
        }
        return ex;
      });
      setClassifyModal(false);
      await startWorkout(null, classifyPending.name, merged);
      navigation.navigate('LiveWorkout');
    }
  };

  // AI-Banner: strength sessions today
  const todayIdx = getTodayIndex();
  const todayStrength = trainingPlan?.sessions?.filter(
    s => s.day_index === todayIdx && s.sport_type === 'strength' && !s.is_rest
  ) || [];

  // Sort routines by local order, then group by folder
  const sortedRoutines = routineOrder.length > 0
    ? [...routines].sort((a, b) => {
        const ai = routineOrder.indexOf(a.id);
        const bi = routineOrder.indexOf(b.id);
        return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
      })
    : routines;

  const folders = {};
  sortedRoutines.forEach(r => {
    const key = r.folder_name || '—';
    if (!folders[key]) folders[key] = [];
    folders[key].push(r);
  });

  const handleStartEmpty = async () => {
    await startWorkout(null, 'Leeres Workout', []);
    navigation.navigate('LiveWorkout');
  };

  const handleStartFromAI = async (session) => {
    const exercises = (session.exercises || []).filter(e => !e.zone || e.zone !== 'rest').map(e => {
      // Sätze/Wiederholungen aus dem KI-Plan in ein echtes Sätze-Array übernehmen
      // (sonst startet das Workout mit nur 1 leerem Satz statt z.B. 3×10).
      const numSets = Math.max(1, parseInt(e.sets) || 1);
      const repsStr = (e.reps !== undefined && e.reps !== null) ? String(e.reps) : '';
      return {
        id: null,
        name_de: e.name || e.emoji || 'Übung',
        muscle_group: guessMuscleGroup(e.name, customExercises) || '',
        sets: Array.from({ length: numSets }, () => ({ reps: repsStr, weight_kg: '' })),
      };
    });
    const unknown = exercises.filter(e => !e.muscle_group && e.name_de !== 'Übung');
    if (unknown.length > 0) {
      setClassifyList(unknown.map(e => ({ name_de: e.name_de, muscle_group: '' })));
      setClassifyPending({ name: session.focus || 'Kraft', exercises });
      setClassifyModal(true);
    } else {
      await startWorkout(null, session.focus || 'Kraft', exercises.length > 0 ? exercises : []);
      navigation.navigate('LiveWorkout');
    }
  };

  const allClassified = classifyList.length > 0 && classifyList.every(e => !!e.muscle_group);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {tabBar}

      {/* ── Klassifizier-Modal für unbekannte KI-Übungen ── */}
      <Modal visible={classifyModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setClassifyModal(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          {/* Header */}
          <View style={{ paddingTop: 20, paddingHorizontal: S.md, paddingBottom: S.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 17 }}>Neue Übungen gefunden</Text>
                <Text style={{ color: C.textSecondary, fontSize: 13, marginTop: 2 }}>
                  {classifyList.length} Übungen ohne Muskelgruppe — einmal zuordnen, dann gespeichert
                </Text>
              </View>
              <TouchableOpacity onPress={() => setClassifyModal(false)}>
                <Feather name="x" size={22} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 160 }}>
            {classifyList.map((ex, i) => {
              const selected = ex.muscle_group;
              return (
                <View key={i} style={{ marginBottom: S.lg }}>
                  <Text style={{ color: C.text, fontWeight: '600', fontSize: 15, marginBottom: S.xs }}>{ex.name_de}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {MUSCLE_GROUPS.filter(m => m !== 'Alle').map(m => {
                      const active = selected === m;
                      const color = DB_MUSCLE_COLORS[m] || MUSCLE_COLORS[m] || C.accent;
                      return (
                        <TouchableOpacity
                          key={m}
                          onPress={() => setClassifyList(prev => prev.map((e, idx) => idx === i ? { ...e, muscle_group: m } : e))}
                          style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginRight: 6, backgroundColor: active ? color : C.surface, borderWidth: 1.5, borderColor: active ? color : C.border }}
                        >
                          <Text style={{ color: active ? '#fff' : C.textSecondary, fontSize: 12, fontWeight: '600' }}>{m}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>

          {/* Buttons */}
          <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: S.md, right: S.md, gap: S.sm }}>
            <TouchableOpacity
              onPress={handleClassifyWithAI}
              disabled={classifying}
              style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.xs, borderWidth: 1.5, borderColor: C.accent }}
            >
              {classifying
                ? <ActivityIndicator size="small" color={C.accent} />
                : <Feather name="cpu" size={16} color={C.accent} />}
              <Text style={{ color: C.accent, fontWeight: '700' }}>KI bestimmen lassen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClassifyDone}
              disabled={!allClassified}
              style={{ backgroundColor: allClassified ? C.accent : C.surface, borderRadius: R.md, padding: S.md, alignItems: 'center', opacity: allClassified ? 1 : 0.5 }}
            >
              <Text style={{ color: allClassified ? C.bg : C.textTertiary, fontWeight: '700', fontSize: 16 }}>
                Speichern & Workout starten
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={{ padding: S.md, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Active workout banner */}
        {activeWorkout && (
          <TouchableOpacity
            onPress={() => navigation.navigate('LiveWorkout')}
            style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, marginBottom: S.md, flexDirection: 'row', alignItems: 'center' }}
          >
            <Feather name="play-circle" size={22} color={C.bg} style={{ marginRight: S.sm }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.bg, fontWeight: '700' }}>Workout läuft: {activeWorkout.routineName}</Text>
              <Text style={{ color: C.bg + 'CC', fontSize: 13 }}>{formatDuration(activeWorkout.elapsedSeconds)} · Fortsetzen</Text>
            </View>
            <Feather name="chevron-right" size={18} color={C.bg} />
          </TouchableOpacity>
        )}

        {/* KI-Plan Kraft-Einheiten */}
        {(() => {
          const allStrength = trainingPlan?.sessions?.filter(s => s.sport_type === 'strength' && !s.is_rest) || [];
          if (allStrength.length === 0) return null;
          const todaySessions = allStrength.filter(s => s.day_index === todayIdx);
          const otherSessions = allStrength.filter(s => s.day_index !== todayIdx)
            .sort((a, b) => {
              // Sortiere: zukünftige Tage zuerst, dann vergangene
              const aDiff = (a.day_index - todayIdx + 7) % 7;
              const bDiff = (b.day_index - todayIdx + 7) % 7;
              return aDiff - bDiff;
            });
          return (
            <>
              {/* Heute — prominenter Banner */}
              {todaySessions.map((session, i) => (
                <TouchableOpacity
                  key={`today-${i}`}
                  onPress={() => handleStartFromAI(session)}
                  style={{ backgroundColor: '#E8C54722', borderColor: '#E8C547', borderWidth: 1.5, borderRadius: R.md, padding: S.md, marginBottom: S.sm, flexDirection: 'row', alignItems: 'center' }}
                >
                  <MaterialCommunityIcons name="robot-outline" size={22} color="#E8C547" style={{ marginRight: S.sm }} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <View style={{ backgroundColor: '#E8C547', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#000', fontSize: 10, fontWeight: '800' }}>HEUTE</Text>
                      </View>
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{session.focus || 'Kraft'}</Text>
                    </View>
                    <Text style={{ color: C.textSecondary, fontSize: 13 }}>{session.duration} Min · {session.exercises?.length || 0} Übungen</Text>
                  </View>
                  <View style={{ backgroundColor: '#E8C547', borderRadius: R.full, padding: 8 }}>
                    <Feather name="play" size={16} color="#000" />
                  </View>
                </TouchableOpacity>
              ))}

              {/* Andere Tage — kompakte Zeilen */}
              {otherSessions.length > 0 && (
                <View style={{ backgroundColor: C.surface, borderRadius: R.md, marginBottom: S.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingTop: S.sm, paddingBottom: 6 }}>
                    <MaterialCommunityIcons name="robot-outline" size={12} color={C.textTertiary} />
                    <Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginLeft: 5 }}>KI-PLAN DIESE WOCHE</Text>
                  </View>
                  {otherSessions.map((session, i) => {
                    const isPast = ((session.day_index - todayIdx + 7) % 7) > 3;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => handleStartFromAI(session)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, opacity: isPast ? 0.5 : 1 }}
                      >
                        <View style={{ width: 36, alignItems: 'center' }}>
                          <Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '700' }}>{DAYS[session.day_index].slice(0, 2).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{session.focus || 'Kraft'}</Text>
                          <Text style={{ color: C.textTertiary, fontSize: 12 }}>{session.duration} Min</Text>
                        </View>
                        <Feather name="play" size={15} color={C.accent} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          );
        })()}

        {/* Quick start */}
        <TouchableOpacity
          onPress={handleStartEmpty}
          style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm }}
        >
          <Feather name="plus-circle" size={20} color={C.accent} />
          <Text style={{ color: C.accent, fontWeight: '700', fontSize: 15 }}>Leeres Workout starten</Text>
        </TouchableOpacity>

        {/* Routinen */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
          <Text style={[T.h3, { color: C.text, flex: 1 }]}>Meine Routinen</Text>
          <TouchableOpacity onPress={() => navigation.navigate('RoutineEdit')}>
            <Feather name="plus" size={20} color={C.accent} />
          </TouchableOpacity>
        </View>

        {routines.length === 0 && (
          <Text style={{ color: C.textTertiary, marginBottom: S.md }}>Noch keine Routinen. Erstelle deine erste!</Text>
        )}

        {Object.entries(folders).map(([folder, rList]) => (
          <View key={folder} style={{ marginBottom: S.sm }}>
            {folder !== '—' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.xs }}>
                <Feather name="folder" size={14} color={C.textSecondary} style={{ marginRight: 4 }} />
                <Text style={{ color: C.textSecondary, fontSize: 13, fontWeight: '600' }}>{folder}</Text>
              </View>
            )}
            {rList.map(routine => {
              const exercises = Array.isArray(routine.exercises) ? routine.exercises : (() => { try { return JSON.parse(routine.exercises || '[]'); } catch { return []; } })();
              const muscles = [...new Set(exercises.map(ex => ex.muscle_group).filter(Boolean))];
              const lastSession = sessions.find(s => s.routine_id === routine.id);
              const exPreview = exercises.slice(0, 3).map(e => e.name).filter(Boolean).join(', ') + (exercises.length > 3 ? ` +${exercises.length - 3} mehr` : '');
              const flatIdx = sortedRoutines.findIndex(r => r.id === routine.id);
              return (
                <TouchableOpacity
                  key={routine.id}
                  onPress={() => navigation.navigate('RoutineDetail', { routine })}
                  style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                >
                  {/* Name + reorder buttons */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{routine.name}</Text>
                    <View style={{ gap: 1, marginLeft: S.xs }}>
                      <TouchableOpacity
                        onPress={() => reorderRoutines(flatIdx, flatIdx - 1)}
                        disabled={flatIdx === 0}
                        hitSlop={{ top: 4, bottom: 4, left: 8, right: 4 }}
                      >
                        <Feather name="chevron-up" size={16} color={flatIdx === 0 ? C.textTertiary + '33' : C.textTertiary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => reorderRoutines(flatIdx, flatIdx + 1)}
                        disabled={flatIdx === sortedRoutines.length - 1}
                        hitSlop={{ top: 4, bottom: 4, left: 8, right: 4 }}
                      >
                        <Feather name="chevron-down" size={16} color={flatIdx === sortedRoutines.length - 1 ? C.textTertiary + '33' : C.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={{ color: C.textTertiary, fontSize: 12, marginBottom: 4 }}>
                    {lastSession ? `Zuletzt: ${formatDate(lastSession.started_at)}` : 'Noch nicht gestartet'}{exercises.length > 0 ? `  ·  ${exercises.length} Übungen` : ''}
                  </Text>
                  {exPreview ? (
                    <Text style={{ color: C.textSecondary, fontSize: 13, marginBottom: S.sm }} numberOfLines={1}>{exPreview}</Text>
                  ) : null}
                  {/* Muscle dots */}
                  {muscles.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: S.sm }}>
                      {muscles.slice(0, 5).map(m => (
                        <View key={m} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MUSCLE_COLORS[m] || C.textTertiary }} />
                      ))}
                      {muscles.length > 5 && <Text style={{ color: C.textTertiary, fontSize: 11 }}>+{muscles.length - 5}</Text>}
                    </View>
                  )}
                  {/* Full-width Start Button */}
                  <TouchableOpacity
                    onPress={async () => {
                      await startWorkout(routine.id, routine.name, exercises.map(ex => ({
                        id: ex.exercise_id, name_de: ex.name, muscle_group: ex.muscle_group, sets: ex.sets,
                      })));
                      navigation.navigate('LiveWorkout');
                    }}
                    style={{ backgroundColor: C.accent, borderRadius: R.md, paddingVertical: 10, alignItems: 'center' }}
                  >
                    <Text style={{ color: C.accentText, fontWeight: '700', fontSize: 14 }}>Routine starten</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Letzte Sessions */}
        {sessions.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S.md, marginBottom: S.sm }}>
              <Text style={[T.h3, { color: C.text, flex: 1 }]}>Letzte Trainings</Text>
              <TouchableOpacity onPress={() => navigation.navigate('KraftStats')}>
                <Text style={{ color: C.accent, fontSize: 13 }}>Statistiken</Text>
              </TouchableOpacity>
            </View>
            {sessions.map(session => (
              <View key={session.id} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: S.sm }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{session.routine_name || 'Workout'}</Text>
                    <Text style={{ color: C.textTertiary, fontSize: 12, marginTop: 2 }}>{formatDate(session.started_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>{Math.round(session.total_volume_kg || 0)} kg</Text>
                    <Text style={{ color: C.textTertiary, fontSize: 12, marginTop: 1 }}>{Math.round((session.duration_seconds || 0) / 60)} min</Text>
                  </View>
                </View>
                <Text style={{ color: C.textSecondary, fontSize: 13, marginTop: 6 }}>{session.total_sets || 0} Sätze abgeschlossen</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
