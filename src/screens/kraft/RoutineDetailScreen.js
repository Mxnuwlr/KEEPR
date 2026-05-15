import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useKraftStore } from '../../store/kraftStore';
import { EXERCISES } from '../../data/exercises';

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
        <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.sm }}>{exercises.length} ÜBUNGEN</Text>
        {exercises.map((ex, i) => {
          const fullEx = EXERCISES.find(e => e.id === ex.exercise_id) || null;
          const setsCount = Array.isArray(ex.sets) ? ex.sets.length : 1;
          const defaultReps = ex.sets?.[0]?.reps || '—';
          return (
            <TouchableOpacity
              key={i}
              onPress={() => fullEx && navigation.navigate('ExerciseDetail', { exercise: fullEx })}
              style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, marginBottom: S.sm, flexDirection: 'row', alignItems: 'center' }}
              activeOpacity={fullEx ? 0.7 : 1}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: fullEx ? C.accent : C.text, fontWeight: '600' }}>{ex.name}</Text>
                <Text style={{ color: C.textSecondary, fontSize: 13 }}>{ex.muscle_group}</Text>
              </View>
              <Text style={{ color: C.textTertiary, fontSize: 13, marginRight: S.xs }}>
                {setsCount} × {defaultReps}
              </Text>
              {fullEx && <Feather name="chevron-right" size={16} color={C.textTertiary} />}
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
