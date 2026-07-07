/**
 * screens/kraft/ExerciseDetailScreen.js — Übungsdetails
 *
 * Drei Tabs:
 *   Zusammenfassung — MuscleMap + PR-Anzeige + Kurzanleitung
 *   Anleitung       — Vollbild-Bild + Schritt-für-Schritt
 *   Historie        — 1RM-Verlauf (LineChart, Epley-Formel) + Session-History
 *
 * Epley-Formel für 1RM-Schätzung: estimated1RM = weight × (1 + reps/30)
 * Wird auch für den Chart und PR-Vergleich verwendet.
 */

// React/RN
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Linking, Dimensions,
} from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Internal
import LineChart from '../../components/LineChart';
import { useTheme } from '../../theme';
import { api } from '../../api/client';
import { useKraftStore } from '../../store/kraftStore';
import { EXERCISES, MUSCLE_COLORS, getExerciseImageUrl, muscleIcon } from '../../data/exercises';
import MuscleMap from '../../components/MuscleMap';

const TABS = ['Zusammenfassung', 'Anleitung', 'Historie'];

// ── Step-by-step instructions ─────────────────────────────────────
function StepByStep({ instructions, colors: C, spacing: S, radius: R }) {
  if (!instructions) {
    return <Text style={{ color: C.textTertiary, fontStyle: 'italic' }}>Keine Anleitung verfügbar.</Text>;
  }
  const steps = instructions.split('\n').filter(Boolean);
  return (
    <View style={{ gap: 12 }}>
      {steps.map((step, i) => {
        const text = step.replace(/^\d+\.\s*/, '').trim();
        const num = step.match(/^(\d+)\./)?.[1] || String(i + 1);
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.accent + '22', justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 }}>
              <Text style={{ color: C.accent, fontSize: 13, fontWeight: '700' }}>{num}</Text>
            </View>
            <Text style={{ color: C.text, fontSize: 15, lineHeight: 23, flex: 1 }}>{text}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Image Section ─────────────────────────────────────────────────
function ExerciseImageSection({ exercise, muscleColor, colors: C, spacing: S, radius: R }) {
  const imgUrl = getExerciseImageUrl(exercise);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const openVideo = () => {
    const q = encodeURIComponent(exercise.name_de + ' Ausführung Tutorial');
    Linking.openURL(`https://www.youtube.com/results?search_query=${q}`);
  };

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: R.md, overflow: 'hidden', marginBottom: S.md }}>
      {/* Image area */}
      <View style={{ height: 220, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' }}>
        {imgUrl && !imgFailed ? (
          <>
            {!imgLoaded && <ActivityIndicator color={muscleColor} style={{ position: 'absolute' }} />}
            <Image
              source={{ uri: imgUrl }}
              style={{ width: '100%', height: 220, resizeMode: 'contain' }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
            />
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: muscleColor + '22', justifyContent: 'center', alignItems: 'center' }}>
              <MaterialCommunityIcons name={muscleIcon(exercise.muscle_group)} size={40} color={muscleColor} />
            </View>
            <Text style={{ color: C.textTertiary, fontSize: 13 }}>Kein Bild verfügbar</Text>
          </View>
        )}
      </View>

      {/* Bottom bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }}>
        <View style={{ backgroundColor: muscleColor + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 }}>
          <Text style={{ color: muscleColor, fontWeight: '700', fontSize: 13 }}>{exercise.muscle_group}</Text>
        </View>
        <Text style={{ color: C.textSecondary, fontSize: 13, marginLeft: 8, flex: 1 }}>{exercise.equipment}</Text>
        <TouchableOpacity onPress={openVideo} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: C.border }}>
          <Feather name="youtube" size={14} color={C.accent} />
          <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>Video</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────
export default function ExerciseDetailScreen({ navigation, route }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const exercise = route?.params?.exercise || {};
  const [activeTab, setActiveTab] = useState('Zusammenfassung');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { prs } = useKraftStore();
  const pr = prs[exercise.id];
  const muscleColor = MUSCLE_COLORS[exercise.muscle_group] || C.accent;
  const chartWidth = Dimensions.get('window').width - 80;

  // Short description: first 3 steps joined
  const shortDesc = exercise.instructions_de
    ? exercise.instructions_de.split('\n').slice(0, 3).map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean).join(' → ')
    : null;

  useEffect(() => {
    if (activeTab === 'Historie' && exercise.id) {
      setLoadingHistory(true);
      api.getExerciseHistory(exercise.id)
        .then(data => setHistory(data || []))
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [activeTab, exercise.id]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.md, paddingBottom: S.sm, backgroundColor: C.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: S.sm }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: S.sm, marginTop: 3 }}>
            <Feather name="arrow-left" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[T.h2, { color: C.text }]}>{exercise.name_de || '—'}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              <View style={{ backgroundColor: muscleColor + '33', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                <Text style={{ color: muscleColor, fontSize: 12, fontWeight: '700' }}>{exercise.muscle_group}</Text>
              </View>
              <View style={{ backgroundColor: C.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                <Text style={{ color: C.textSecondary, fontSize: 12 }}>{exercise.equipment}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sub-Tabs */}
        <View style={{ flexDirection: 'row' }}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: activeTab === tab ? muscleColor : 'transparent' }}
            >
              <Text style={{ color: activeTab === tab ? C.text : C.textTertiary, fontSize: 13, fontWeight: '600' }}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>

        {/* ── ZUSAMMENFASSUNG ── */}
        {activeTab === 'Zusammenfassung' && (
          <>
            {/* Muscle Map */}
            <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.md, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              <MuscleMap
                workedMuscles={(EXERCISES.find(e => e.id === exercise.id) || exercise).worked_muscles}
                muscleGroup={exercise.muscle_group}
                colors={C}
              />
            </View>

            {/* PR */}
            {pr ? (
              <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.md }}>
                <Text style={{ color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 }}>PERSÖNLICHER REKORD</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={{ color: muscleColor, fontWeight: '800', fontSize: 30 }}>{pr.weight_kg} kg</Text>
                  <Text style={{ color: C.textSecondary, fontSize: 16 }}>× {pr.reps} Wdh</Text>
                </View>
                {pr.estimated_1rm && <Text style={{ color: C.textTertiary, fontSize: 13, marginTop: 4 }}>Gesch. 1RM: {Math.round(pr.estimated_1rm)} kg</Text>}
              </View>
            ) : (
              <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.md, alignItems: 'center' }}>
                <Text style={{ color: C.textTertiary }}>Noch kein Rekord — leg los!</Text>
              </View>
            )}

            {/* Short instructions */}
            <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md }}>
              <Text style={{ color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 }}>KURZVERSION</Text>
              {shortDesc ? (
                <>
                  <Text style={{ color: C.text, lineHeight: 22, fontSize: 14 }}>{shortDesc}</Text>
                  <TouchableOpacity onPress={() => setActiveTab('Anleitung')} style={{ marginTop: 10 }}>
                    <Text style={{ color: C.accent, fontWeight: '600', fontSize: 14 }}>Vollständige Anleitung ansehen →</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={{ color: C.textTertiary, fontStyle: 'italic' }}>Keine Beschreibung vorhanden</Text>
              )}
            </View>
          </>
        )}

        {/* ── ANLEITUNG ── */}
        {activeTab === 'Anleitung' && (
          <>
            <ExerciseImageSection exercise={exercise} muscleColor={muscleColor} colors={C} spacing={S} radius={R} />
            <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md }}>
              <Text style={{ color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: S.md }}>SCHRITT-FÜR-SCHRITT</Text>
              <StepByStep instructions={exercise.instructions_de} colors={C} spacing={S} radius={R} />
            </View>
          </>
        )}

        {/* ── HISTORIE ── */}
        {activeTab === 'Historie' && (
          loadingHistory ? (
            <ActivityIndicator color={muscleColor} style={{ marginTop: 40 }} />
          ) : history.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Feather name="inbox" size={36} color={C.textTertiary} />
              <Text style={{ color: C.textTertiary, marginTop: 10 }}>Noch keine Einträge</Text>
            </View>
          ) : (
            <>
              {(() => {
                const chartData = [...history].reverse().map((session, i) => {
                  const best1RM = Math.max(...session.sets.map(s => Math.round((parseFloat(s.weight_kg)||0) * (1 + (parseInt(s.reps)||0)/30))));
                  return {
                    value: best1RM,
                    label: i % 2 === 0 ? new Date(session.finished_at || session.started_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '',
                  };
                });
                return chartData.length >= 2 ? (
                  <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.md }}>
                    <Text style={{ color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: S.sm }}>1RM VERLAUF (GESCHÄTZT)</Text>
                    <LineChart data={chartData} width={chartWidth} height={120} color={muscleColor} colors={C} />
                  </View>
                ) : null;
              })()}
              {history.map((session, i) => (
                <View key={i} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.sm }}>
                  <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 6 }}>
                    {new Date(session.finished_at || session.started_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    {session.routine_name ? ` · ${session.routine_name}` : ''}
                  </Text>
                  {(session.sets || []).map((s, si) => (
                    <View key={si} style={{ flexDirection: 'row', paddingVertical: 3 }}>
                      <Text style={{ color: C.textTertiary, width: 24, fontSize: 13 }}>{s.set_number}.</Text>
                      <Text style={{ color: C.text, fontWeight: '600', flex: 1 }}>{s.weight_kg} kg</Text>
                      <Text style={{ color: C.textSecondary, fontSize: 13 }}>× {s.reps} Wdh</Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
          )
        )}
      </ScrollView>
    </View>
  );
}
