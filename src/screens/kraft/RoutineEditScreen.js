import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useKraftStore } from '../../store/kraftStore';

export default function RoutineEditScreen({ navigation, route }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const existing = route?.params?.routine;
  const { createRoutine, updateRoutine, pendingExercise, clearPendingExercise } = useKraftStore();

  const [name, setName] = useState(existing?.name || '');
  const [folder, setFolder] = useState(existing?.folder_name || '');
  const [exercises, setExercises] = useState(() => {
    if (!existing?.exercises) return [];
    if (Array.isArray(existing.exercises)) return existing.exercises;
    try { return JSON.parse(existing.exercises); } catch { return []; }
  });
  const [saving, setSaving] = useState(false);

  // Catch exercise returned from ExerciseDatabaseScreen via store
  useFocusEffect(useCallback(() => {
    if (pendingExercise) {
      setExercises(prev => [...prev, {
        exercise_id: pendingExercise.id,
        name: pendingExercise.name_de || pendingExercise.name,
        muscle_group: pendingExercise.muscle_group,
        sets: [{ reps: 10, weight_kg: 0 }],
      }]);
      clearPendingExercise();
    }
  }, [pendingExercise]));

  const handleAddExercise = () => {
    navigation.navigate('ExerciseDatabase', { returnTo: 'RoutineEdit', selectMode: true });
  };

  const handleRemoveExercise = (idx) => {
    setExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Fehler', 'Bitte einen Namen eingeben'); return; }
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        folder_name: folder.trim() || null,
        exercises,   // plain array — backend calls JSON.stringify on it
      };
      if (existing?.id) {
        await updateRoutine(existing.id, data);
      } else {
        await createRoutine(data);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.md, paddingBottom: S.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: S.sm }}>
          <Feather name="x" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.h2, { color: C.text, flex: 1 }]}>{existing ? 'Routine bearbeiten' : 'Neue Routine'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={{ color: C.accent, fontWeight: '700', fontSize: 16 }}>{saving ? '…' : 'Speichern'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 40 }}>
        <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.xs }}>NAME</Text>
        <TextInput
          style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, color: C.text, fontSize: 16, marginBottom: S.md }}
          placeholder="z.B. Push A"
          placeholderTextColor={C.textTertiary}
          value={name}
          onChangeText={setName}
        />

        <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.xs }}>ORDNER (optional)</Text>
        <TextInput
          style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, color: C.text, fontSize: 16, marginBottom: S.md }}
          placeholder="z.B. PPL"
          placeholderTextColor={C.textTertiary}
          value={folder}
          onChangeText={setFolder}
        />

        <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.sm }}>ÜBUNGEN ({exercises.length})</Text>

        {exercises.map((ex, i) => {
          const setsCount = Array.isArray(ex.sets) ? ex.sets.length : 1;
          const defaultReps = ex.sets?.[0]?.reps ?? 10;
          const defaultWeight = ex.sets?.[0]?.weight_kg ?? 0;

          const updateSetsCount = (val) => {
            const n = Math.max(1, Math.min(20, parseInt(val) || 1));
            const base = ex.sets?.[0] || { reps: 10, weight_kg: 0 };
            const newSets = Array.from({ length: n }, () => ({ ...base }));
            setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, sets: newSets } : e));
          };

          const updateReps = (val) => {
            const reps = parseInt(val) || 0;
            const newSets = (ex.sets || [{ reps: 10, weight_kg: 0 }]).map(s => ({ ...s, reps }));
            setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, sets: newSets } : e));
          };

          const updateWeight = (val) => {
            const weight_kg = parseFloat(val) || 0;
            const newSets = (ex.sets || [{ reps: 10, weight_kg: 0 }]).map(s => ({ ...s, weight_kg }));
            setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, sets: newSets } : e));
          };

          return (
            <View key={i} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, marginBottom: S.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '600' }}>{ex.name}</Text>
                  <Text style={{ color: C.textSecondary, fontSize: 13 }}>{ex.muscle_group}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveExercise(i)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="trash-2" size={18} color={C.danger} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '600', marginBottom: 3 }}>SÄTZE</Text>
                  <TextInput
                    style={{ backgroundColor: C.bg, borderRadius: R.sm, padding: 6, color: C.text, textAlign: 'center', fontSize: 15 }}
                    keyboardType="number-pad"
                    value={String(setsCount)}
                    onChangeText={updateSetsCount}
                    returnKeyType="done"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '600', marginBottom: 3 }}>WDH</Text>
                  <TextInput
                    style={{ backgroundColor: C.bg, borderRadius: R.sm, padding: 6, color: C.text, textAlign: 'center', fontSize: 15 }}
                    keyboardType="number-pad"
                    value={String(defaultReps)}
                    onChangeText={updateReps}
                    returnKeyType="done"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '600', marginBottom: 3 }}>KG</Text>
                  <TextInput
                    style={{ backgroundColor: C.bg, borderRadius: R.sm, padding: 6, color: C.text, textAlign: 'center', fontSize: 15 }}
                    keyboardType="decimal-pad"
                    value={defaultWeight ? String(defaultWeight) : ''}
                    placeholder="0"
                    placeholderTextColor={C.textTertiary}
                    onChangeText={updateWeight}
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          onPress={handleAddExercise}
          style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.xs, borderWidth: 1, borderColor: C.accent + '55', borderStyle: 'dashed' }}
        >
          <Feather name="plus" size={18} color={C.accent} />
          <Text style={{ color: C.accent, fontWeight: '600' }}>Übung hinzufügen</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
