import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, PanResponder, Animated, AppState,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useKraftStore } from '../../store/kraftStore';

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Swipeable Set Row ─────────────────────────────────────────────
function SetRow({ set, setIdx, exIdx, prevSet, onUpdate, onToggle, onDelete, isFirst }) {
  const { colors: C, spacing: S, radius: R } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const deleteVisible = useRef(false);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => {
      if (g.dx < 0) translateX.setValue(Math.max(g.dx, -80));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -50) {
        Animated.spring(translateX, { toValue: -72, useNativeDriver: true }).start();
        deleteVisible.current = true;
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        deleteVisible.current = false;
      }
    },
  })).current;

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Red delete background — only visible when swiped */}
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 72, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity onPress={onDelete}>
          <Feather name="trash-2" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={{ transform: [{ translateX }], backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: S.sm, gap: S.xs }}
        {...panResponder.panHandlers}
      >
        {/* Green completion overlay */}
        {set.completed && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#22C55E20' }} pointerEvents="none" />
        )}
        {/* SET # */}
        <View style={{ width: 32, alignItems: 'center' }}>
          <Text style={{ color: C.textSecondary, fontSize: 14, fontWeight: '600' }}>{setIdx + 1}</Text>
        </View>

        {/* PREV */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: C.textTertiary, fontSize: 12 }} numberOfLines={1}>
            {prevSet ? `${prevSet.weight_kg}×${prevSet.reps}` : '—'}
          </Text>
        </View>

        {/* KG */}
        <TextInput
          style={{ flex: 1, backgroundColor: C.bg, borderRadius: R.sm, textAlign: 'center', color: C.text, paddingVertical: 6, fontSize: 15 }}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={C.textTertiary}
          value={set.weight_kg !== '' ? String(set.weight_kg) : ''}
          onChangeText={v => onUpdate('weight_kg', v)}
          returnKeyType="done"
        />

        {/* WDH */}
        <TextInput
          style={{ flex: 1, backgroundColor: C.bg, borderRadius: R.sm, textAlign: 'center', color: C.text, paddingVertical: 6, fontSize: 15 }}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={C.textTertiary}
          value={set.reps !== '' ? String(set.reps) : ''}
          onChangeText={v => onUpdate('reps', v)}
          returnKeyType="done"
        />

        {/* Checkmark */}
        <TouchableOpacity
          onPress={onToggle}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: set.completed ? '#22C55E' : C.surface, justifyContent: 'center', alignItems: 'center' }}
        >
          <Feather name="check" size={16} color={set.completed ? 'white' : C.textTertiary} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Exercise Card ─────────────────────────────────────────────────
function ExerciseCard({ exercise, exIdx, navigation, lastSets }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { updateSetWithFill, toggleSetComplete, addSet, deleteSet, removeExercise } = useKraftStore();

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: R.md, marginBottom: S.sm, overflow: 'hidden' }}>
      {/* Exercise header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.sm }}>
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('ExerciseDetail', { exercise: { id: exercise.exerciseId, name_de: exercise.name, muscle_group: exercise.muscle_group } })}
        >
          <Text style={{ color: C.accent, fontWeight: '700', fontSize: 15 }}>{exercise.name}</Text>
          <Text style={{ color: C.textSecondary, fontSize: 13 }}>{exercise.muscle_group}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => removeExercise(exIdx)}>
          <Feather name="x" size={18} color={C.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Column headers */}
      <View style={{ flexDirection: 'row', paddingHorizontal: S.sm, paddingBottom: 4 }}>
        <View style={{ width: 32, alignItems: 'center' }}><Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '600' }}>SET</Text></View>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '600' }}>VORIGE</Text></View>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '600' }}>KG</Text></View>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '600' }}>WDH</Text></View>
        <View style={{ width: 32 }} />
      </View>

      {/* Sets */}
      {exercise.sets.map((set, si) => (
        <SetRow
          key={si}
          set={set}
          setIdx={si}
          exIdx={exIdx}
          prevSet={lastSets?.[si]}
          isFirst={si === 0}
          onUpdate={(field, val) => updateSetWithFill(exIdx, si, field, val)}
          onToggle={() => toggleSetComplete(exIdx, si)}
          onDelete={() => deleteSet(exIdx, si)}
        />
      ))}

      {/* Add set */}
      <TouchableOpacity
        onPress={() => addSet(exIdx)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: S.sm, gap: S.xs }}
      >
        <Feather name="plus" size={15} color={C.accent} />
        <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600' }}>Satz hinzufügen</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────
export default function LiveWorkoutScreen({ navigation, route }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeWorkout, tickTimer, discardWorkout, lastSessionSets } = useKraftStore();
  const timerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const bgTimeRef = useRef(null);

  // Start timer
  useEffect(() => {
    timerRef.current = setInterval(tickTimer, 1000);

    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current === 'active' && nextState !== 'active') {
        bgTimeRef.current = Date.now();
      } else if (nextState === 'active' && bgTimeRef.current) {
        const elapsed = Math.floor((Date.now() - bgTimeRef.current) / 1000);
        for (let i = 0; i < elapsed; i++) tickTimer();
        bgTimeRef.current = null;
      }
      appStateRef.current = nextState;
    });

    return () => {
      clearInterval(timerRef.current);
      sub.remove();
    };
  }, [tickTimer]);

  const handleFinish = () => {
    Alert.alert('Workout beenden?', 'Du wirst zur Zusammenfassung weitergeleitet.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Beenden', onPress: () => navigation.navigate('WorkoutSummary') },
    ]);
  };

  const handleDiscard = () => {
    Alert.alert('Workout verwerfen?', 'Alle Daten gehen verloren.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Verwerfen', style: 'destructive', onPress: async () => {
        clearInterval(timerRef.current);
        await discardWorkout();
        navigation.goBack();
      }},
    ]);
  };

  const { addExercise, pendingExercise, clearPendingExercise } = useKraftStore();

  // Catch exercise returned from ExerciseDatabaseScreen via store
  useFocusEffect(useCallback(() => {
    if (pendingExercise) {
      addExercise(pendingExercise);
      clearPendingExercise();
    }
  }, [pendingExercise]));

  const handleAddExercise = useCallback(() => {
    navigation.navigate('ExerciseDatabase', { returnTo: 'LiveWorkout', selectMode: true });
  }, [navigation]);

  if (!activeWorkout) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: C.textTertiary }}>Kein aktives Workout</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: C.accent }}>Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const completedSets = activeWorkout.exercises?.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0) || 0;
  const totalVolume = activeWorkout.exercises?.reduce((acc, ex) =>
    acc + ex.sets.filter(s => s.completed).reduce((a, s) => a + (parseFloat(s.weight_kg) || 0) * (parseInt(s.reps) || 0), 0), 0) || 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Sticky Header */}
      <View style={{
        paddingTop: insets.top + 4,
        paddingHorizontal: S.md,
        paddingBottom: S.sm,
        backgroundColor: C.bg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: C.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.xs }}>
          <TouchableOpacity onPress={handleDiscard} style={{ marginRight: S.sm }}>
            <Feather name="x" size={22} color={C.textSecondary} />
          </TouchableOpacity>
          <Text style={[T.h3, { color: C.text, flex: 1 }]}>{activeWorkout.routineName}</Text>
          <TouchableOpacity
            onPress={handleFinish}
            style={{ backgroundColor: C.accent, paddingHorizontal: S.md, paddingVertical: 8, borderRadius: R.full }}
          >
            <Text style={{ color: C.bg, fontWeight: '700', fontSize: 14 }}>Beenden</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: S.md }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 18 }}>{formatTime(activeWorkout.elapsedSeconds || 0)}</Text>
            <Text style={{ color: C.textTertiary, fontSize: 11 }}>DAUER</Text>
          </View>
          <View style={{ width: 1, backgroundColor: C.border }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 18 }}>{Math.round(totalVolume)}</Text>
            <Text style={{ color: C.textTertiary, fontSize: 11 }}>KG VOL.</Text>
          </View>
          <View style={{ width: 1, backgroundColor: C.border }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 18 }}>{completedSets}</Text>
            <Text style={{ color: C.textTertiary, fontSize: 11 }}>SÄTZE</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 80 }}
        keyboardDismissMode="interactive"
      >
        {activeWorkout.exercises?.map((ex, i) => (
          <ExerciseCard
            key={i}
            exercise={ex}
            exIdx={i}
            navigation={navigation}
            lastSets={lastSessionSets[ex.exerciseId]}
          />
        ))}

        <TouchableOpacity
          onPress={handleAddExercise}
          style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.xs }}
        >
          <Feather name="plus" size={18} color={C.accent} />
          <Text style={{ color: C.accent, fontWeight: '600' }}>Übung hinzufügen</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
