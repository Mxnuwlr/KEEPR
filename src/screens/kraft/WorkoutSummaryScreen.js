/**
 * screens/kraft/WorkoutSummaryScreen.js — Workout-Zusammenfassung
 *
 * Wird nach dem Beenden eines Workouts angezeigt (LiveWorkout → WorkoutSummary).
 * Zeigt Statistiken, MuscleMap und Übungsübersicht. Erlaubt Notizen vor dem Speichern.
 *
 * muscleCounts Format: { [muscle]: { primary: n, secondary: m } }
 * Gleiche Aggregationslogik wie in LiveWorkoutScreen.
 */

// React/RN
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Internal
import { useTheme } from '../../theme';
import { useKraftStore } from '../../store/kraftStore';
import { EXERCISES } from '../../data/exercises';
import MuscleMap from '../../components/MuscleMap';

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

export default function WorkoutSummaryScreen({ navigation, route }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeWorkout, finishWorkout } = useKraftStore();
  const workout = route?.params?.workout || activeWorkout;
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!workout) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: C.textTertiary }}>Kein aktives Workout</Text>
      </View>
    );
  }

  const completedSets = workout.exercises?.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0) || 0;
  const totalVolume = workout.exercises?.reduce((acc, ex) =>
    acc + ex.sets.filter(s => s.completed).reduce((a, s) => a + (parseFloat(s.weight_kg) || 0) * (parseInt(s.reps) || 0), 0), 0) || 0;

  // Specific sub-muscle level (primary/secondary) — same logic as live workout
  const workedMuscles = {};
  workout.exercises?.forEach(ex => {
    if (!ex.sets.some(s => s.completed)) return;
    const dbEx = EXERCISES.find(e => e.id === ex.exerciseId);
    const muscles = dbEx?.worked_muscles || (ex.muscle_group ? { [ex.muscle_group]: 'primary' } : {});
    Object.entries(muscles).forEach(([m, lvl]) => {
      if (!workedMuscles[m] || lvl === 'primary') workedMuscles[m] = lvl;
    });
  });

  // Per-muscle set counts — tracked separately for primary and secondary
  const muscleCounts = {};
  workout.exercises?.forEach(ex => {
    const done = ex.sets.filter(s => s.completed).length;
    if (!done) return;
    const dbEx = EXERCISES.find(e => e.id === ex.exerciseId);
    const muscles = dbEx?.worked_muscles || (ex.muscle_group ? { [ex.muscle_group]: 'primary' } : {});
    Object.entries(muscles).forEach(([m, lvl]) => {
      if (!muscleCounts[m]) muscleCounts[m] = { primary: 0, secondary: 0 };
      muscleCounts[m][lvl === 'primary' ? 'primary' : 'secondary'] += done;
    });
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await finishWorkout(notes);
      navigation.popToTop();
    } catch (e) {
      Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: S.md, paddingTop: insets.top + S.sm, paddingBottom: insets.bottom + 100 }}>

        {/* Celebration Header */}
        <View style={{ alignItems: 'center', paddingVertical: S.lg }}>
          <MaterialCommunityIcons name="trophy" size={52} color="#E8C547" />
          <Text style={{ color: C.text, fontWeight: '800', fontSize: 24, marginTop: S.sm, textAlign: 'center' }}>Workout abgeschlossen!</Text>
          <Text style={{ color: C.textSecondary, fontSize: 14, marginTop: 4 }}>{workout.routineName || 'Workout'}</Text>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
          {[
            { label: 'DAUER', value: formatDuration(workout.elapsedSeconds || 0) },
            { label: 'VOLUMEN', value: `${Math.round(totalVolume)} kg` },
            { label: 'SÄTZE', value: String(completedSets) },
          ].map(({ label, value }) => (
            <View key={label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              <Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{label}</Text>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 22 }}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Muscle Map */}
        {Object.keys(workedMuscles).length > 0 && (
          <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.md, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <Text style={{ color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: S.sm }}>BEANSPRUCHTE MUSKELN</Text>
            <MuscleMap workedMuscles={workedMuscles} muscleCounts={muscleCounts} colors={C} />
          </View>
        )}

        {/* Exercise summary */}
        {workout.exercises?.filter(ex => ex.sets.some(s => s.completed)).map((ex, i) => (
          <View key={i} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, marginBottom: S.sm }}>
            <Text style={{ color: C.text, fontWeight: '600', marginBottom: S.xs }}>{ex.name}</Text>
            {ex.sets.filter(s => s.completed).map((set, si) => (
              <Text key={si} style={{ color: C.textSecondary, fontSize: 13 }}>{si + 1}. {set.weight_kg} kg × {set.reps}</Text>
            ))}
          </View>
        ))}

        {/* Notes */}
        <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.xs }}>NOTIZEN</Text>
        <TextInput
          style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, color: C.text, minHeight: 80, textAlignVertical: 'top' }}
          placeholder="Wie lief das Training…"
          placeholderTextColor={C.textTertiary}
          multiline
          value={notes}
          onChangeText={setNotes}
        />
      </ScrollView>

      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: S.md, right: S.md }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center' }}
        >
          <Text style={{ color: C.bg, fontWeight: '700', fontSize: 16 }}>{saving ? 'Speichern…' : 'Workout speichern'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
