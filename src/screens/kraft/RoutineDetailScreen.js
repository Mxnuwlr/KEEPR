/**
 * screens/kraft/RoutineDetailScreen.js — Routine-Detailansicht
 *
 * Zeigt MuscleMap, Statistiken (Übungen, Sätze, geschätzte Dauer)
 * und alle Übungen der Routine. Startbutton für sofortigen Workout-Start.
 */

// React/RN
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';

// Lokale MUSCLE_COLORS für Farbakzente
const MUSCLE_COLORS = {
  Brust: '#F87171', Rücken: '#60A5FA', Trapez: '#06B6D4', Beine: '#86EFAC', Waden: '#A78BFA', Schultern: '#FDBA74',
  Arme: '#A78BFA', Bauch: '#FCD34D', Gesäß: '#FB923C', Ganzkörper: '#94A3B8',
  Hamstrings: '#8B5CF6', Unterarme: '#F59E0B',
};
// Third-party
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Internal
import { useTheme } from '../../theme';
import { useKraftStore } from '../../store/kraftStore';
import { EXERCISES } from '../../data/exercises';
import MuscleMap from '../../components/MuscleMap';

export default function RoutineDetailScreen({ navigation, route }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const routine = route?.params?.routine || {};
  const { startWorkout, deleteRoutine } = useKraftStore();

  const exercises = Array.isArray(routine.exercises)
    ? routine.exercises
    : (() => { try { return JSON.parse(routine.exercises || '[]'); } catch { return []; } })();

  const handleStart = async () => {
    await startWorkout(routine.id, routine.name, exercises.map(ex => ({
      id: ex.exercise_id,
      name_de: ex.name,
      muscle_group: ex.muscle_group,
      sets: ex.sets,
    })));
    navigation.navigate('LiveWorkout');
  };

  const handleDelete = () => {
    Alert.alert('Routine löschen?', routine.name, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        await deleteRoutine(routine.id);
        navigation.goBack();
      }},
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.md, paddingBottom: S.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: S.sm }}>
            <Feather name="arrow-left" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[T.h2, { color: C.text, flex: 1 }]}>{routine.name}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('RoutineEdit', { routine })} style={{ marginRight: S.sm }}>
            <Feather name="edit-2" size={20} color={C.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete}>
            <Feather name="trash-2" size={20} color={C.danger} />
          </TouchableOpacity>
        </View>
        {routine.folder_name ? <Text style={{ color: C.textSecondary, marginTop: 2 }}>{routine.folder_name}</Text> : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 200 }}>
        {/* Muscle Map */}
        {(() => {
          const workedMuscles = {};
          const muscleCounts = {};
          exercises.forEach(ex => {
            const dbEx = EXERCISES.find(e => e.id === (ex.exercise_id || ex.id));
            const muscles = dbEx?.worked_muscles || (ex.muscle_group ? { [ex.muscle_group]: 'primary' } : {});
            const sets = Array.isArray(ex.sets) ? ex.sets.length : 1;
            Object.entries(muscles).forEach(([m, lvl]) => {
              if (!workedMuscles[m] || lvl === 'primary') workedMuscles[m] = lvl;
              muscleCounts[m] = (muscleCounts[m] || 0) + sets;
            });
          });
          if (Object.keys(workedMuscles).length === 0) return null;
          return (
            <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              <Text style={{ color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: S.sm }}>BEANSPRUCHTE MUSKELN</Text>
              <MuscleMap workedMuscles={workedMuscles} muscleCounts={muscleCounts} colors={C} />
            </View>
          );
        })()}

        {/* Stats Summary */}
        {(() => {
          const totalSets = exercises.reduce((acc, ex) => acc + (Array.isArray(ex.sets) ? ex.sets.length : 1), 0);
          const estMinutes = Math.round(totalSets * 2.5);
          return (
            <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
              {[
                { val: exercises.length, label: 'ÜBUNGEN' },
                { val: totalSets, label: 'SÄTZE' },
                { val: `~${estMinutes}`, label: 'MIN EST.' },
              ].map(({ val, label }) => (
                <View key={label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 18 }}>{val}</Text>
                  <Text style={{ color: C.textTertiary, fontSize: 10, fontWeight: '600', marginTop: 2 }}>{label}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {exercises.map((ex, i) => {
          const fullEx = EXERCISES.find(e => e.id === ex.exercise_id) || null;
          const setsCount = Array.isArray(ex.sets) ? ex.sets.length : 1;
          const defaultReps = ex.sets?.[0]?.reps || '—';
          const accentColor = MUSCLE_COLORS[ex.muscle_group] || C.accent;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => fullEx && navigation.navigate('ExerciseDetail', { exercise: fullEx })}
              style={{ backgroundColor: C.surface, borderRadius: R.md, marginBottom: S.sm, overflow: 'hidden', flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
              activeOpacity={fullEx ? 0.7 : 1}
            >
              <View style={{ width: 4, backgroundColor: accentColor }} />
              <View style={{ flex: 1, padding: S.sm }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{ex.name}</Text>
                <Text style={{ color: C.textSecondary, fontSize: 12, marginTop: 2 }}>{ex.muscle_group}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center', paddingRight: S.sm, gap: 2 }}>
                <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>{setsCount} × {defaultReps}</Text>
                {fullEx && <Feather name="chevron-right" size={14} color={C.textTertiary} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ position: 'absolute', bottom: insets.bottom + 110, left: S.md, right: S.md }}>
        <TouchableOpacity
          onPress={handleStart}
          style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center' }}
        >
          <Text style={{ color: C.bg, fontWeight: '700', fontSize: 16 }}>Routine starten</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
