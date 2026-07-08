/**
 * screens/CalendarScreen.js — Trainingskalender & Wettkampfplanung
 *
 * Monatskalender mit Trainings-Einträgen (aus dem Backend via api.getCalendar()).
 * Zeigt Workouts, geplante Einheiten und Wettkampf-Marker pro Tag.
 * Sporttyp-Farben und Icons über getSportIcon() / getSportColor() aus api/client.
 *
 * Daten werden bei Screen-Focus (useFocusEffect) neu geladen (RefreshControl + Auto).
 */

// React/RN
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, RefreshControl, Alert,
} from 'react-native';

// Third-party
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// Internal
import { useStore } from '../store';
import { api, getSportIcon, getSportColor } from '../api/client';
import { getSportMci } from '../data/sports';
import { useTheme } from '../theme';
import ActivityLogModal from '../components/ActivityLogModal';
import WeeklyReviewModal from '../components/WeeklyReviewModal';
import WorkoutProfileChart from '../components/WorkoutProfileChart';
import { getSessionSteps } from '../utils/workoutStructure';

const DAYS_SHORT = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const MONTHS_FULL = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

function getMondayOfWeek(date) {
  const d = new Date(date);
  const diff = (d.getDay() === 0 ? -6 : 1 - d.getDay());
  d.setDate(d.getDate() + diff); d.setHours(0,0,0,0); return d;
}
function formatDate(d) { return d.toISOString().split('T')[0]; }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate()+n); return d; }

function WellnessDot({ value, max=5 }) {
  const { colors: C } = useTheme();
  if (!value) return null;
  const color = value/max >= 0.8 ? C.success : value/max >= 0.5 ? C.warning : C.danger;
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({length:max}).map((_,i) => (
        <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: i < value ? color : C.border }} />
      ))}
    </View>
  );
}

function StatPill({ label, value }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  return (
    <View style={{ backgroundColor: C.bgTertiary, borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: 5 }}>
      <Text style={[T.caption, { color: C.textTertiary, fontSize: 9 }]}>{label}</Text>
      <Text style={[T.bodyMed, { color: C.text, fontSize: 12 }]}>{value}</Text>
    </View>
  );
}

function DayCard({ date, dayData, isToday, onPress, onKIReview }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const dayIdx = (new Date(date+'T12:00:00').getDay()+6)%7;
  const dayShort = DAYS_SHORT[dayIdx];
  const dayNum = new Date(date+'T12:00:00').getDate();
  const isFuture = new Date(date+'T23:59:59') > new Date();

  const workouts = dayData?.training?.completedAll?.length > 0
    ? dayData.training.completedAll
    : dayData?.training?.completed ? [dayData.training.completed] : [];
  const workout = workouts[0] || null;
  const plannedRaw = dayData?.training?.planned;
  const planned = Array.isArray(plannedRaw) ? plannedRaw : (plannedRaw ? [plannedRaw] : []);
  const calories = dayData?.calories;
  const wellness = dayData?.dailyLog;
  const weight = dayData?.weight;

  const calGoal = calories?.goal || 2000;
  const calDone = calories?.totals?.calories || 0;
  const calPct = Math.min(calDone/calGoal, 1);
  const calColor = calDone > calGoal*1.15 ? C.danger : calDone >= calGoal*0.85 ? C.success : calDone > 0 ? C.warning : C.textTertiary;

  return (
    <TouchableOpacity
      style={{
        backgroundColor: C.surface, borderRadius: R.lg, padding: S.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isToday ? C.tint+'60' : C.border,
        backgroundColor: isToday ? C.tint+'06' : C.surface,
      }}
      onPress={onPress} activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 40, height: 44, borderRadius: R.md, backgroundColor: isToday ? C.tint : C.bgSecondary, alignItems: 'center', justifyContent: 'center', marginRight: S.md }}>
          <Text style={[T.label, { color: isToday ? C.tintText : C.textTertiary }]}>{dayShort}</Text>
          <Text style={[T.bodyMed, { color: isToday ? C.tintText : C.text, fontSize: 18 }]}>{dayNum}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {workouts.length > 0 ? (
            workouts.map((w, wi) => (
              <View key={wi} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: wi < workouts.length-1 ? 2 : 0 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getSportColor(w.sport_type) }} />
                <Text style={[T.caption, { color: wi===0 ? C.text : C.textSecondary, fontWeight: wi===0 ? '600' : '400' }]} numberOfLines={1}>{w.focus||'Workout'}</Text>
              </View>
            ))
          ) : planned.length > 0 && !isFuture ? (
            planned.map((p, pi) => (
              <View key={pi} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: pi < planned.length-1 ? 2 : 0 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getSportColor(p.sport_type), opacity: 0.5 }} />
                <Text style={[T.caption, { color: C.textTertiary }]} numberOfLines={1}>{p.focus}</Text>
                {pi === 0 && <Text style={[T.label, { color: C.tint }]}>Ausstehend</Text>}
              </View>
            ))
          ) : planned.length > 0 && isFuture ? (
            planned.map((p, pi) => (
              <View key={pi} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: pi < planned.length-1 ? 2 : 0 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getSportColor(p.sport_type) }} />
                <Text style={[T.caption, { color: C.textSecondary }]} numberOfLines={1}>{p.focus}</Text>
              </View>
            ))
          ) : (
            <Text style={[T.caption, { color: C.textTertiary }]}>{isFuture ? '—' : 'Kein Eintrag'}</Text>
          )}
        </View>
        {onKIReview && workout && (
          <TouchableOpacity
            style={{ backgroundColor: C.tint+'18', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint+'40' }}
            onPress={() => onKIReview(date, workout)}
          >
            <Text style={[T.label, { color: C.tint }]}>KI</Text>
          </TouchableOpacity>
        )}
      </View>

      {(calDone > 0 || wellness) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S.sm, paddingTop: S.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }}>
          {calDone > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <View style={{ width: 60, height: 4, backgroundColor: C.bgTertiary, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${calPct*100}%`, backgroundColor: calColor, borderRadius: 2 }} />
              </View>
              <Text style={[T.caption, { color: calColor, fontSize: 10 }]}>{Math.round(calDone)}</Text>
            </View>
          )}
          {wellness && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginLeft: 'auto' }}>
              {wellness.sleep_quality && <WellnessDot value={wellness.sleep_quality} />}
              {wellness.energy && <WellnessDot value={wellness.energy} />}
            </View>
          )}
          {weight && (
            <Text style={[T.caption, { color: C.textTertiary, marginLeft: S.sm }]}>{weight}kg</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function SessionPreviewModal({ visible, session, onClose, onComplete }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  if (!session) return null;
  const sc = getSportColor(session.sport_type);
  const exercises = session.exercises || session.sessionExercises || [];
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.lg, paddingTop: S.xl, paddingBottom: 130 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={[T.h3, { color: C.text }]}>{session.focus}</Text>
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.xs, flexWrap: 'wrap' }}>
              {session.duration > 0 && <Text style={[T.caption, { color: C.textSecondary }]}>{session.duration} Min</Text>}
              {session.intensity && <Text style={[T.caption, { color: sc }]}>{session.intensity}</Text>}
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Feather name="x" size={22} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        {exercises.length > 0 && (
          <View style={{ marginBottom: S.lg }}>
            <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', marginBottom: S.sm }]}>Übungen</Text>
            {exercises.map((ex, i) => (
              <View key={i} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[T.bodyMed, { color: C.text, flex: 1 }]}>{ex.name}</Text>
                  {(ex.sets > 1 || ex.reps) && (
                    <Text style={[T.label, { color: sc }]}>{ex.sets > 1 ? `${ex.sets}×` : ''}{ex.reps}</Text>
                  )}
                </View>
                {ex.description && <Text style={[T.caption, { color: C.textSecondary, marginTop: 2 }]}>{ex.description}</Text>}
                {ex.zone && <Text style={[T.caption, { color: C.textTertiary, marginTop: 2 }]}>{ex.zone}</Text>}
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={() => { onClose(); onComplete?.(); }}
          style={{ backgroundColor: C.tint, borderRadius: R.lg, padding: S.md, alignItems: 'center', marginTop: S.sm }}
        >
          <Text style={[T.bodyMed, { color: C.tintText }]}>Zum Training → Abschließen</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

function DayDetailModal({ visible, date, dayData, onClose, onDeleted, onCaloriePress, onTrainingPress, onAddActivity }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const [previewSession, setPreviewSession] = useState(null);
  if (!date) return null;
  const d = new Date(date+'T12:00:00');
  const workouts = dayData?.training?.completedAll?.length > 0
    ? dayData.training.completedAll
    : dayData?.training?.completed ? [dayData.training.completed] : [];
  const plannedRaw = dayData?.training?.planned;
  const planned = Array.isArray(plannedRaw) ? plannedRaw : (plannedRaw ? [plannedRaw] : []);
  const calories = dayData?.calories;
  const wellness = dayData?.dailyLog;
  const calGoal = calories?.goal || 2000;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.lg, paddingTop: S.xl, paddingBottom: 130 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg }}>
          <Text style={[T.h3, { color: C.text }]}>
            {d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Feather name="x" size={22} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Aktivität manuell eintragen */}
        <TouchableOpacity
          onPress={() => onAddActivity?.(date)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.tint + '15', borderRadius: R.lg, padding: S.md, marginBottom: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '40' }}
        >
          <Feather name="plus-circle" size={18} color={C.tint} />
          <Text style={[T.bodyMed, { color: C.tint }]}>Aktivität eintragen</Text>
        </TouchableOpacity>

        {(workouts.length > 0 || planned.length > 0) && (
          <View style={{ marginBottom: S.lg }}>
            <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', marginBottom: S.sm }]}>Training</Text>
            {workouts.length > 0 ? workouts.map((workout, wi) => (
              <TouchableOpacity key={wi} activeOpacity={0.7} onPress={() => setPreviewSession(workout)} style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: `${getSportColor(workout.sport_type)}30`, marginBottom: wi < workouts.length-1 ? S.sm : 0 }}>
                {workouts.length > 1 && <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs }]}>EINHEIT {wi+1}</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${getSportColor(workout.sport_type)}20`, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name={getSportMci(workout.sport_type)} size={20} color={getSportColor(workout.sport_type)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.bodyMed, { color: C.text }]}>{workout.focus||'Workout'}</Text>
                    {workout.plan_name && <Text style={[T.caption, { color: C.textSecondary }]}>{workout.plan_name}</Text>}
                  </View>
                  {workout.rating ? (
                    <View style={{ flexDirection: 'row', gap: 1 }}>
                      {Array.from({ length: workout.rating }).map((_, si) => <Feather key={si} name="star" size={12} color="#E8C547" />)}
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  {workout.duration_minutes ? <StatPill label="Dauer" value={`${workout.duration_minutes} Min`} /> : null}
                  {workout.distance ? <StatPill label="Distanz" value={`${workout.distance} km`} /> : null}
                  {workout.avg_hr ? <StatPill label="ØHF" value={`${workout.avg_hr}`} /> : null}
                  {workout.calories ? <StatPill label="kcal" value={`${workout.calories}`} /> : null}
                  {workout.perceived_effort ? <StatPill label="RPE" value={`${workout.perceived_effort}/10`} /> : null}
                </View>
                {workout.notes && <Text style={[T.caption, { color: C.textSecondary, fontStyle: 'italic', marginTop: S.sm }]}>"{workout.notes}"</Text>}
                <TouchableOpacity
                  style={{ marginTop: S.sm, flexDirection: 'row', alignItems: 'center', gap: S.xs }}
                  onPress={() => Alert.alert('Löschen?', workout.focus || 'Workout', [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'Löschen', style: 'destructive', onPress: async () => {
                      try { await api.deleteCompletedWorkout(workout.id); onDeleted?.(); onClose(); } catch(e) { Alert.alert('Fehler', e.message); }
                    }},
                  ])}
                >
                  <Feather name="trash-2" size={13} color={C.danger} />
                  <Text style={[T.caption, { color: C.danger }]}>Einheit löschen</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )) : planned.length > 0 ? planned.map((p, pi) => (
              <TouchableOpacity
                key={pi}
                onPress={() => setPreviewSession(p)}
                activeOpacity={0.7}
                style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: pi < planned.length-1 ? S.sm : 0 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { color: C.text }]}>{p.focus}</Text>
                    <Text style={[T.caption, { color: C.textTertiary }]}>Geplant — noch nicht abgeschlossen</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={C.textTertiary} />
                </View>
              </TouchableOpacity>
            )) : null}
          </View>
        )}

        {calories?.totals?.calories > 0 && (
          <View style={{ marginBottom: S.lg }}>
            <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', marginBottom: S.sm }]}>Ernährung</Text>
            <TouchableOpacity onPress={() => { onClose(); onCaloriePress?.(); }} activeOpacity={0.7} style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: S.md }}>
                {[[Math.round(calories.totals.calories),'kcal',C.tint],[Math.round(calories.totals.protein||0),'P g',C.success],[Math.round(calories.totals.carbs||0),'K g',C.warning],[Math.round(calories.totals.fat||0),'F g',C.danger]].map(([val,label,color]) => (
                  <View key={label} style={{ alignItems: 'center' }}>
                    <Text style={[T.h2, { color }]}>{val}</Text>
                    <Text style={[T.caption, { color: C.textSecondary }]}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={{ height: 3, backgroundColor: C.bgTertiary, borderRadius: 2, overflow: 'hidden', marginBottom: S.xs }}>
                <View style={{ height: '100%', width: `${Math.min(calories.totals.calories/calGoal,1)*100}%`, backgroundColor: calories.totals.calories >= calGoal*0.85 ? C.success : C.warning, borderRadius: 2 }} />
              </View>
              <Text style={[T.caption, { color: C.textTertiary, textAlign: 'right' }]}>Ziel: {calGoal} kcal</Text>
            </TouchableOpacity>
          </View>
        )}

        {wellness && (
          <View style={{ marginBottom: S.lg }}>
            <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', marginBottom: S.sm }]}>Tagesform</Text>
            <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.lg }}>
                {[['moon','Schlaf', wellness.sleep_hours ? `${wellness.sleep_hours}h` : null, null],['star','Schlafqualität',null,wellness.sleep_quality],['smile','Stimmung',null,wellness.mood],['zap','Energie',null,wellness.energy],['activity','Kater',null,wellness.soreness],['heart','Ruhe-HF',wellness.resting_hr ? `${wellness.resting_hr}bpm` : null, null]].filter(([,,v,s]) => v||s).map(([ico,label,val,scale]) => (
                  <View key={label} style={{ alignItems: 'center', minWidth: 56 }}>
                    <Feather name={ico} size={15} color={C.textSecondary} style={{ marginBottom: 3 }} />
                    <Text style={[T.caption, { color: C.textTertiary, fontSize: 9, marginBottom: 3 }]}>{label}</Text>
                    {val ? <Text style={[T.caption, { color: C.textSecondary, fontWeight: '600' }]}>{val}</Text> : <WellnessDot value={scale} />}
                  </View>
                ))}
              </View>
              {wellness.notes && <Text style={[T.caption, { color: C.textSecondary, fontStyle: 'italic', marginTop: S.md }]}>"{wellness.notes}"</Text>}
            </View>
          </View>
        )}

        {workouts.length === 0 && !planned && !(calories?.totals?.calories > 0) && !wellness && (
          <View style={{ alignItems: 'center', paddingVertical: S.xxl }}>
            <Feather name="inbox" size={36} color={C.textTertiary} />
            <Text style={[T.body, { color: C.textSecondary, marginTop: S.md }]}>Keine Daten für diesen Tag</Text>
          </View>
        )}
      </ScrollView>

      {previewSession && (() => {
        const sc = getSportColor(previewSession.sport_type);
        const exercises = previewSession.exercises || previewSession.sessionExercises || [];
        // Erledigte Einheit (importiert/abgeschlossen) vs. geplante Session
        const isCompleted = !!(previewSession.completed_at || previewSession.exercisesCompleted);
        const done = previewSession.exercisesCompleted || {};
        const fmtT = (s) => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : null;
        const stats = isCompleted ? [
          ['Dauer', previewSession.duration_minutes ? `${previewSession.duration_minutes} Min` : null],
          ['Distanz', previewSession.distance ? `${previewSession.distance} km` : null],
          ['Ø Puls', done.avg_hr || previewSession.avg_hr ? `${done.avg_hr || previewSession.avg_hr} bpm` : null],
          ['Max. Puls', done.max_hr ? `${done.max_hr} bpm` : null],
          ['Ø Tempo', done.avg_speed_kmh ? `${done.avg_speed_kmh} km/h` : null],
          ['Ø Watt', done.avg_watts ? `${done.avg_watts} W` : null],
          ['NP', done.weighted_watts ? `${done.weighted_watts} W` : null],
          ['Höhenmeter', done.elevation_gain_m ? `${done.elevation_gain_m} m` : null],
          ['Kalorien', done.calories || previewSession.calories ? `${done.calories || previewSession.calories} kcal` : null],
          ['Load', done.training_load ? `${done.training_load}` : null],
        ].filter(([, v]) => v) : [];
        const laps = Array.isArray(done.laps) ? done.laps : (Array.isArray(done.splits) ? done.splits : []);
        return (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: S.lg, paddingTop: S.xl, paddingBottom: 130 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg }}>
                <View style={{ flex: 1 }}>
                  <Text style={[T.h3, { color: C.text }]}>{previewSession.focus || previewSession.title || 'Einheit'}</Text>
                  <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.xs, flexWrap: 'wrap' }}>
                    {isCompleted && <Text style={[T.caption, { color: C.success, fontWeight: '600' }]}>✓ Absolviert</Text>}
                    {!isCompleted && previewSession.duration > 0 && <Text style={[T.caption, { color: C.textSecondary }]}>{previewSession.duration} Min</Text>}
                    {previewSession.intensity && <Text style={[T.caption, { color: sc }]}>{previewSession.intensity}</Text>}
                  </View>
                </View>
                <TouchableOpacity onPress={() => setPreviewSession(null)} hitSlop={8}>
                  <Feather name="x" size={22} color={C.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Ergebnis-Werte (erledigte Einheit) */}
              {stats.length > 0 && (
                <View style={{ marginBottom: S.lg }}>
                  <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', marginBottom: S.sm }]}>Ergebnis</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
                    {stats.map(([l, v]) => (
                      <View key={l} style={{ width: '30.5%', backgroundColor: C.surface, borderRadius: R.md, paddingVertical: 10, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                        <Text style={[T.bodyMed, { color: C.text, fontSize: 14 }]}>{v}</Text>
                        <Text style={[T.label, { color: C.textTertiary, marginTop: 1 }]}>{l}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Runden / Splits */}
              {isCompleted && laps.length > 1 && (
                <View style={{ marginBottom: S.lg }}>
                  <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', marginBottom: S.sm }]}>
                    {done.laps ? 'Runden' : 'Kilometer-Splits'}
                  </Text>
                  <View style={{ backgroundColor: C.surface, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' }}>
                    {laps.slice(0, 25).map((lp, li) => (
                      <View key={li} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 8, borderBottomWidth: li < Math.min(laps.length, 25) - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: C.border, gap: S.sm }}>
                        <Text style={[T.label, { color: lp.typ === 'WORK' ? sc : C.textTertiary, width: 24 }]}>{lp.km || li + 1}</Text>
                        <Text style={[T.caption, { color: C.text, flex: 1 }]}>
                          {lp.distanz_m ? `${(lp.distanz_m / 1000).toFixed(2)} km` : lp.pace_s_km ? `${fmtT(lp.pace_s_km)}/km` : ''}
                          {lp.zeit_s ? ` · ${fmtT(lp.zeit_s)}` : ''}
                        </Text>
                        {lp.avg_watts ? <Text style={[T.caption, { color: C.textSecondary }]}>{lp.avg_watts} W</Text> : null}
                        {lp.avg_hr ? <Text style={[T.caption, { color: C.textSecondary }]}>{lp.avg_hr} bpm</Text> : null}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {!isCompleted && getSessionSteps(previewSession).length > 0 && (
                <View style={{ marginBottom: S.lg }}>
                  <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', marginBottom: S.sm }]}>Profil</Text>
                  <WorkoutProfileChart steps={getSessionSteps(previewSession)} height={72} />
                </View>
              )}

              {exercises.length > 0 && (
                <View style={{ marginBottom: S.lg }}>
                  <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', marginBottom: S.sm }]}>Übungen</Text>
                  {exercises.map((ex, i) => (
                    <View key={i} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, marginBottom: S.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[T.bodyMed, { color: C.text, flex: 1 }]}>{ex.name}</Text>
                        {(ex.sets > 1 || ex.reps) && (
                          <Text style={[T.label, { color: sc }]}>{ex.sets > 1 ? `${ex.sets}×` : ''}{ex.reps}</Text>
                        )}
                      </View>
                      {ex.description && <Text style={[T.caption, { color: C.textSecondary, marginTop: 2 }]}>{ex.description}</Text>}
                      {ex.zone && <Text style={[T.caption, { color: C.textTertiary, marginTop: 2 }]}>{ex.zone}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {!isCompleted && (
                <TouchableOpacity
                  onPress={() => { setPreviewSession(null); onClose(); onTrainingPress?.(); }}
                  style={{ backgroundColor: C.tint, borderRadius: R.lg, padding: S.md, alignItems: 'center', marginTop: S.sm }}
                >
                  <Text style={[T.bodyMed, { color: C.tintText }]}>Zum Training → Abschließen</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        );
      })()}

      </View>
    </Modal>
  );
}

function KIReviewModal({ visible, date, workout, onClose }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (visible && workout && !review) loadReview(); }, [visible]);

  const loadReview = async () => {
    setLoading(true);
    try {
      const context = `Training am ${date}: ${workout.focus||'Workout'}, Dauer: ${workout.duration_minutes||'?'} Min, RPE: ${workout.perceived_effort||'?'}/10`;
      const res = await api.chatWithCoach(`Analysiere dieses Training und gib mir kurzes Feedback: ${context}`, 'training-review');
      setReview(res.reply);
    } catch (e) { setReview('Feedback konnte nicht geladen werden.'); }
    setLoading(false);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', padding: S.md, paddingBottom: S.xl }} activeOpacity={1} onPress={onClose}>
        <View style={{ backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <Feather name="cpu" size={16} color={C.tint} />
              <Text style={[T.bodyMed, { color: C.text }]}>KI Coach Feedback</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={C.textSecondary} />
            </TouchableOpacity>
          </View>
          {workout && <Text style={[T.label, { color: C.tint, marginBottom: S.md }]}>{workout.focus} · {date}</Text>}
          {loading
            ? <View style={{ alignItems: 'center', padding: S.lg }}><ActivityIndicator color={C.textSecondary} /><Text style={[T.caption, { color: C.textSecondary, marginTop: S.sm }]}>Analysiere…</Text></View>
            : <Text style={[T.body, { color: C.text, lineHeight: 22 }]}>{review}</Text>
          }
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function CalendarScreen({ tabBar, onSwitchToKalorien }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { user } = useStore();
  const navigation = useNavigation();
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(new Date()));
  const [weekData, setWeekData] = useState({});
  const [loading, setLoading] = useState(false);
  const [streakData, setStreakData] = useState({ goalStreak: 0, trackStreak: 0 });
  const [selectedDate, setSelectedDate] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [kiDate, setKiDate] = useState(null);
  const [kiWorkout, setKiWorkout] = useState(null);
  const [kiVisible, setKiVisible] = useState(false);
  const [view, setView] = useState('week');
  const [monthYear, setMonthYear] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() });
  const [monthData, setMonthData] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [activityVisible, setActivityVisible] = useState(false);
  const [activityDate, setActivityDate] = useState(null);
  const [reviewVisible, setReviewVisible] = useState(false);

  const openActivity = (d) => { setActivityDate(d || today); setDetailVisible(false); setActivityVisible(true); };

  const today = formatDate(new Date());
  const weekDates = Array.from({length:7}, (_,i) => formatDate(addDays(weekStart,i)));
  const weekLabel = `${weekStart.getDate()}. ${MONTHS[weekStart.getMonth()]} – ${formatDate(addDays(weekStart,6)).slice(8)}. ${MONTHS[addDays(weekStart,6).getMonth()]} ${addDays(weekStart,6).getFullYear()}`;

  useEffect(() => { loadStreak(); }, []);
  useEffect(() => { loadWeek(); }, [weekStart]);
  useFocusEffect(useCallback(() => { loadWeek(); if (view==='month') loadMonth(); }, [weekStart, view, monthYear]));
  useEffect(() => { if (view==='month') loadMonth(); }, [view, monthYear]);

  const loadStreak = async () => { try { setStreakData(await api.getStreak()); } catch(e) {} };

  const loadWeek = async () => {
    setLoading(true);
    const newData = {};
    await Promise.all(weekDates.map(async (date) => {
      try { newData[date] = await api.getCalendarDay(date); }
      catch(e) { try { const cal = await api.getCalories(date); newData[date] = { date, calories: cal, training:{}, dailyLog:null }; } catch {} }
    }));
    setWeekData(newData); setLoading(false);
  };

  const loadMonth = async () => {
    try { const data = await api.getCalendarMonth(monthYear.y, monthYear.m+1); setMonthData(data||{}); }
    catch(e) { try { const data = await api.getCalendarCalories(monthYear.y, monthYear.m+1); setMonthData(data||{}); } catch {} }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWeek();
    if (view==='month') await loadMonth();
    setRefreshing(false);
  };

  const workoutsThisWeek = weekDates.filter(d => { const t = weekData[d]?.training; return t?.completedAll?.length > 0 || !!t?.completed; }).length;
  const caloriesDaysReached = weekDates.filter(d => { const c = weekData[d]?.calories; return c?.totals?.calories > 0 && c.totals.calories >= (c.goal||2000)*0.85; }).length;

  const firstDayOfMonth = new Date(monthYear.y, monthYear.m, 1).getDay();
  const daysInMonth = new Date(monthYear.y, monthYear.m+1, 0).getDate();
  const startOffset = firstDayOfMonth===0 ? 6 : firstDayOfMonth-1;
  const monthCells = [...Array(startOffset).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];

  return (
    <View style={{ flex: 1 }}>
      {tabBar}
      <DayDetailModal
        visible={detailVisible} date={selectedDate} dayData={selectedDate?weekData[selectedDate]:null}
        onClose={() => setDetailVisible(false)}
        onDeleted={() => { setDetailVisible(false); loadWeek(); }}
        onCaloriePress={() => { setDetailVisible(false); onSwitchToKalorien?.(); }}
        onTrainingPress={() => navigation.navigate('Training')}
        onAddActivity={openActivity}
      />
      <KIReviewModal visible={kiVisible} date={kiDate} workout={kiWorkout} onClose={() => setKiVisible(false)} />
      <ActivityLogModal
        visible={activityVisible}
        date={activityDate}
        onClose={() => setActivityVisible(false)}
        onSaved={() => { setActivityVisible(false); loadWeek(); if (view === 'month') loadMonth(); loadStreak(); }}
      />
      <WeeklyReviewModal
        visible={reviewVisible}
        weekData={weekData}
        weekDates={weekDates}
        weekLabel={weekLabel}
        onClose={() => setReviewVisible(false)}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ paddingBottom: 130, paddingHorizontal: S.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textSecondary} />}
      >
        {/* View toggle + Schnell-Eintrag + Review */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: S.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
            <TouchableOpacity
              onPress={() => openActivity(today)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accent, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 7 }}
            >
              <Feather name="plus" size={15} color={C.accentText} />
              <Text style={[T.label, { color: C.accentText, fontWeight: '700' }]}>Aktivität</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setReviewVisible(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
            >
              <Feather name="bar-chart-2" size={15} color={C.textSecondary} />
              <Text style={[T.label, { color: C.textSecondary, fontWeight: '700' }]}>Review</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', backgroundColor: C.bgSecondary, borderRadius: R.md, padding: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            {[['week','Woche'],['month','Monat']].map(([v,l]) => (
              <TouchableOpacity key={v} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: R.sm, backgroundColor: view===v ? C.accent : 'transparent' }} onPress={() => setView(v)}>
                <Text style={[T.label, { color: view===v ? C.accentText : C.textSecondary }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
          {[
            [streakData.goalStreak, 'Streak', '#F97316'],
            [workoutsThisWeek, 'Workouts', C.success],
            [`${caloriesDaysReached}/7`, 'Kal.Ziel', '#60A5FA'],
            [streakData.trackStreak, 'Track', C.tint],
          ].map(([val, label, color]) => (
            <View key={label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              <Text style={[T.h2, { color, fontSize: 18 }]}>{val}</Text>
              <Text style={[T.label, { color: C.textTertiary, fontSize: 9, marginTop: 1, textAlign: 'center' }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Week view */}
        {view === 'week' && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.md }}>
              <TouchableOpacity
                style={{ width: 36, height: 36, borderRadius: R.md, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setWeekStart(prev => addDays(prev,-7))}
              >
                <Feather name="chevron-left" size={18} color={C.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => setWeekStart(getMondayOfWeek(new Date()))}>
                <Text style={[T.bodyMed, { color: C.text }]}>{weekLabel}</Text>
                {weekDates.includes(today) && <Text style={[T.label, { color: C.tint }]}>Diese Woche</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ width: 36, height: 36, borderRadius: R.md, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setWeekStart(prev => addDays(prev,7))}
              >
                <Feather name="chevron-right" size={18} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={{ alignItems: 'center', paddingVertical: S.xl }}>
                <ActivityIndicator color={C.textSecondary} />
                <Text style={[T.caption, { color: C.textSecondary, marginTop: S.md }]}>Lade Woche…</Text>
              </View>
            ) : (
              <View style={{ gap: S.sm }}>
                {weekDates.map(date => (
                  <DayCard
                    key={date} date={date} dayData={weekData[date]} isToday={date===today}
                    onPress={() => { setSelectedDate(date); setDetailVisible(true); }}
                    onKIReview={(d,w) => { setKiDate(d); setKiWorkout(w); setKiVisible(true); }}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* Month view */}
        {view === 'month' && (
          <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.md }}>
              <TouchableOpacity
                style={{ width: 36, height: 36, borderRadius: R.md, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setMonthYear(p => { const m = p.m-1<0?11:p.m-1; return {m,y:p.m-1<0?p.y-1:p.y}; })}
              >
                <Feather name="chevron-left" size={18} color={C.textSecondary} />
              </TouchableOpacity>
              <Text style={[T.bodyMed, { color: C.text, flex: 1, textAlign: 'center' }]}>{MONTHS_FULL[monthYear.m]} {monthYear.y}</Text>
              <TouchableOpacity
                style={{ width: 36, height: 36, borderRadius: R.md, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setMonthYear(p => { const m = p.m+1>11?0:p.m+1; return {m,y:p.m+1>11?p.y+1:p.y}; })}
              >
                <Feather name="chevron-right" size={18} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: S.sm }}>
              {DAYS_SHORT.map(d => <Text key={d} style={[T.label, { flex: 1, textAlign: 'center', color: C.textTertiary }]}>{d}</Text>)}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {monthCells.map((day, i) => {
                if (!day) return <View key={`e${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />;
                const dateStr = `${monthYear.y}-${String(monthYear.m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const data = monthData[dateStr];
                const isToday = dateStr===today;
                const isFuture = dateStr>today;
                const hasWorkout = data?.workouts?.length>0 || !!data?.workout;
                const calReached = !!(data?.calorieReached||data?.reached);
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={{ width: '14.28%', aspectRatio: 1, padding: 2 }}
                    onPress={() => { setSelectedDate(dateStr); setDetailVisible(true); }}
                  >
                    <View style={{ flex: 1, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? C.accent : 'transparent' }}>
                      <Text style={[T.caption, { color: isToday ? C.accentText : isFuture ? C.textTertiary : C.textSecondary, fontWeight: isToday ? '700' : '400' }]}>{day}</Text>
                      <View style={{ flexDirection: 'row', gap: 2, marginTop: 1 }}>
                        {hasWorkout && !isToday && <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: C.success }} />}
                        {calReached && !isToday && <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: '#60A5FA' }} />}
                        {data?.wellness && !isToday && <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: '#A78BFA' }} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: S.lg, marginTop: S.md, paddingTop: S.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }}>
              {[[C.success,'Training'],['#60A5FA','Kal. Ziel'],['#A78BFA','Tagesform']].map(([color,label]) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                  <Text style={[T.label, { color: C.textSecondary }]}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
