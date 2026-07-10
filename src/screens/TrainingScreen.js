/**
 * screens/TrainingScreen.js — Trainingsplan & Wochenübersicht
 *
 * Hauptscreen für Ausdauer-Training. Zeigt KI-generierten Wochenplan,
 * Tageseinheiten und ermöglicht Workout-Logging.
 *
 * getCurrentWeekKey() — Wochenschlüssel (YYYY-WNN) für Plan-Caching
 * getCurrentPhaseText() — Aktuelle Trainingsphase aus Store (Text oder strukturiert)
 * DAYS / DAY_SHORT — Deutsche Wochentage
 * SPORT_MCI — Mapping Sportkey → MaterialCommunityIcons Icon-Name
 *
 * analyzeWorkoutWithGemini() — Post-Workout KI-Feedback
 * getSportIcon() / getSportColor() — Einheitliche Sporttyp-Visualisierung
 */

// React/RN
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView,
  Platform, Animated, Dimensions,
} from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Internal
import { useStore, getCurrentPhaseText } from '../store';
import { useKraftStore } from '../store/kraftStore';
import { api, getSportIcon, getSportColor, secondsToPace, analyzeWorkoutWithGemini } from '../api/client';
import { useTheme } from '../theme';
import { analyzeTrainingStatus, getTrainingStatusIcon, getTrainingStatusColor } from '../utils/trainingStatus';
import { detectTrainingConflicts } from '../utils/coaching';
import { assessRecovery, EASE_INSTRUCTION } from '../utils/recovery';
import { weakestZones } from '../data/mobility';
import { getSessionSteps } from '../utils/workoutStructure';
import WorkoutProfileChart from '../components/WorkoutProfileChart';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActivityDetail from '../components/ActivityDetail';
import ActivityCard from '../components/ActivityCard';
import { getSportMci } from '../data/sports';

const DAYS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
const DAY_SHORT = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const SPORT_MCI = { run: 'run', bike: 'bike', swim: 'swim', strength: 'weight-lifter', yoga: 'yoga', triathlon: 'run-fast', mobility: 'human' };

function getCurrentWeekKey() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return start.toISOString().split('T')[0];
}
function getTodayIndex() { return (new Date().getDay() + 6) % 7; }

// ── Intensity badge ──────────────────────────────────────────
function IntensityBadge({ value }) {
  if (!value || value === 'none') return null;
  const colors = {
    Z1: '#22C55E', Z2: '#86EFAC', Z3: '#F59E0B', Z4: '#F97316', Z5: '#EF4444',
    GA1: '#22C55E', GA2: '#86EFAC', EB: '#F59E0B', SB: '#EF4444',
    leicht: '#22C55E', mittel: '#F59E0B', hoch: '#EF4444',
  };
  const color = colors[value] || '#9A9894';
  return (
    <View style={{ backgroundColor: `${color}20`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${color}40` }}>
      <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

// ── Exercise row ─────────────────────────────────────────────
function ExerciseRow({ exercise, index, dayIndex, done, onToggle, sportType }) {
  const { colors: C, spacing: S } = useTheme();
  const sc = getSportColor(sportType);
  const mciName = SPORT_MCI[sportType] || 'dumbbell';
  return (
    <TouchableOpacity
      style={{
        backgroundColor: done ? C.success + '08' : C.surface, borderRadius: 14, padding: 14,
        flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: done ? C.success + '50' : C.border,
      }}
      onPress={() => onToggle(dayIndex, index)}
      activeOpacity={0.7}
    >
      <View style={{
        width: 26, height: 26, borderRadius: 13,
        borderWidth: 2, borderColor: done ? C.success : C.borderStrong,
        alignItems: 'center', justifyContent: 'center', marginTop: 2,
        backgroundColor: done ? C.success : 'transparent',
      }}>
        {done && <Feather name="check" size={13} color={C.accentText} />}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <MaterialCommunityIcons name={mciName} size={16} color={sc} />
          <Text style={{ color: done ? C.textSecondary : C.text, fontSize: 14, fontWeight: '600', textDecorationLine: done ? 'line-through' : 'none' }}>
            {exercise.name}
          </Text>
          {exercise.zone && <IntensityBadge value={exercise.zone} />}
        </View>
        {exercise.description && (
          <Text style={{ color: C.textSecondary, fontSize: 11, marginTop: 3 }}>{exercise.description}</Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <View style={{ backgroundColor: C.bgTertiary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: C.tint, fontSize: 11, fontWeight: '700' }}>
              {exercise.sets > 1 ? `${exercise.sets}×` : ''}{exercise.reps}
            </Text>
          </View>
          {exercise.duration > 0 && (
            <Text style={{ color: C.textTertiary, fontSize: 11 }}>{exercise.duration} Min</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Session Info Modal ────────────────────────────────────────
function SessionInfoModal({ visible, session, onClose, onComplete }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  if (!session) return null;
  const sc = getSportColor(session.sport_type);
  const sportLabels = { run: 'Laufen', bike: 'Radfahren', swim: 'Schwimmen', strength: 'Kraft', yoga: 'Yoga', triathlon: 'Triathlon', mobility: 'Mobility' };
  const intensityInfo = {
    Z1: 'Sehr leicht — Aktive Erholung, Puls sehr niedrig', Z2: 'Locker — Grundlagenausdauer, du kannst dich gut unterhalten',
    Z3: 'Mittel — Tempo, leicht anstrengend', Z4: 'Hart — Schwellenpace, kaum noch sprechen',
    Z5: 'Maximal — Voller Einsatz, kurze Intervalle', GA1: 'Grundlagenausdauer 1 — locker und aerob',
    GA2: 'Grundlagenausdauer 2 — etwas intensiver', EB: 'Entwicklungsbereich', SB: 'Spitzenbereich',
    leicht: 'Niedriger Puls, Regeneration', mittel: 'Moderates Tempo', hoch: 'Hohe Intensität',
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.lg, paddingTop: S.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${sc}20`, alignItems: 'center', justifyContent: 'center', marginRight: S.md }}>
            <MaterialCommunityIcons name={SPORT_MCI[session.sport_type] || 'run'} size={24} color={sc} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T.label, { color: C.textTertiary }]}>{sportLabels[session.sport_type] || session.sport_type}</Text>
            <Text style={[T.h3, { color: C.text }]} numberOfLines={2}>{session.focus}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}><Feather name="x" size={22} color={C.textSecondary} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: S.lg }}>
          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
            {session.duration > 0 && (
              <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: S.md, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <Feather name="clock" size={18} color={C.textSecondary} />
                <Text style={[T.bodyMed, { color: C.text, marginTop: 4 }]}>{session.duration} Min</Text>
                <Text style={[T.label, { color: C.textTertiary }]}>Dauer</Text>
              </View>
            )}
            {session.intensity && (
              <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: S.md, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <Feather name="zap" size={18} color={C.textSecondary} />
                <Text style={[T.bodyMed, { color: C.text, marginTop: 4 }]}>{session.intensity}</Text>
                <Text style={[T.label, { color: C.textTertiary }]}>Intensität</Text>
              </View>
            )}
            {session.exercises?.length > 0 && (
              <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: S.md, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <Feather name="list" size={18} color={C.textSecondary} />
                <Text style={[T.bodyMed, { color: C.text, marginTop: 4 }]}>{session.exercises.length}</Text>
                <Text style={[T.label, { color: C.textTertiary }]}>Übungen</Text>
              </View>
            )}
          </View>

          {/* Intensity explanation */}
          {session.intensity && intensityInfo[session.intensity] && (
            <View style={{ backgroundColor: `${sc}10`, borderRadius: R.md, padding: S.md, marginBottom: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: `${sc}30` }}>
              <Text style={[T.label, { color: sc, marginBottom: 4 }]}>INTENSITÄT {session.intensity}</Text>
              <Text style={[T.body, { color: C.text }]}>{intensityInfo[session.intensity]}</Text>
            </View>
          )}

          {/* Workout-Profil (intervals.icu-Stil) */}
          {(() => {
            const profileSteps = getSessionSteps(session);
            return profileSteps.length > 0 ? (
              <View style={{ marginBottom: S.lg }}>
                <Text style={[T.label, { color: C.textTertiary, marginBottom: S.sm }]}>PROFIL</Text>
                <WorkoutProfileChart steps={profileSteps} height={72} />
              </View>
            ) : null;
          })()}

          {/* Exercises */}
          {session.exercises?.length > 0 && (
            <>
              <Text style={[T.label, { color: C.textTertiary, marginBottom: S.sm }]}>ÜBUNGEN</Text>
              <View style={{ gap: S.sm, marginBottom: S.lg }}>
                {session.exercises.map((ex, i) => (
                  <View key={i} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                      <MaterialCommunityIcons name={SPORT_MCI[session.sport_type] || 'dumbbell'} size={14} color={sc} />
                      <Text style={[T.bodyMed, { color: C.text, flex: 1 }]}>{ex.name}</Text>
                      {ex.zone && <View style={{ backgroundColor: `${sc}20`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: sc, fontSize: 10, fontWeight: '700' }}>{ex.zone}</Text></View>}
                    </View>
                    <Text style={[T.caption, { color: C.textSecondary, marginTop: 4 }]}>
                      {[ex.sets > 1 && `${ex.sets}×`, ex.reps, ex.duration > 0 && `${ex.duration} Min`].filter(Boolean).join(' · ')}
                    </Text>
                    {ex.description && <Text style={[T.caption, { color: C.textTertiary, marginTop: 3 }]}>{ex.description}</Text>}
                  </View>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity
            style={{ backgroundColor: sc, borderRadius: R.md, padding: S.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm }}
            onPress={() => { onClose(); onComplete(); }}
          >
            <Feather name="check-circle" size={16} color="#fff" />
            <Text style={[T.bodyMed, { color: '#fff', fontWeight: '600' }]}>Einheit abschließen</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Complete Workout Modal ────────────────────────────────────
function CompleteModal({ visible, session, planId, onClose, onSaved, geminiKey, user }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const [rating, setRating] = useState(3);
  const [effort, setEffort] = useState(5);
  const [duration, setDuration] = useState(session?.duration?.toString() || '');
  const [distance, setDistance] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [maxHr, setMaxHr] = useState('');
  const [avgPower, setAvgPower] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);

  const isBike = ['bike','triathlon'].includes(session?.sport_type);
  const hasDistance = ['run','bike','swim','triathlon'].includes(session?.sport_type);

  const shiftDate = (days) => {
    const d = new Date(workoutDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setWorkoutDate(d.toISOString().split('T')[0]);
  };

  const workoutPayload = () => ({
    sessionId: session?.id, planId,
    date: workoutDate,
    dayIndex: session?.day_index,
    exercisesCompleted: {}, rating,
    perceivedEffort: effort, notes,
    durationMinutes: parseInt(duration) || null,
    distance: parseFloat(distance) || null,
    avgHr: parseInt(avgHr) || null,
    maxHr: parseInt(maxHr) || null,
    avgPower: parseInt(avgPower) || null,
    calories: parseInt(calories) || null,
  });

  const save = async () => {
    setSaving(true);
    try {
      await api.completeWorkout(workoutPayload());
      onSaved(); onClose();
    } catch (e) { Alert.alert('Fehler', e.message); }
    setSaving(false);
  };

  const analyze = async () => {
    setAnalyzing(true);
    try {
      let feedback;
      try { feedback = await api.chatWithCoach(`Analysiere kurz dieses Training auf Deutsch: ${session?.focus}, Dauer: ${duration} Min, RPE: ${effort}/10, HR: ${avgHr||'–'}/${maxHr||'–'} bpm, Distanz: ${distance||'–'} km, Notes: ${notes||'–'}`, 'workout_analysis'); }
      catch(e) { if (geminiKey) feedback = await analyzeWorkoutWithGemini(session, workoutPayload(), user, geminiKey); else throw e; }
      setAiAnalysis(feedback?.reply || feedback || '');
    } catch(e) { Alert.alert('Analyse fehlgeschlagen', e.message); }
    setAnalyzing(false);
  };

  const inputStyle = { backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.md, color: C.text, fontSize: 14, padding: S.md };
  const label = (t) => <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs, marginTop: S.md }]}>{t}</Text>;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.lg, paddingTop: S.xl }}>
          <Text style={[T.h2, { color: C.text, marginBottom: S.xs }]}>Einheit abschließen</Text>
          {session && <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.md }]}>{session.focus}</Text>}

          {/* Datum */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgSecondary, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.lg }}>
            <TouchableOpacity onPress={() => shiftDate(-1)} style={{ padding: S.md }} hitSlop={8}>
              <Feather name="chevron-left" size={18} color={C.textSecondary} />
            </TouchableOpacity>
            <Text style={[T.bodyMed, { flex: 1, textAlign: 'center', color: C.text }]}>
              {workoutDate === new Date().toISOString().split('T')[0] ? 'Heute' : new Date(workoutDate + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
            <TouchableOpacity onPress={() => shiftDate(1)} style={{ padding: S.md }} hitSlop={8} disabled={workoutDate >= new Date().toISOString().split('T')[0]}>
              <Feather name="chevron-right" size={18} color={workoutDate >= new Date().toISOString().split('T')[0] ? C.textTertiary : C.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Rating */}
          <Text style={[T.label, { color: C.textTertiary, marginBottom: S.sm }]}>WIE WAR DAS TRAINING?</Text>
          <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
            {[1,2,3,4,5].map(v => (
              <TouchableOpacity key={v} style={{ flex: 1, backgroundColor: rating===v ? C.tint+'20' : C.bgSecondary, borderRadius: R.md, padding: S.sm, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: rating===v ? C.tint : C.border }} onPress={() => setRating(v)}>
                <MaterialCommunityIcons name={['emoticon-sad-outline','emoticon-neutral-outline','emoticon-happy-outline','emoticon-excited-outline','emoticon-cool-outline'][v-1]} size={20} color={rating===v ? C.tint : C.textTertiary} />
                <Text style={[T.caption, { color: rating===v ? C.tint : C.textTertiary, fontSize: 10, marginTop: 2 }]}>{['Schlecht','Mäßig','Ok','Gut','Top!'][v-1]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* RPE */}
          <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs }]}>ANSTRENGUNG (RPE 1–10)</Text>
          <View style={{ flexDirection: 'row', gap: S.xs, marginBottom: S.md, flexWrap: 'wrap' }}>
            {[1,2,3,4,5,6,7,8,9,10].map(v => {
              const color = v <= 3 ? C.success : v <= 6 ? C.warning : C.danger;
              return (
                <TouchableOpacity key={v} style={{ width: 40, height: 40, borderRadius: R.md, backgroundColor: effort===v ? `${color}20` : C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: effort===v ? color : C.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setEffort(v)}>
                  <Text style={[T.bodyMed, { color: effort===v ? color : C.textSecondary }]}>{v}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Duration + Distance */}
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <View style={{ flex: 1 }}>
              {label('DAUER (MIN)')}
              <TextInput style={inputStyle} value={duration} onChangeText={setDuration} placeholder={session?.duration?.toString() || '60'} placeholderTextColor={C.textTertiary} keyboardType="numeric" />
            </View>
            {hasDistance && (
              <View style={{ flex: 1 }}>
                {label('DISTANZ (KM)')}
                <TextInput style={inputStyle} value={distance} onChangeText={setDistance} placeholder="0.0" placeholderTextColor={C.textTertiary} keyboardType="decimal-pad" />
              </View>
            )}
          </View>

          {/* HR */}
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <View style={{ flex: 1 }}>
              {label('Ø HERZFREQ.')}
              <TextInput style={inputStyle} value={avgHr} onChangeText={setAvgHr} placeholder="–" placeholderTextColor={C.textTertiary} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              {label('MAX HERZFREQ.')}
              <TextInput style={inputStyle} value={maxHr} onChangeText={setMaxHr} placeholder="–" placeholderTextColor={C.textTertiary} keyboardType="numeric" />
            </View>
          </View>

          {/* Power + Calories */}
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            {isBike && (
              <View style={{ flex: 1 }}>
                {label('Ø POWER (W)')}
                <TextInput style={inputStyle} value={avgPower} onChangeText={setAvgPower} placeholder="–" placeholderTextColor={C.textTertiary} keyboardType="numeric" />
              </View>
            )}
            <View style={{ flex: isBike ? 1 : undefined, minWidth: isBike ? undefined : 120 }}>
              {label('KALORIEN')}
              <TextInput style={inputStyle} value={calories} onChangeText={setCalories} placeholder="–" placeholderTextColor={C.textTertiary} keyboardType="numeric" />
            </View>
          </View>

          {/* Notes */}
          {label('NOTIZEN')}
          <TextInput style={[inputStyle, { minHeight: 80, textAlignVertical: 'top', paddingTop: S.md, marginBottom: S.md }]} value={notes} onChangeText={setNotes} placeholder="Wie hat es sich angefühlt? Besonderheiten…" placeholderTextColor={C.textTertiary} multiline />

          {/* AI Analysis */}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, marginBottom: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, opacity: analyzing ? 0.6 : 1 }}
            onPress={analyze} disabled={analyzing}
          >
            {analyzing ? <ActivityIndicator size="small" color={C.tint} /> : <Feather name="cpu" size={15} color={C.tint} />}
            <Text style={[T.bodyMed, { color: C.tint }]}>KI-Analyse</Text>
          </TouchableOpacity>

          {aiAnalysis ? (
            <View style={{ backgroundColor: C.tint+'10', borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint+'30' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs }}>
                <Feather name="cpu" size={13} color={C.tint} />
                <Text style={[T.label, { color: C.tint }]}>KI-FEEDBACK</Text>
              </View>
              <Text style={[T.body, { color: C.text, lineHeight: 20 }]}>{aiAnalysis}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', marginBottom: S.sm, opacity: saving ? 0.6 : 1 }} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={C.accentText} /> : <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>Abschließen & Speichern</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: S.md, alignItems: 'center' }} onPress={onClose}>
            <Text style={[T.caption, { color: C.textSecondary }]}>Abbrechen</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Chat Modal ───────────────────────────────────────────────
function ChatModal({ visible, onClose }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const [messages, setMessages] = useState([
    { role: 'coach', text: 'Hey! Ich bin dein KI-Coach. Frag mich über deinen Trainingsplan, Anpassungen oder Empfehlungen.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const send = async () => {
    const msg = input.trim();
    if (!msg) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await api.chatWithCoach(msg);
      setMessages(prev => [...prev, { role: 'coach', text: res.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'coach', text: `Fehler: ${e.message}` }]);
    }
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: S.md, paddingTop: S.xl + S.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <Feather name="cpu" size={18} color={C.tint} />
              <View>
                <Text style={[T.bodyMed, { color: C.text }]}>KI Coach</Text>
                <Text style={[T.caption, { color: C.success, fontSize: 11 }]}>Online</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Feather name="x" size={22} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: S.md, gap: S.sm }}>
            {messages.map((m, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row', alignItems: 'flex-start',
                  maxWidth: '88%', padding: S.md,
                  borderRadius: R.lg,
                  backgroundColor: m.role === 'user' ? C.accent : C.surface,
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  borderBottomRightRadius: m.role === 'user' ? 4 : R.lg,
                  borderBottomLeftRadius: m.role === 'coach' ? 4 : R.lg,
                }}
              >
                <Text style={[T.body, { color: m.role === 'user' ? C.accentText : C.text, lineHeight: 20, flex: 1 }]}>{m.text}</Text>
              </View>
            ))}
            {loading && (
              <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, alignSelf: 'flex-start' }}>
                <ActivityIndicator size="small" color={C.tint} />
              </View>
            )}
          </ScrollView>

          <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.md, paddingBottom: S.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, gap: S.sm, backgroundColor: C.bg }}>
            <TextInput
              style={[T.body, { flex: 1, backgroundColor: C.bgSecondary, borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.sm, color: C.text, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }]}
              value={input} onChangeText={setInput}
              placeholder="Frag deinen Coach..."
              placeholderTextColor={C.textTertiary}
              onSubmitEditing={send} returnKeyType="send"
            />
            <TouchableOpacity
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', opacity: !input.trim() ? 0.4 : 1 }}
              onPress={send} disabled={!input.trim()}
            >
              <Feather name="send" size={18} color={C.accentText} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Daily Log Modal ──────────────────────────────────────────
function DailyLogModal({ visible, onClose, onSaved }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const [form, setForm] = useState({ sleepHours:'', sleepQuality:3, mood:3, energy:3, soreness:1, restingHr:'', weight:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      await api.saveDailyLog({
        date: new Date().toISOString().split('T')[0],
        sleepHours: parseFloat(form.sleepHours)||null,
        sleepQuality: form.sleepQuality, mood: form.mood,
        energy: form.energy, soreness: form.soreness,
        restingHr: parseInt(form.restingHr)||null,
        weight: parseFloat(form.weight)||null,
        notes: form.notes,
      });
      onSaved?.(); onClose();
    } catch (e) { Alert.alert('Fehler', e.message); }
    setSaving(false);
  };

  const inputStyle = { backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.md, color: C.text, fontSize: 14, padding: S.md };

  function ScaleRow({ label, value, onChange, min=1, max=5, labels }) {
    return (
      <View style={{ marginBottom: S.md }}>
        <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs }]}>{label.toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', gap: S.xs }}>
          {Array.from({length: max-min+1}, (_,i) => i+min).map(v => (
            <TouchableOpacity
              key={v}
              style={{ flex: 1, backgroundColor: value===v ? C.tint+'20' : C.bgSecondary, borderRadius: R.sm, padding: S.sm, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: value===v ? C.tint : C.border }}
              onPress={() => onChange(v)}
            >
              <Text style={[T.bodyMed, { color: value===v ? C.tint : C.textSecondary }]}>{v}</Text>
              {labels?.[v-min] && <Text style={{ color: C.textTertiary, fontSize: 9, marginTop: 1 }}>{labels[v-min]}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.lg, paddingTop: S.xl }}>
          <Text style={[T.h2, { color: C.text, marginBottom: S.xs }]}>Tagesform eintragen</Text>
          <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.lg }]}>Hilft der KI deinen Plan anzupassen.</Text>

          <View style={{ flexDirection: 'row', gap: S.md, marginBottom: S.md }}>
            <View style={{ flex: 1 }}>
              <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs }]}>SCHLAF (H)</Text>
              <TextInput style={inputStyle} value={form.sleepHours} onChangeText={f('sleepHours')} placeholder="7.5" placeholderTextColor={C.textTertiary} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs }]}>RUHE-HF (BPM)</Text>
              <TextInput style={inputStyle} value={form.restingHr} onChangeText={f('restingHr')} placeholder="55" placeholderTextColor={C.textTertiary} keyboardType="numeric" />
            </View>
          </View>

          <ScaleRow label="Schlafqualität" value={form.sleepQuality} onChange={f('sleepQuality')} labels={['Schlecht','Mäßig','Ok','Gut','Top']} />
          <ScaleRow label="Stimmung" value={form.mood} onChange={f('mood')} labels={['Tief','Mäßig','Ok','Gut','Super']} />
          <ScaleRow label="Energielevel" value={form.energy} onChange={f('energy')} labels={['Leer','Müde','Ok','Fit','Voll']} />
          <ScaleRow label="Muskelkater" value={form.soreness} onChange={f('soreness')} labels={['Kein','Leicht','Mittel','Stark','Sehr']} />

          <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs }]}>GEWICHT (KG, OPTIONAL)</Text>
          <TextInput style={[inputStyle, { marginBottom: S.md }]} value={form.weight} onChangeText={f('weight')} placeholder="75.5" placeholderTextColor={C.textTertiary} keyboardType="numeric" />

          <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs }]}>NOTIZEN</Text>
          <TextInput style={[inputStyle, { minHeight: 70, textAlignVertical: 'top', paddingTop: S.md, marginBottom: S.lg }]} value={form.notes} onChangeText={f('notes')} placeholder="z.B. Knieschmerzen, Schnupfen..." placeholderTextColor={C.textTertiary} multiline />

          <TouchableOpacity style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', marginBottom: S.sm, opacity: saving ? 0.6 : 1 }} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={C.accentText} /> : <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>Speichern</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: S.md, alignItems: 'center' }} onPress={onClose}>
            <Text style={[T.caption, { color: C.textSecondary }]}>Abbrechen</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────
// ── Einheit bearbeiten & verschieben ──────────────────────────────────────────
const EDIT_SPORTS = [
  { key: 'run', label: 'Laufen' }, { key: 'bike', label: 'Rad' }, { key: 'swim', label: 'Schwimmen' },
  { key: 'strength', label: 'Kraft' }, { key: 'yoga', label: 'Yoga' }, { key: 'mobility', label: 'Mobility' },
  { key: 'triathlon', label: 'Triathlon' }, { key: 'other', label: 'Andere' },
];
const EDIT_ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

function SessionEditModal({ visible, session, onClose, onSubmit }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const [focus, setFocus] = useState('');
  const [sportType, setSportType] = useState('run');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState('');
  const [dayIndex, setDayIndex] = useState(0);
  const [isRest, setIsRest] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && session) {
      setFocus(session.focus || '');
      setSportType(session.sport_type || 'run');
      setDuration(session.duration ? String(session.duration) : '');
      setIntensity(session.intensity || '');
      setDayIndex(session.day_index ?? 0);
      setIsRest(!!session.is_rest);
      setExercises(Array.isArray(session.exercises) ? session.exercises.map(e => ({ ...e })) : []);
    }
  }, [visible, session]);

  const updateEx = (i, patch) => setExercises(prev => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const removeEx = (i) => setExercises(prev => prev.filter((_, j) => j !== i));
  const moveEx = (i, dir) => setExercises(prev => {
    const j = i + dir; if (j < 0 || j >= prev.length) return prev;
    const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const addEx = () => setExercises(prev => [...prev, { name: '', sets: 3, reps: '10', duration: 0 }]);
  const showExercises = !isRest && (sportType === 'strength' || exercises.length > 0);

  const submit = async () => {
    setSaving(true);
    try {
      const newDuration = isRest ? 0 : (parseInt(duration) || 0);
      // Profil neu berechnen lassen, wenn sich profil-relevante Felder geändert haben
      const profileChanged = isRest
        || newDuration !== (session?.duration || 0)
        || sportType !== (session?.sport_type)
        || intensity !== (session?.intensity || '');
      await onSubmit({
        focus: focus.trim() || (isRest ? 'Ruhetag' : 'Training'),
        sport_type: isRest ? 'rest' : sportType,
        duration: newDuration,
        intensity: isRest ? '' : intensity,
        day_index: dayIndex,
        is_rest: isRest,
        exercises: isRest ? [] : exercises.filter(e => (e.name || '').trim()),
        ...(profileChanged ? { steps: null } : {}),
      });
      onClose();
    } catch (e) {
      Alert.alert('Fehler', e.message || 'Konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.md, color: C.text, fontSize: 15, padding: S.md };
  const lbl = (t) => <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs, marginTop: S.md }]}>{t}</Text>;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.lg, paddingTop: S.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
          <TouchableOpacity onPress={onClose} hitSlop={8}><Feather name="x" size={22} color={C.textSecondary} /></TouchableOpacity>
          <Text style={[T.h3, { color: C.text, flex: 1 }]}>Einheit bearbeiten</Text>
          <TouchableOpacity onPress={submit} disabled={saving} style={{ backgroundColor: C.accent, borderRadius: R.full, paddingHorizontal: 16, paddingVertical: 8, opacity: saving ? 0.6 : 1 }}>
            {saving ? <ActivityIndicator size="small" color={C.accentText} /> : <Text style={[T.label, { color: C.accentText, fontWeight: '700' }]}>Speichern</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {/* Wochentag (Verschieben) */}
          {lbl('Wochentag (verschieben)')}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DAY_SHORT.map((d, i) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDayIndex(i)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: R.sm, alignItems: 'center', backgroundColor: dayIndex === i ? C.accent : C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: dayIndex === i ? C.accent : C.border }}
              >
                <Text style={{ color: dayIndex === i ? C.accentText : C.textSecondary, fontWeight: '700', fontSize: 12 }}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Ruhetag-Toggle */}
          <TouchableOpacity
            onPress={() => setIsRest(v => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.lg, padding: S.md, backgroundColor: C.surface, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: isRest ? C.accent : C.border }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: isRest ? C.accent : C.borderStrong, backgroundColor: isRest ? C.accent : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
              {isRest && <Feather name="check" size={13} color={C.bg} />}
            </View>
            <Text style={[T.body, { color: C.text, flex: 1 }]}>Als Ruhetag markieren</Text>
          </TouchableOpacity>

          {!isRest && (
            <>
              {/* Sportart */}
              {lbl('Sportart')}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
                {EDIT_SPORTS.map(s => {
                  const active = sportType === s.key;
                  const col = getSportColor(s.key);
                  return (
                    <TouchableOpacity
                      key={s.key}
                      onPress={() => setSportType(s.key)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: R.full, backgroundColor: active ? `${col}20` : C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: active ? col : C.border }}
                    >
                      <MaterialCommunityIcons name={SPORT_MCI[s.key] || 'star'} size={15} color={active ? col : C.textTertiary} />
                      <Text style={[T.label, { color: active ? C.text : C.textSecondary }]}>{s.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Fokus */}
              {lbl('Fokus / Beschreibung')}
              <TextInput style={inputStyle} value={focus} onChangeText={setFocus} placeholder="z.B. Lockerer Dauerlauf" placeholderTextColor={C.textTertiary} />

              {/* Dauer */}
              {lbl('Dauer (Min)')}
              <TextInput style={inputStyle} value={duration} onChangeText={setDuration} placeholder="z.B. 60" placeholderTextColor={C.textTertiary} keyboardType="number-pad" />

              {/* Intensität */}
              {lbl('Intensität / Zone')}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setIntensity('')}
                  style={{ paddingVertical: 9, paddingHorizontal: 12, borderRadius: R.sm, backgroundColor: !intensity ? C.accent : C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: !intensity ? C.accent : C.border }}
                >
                  <Text style={{ color: !intensity ? C.accentText : C.textSecondary, fontWeight: '600', fontSize: 12 }}>—</Text>
                </TouchableOpacity>
                {EDIT_ZONES.map(z => (
                  <TouchableOpacity
                    key={z}
                    onPress={() => setIntensity(z)}
                    style={{ flex: 1, paddingVertical: 9, borderRadius: R.sm, alignItems: 'center', backgroundColor: intensity === z ? C.accent : C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: intensity === z ? C.accent : C.border }}
                  >
                    <Text style={{ color: intensity === z ? C.accentText : C.textSecondary, fontWeight: '700', fontSize: 12 }}>{z}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Übungen (bei Kraft / wenn vorhanden) */}
              {showExercises && (
                <>
                  {lbl('Übungen')}
                  <View style={{ gap: S.sm }}>
                    {exercises.map((ex, i) => (
                      <View key={i} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TextInput
                            style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: '600', paddingVertical: 4 }}
                            value={ex.name} onChangeText={t => updateEx(i, { name: t })}
                            placeholder="Übungsname (z.B. Kniebeugen)" placeholderTextColor={C.textTertiary}
                          />
                          <TouchableOpacity onPress={() => moveEx(i, -1)} disabled={i === 0} hitSlop={6} style={{ opacity: i === 0 ? 0.3 : 1, padding: 2 }}><Feather name="chevron-up" size={18} color={C.textSecondary} /></TouchableOpacity>
                          <TouchableOpacity onPress={() => moveEx(i, 1)} disabled={i === exercises.length - 1} hitSlop={6} style={{ opacity: i === exercises.length - 1 ? 0.3 : 1, padding: 2 }}><Feather name="chevron-down" size={18} color={C.textSecondary} /></TouchableOpacity>
                          <TouchableOpacity onPress={() => removeEx(i)} hitSlop={6} style={{ padding: 2 }}><Feather name="trash-2" size={17} color={C.danger} /></TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <Text style={[T.label, { color: C.textTertiary }]}>Sätze</Text>
                          <TextInput
                            style={{ width: 46, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.sm, color: C.text, fontSize: 14, paddingVertical: 6, textAlign: 'center' }}
                            value={ex.sets != null ? String(ex.sets) : ''} onChangeText={t => updateEx(i, { sets: parseInt(t) || 0 })}
                            keyboardType="number-pad" placeholder="3" placeholderTextColor={C.textTertiary}
                          />
                          <Text style={[T.label, { color: C.textTertiary }]}>Wdh.</Text>
                          <TextInput
                            style={{ width: 70, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.sm, color: C.text, fontSize: 14, paddingVertical: 6, textAlign: 'center' }}
                            value={ex.reps != null ? String(ex.reps) : ''} onChangeText={t => updateEx(i, { reps: t })}
                            placeholder="8-12" placeholderTextColor={C.textTertiary}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity onPress={addEx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: S.sm, paddingVertical: 12, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.accent, borderStyle: 'dashed' }}>
                    <Feather name="plus" size={16} color={C.accent} />
                    <Text style={[T.label, { color: C.accent, fontWeight: '700' }]}>Übung hinzufügen</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Einheit per KI neu erstellen ──────────────────────────────────────────────
function RegenerateModal({ visible, onClose, onSubmit, loading }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const [instruction, setInstruction] = useState('');
  useEffect(() => { if (visible) setInstruction(''); }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: S.lg, paddingBottom: S.xl + 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm }}>
              <Feather name="repeat" size={18} color={C.tint} />
              <Text style={[T.h3, { color: C.text, flex: 1 }]}>Einheit austauschen</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8} disabled={loading}><Feather name="x" size={20} color={C.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.md }]}>
              Die KI ersetzt die Einheit durch die, die an diesem Tag am besten in deine Woche passt (Athletenprofil + Erholung). Optionaler Wunsch:
            </Text>
            <TextInput
              style={{ backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.md, color: C.text, fontSize: 15, padding: S.md, minHeight: 64, textAlignVertical: 'top', marginBottom: S.md }}
              value={instruction} onChangeText={setInstruction} multiline editable={!loading}
              placeholder="z.B. mehr Intervalle · kürzer · lockerer · anderer Fokus" placeholderTextColor={C.textTertiary}
            />
            <TouchableOpacity
              onPress={() => onSubmit(instruction)} disabled={loading}
              style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? <ActivityIndicator size="small" color={C.accentText} /> : <Feather name="refresh-cw" size={16} color={C.accentText} />}
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>{loading ? 'KI erstellt…' : 'Neu erstellen'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function TrainingScreen({ navigation, route, tabBar } = {}) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, trainingPlan, fetchTrainingPlan, generateTrainingPlan, geminiKey, externalData, returnFromBreak, setReturnFromBreak, updateSessionAt, regenerateSessionAt, rebalancePlan, lastEditedSessionId, generateMobilityFlow, mobilityResult, dailyContext, athleteInsight, fetchAthleteInsight } = useStore();
  const { routines, sessions, fetchSessions } = useKraftStore();
  const [selectedDay, setSelectedDay] = useState(getTodayIndex());
  const [completedMap, setCompletedMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showDailyLog, setShowDailyLog] = useState(false);
  const [trainingType, setTrainingType] = useState('mixed');
  const [completeSession, setCompleteSession] = useState(null);
  const [showSessionInfo, setShowSessionInfo] = useState(false);
  const [infoSession, setInfoSession] = useState(null);
  const [showSessionEdit, setShowSessionEdit] = useState(false);
  const [editSession, setEditSession] = useState(null);
  const [editIndex, setEditIndex] = useState(-1);
  const [showRegen, setShowRegen] = useState(false);
  const [regenIndex, setRegenIndex] = useState(-1);
  const [regenLoading, setRegenLoading] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [detailWorkout, setDetailWorkout] = useState(null); // absolvierte Einheit (Strava-Detail)
  const [freshFeedback, setFreshFeedback] = useState(null); // frische KI-Analyse als Popup

  // Neueste Einheit mit KI-Feedback, die noch nicht als Popup gesehen wurde → Popup
  useEffect(() => {
    (async () => {
      const list = trainingPlan?.completedWorkouts || [];
      console.log('[KI-DEBUG] completedWorkouts=', list.length, 'mitFb=', list.filter(w => w.ai_feedback).length, 'ids=', list.map(w => w.id).join(','));
      const cand = list
        .map(w => { let fb = null; try { fb = typeof w.ai_feedback === 'string' ? JSON.parse(w.ai_feedback) : w.ai_feedback; } catch (e) {} return { w, fb }; })
        .filter(x => x.fb?.feedback)
        .sort((a, b) => String(b.w.completed_at || b.w.date).localeCompare(String(a.w.completed_at || a.w.date)));
      if (!cand.length) return;
      try {
        const seen = JSON.parse((await AsyncStorage.getItem('seen_activity_feedback')) || '[]');
        const next = cand.find(x => !seen.includes(x.w.id));
        if (next) setFreshFeedback(next);
      } catch (e) {}
    })();
  }, [trainingPlan]);

  const dismissFresh = async () => {
    if (freshFeedback) {
      try {
        const seen = JSON.parse((await AsyncStorage.getItem('seen_activity_feedback')) || '[]');
        seen.push(freshFeedback.w.id);
        await AsyncStorage.setItem('seen_activity_feedback', JSON.stringify(seen.slice(-100)));
      } catch (e) {}
    }
    setFreshFeedback(null);
  };

  const handleRegenerate = async (instruction) => {
    setRegenLoading(true);
    try { await regenerateSessionAt(regenIndex, instruction); setShowRegen(false); }
    catch (e) { Alert.alert('Fehler', e.message || 'KI nicht verfügbar'); }
    finally { setRegenLoading(false); }
  };

  const trainingConflicts = useMemo(() => detectTrainingConflicts(trainingPlan?.sessions), [trainingPlan]);
  const [flowStarting, setFlowStarting] = useState(false);

  const startMobilityFlow = async (session) => {
    setFlowStarting(true);
    try {
      const focusZones = weakestZones(mobilityResult?.byZone, 2);
      const sport = Array.isArray(user?.sportTypes) && user.sportTypes.length ? user.sportTypes[0] : null;
      const flow = await generateMobilityFlow({ minutes: session.duration || 15, equipment: '', focusZones, sport, weekKey: trainingPlan?.week_key, dayIndex: session.day_index });
      navigation?.navigate('MobilityFlow', { flow, sessionId: session.id, planId: trainingPlan?.id, dayIndex: session.day_index });
    } catch (e) {
      Alert.alert('Fehler', e.message || 'Flow konnte nicht erstellt werden.');
    } finally {
      setFlowStarting(false);
    }
  };

  const handleRebalance = async () => {
    setRebalancing(true);
    try { await rebalancePlan(trainingPlan?.week_key || getCurrentWeekKey(), lastEditedSessionId); }
    catch (e) { Alert.alert('Fehler', e.message || 'Konnte den Plan nicht ausbalancieren'); }
    finally { setRebalancing(false); }
  };
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [trainingPhase, setTrainingPhase] = useState('');
  const [includeRoutines, setIncludeRoutines] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const retryTimer = useRef(null);
  const pendingContext = useRef(null);
  const pendingIncludeRoutines = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const todayIdx = getTodayIndex();

  useEffect(() => { loadPlan(); }, []);
  useEffect(() => { if (sessions.length === 0) fetchSessions(40); }, []);
  useEffect(() => { fetchAthleteInsight(); }, []);

  // Trainingsstatus: Pausenerkennung, Belastungs- & Ermüdungstrend
  const trainingStatus = useMemo(() =>
    analyzeTrainingStatus({ kraftSessions: sessions, externalData, manualOverride: returnFromBreak }),
    [sessions, externalData, returnFromBreak]
  );

  // Recovery-Coaching: Schlaf/Readiness/Energie/Muskelkater → heute leichter + Recovery-Flow
  const recovery = useMemo(() =>
    assessRecovery({ dailyContext, externalData, trainingStatus }),
    [dailyContext, externalData, trainingStatus]
  );
  const todaySessionIdxs = useMemo(() =>
    (trainingPlan?.sessions || []).map((s, i) => ({ s, i })).filter((x) => x.s.day_index === todayIdx && !x.s.is_rest).map((x) => x.i),
    [trainingPlan, todayIdx]
  );
  const [easing, setEasing] = useState(false);

  const handleEaseToday = async () => {
    if (!todaySessionIdxs.length) { Alert.alert('Kein Training heute', 'Für heute ist keine Einheit geplant.'); return; }
    setEasing(true);
    try {
      for (const i of todaySessionIdxs) await regenerateSessionAt(i, EASE_INSTRUCTION);
      Alert.alert('Angepasst', 'Die heutige Einheit wurde leichter & regenerativer gestaltet.');
    } catch (e) { Alert.alert('Fehler', e.message || 'KI nicht verfügbar'); }
    finally { setEasing(false); }
  };

  const handleRecoveryFlow = async () => {
    setFlowStarting(true);
    try {
      const focusZones = weakestZones(mobilityResult?.byZone, 2);
      const sport = Array.isArray(user?.sportTypes) && user.sportTypes.length ? user.sportTypes[0] : null;
      const flow = await generateMobilityFlow({ minutes: 12, equipment: '', focusZones, sport, goal: 'recovery', weekKey: trainingPlan?.week_key });
      navigation?.navigate('MobilityFlow', { flow });
    } catch (e) { Alert.alert('Fehler', e.message || 'Flow konnte nicht erstellt werden.'); }
    finally { setFlowStarting(false); }
  };

  useEffect(() => {
    if (trainingPlan) {
      const map = {};
      trainingPlan.completedWorkouts?.forEach(w => {
        if (w.session_id) map[`session_${w.session_id}`] = true;
        if (w.day_index != null) map[`day_${w.day_index}`] = true;
      });
      setCompletedMap(map);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [trainingPlan]);

  const loadPlan = async () => {
    setLoading(true);
    await fetchTrainingPlan(getCurrentWeekKey());
    setLoading(false);
  };

  const handleGenerate = () => setShowGenerateModal(true);

  const startRetryCountdown = (seconds, withContext) => {
    pendingContext.current = withContext;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    let remaining = seconds;
    setRetryCountdown(remaining);
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        setRetryCountdown(0);
        retryTimer.current = null;
        doGenerateInner(pendingContext.current, true);
      } else {
        setRetryCountdown(remaining);
        retryTimer.current = setTimeout(tick, 1000);
      }
    };
    retryTimer.current = setTimeout(tick, 1000);
  };

  const doGenerateInner = async (withContext, isRetry = false) => {
    setGenerating(true);
    fadeAnim.setValue(0);
    try {
      // trainingContext wird im Store automatisch immer als Regel mitgegeben
      // Hier nur die session-spezifische manuelle Phaseneingabe übergeben
      const phaseNote = trainingPhase.trim() ? `Aktuelle Trainingsphase: ${trainingPhase.trim()}` : '';
      const routinesToPass = pendingIncludeRoutines.current ? routines : [];
      await generateTrainingPlan(trainingType, getCurrentWeekKey(), phaseNote, routinesToPass, trainingStatus);
    } catch(e) {
      const msg = e.message || 'Unbekannter Fehler';
      const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)/i);
      const isRateLimit = retryMatch || /quota|rate.limit|429|resource.*exhaust/i.test(msg);
      if (isRateLimit && !isRetry) {
        const secs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 3 : 65;
        startRetryCountdown(secs, withContext);
      } else {
        Alert.alert('Fehler beim Generieren', msg);
      }
    }
    setGenerating(false);
  };

  const doGenerate = (withContext) => {
    setShowGenerateModal(false);
    pendingIncludeRoutines.current = includeRoutines;
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    setRetryCountdown(0);
    doGenerateInner(withContext, false);
  };

  const toggleExercise = useCallback((dayIndex, exIndex) => {
    const key = `${dayIndex}-${exIndex}`;
    setCompletedMap(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const sessionsByDay = {};
  for (let i = 0; i < 7; i++) {
    sessionsByDay[i] = trainingPlan?.sessions?.filter(s => s.day_index === i) || [];
  }

  // Abgeschlossene Einheiten nach Wochentag (erscheinen am jeweiligen Tag, nicht separat)
  const completedByDay = {};
  for (const w of (trainingPlan?.completedWorkouts || [])) {
    let di = w.day_index;
    if (di == null) { try { di = (new Date((w.date) + 'T12:00:00').getDay() + 6) % 7; } catch (e) {} }
    if (di == null) continue;
    (completedByDay[di] = completedByDay[di] || []).push(w);
  }

  const isWorkoutDone = (dayIndex) => {
    if (completedMap[`day_${dayIndex}`]) return true;
    if ((completedByDay[dayIndex] || []).length > 0) return true;
    const days = sessionsByDay[dayIndex] || [];
    const trainSessions = days.filter(s => !s.is_rest);
    if (trainSessions.length === 0) return false;
    return trainSessions.every(s => completedMap[`session_${s.id}`]);
  };

  const daySessions = sessionsByDay[selectedDay] || [];
  const currentSession = daySessions[0] || null;
  const primarySportType = daySessions[0]?.sport_type || trainingPlan?.planData?.days?.[selectedDay]?.sportType;
  const sportColor = getSportColor(primarySportType);

  const uniqueTrainDays = new Set(trainingPlan?.sessions?.filter(s => !s.is_rest).map(s => s.day_index) || []);
  const totalTrainDays = uniqueTrainDays.size;
  const completedDays = [...uniqueTrainDays].filter(i => isWorkoutDone(i)).length;
  const isNewWeek = trainingPlan && trainingPlan.week_key !== getCurrentWeekKey();

  const getSportTypes = () => {
    const types = user?.sportTypes || [];
    if (types.length === 0) return 'gemischt';
    const labels = { swim: 'Schwimmen', bike: 'Rad', run: 'Laufen', strength: 'Kraft', yoga: 'Yoga', mobility: 'Mobility', triathlon: 'Triathlon', mixed: 'Gemischt', hyrox: 'Hyrox', calisthenics: 'Calisthenics', row: 'Rudern', hike: 'Wandern', climbing: 'Klettern', pilates: 'Pilates' };
    return types.map(t => labels[t] || t).join(' + ');
  };

  return (
    <>
      {tabBar}
      <SessionInfoModal
        visible={showSessionInfo}
        session={infoSession}
        onClose={() => setShowSessionInfo(false)}
        onComplete={() => { setCompleteSession(infoSession); setShowComplete(true); }}
      />
      <CompleteModal
        visible={showComplete}
        session={completeSession || currentSession}
        planId={trainingPlan?.id}
        onClose={() => { setShowComplete(false); setCompleteSession(null); }}
        onSaved={loadPlan}
        geminiKey={geminiKey}
        user={user}
      />
      <ChatModal visible={showChat} onClose={() => setShowChat(false)} />
      <DailyLogModal visible={showDailyLog} onClose={() => setShowDailyLog(false)} />
      <SessionEditModal
        visible={showSessionEdit}
        session={editSession}
        onClose={() => { setShowSessionEdit(false); setEditSession(null); setEditIndex(-1); }}
        onSubmit={async (updates) => { if (editIndex >= 0) await updateSessionAt(editIndex, updates); }}
      />
      <RegenerateModal
        visible={showRegen}
        loading={regenLoading}
        onClose={() => { if (!regenLoading) setShowRegen(false); }}
        onSubmit={handleRegenerate}
      />

      {/* Generate Modal */}
      <Modal visible={showGenerateModal} transparent animationType="fade" onRequestClose={() => setShowGenerateModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: S.lg, paddingBottom: S.xl + 16 }}>
            <Text style={[T.h3, { color: C.text, marginBottom: S.sm }]}>Trainingsplan erstellen</Text>

            {/* Trainingsphase */}
            <Text style={[T.label, { color: C.textTertiary, marginBottom: 6 }]}>AKTUELLE PHASE (optional)</Text>
            <TextInput
              style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, color: C.text, fontSize: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.md }}
              value={trainingPhase}
              onChangeText={setTrainingPhase}
              placeholder="z.B. Fokus Laufen, Woche 2 · oder: Deload"
              placeholderTextColor={C.textTertiary}
            />

            {/* Trainingsstatus-Hinweis */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.md, padding: S.sm, backgroundColor: getTrainingStatusColor(trainingStatus, C) + '12', borderRadius: R.sm }}>
              <Feather name={getTrainingStatusIcon(trainingStatus)} size={13} color={getTrainingStatusColor(trainingStatus, C)} />
              <Text style={[T.caption, { color: getTrainingStatusColor(trainingStatus, C), flex: 1 }]}>
                Trainingsstatus: {trainingStatus.summaryDe}
              </Text>
            </View>

            {/* Wiedereinstieg nach Pause */}
            <TouchableOpacity
              onPress={() => setReturnFromBreak(!returnFromBreak?.active)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.md, padding: S.sm, backgroundColor: C.surface, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: returnFromBreak?.active ? C.accent : C.border }}
              activeOpacity={0.7}
            >
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: returnFromBreak?.active ? C.accent : C.borderStrong, backgroundColor: returnFromBreak?.active ? C.accent : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                {returnFromBreak?.active && <Feather name="check" size={13} color={C.bg} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { color: C.text }]}>Ich starte nach einer Pause neu</Text>
                <Text style={[T.caption, { color: C.textTertiary }]}>Plan startet mit reduziertem Volumen & Intensität</Text>
              </View>
            </TouchableOpacity>

            {/* Routinen einbeziehen */}
            {routines.length > 0 && (
              <TouchableOpacity
                onPress={() => setIncludeRoutines(v => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.md, padding: S.sm, backgroundColor: C.surface, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: includeRoutines ? C.accent : C.border }}
                activeOpacity={0.7}
              >
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: includeRoutines ? C.accent : C.borderStrong, backgroundColor: includeRoutines ? C.accent : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                  {includeRoutines && <Feather name="check" size={13} color={C.bg} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { color: C.text }]}>Meine Routinen einbeziehen</Text>
                  <Text style={[T.caption, { color: C.textTertiary }]}>{routines.length} Routine{routines.length !== 1 ? 'n' : ''} · KI nutzt deine Übungen</Text>
                </View>
              </TouchableOpacity>
            )}

            {(user?.trainingContext || user?.trainingContextFile?.content) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.md, padding: S.sm, backgroundColor: C.tint + '12', borderRadius: R.sm }}>
                <Feather name="paperclip" size={13} color={C.tint} />
                <Text style={[T.caption, { color: C.tint, flex: 1 }]}>
                  {user?.trainingContextFile?.content ? `Datei: ${user.trainingContextFile.name}` : 'Hinweise hinterlegt'}
                  {' · '}wird an KI übergeben
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', marginBottom: S.sm }}
              onPress={() => doGenerate(true)}
            >
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>
                {(user?.trainingContext || user?.trainingContextFile?.content) ? 'Mit Kontext generieren' : 'Plan generieren'}
              </Text>
            </TouchableOpacity>
            {(user?.trainingContext || user?.trainingContextFile?.content) && (
              <TouchableOpacity
                style={{ borderRadius: R.md, padding: S.md, alignItems: 'center', marginBottom: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                onPress={() => doGenerate(false)}
              >
                <Text style={[T.body, { color: C.textSecondary }]}>Ohne Kontext generieren</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{ padding: S.md, alignItems: 'center' }} onPress={() => setShowGenerateModal(false)}>
              <Text style={[T.caption, { color: C.textTertiary }]}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 130, paddingHorizontal: S.md, paddingTop: tabBar ? S.md : insets.top + S.md }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs }}>
          <Text style={[T.h1, { color: C.text }]}>Training</Text>
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <TouchableOpacity
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setShowDailyLog(true)}
            >
              <Feather name="edit-3" size={16} color={C.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.tint+'18', borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint+'40', alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setShowChat(true)}
            >
              <Feather name="cpu" size={16} color={C.tint} />
            </TouchableOpacity>
          </View>
        </View>
        {(() => { const phase = getCurrentPhaseText(user); return phase ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs, backgroundColor: C.tint+'14', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: 4, alignSelf: 'flex-start' }}>
            <Feather name="calendar" size={11} color={C.tint} />
            <Text style={[T.label, { color: C.tint, fontSize: 11 }]}>{phase.display} · Woche {phase.weekNumber}</Text>
          </View>
        ) : null; })()}
        <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.lg }]}>
          {getSportTypes()}
        </Text>

        {/* Stats row (when plan exists) */}
        {trainingPlan && (
          <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
            {[
              [completedDays.toString(), 'Abgeschlossen', C.success],
              [totalTrainDays.toString(), 'Geplant', C.text],
              [(() => { const mins = trainingPlan.sessions?.filter(s=>!s.is_rest).reduce((a,s)=>a+(s.duration||0),0)||0; return mins>0?(mins/60).toFixed(1)+'h':'–'; })(), 'Wochenstunden', C.tint],
            ].map(([val, label, color]) => (
              <View key={label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <Text style={[T.h2, { color }]} numberOfLines={1} adjustsFontSizeToFit>{val}</Text>
                <Text style={[T.label, { color: C.textSecondary, marginTop: 2 }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* New week banner */}
        {isNewWeek && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.warning+'12', borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.warning+'40' }}
            onPress={handleGenerate}
          >
            <Feather name="refresh-cw" size={16} color={C.warning} />
            <Text style={[T.caption, { color: C.warning, marginLeft: S.sm, flex: 1 }]}>Neue Woche — Plan aktualisieren?</Text>
            <Feather name="chevron-right" size={14} color={C.warning} />
          </TouchableOpacity>
        )}

        {/* Generate button */}
        <TouchableOpacity
          style={{ backgroundColor: retryCountdown > 0 ? C.bgTertiary : C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', marginBottom: S.lg, opacity: generating ? 0.6 : 1 }}
          onPress={handleGenerate} disabled={generating || retryCountdown > 0}
        >
          {generating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <ActivityIndicator color={C.accentText} size="small" />
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>KI erstellt Plan…</Text>
            </View>
          ) : retryCountdown > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <Feather name="clock" size={15} color={C.textSecondary} />
              <Text style={[T.bodyMed, { color: C.textSecondary, fontWeight: '600' }]}>Automatischer Retry in {retryCountdown}s…</Text>
            </View>
          ) : (
            <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>
              {trainingPlan ? 'Neuen Plan generieren' : 'Trainingsplan erstellen'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Loading */}
        {loading && !trainingPlan && (
          <View style={{ alignItems: 'center', paddingVertical: S.xl }}>
            <ActivityIndicator color={C.textSecondary} />
            <Text style={[T.caption, { color: C.textSecondary, marginTop: S.md }]}>Lade Plan…</Text>
          </View>
        )}

        {/* Empty state */}
        {!trainingPlan && !loading && !generating && (
          <View style={{ alignItems: 'center', paddingVertical: S.xxl }}>
            <MaterialCommunityIcons name="weight-lifter" size={44} color={C.tint} style={{ marginBottom: S.md }} />
            <Text style={[T.h3, { color: C.text, marginBottom: S.sm }]}>Dein persönlicher Coach</Text>
            <Text style={[T.caption, { color: C.textSecondary, textAlign: 'center', lineHeight: 20 }]}>
              Die KI erstellt einen maßgeschneiderten Wochenplan — basierend auf deinem Athletenprofil, Zielen und Wettkämpfen.
            </Text>
          </View>
        )}

        {/* Plan */}
        {trainingPlan && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={{ marginBottom: S.md }}>
              <Text style={[T.h3, { color: C.text }]}>{trainingPlan.plan_name || trainingPlan.planData?.planName}</Text>
              {(trainingPlan.description || trainingPlan.planData?.description) && (
                <Text style={[T.caption, { color: C.textSecondary, marginTop: 2 }]}>{trainingPlan.description || trainingPlan.planData?.description}</Text>
              )}
            </View>

            {/* KI-Coach: automatische Einheiten-Analyse (Profil-Anpassungen + Belastung) */}
            {athleteInsight?.nachricht && (() => {
              const applied = athleteInsight.applied || {};
              const appliedParts = [
                applied.fitnessLevel && `Level: ${{ beginner: 'Anfänger', intermediate: 'Fortgeschritten', advanced: 'Fortgeschritten+', elite: 'Elite' }[applied.fitnessLevel] || applied.fitnessLevel}`,
                applied.ftp && `FTP: ${applied.ftp} W`,
                applied.maxHr && `maxHF: ${applied.maxHr}`,
                applied.runPace && `Lauf-Pace: ${Math.floor(applied.runPace / 60)}:${String(applied.runPace % 60).padStart(2, '0')}/km`,
                applied.swimPace && `Schwimm-Pace: ${Math.floor(applied.swimPace / 60)}:${String(applied.swimPace % 60).padStart(2, '0')}/100m`,
              ].filter(Boolean);
              const loadColor = athleteInsight.belastung === 'zu_hoch' ? C.danger : athleteInsight.belastung === 'zu_niedrig' ? C.warning : C.success;
              const loadLabel = athleteInsight.belastung === 'zu_hoch' ? 'Belastung zu hoch' : athleteInsight.belastung === 'zu_niedrig' ? 'Luft nach oben' : 'Belastung passend';
              return (
                <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: 6 }}>
                    <Feather name="cpu" size={15} color={C.text} />
                    <Text style={[T.label, { color: C.textTertiary, flex: 1 }]}>DEIN KI-COACH</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: loadColor + '18', borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: loadColor }} />
                      <Text style={[T.label, { color: loadColor }]}>{loadLabel}</Text>
                    </View>
                  </View>
                  <Text style={[T.caption, { color: C.textSecondary, lineHeight: 18 }]}>{athleteInsight.nachricht}</Text>
                  {appliedParts.length > 0 && (
                    <Text style={[T.caption, { color: C.text, marginTop: 6 }]}>
                      Automatisch angepasst: <Text style={{ fontWeight: '700' }}>{appliedParts.join(' · ')}</Text>
                    </Text>
                  )}
                </View>
              );
            })()}

            {/* Recovery-Coaching: schlecht erholt → heute leichter + Recovery-Flow */}
            {recovery.level !== 'good' && recovery.hasData && (
              <View style={{ backgroundColor: (recovery.poor ? C.danger : C.warning) + '14', borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: (recovery.poor ? C.danger : C.warning) + '50' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: 4 }}>
                  <Feather name="moon" size={15} color={recovery.poor ? C.danger : C.warning} />
                  <Text style={[T.bodyMed, { color: recovery.poor ? C.danger : C.warning, flex: 1 }]}>{recovery.summaryDe}</Text>
                </View>
                {recovery.reasons.length > 0 && (
                  <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.sm }]}>{recovery.reasons.join(' · ')}</Text>
                )}
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                  {todaySessionIdxs.length > 0 && (
                    <TouchableOpacity
                      onPress={handleEaseToday}
                      disabled={easing || flowStarting}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: recovery.poor ? C.danger : C.warning, borderRadius: R.md, paddingVertical: 11, opacity: (easing || flowStarting) ? 0.6 : 1 }}
                    >
                      {easing ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="trending-down" size={15} color="#fff" />}
                      <Text style={[T.label, { color: '#fff', fontWeight: '700' }]}>{easing ? 'KI passt an…' : 'Einheit leichter'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleRecoveryFlow}
                    disabled={easing || flowStarting}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingVertical: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, opacity: (easing || flowStarting) ? 0.6 : 1 }}
                  >
                    {flowStarting ? <ActivityIndicator size="small" color={C.text} /> : <Feather name="wind" size={15} color={C.text} />}
                    <Text style={[T.label, { color: C.text, fontWeight: '700' }]}>{flowStarting ? 'Flow…' : 'Recovery-Flow'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Überlastungs-Warnung + KI-Ausbalancieren (Button immer verfügbar) */}
            {trainingConflicts.length > 0 ? (
              <View style={{ backgroundColor: C.warning + '14', borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.warning + '50' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: 6 }}>
                  <Feather name="alert-triangle" size={15} color={C.warning} />
                  <Text style={[T.bodyMed, { color: C.warning, flex: 1 }]}>Mögliche Überlastung</Text>
                </View>
                {trainingConflicts.map((c, i) => (
                  <Text key={i} style={[T.caption, { color: C.textSecondary, marginBottom: 4 }]}>{c.message}</Text>
                ))}
                <TouchableOpacity
                  onPress={handleRebalance}
                  disabled={rebalancing}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.warning, borderRadius: R.md, paddingVertical: 12, marginTop: S.sm, opacity: rebalancing ? 0.6 : 1 }}
                >
                  {rebalancing ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="shuffle" size={16} color="#fff" />}
                  <Text style={[T.bodyMed, { color: '#fff', fontWeight: '700' }]}>{rebalancing ? 'KI balanciert…' : 'Plan ausbalancieren (KI)'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleRebalance}
                disabled={rebalancing}
                style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.sm, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.md }}
              >
                {rebalancing ? <ActivityIndicator size="small" color={C.textSecondary} /> : <Feather name="shuffle" size={13} color={C.textSecondary} />}
                <Text style={[T.label, { color: C.textSecondary }]}>{rebalancing ? 'KI balanciert…' : 'Woche optimal verteilen (KI)'}</Text>
              </TouchableOpacity>
            )}

            {/* Week day pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S.lg }}>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                {DAY_SHORT.map((d, i) => {
                  const dSessions = sessionsByDay[i] || [];
                  const isRest = dSessions.length === 0 || dSessions.every(s => s.is_rest);
                  const isDone = isWorkoutDone(i);
                  const isSelected = i === selectedDay;
                  const isToday = i === todayIdx;
                  const firstColor = getSportColor(dSessions[0]?.sport_type);
                  return (
                    <TouchableOpacity
                      key={d}
                      style={{
                        alignItems: 'center', paddingVertical: S.sm, paddingHorizontal: S.md,
                        borderRadius: R.md,
                        backgroundColor: isDone ? C.success+'12' : isSelected ? `${firstColor}18` : C.surface,
                        borderWidth: isToday ? (isSelected ? 2 : 1.5) : StyleSheet.hairlineWidth,
                        borderColor: isToday ? C.accent : (isDone ? C.success : isSelected ? firstColor : C.border),
                        minWidth: 52, opacity: isRest && !isSelected ? 0.5 : 1,
                      }}
                      onPress={() => setSelectedDay(i)}
                    >
                      <Text style={[T.label, { color: isDone ? C.success : isSelected ? firstColor : C.textSecondary, marginBottom: 3 }]}>{d}</Text>
                      <View style={{ flexDirection: 'row', gap: 3, justifyContent: 'center', minHeight: 10 }}>
                        {isRest
                          ? <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: isDone ? C.success + '60' : C.border }} />
                          : dSessions.filter(s => !s.is_rest).slice(0, 3).map((s, si) => {
                              const iconName = SPORT_MCI[s.sport_type] || 'run';
                              const iconColor = isDone ? C.success : getSportColor(s.sport_type);
                              return <MaterialCommunityIcons key={si} name={iconName} size={10} color={iconColor} />;
                            })
                        }
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Day detail */}
            {(daySessions.length > 0 || (completedByDay[selectedDay] || []).length > 0) && (
              <View>
                <Text style={[T.h3, { color: C.text, marginBottom: S.md }]}>{DAYS[selectedDay]}</Text>

                {/* Absolvierte Einheiten dieses Tages (Strava-Feed-Karten) */}
                {(completedByDay[selectedDay] || []).length > 0 && (
                  <View style={{ marginBottom: S.lg, gap: S.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name="check-circle" size={15} color={C.success} />
                      <Text style={[T.label, { color: C.success, textTransform: 'uppercase' }]}>Absolviert</Text>
                    </View>
                    {(completedByDay[selectedDay] || []).map((w, ci) => (
                      <ActivityCard key={w.id || ci} workout={w} width={Dimensions.get('window').width - S.md * 2} onPress={() => setDetailWorkout(w)} />
                    ))}
                  </View>
                )}

                {(daySessions.length === 0 || daySessions.every(s => s.is_rest)) && !(completedByDay[selectedDay] || []).length ? (
                  <View style={{ backgroundColor: C.surface, borderRadius: R.xl, padding: S.xl, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.md }}>
                    <Feather name="moon" size={38} color={C.textTertiary} style={{ marginBottom: S.md }} />
                    <Text style={[T.h3, { color: C.text }]}>Ruhetag</Text>
                    <Text style={[T.caption, { color: C.textSecondary, marginTop: S.sm, textAlign: 'center' }]}>
                      Aktive Erholung, Dehnen oder Spaziergang sind ok.
                    </Text>
                    <TouchableOpacity
                      onPress={() => { const s = daySessions[0]; const idx = trainingPlan.sessions.indexOf(s); setEditIndex(idx); setEditSession(s); setShowSessionEdit(true); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: S.md, paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.sm, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                    >
                      <Feather name="edit-2" size={13} color={C.textSecondary} />
                      <Text style={[T.label, { color: C.textSecondary }]}>Bearbeiten / Verschieben</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  daySessions.filter(s => !s.is_rest).map((session, si) => {
                    const sc = getSportColor(session.sport_type);
                    const sessionDone = completedMap[`session_${session.id}`] || (si===0 && completedMap[`day_${selectedDay}`]);
                    return (
                      <View key={session.id || si} style={{ marginBottom: si < daySessions.length-1 ? S.md : 0 }}>
                        {/* Session header */}
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: `${sc}30` }} onPress={() => { setInfoSession(session); setShowSessionInfo(true); }} activeOpacity={0.7}>
                          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${sc}20`, alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialCommunityIcons name={SPORT_MCI[session.sport_type] || 'run'} size={22} color={sc} />
                          </View>
                          <View style={{ flex: 1, marginLeft: S.md }}>
                            {daySessions.length > 1 && (
                              <Text style={[T.label, { color: C.textTertiary }]}>EINHEIT {si+1}</Text>
                            )}
                            <Text style={[T.bodyMed, { color: sc }]} numberOfLines={2} ellipsizeMode="tail">{session.focus}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: S.xs }}>
                            {session.duration > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bgSecondary, borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: 3 }}>
                                <Feather name="clock" size={11} color={C.textSecondary} />
                                <Text style={[T.caption, { color: C.textSecondary }]}>{session.duration} Min</Text>
                              </View>
                            )}
                            {session.intensity && <IntensityBadge value={session.intensity} />}
                            <Feather name="info" size={14} color={C.textTertiary} style={{ marginTop: 2 }} />
                          </View>
                        </TouchableOpacity>

                        {/* Workout-Profil (intervals.icu-Stil) */}
                        {(() => {
                          const profileSteps = getSessionSteps(session);
                          return profileSteps.length > 0 ? (
                            <View style={{ marginBottom: S.md }}>
                              <WorkoutProfileChart steps={profileSteps} />
                            </View>
                          ) : null;
                        })()}

                        {/* Exercises */}
                        {session.exercises?.map((ex, ei) => (
                          <ExerciseRow
                            key={ei} exercise={ex} index={ei}
                            dayIndex={selectedDay*10+si}
                            done={!!completedMap[`${selectedDay*10+si}-${ei}`]}
                            onToggle={toggleExercise}
                            sportType={session.sport_type}
                          />
                        ))}

                        {/* Progress */}
                        {session.exercises?.length > 0 && (() => {
                          const total = session.exercises.length;
                          const done = session.exercises.filter((_,ei) => completedMap[`${selectedDay*10+si}-${ei}`]).length;
                          const pct = total > 0 ? done/total : 0;
                          return (
                            <View style={{ marginBottom: S.md }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: S.xs }}>
                                <Text style={[T.caption, { color: C.textSecondary }]}>{done}/{total} Übungen</Text>
                                {pct===1 && <Text style={[T.caption, { color: C.success, fontWeight: '600' }]}>Alle erledigt</Text>}
                              </View>
                              <View style={{ height: 3, backgroundColor: C.bgTertiary, borderRadius: 2, overflow: 'hidden' }}>
                                <View style={{ height: '100%', width: `${pct*100}%`, backgroundColor: pct===1 ? C.success : sc, borderRadius: 2 }} />
                              </View>
                            </View>
                          );
                        })()}

                        {/* Hauptaktion: Einheit abschließen (gefüllt, klar dominant) */}
                        {!sessionDone ? (
                          session.sport_type === 'mobility' ? (
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.lg, paddingVertical: 16, backgroundColor: sc, marginBottom: S.sm, opacity: flowStarting ? 0.6 : 1 }}
                              onPress={() => startMobilityFlow(session)}
                              disabled={flowStarting}
                              activeOpacity={0.85}
                            >
                              {flowStarting ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="play-circle" size={20} color="#fff" />}
                              <Text style={[T.bodyMed, { color: '#fff', fontWeight: '800', fontSize: 16 }]}>{flowStarting ? 'KI erstellt Flow…' : 'Mobility-Flow starten'}</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.lg, paddingVertical: 16, backgroundColor: sc, marginBottom: S.sm, shadowColor: sc, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}
                              onPress={() => { setCompleteSession(session); setShowComplete(true); }}
                              activeOpacity={0.85}
                            >
                              <Feather name="check-circle" size={20} color="#fff" />
                              <Text style={[T.bodyMed, { color: '#fff', fontWeight: '800', fontSize: 16 }]}>
                                Einheit abschließen
                              </Text>
                            </TouchableOpacity>
                          )
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.success, borderRadius: R.lg, paddingVertical: 16, marginBottom: S.sm }}>
                            <Feather name="check-circle" size={20} color="#fff" />
                            <Text style={[T.bodyMed, { color: '#fff', fontWeight: '800', fontSize: 16 }]}>
                              Einheit abgeschlossen
                            </Text>
                          </View>
                        )}

                        {/* Sekundäraktionen: dezent, untergeordnet */}
                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: S.lg, marginBottom: S.sm }}>
                          <TouchableOpacity
                            onPress={() => { const idx = trainingPlan.sessions.indexOf(session); setEditIndex(idx); setEditSession(session); setShowSessionEdit(true); }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 8 }}
                            hitSlop={6}
                          >
                            <Feather name="edit-2" size={13} color={C.textTertiary} />
                            <Text style={[T.caption, { color: C.textTertiary }]}>Bearbeiten</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => { const idx = trainingPlan.sessions.indexOf(session); setRegenIndex(idx); setShowRegen(true); }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 8 }}
                            hitSlop={6}
                          >
                            <Feather name="repeat" size={13} color={C.textTertiary} />
                            <Text style={[T.caption, { color: C.textTertiary }]}>Austauschen</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* Week overview */}
            <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', marginTop: S.xl, marginBottom: S.md }]}>Wochenübersicht</Text>
            <View style={{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' }}>
              {DAY_SHORT.map((d, i) => {
                const dSessions = sessionsByDay[i] || [];
                const isRest = dSessions.length === 0 || dSessions.every(s => s.is_rest);
                const done = isWorkoutDone(i);
                const totalDur = dSessions.reduce((s, sess) => s + (sess.duration||0), 0);
                return (
                  <TouchableOpacity
                    key={i}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: S.md, paddingHorizontal: S.md, borderBottomWidth: i < 6 ? StyleSheet.hairlineWidth : 0, borderBottomColor: C.border }}
                    onPress={() => setSelectedDay(i)}
                  >
                    <Text style={[T.label, { color: i===selectedDay ? C.tint : C.textSecondary, width: 24 }]}>{d}</Text>
                    <View style={{ flex: 1, marginHorizontal: S.md }}>
                      {isRest ? (
                        <Text style={[T.caption, { color: C.textTertiary }]}>Ruhetag</Text>
                      ) : (
                        (() => {
                          const trainS = dSessions.filter(s => !s.is_rest && s.duration > 0);
                          const tot = trainS.reduce((a, s) => a + s.duration, 0);
                          return (
                            <View style={{ height: 4, backgroundColor: C.bgTertiary, borderRadius: 2, overflow: 'hidden' }}>
                              <View style={{ flexDirection: 'row', width: done ? '100%' : '50%', height: '100%' }}>
                                {done
                                  ? <View style={{ flex: 1, backgroundColor: C.success }} />
                                  : tot > 0
                                    ? trainS.map((s, si) => (
                                        <View key={si} style={{ flex: s.duration / tot, height: '100%', backgroundColor: getSportColor(s.sport_type) }} />
                                      ))
                                    : <View style={{ flex: 1, backgroundColor: `${getSportColor(dSessions[0]?.sport_type)}80` }} />
                                }
                              </View>
                            </View>
                          );
                        })()
                      )}
                    </View>
                    <Text style={[T.caption, { color: isRest ? C.textTertiary : C.textSecondary, maxWidth: 90, textAlign: 'right' }]} numberOfLines={1} ellipsizeMode="tail">
                      {isRest ? 'Ruhe' : totalDur > 0 ? `${totalDur} Min` : dSessions[0]?.focus || 'Training'}
                    </Text>
                    {done && <Feather name="check-circle" size={14} color={C.success} style={{ marginLeft: S.sm }} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* (Abgeschlossene Einheiten erscheinen jetzt am jeweiligen Tag oben im Tages-Detail) */}
          </Animated.View>
        )}
      </ScrollView>

      {/* Strava-artige Detailansicht einer absolvierten Einheit */}
      {detailWorkout && (
        <ActivityDetail
          workout={detailWorkout}
          onClose={() => setDetailWorkout(null)}
          actions={detailWorkout.session_id ? [] : [{
            icon: 'refresh-cw',
            label: 'Als geplante Einheit verbuchen',
            onPress: () => {
              setDetailWorkout(null);
              Alert.alert('Hinweis', 'Diese Aktivität ist keiner geplanten Einheit zugeordnet. Nutze „Woche ausbalancieren", um den Plan an deine tatsächlichen Einheiten anzupassen.');
            },
          }]}
          onDelete={() => Alert.alert('Löschen?', detailWorkout.focus || detailWorkout.title || 'Einheit', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Löschen', style: 'destructive', onPress: async () => {
              try { await api.deleteCompletedWorkout(detailWorkout.id); setDetailWorkout(null); loadPlan(); } catch (e) { Alert.alert('Fehler', e.message); }
            }},
          ])}
        />
      )}

      {/* Popup: frische Einheit + KI-Analyse */}
      <Modal visible={!!freshFeedback} transparent animationType="fade" onRequestClose={dismissFresh}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: S.lg }}>
          {freshFeedback && (() => {
            const fb = freshFeedback.fb, w = freshFeedback.w;
            const vc = { stark: C.success, solide: C.success, zu_locker: C.warning, zu_hart: C.danger, abweichung_vom_plan: C.danger }[fb.verdict] || C.text;
            const vl = { stark: 'Stark', solide: 'Solide', zu_locker: 'Zu locker', zu_hart: 'Zu hart', abweichung_vom_plan: 'Weicht vom Plan ab' }[fb.verdict] || '';
            return (
              <View style={{ backgroundColor: C.bg, borderRadius: R.xl, padding: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: S.sm }}>
                  <Feather name="cpu" size={18} color={C.text} />
                  <Text style={[T.h3, { color: C.text, flex: 1 }]}>KI-Analyse</Text>
                  {vl ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: vc + '18', borderRadius: R.full, paddingHorizontal: 9, paddingVertical: 4 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: vc }} /><Text style={[T.label, { color: vc }]}>{vl}</Text></View> : null}
                </View>
                <Text style={[T.caption, { color: C.textTertiary, marginBottom: S.sm }]}>{w.focus || w.title || 'Einheit'}</Text>
                {fb.headline ? <Text style={[T.bodyMed, { color: C.text, marginBottom: 6 }]}>{fb.headline}</Text> : null}
                <Text style={[T.body, { color: C.textSecondary, lineHeight: 21 }]}>{fb.feedback}</Text>
                {fb.tipp ? <Text style={[T.body, { color: C.text, marginTop: S.sm }]}>→ {fb.tipp}</Text> : null}
                <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg }}>
                  <TouchableOpacity onPress={dismissFresh} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                    <Text style={[T.bodyMed, { color: C.textSecondary }]}>Ok</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { const wk = w; dismissFresh(); setDetailWorkout(wk); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: R.md, backgroundColor: C.accent }}>
                    <Text style={[T.bodyMed, { color: C.accentText }]}>Einheit ansehen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
        </View>
      </Modal>
    </>
  );
}
