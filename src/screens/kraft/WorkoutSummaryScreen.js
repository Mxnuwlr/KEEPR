import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useKraftStore } from '../../store/kraftStore';

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
      <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.md, paddingBottom: S.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        <Text style={[T.h2, { color: C.text, textAlign: 'center' }]}>Workout abgeschlossen</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 100 }}>
        <Text style={[T.h1, { color: C.text, textAlign: 'center', marginBottom: S.xs }]}>{workout.routineName || 'Workout'}</Text>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
          {[
            { label: 'Dauer', value: formatDuration(workout.elapsedSeconds || 0) },
            { label: 'Volumen', value: `${Math.round(totalVolume)} kg` },
            { label: 'Sätze', value: String(completedSets) },
          ].map(({ label, value }) => (
            <View key={label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, alignItems: 'center' }}>
              <Text style={{ color: C.textSecondary, fontSize: 12 }}>{label}</Text>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 18 }}>{value}</Text>
            </View>
          ))}
        </View>

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
