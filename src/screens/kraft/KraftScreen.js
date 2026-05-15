import React, { useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useKraftStore } from '../../store/kraftStore';
import { useStore } from '../../store';

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
  const { routines, sessions, activeWorkout, fetchRoutines, fetchSessions, fetchPRs, startWorkout } = useKraftStore();
  const { trainingPlan } = useStore();

  useFocusEffect(useCallback(() => {
    fetchRoutines();
    fetchSessions(5);
    fetchPRs();
  }, []));

  // AI-Banner: strength sessions today
  const todayIdx = getTodayIndex();
  const todayStrength = trainingPlan?.sessions?.filter(
    s => s.day_index === todayIdx && s.sport_type === 'strength' && !s.is_rest
  ) || [];

  // Group routines by folder
  const folders = {};
  routines.forEach(r => {
    const key = r.folder_name || '—';
    if (!folders[key]) folders[key] = [];
    folders[key].push(r);
  });

  const handleStartEmpty = async () => {
    await startWorkout(null, 'Leeres Workout', []);
    navigation.navigate('LiveWorkout');
  };

  const handleStartFromAI = async (session) => {
    const exercises = (session.exercises || []).filter(e => !e.zone || e.zone !== 'rest').map(e => ({
      id: null,
      name_de: e.name || e.emoji || 'Übung',
      muscle_group: 'Ganzkörper',
    }));
    await startWorkout(null, session.focus || 'Kraft', exercises.length > 0 ? exercises : []);
    navigation.navigate('LiveWorkout');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {tabBar}

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

        {/* AI Banner */}
        {todayStrength.length > 0 && todayStrength.map((session, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => handleStartFromAI(session)}
            style={{ backgroundColor: '#E8C54722', borderColor: '#E8C547', borderWidth: 1, borderRadius: R.md, padding: S.md, marginBottom: S.md, flexDirection: 'row', alignItems: 'center' }}
          >
            <Text style={{ fontSize: 22, marginRight: S.sm }}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '700' }}>Heute: {session.focus || 'Kraft'}</Text>
              <Text style={{ color: C.textSecondary, fontSize: 13 }}>{session.duration} Min · Als Workout starten</Text>
            </View>
            <Feather name="play" size={18} color={C.accent} />
          </TouchableOpacity>
        ))}

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
              return (
                <TouchableOpacity
                  key={routine.id}
                  onPress={() => navigation.navigate('RoutineDetail', { routine })}
                  style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, marginBottom: S.xs, flexDirection: 'row', alignItems: 'center' }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '600' }}>{routine.name}</Text>
                    <Text style={{ color: C.textSecondary, fontSize: 13 }}>{exercises.length} Übungen</Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      await startWorkout(routine.id, routine.name, exercises.map(ex => ({
                        id: ex.exercise_id,
                        name_de: ex.name,
                        muscle_group: ex.muscle_group,
                        sets: ex.sets,
                      })));
                      navigation.navigate('LiveWorkout');
                    }}
                    style={{ backgroundColor: C.accent, paddingHorizontal: S.sm, paddingVertical: 6, borderRadius: R.sm, marginRight: S.sm }}
                  >
                    <Text style={{ color: C.bg, fontWeight: '600', fontSize: 13 }}>Start</Text>
                  </TouchableOpacity>
                  <Feather name="chevron-right" size={18} color={C.textTertiary} />
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
              <View key={session.id} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, marginBottom: S.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.text, fontWeight: '600' }}>{session.routine_name || 'Workout'}</Text>
                  <Text style={{ color: C.textTertiary, fontSize: 13 }}>{formatDate(session.started_at)}</Text>
                </View>
                <Text style={{ color: C.textSecondary, fontSize: 13 }}>
                  {Math.round((session.duration_seconds || 0) / 60)} Min · {Math.round(session.total_volume_kg || 0)} kg · {session.total_sets || 0} Sätze
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
