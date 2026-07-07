/**
 * screens/kraft/KraftStatsScreen.js — Kraft-Statistiken
 *
 * Zeigt:
 *   - Aktivitätskalender (2 Monate, Workout-Tage hervorgehoben)
 *   - Volumen nach Muskelgruppe (letzte 4 Wochen, Balkendiagramm)
 *   - Persönliche Rekorde (1RM-Verlauf via LineChart bei Tap)
 *
 * 1RM-Formel (Epley): estimated1RM = weight × (1 + reps/30)
 * LineChart zeigt geschätzten 1RM-Verlauf über alle Sessions einer Übung.
 */

// React/RN
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';

// Third-party
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Internal
import LineChart from '../../components/LineChart';
import { useTheme } from '../../theme';
import { api } from '../../api/client';
import { useKraftStore } from '../../store/kraftStore';

function WorkoutCalendar({ workoutDays, colors: C, spacing: S, radius: R }) {
  const today = new Date();

  const months = [
    new Date(today.getFullYear(), today.getMonth() - 1, 1),
    new Date(today.getFullYear(), today.getMonth(), 1),
  ];

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
      <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: S.sm }}>AKTIVITÄTSKALENDER</Text>
      {months.map((monthStart, mi) => {
        const year = monthStart.getFullYear();
        const month = monthStart.getMonth();
        const monthName = monthStart.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const rawFirst = new Date(year, month, 1).getDay(); // 0=Sun
        const firstDow = (rawFirst + 6) % 7; // Mon=0
        const cells = [];
        for (let i = 0; i < firstDow; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
        const weeks = [];
        for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

        return (
          <View key={mi} style={{ marginBottom: mi === 0 ? S.md : 0 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 6 }}>{monthName}</Text>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
                <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: C.textTertiary, fontSize: 10, fontWeight: '600' }}>{d}</Text>
                </View>
              ))}
            </View>
            {weeks.map((week, wi) => (
              <View key={wi} style={{ flexDirection: 'row', marginBottom: 2 }}>
                {week.map((date, di) => {
                  if (!date) return <View key={di} style={{ flex: 1 }} />;
                  const isToday = date.toDateString() === today.toDateString();
                  const hasWorkout = workoutDays.has(date.toDateString());
                  return (
                    <View key={di} style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}>
                      <View style={{
                        width: 26, height: 26, borderRadius: 13,
                        backgroundColor: hasWorkout ? C.accent : 'transparent',
                        borderWidth: isToday ? 1.5 : 0,
                        borderColor: C.accent,
                        justifyContent: 'center', alignItems: 'center',
                      }}>
                        <Text style={{
                          fontSize: 11, fontWeight: hasWorkout || isToday ? '700' : '400',
                          color: hasWorkout ? C.bg : isToday ? C.accent : C.textTertiary,
                        }}>{date.getDate()}</Text>
                      </View>
                    </View>
                  );
                })}
                {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, pi) => (
                  <View key={`pad-${pi}`} style={{ flex: 1 }} />
                ))}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const MUSCLE_COLORS = {
  Brust: '#E8C547', Rücken: '#4CAF50', Trapez: '#06B6D4', Schultern: '#2196F3',
  Bizeps: '#FF9800', Trizeps: '#F44336', Unterarme: '#F59E0B', Beine: '#9C27B0',
  Hamstrings: '#8B5CF6', Waden: '#7C3AED', Gesäß: '#E91E63', Bauch: '#00BCD4', Ganzkörper: '#FF5722',
};

export default function KraftStatsScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { prs, fetchPRs, sessions, fetchSessions } = useKraftStore();
  const [volumeStats, setVolumeStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPRExercise, setSelectedPRExercise] = useState(null);
  const [prHistory, setPrHistory] = useState([]);
  const [loadingPRHistory, setLoadingPRHistory] = useState(false);

  useEffect(() => {
    const load = async () => {
      await fetchSessions(100);
      await fetchPRs();
      try {
        const data = await api.getVolumeStats();
        setVolumeStats(data || []);
      } catch (e) {}
      setLoading(false);
    };
    load();
  }, []);

  const workoutDays = useMemo(() => {
    const set = new Set();
    sessions.forEach(s => {
      if (s.started_at) set.add(new Date(s.started_at).toDateString());
    });
    return set;
  }, [sessions]);

  const maxVol = volumeStats.reduce((m, v) => Math.max(m, v.total_volume || 0), 1);
  const prList = Object.entries(prs);

  const handleSelectPRExercise = async (exerciseId, exerciseName) => {
    if (selectedPRExercise === exerciseId) {
      setSelectedPRExercise(null);
      setPrHistory([]);
      return;
    }
    setSelectedPRExercise(exerciseId);
    setLoadingPRHistory(true);
    try {
      const data = await api.getExerciseHistory(exerciseId);
      setPrHistory(data || []);
    } catch (e) {}
    setLoadingPRHistory(false);
  };

  const prChartData = [...prHistory].reverse().map((session, i) => {
    const best = Math.max(...(session.sets || []).map(s => Math.round((parseFloat(s.weight_kg)||0) * (1 + (parseInt(s.reps)||0)/30))), 0);
    return {
      value: best,
      label: i % 2 === 0 ? new Date(session.finished_at || session.started_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '',
    };
  }).filter(d => d.value > 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.md, paddingBottom: S.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: S.sm }}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.h2, { color: C.text }]}>Statistiken</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 20 }}>

          <WorkoutCalendar workoutDays={workoutDays} colors={C} spacing={S} radius={R} />

          {/* Volume per muscle group — last 4 weeks */}
          <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.sm }}>VOLUMEN NACH MUSKELGRUPPE (4 WOCHEN)</Text>
          {volumeStats.length === 0 ? (
            <Text style={{ color: C.textTertiary, marginBottom: S.md }}>Noch keine Daten</Text>
          ) : (
            volumeStats.map((item, i) => {
              const barWidth = ((item.total_volume || 0) / maxVol) * 100;
              const barColor = MUSCLE_COLORS[item.muscle_group] || C.accent;
              return (
                <View key={i} style={{ marginBottom: S.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: C.text, fontSize: 13 }}>{item.muscle_group}</Text>
                    <Text style={{ color: C.textSecondary, fontSize: 13 }}>{Math.round(item.total_volume || 0)} kg</Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: C.surface, borderRadius: 4 }}>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: barColor, width: `${barWidth}%` }} />
                  </View>
                </View>
              );
            })
          )}

          {/* PRs */}
          <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '600', marginTop: S.md, marginBottom: S.sm }}>PERSÖNLICHE REKORDE</Text>
          {prList.length === 0 ? (
            <Text style={{ color: C.textTertiary }}>Noch keine Rekorde</Text>
          ) : (
            prList.map(([exerciseId, pr]) => (
              <React.Fragment key={exerciseId}>
                <TouchableOpacity
                  onPress={() => handleSelectPRExercise(parseInt(exerciseId), pr.exercise_name)}
                  style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, marginBottom: selectedPRExercise === parseInt(exerciseId) ? 0 : S.sm, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: selectedPRExercise === parseInt(exerciseId) ? C.accent : C.border }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '600' }}>{pr.exercise_name}</Text>
                    <Text style={{ color: C.textSecondary, fontSize: 13 }}>{pr.weight_kg} kg × {pr.reps} Wdh</Text>
                  </View>
                  {pr.estimated_1rm && (
                    <View style={{ backgroundColor: C.accent + '22', paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.sm, marginRight: 8 }}>
                      <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>1RM ~{Math.round(pr.estimated_1rm)} kg</Text>
                    </View>
                  )}
                  <Feather name={selectedPRExercise === parseInt(exerciseId) ? 'chevron-up' : 'chevron-down'} size={16} color={C.textTertiary} />
                </TouchableOpacity>
                {selectedPRExercise === parseInt(exerciseId) && (
                  <View style={{ backgroundColor: C.surface, borderRadius: R.md, borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: S.md, marginBottom: S.sm, borderWidth: StyleSheet.hairlineWidth, borderTopWidth: 0, borderColor: C.accent }}>
                    {loadingPRHistory ? (
                      <ActivityIndicator color={C.accent} />
                    ) : prChartData.length < 2 ? (
                      <Text style={{ color: C.textTertiary, textAlign: 'center', paddingVertical: S.sm }}>Noch nicht genug Daten für einen Verlauf</Text>
                    ) : (
                      <>
                        <Text style={{ color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: S.sm }}>1RM VERLAUF</Text>
                        <LineChart data={prChartData} width={Dimensions.get('window').width - 96} height={120} color={C.accent} colors={C} />
                      </>
                    )}
                  </View>
                )}
              </React.Fragment>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
