/**
 * screens/HomeScreen.js — Startseite / Dashboard
 *
 * Zeigt tägliche Zusammenfassung: Kalorien, Gewicht-Trend,
 * ablaufende Inventarartikel (MHD) und personalisierten Tagesplan.
 *
 * DailyCheckin — Einmaliger Tages-Check-in (Schlaf, Stress, Energie)
 * calculateDailyTargets — Coaching-Engine aus utils/coaching.js
 */

// React/RN
import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl, Dimensions, StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { useKraftStore } from '../store/kraftStore';
import { api } from '../api/client';
import { useTheme } from '../theme';
import { Surface } from '../components/ui';
import LineChart from '../components/LineChart';
import {
  calculateDailyTargets,
  classifyTrainingIntensity,
  getTrainingDayLabel,
  getTrainingDayColor,
  planDayType,
  getCarbLoadingStatus,
  getRaceContext,
  getSmoothedWeight,
} from '../utils/coaching';
import { analyzeTrainingStatus, getTrainingStatusIcon, getTrainingStatusColor } from '../utils/trainingStatus';
import { assessRecovery } from '../utils/recovery';
import { resolveConnectedMetrics } from '../utils/connectedData';

function getDays(mhd) { return mhd ? Math.floor((new Date(mhd) - new Date()) / 86400000) : null; }
function getStatus(mhd) {
  if (!mhd) return 'unknown';
  const d = getDays(mhd);
  if (d < 0) return 'expired';
  if (d <= 5) return 'soon';
  return 'ok';
}

// ── Daily Check-in Card ───────────────────────────────────────────────────────
function DailyCheckin({ onSave, externalData }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const metrics = resolveConnectedMetrics(externalData);
  const ouraData = externalData?.oura;
  const [sleep, setSleep]   = useState(7);
  const [stress, setStress] = useState(2);
  const [energy, setEnergy] = useState(3);
  const [soreness, setSoreness] = useState(1);

  const SLEEP_OPTIONS  = [5, 6, 7, 8, 9];
  const LEVEL_OPTIONS  = [1, 2, 3, 4, 5];
  const STRESS_COLORS  = ['#22C55E','#86EFAC','#F59E0B','#F97316','#EF4444'];
  const ENERGY_COLORS  = ['#9A9894','#F59E0B','#86EFAC','#22C55E','#3B82F6'];
  const STRESS_LABELS  = ['Kein','Wenig','Mittel','Hoch','Extrem'];
  const ENERGY_LABELS  = ['Erschöpft','Müde','Okay','Gut','Top'];

  const OptionRow = ({ label, options, selected, onSelect, colors, labels }) => (
    <View style={{ marginBottom: S.md }}>
      <Text style={[T.label, { color: C.textSecondary, marginBottom: 8 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {options.map((opt, idx) => {
          const active = selected === opt;
          const color  = colors ? colors[idx] : C.accent;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onSelect(opt)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: R.md, alignItems: 'center',
                backgroundColor: active ? color + '25' : C.bgSecondary,
                borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                borderColor: active ? color : C.border,
              }}
            >
              <Text style={{ color: active ? color : C.textTertiary, fontWeight: active ? '700' : '400', fontSize: 14 }}>
                {labels ? labels[idx] === undefined ? opt : opt : opt}
              </Text>
              {labels && (
                <Text style={{ color: active ? color : C.textTertiary, fontSize: 10, marginTop: 2 }}>{labels[idx]}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: C.tint + '30', marginBottom: S.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.md }}>
        <Feather name="sun" size={14} color={C.tint} />
        <Text style={[T.label, { color: C.tint }]}>TAGES-CHECK-IN</Text>
        <Text style={[T.caption, { color: C.textTertiary, flex: 1, textAlign: 'right' }]}>einmalig pro Tag</Text>
      </View>

      {/* Oura-Hinweis */}
      {ouraData && (ouraData.readinessScore != null || ouraData.sleepScore != null) && (
        <View style={{ flexDirection: 'row', gap: 8, backgroundColor: '#1B998B15', borderRadius: R.sm, padding: 10, marginBottom: S.md }}>
          <Text style={[T.caption, { color: '#1B998B', fontWeight: '700' }]}>Oura</Text>
          {ouraData.readinessScore != null && (
            <Text style={[T.caption, { color: '#1B998B' }]}>Readiness {ouraData.readinessScore}/100</Text>
          )}
          {ouraData.sleepScore != null && (
            <Text style={[T.caption, { color: '#1B998B' }]}>· Schlaf-Score {ouraData.sleepScore}/100</Text>
          )}
        </View>
      )}

      {/* Schlaf — Gerätedaten (Garmin/Oura) haben Vorrang */}
      <Text style={[T.label, { color: C.textSecondary, marginBottom: 8 }]}>Schlaf (Stunden)</Text>
      {metrics.sleepSource ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingVertical: 12, paddingHorizontal: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="moon" size={15} color={C.tint} />
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{metrics.sleepHours} h</Text>
          <Text style={{ color: C.textTertiary, fontSize: 12, flex: 1, textAlign: 'right' }}>von {metrics.sleepSource} · automatisch</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: S.md }}>
          {[5, 6, 7, 8, 9].map(h => {
            const active = sleep === h;
            const color  = h <= 5 ? '#EF4444' : h === 6 ? '#F59E0B' : '#22C55E';
            return (
              <TouchableOpacity
                key={h}
                onPress={() => setSleep(h)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: R.md, alignItems: 'center', backgroundColor: active ? color + '25' : C.bgSecondary, borderWidth: active ? 1.5 : 0.5, borderColor: active ? color : C.border }}
              >
                <Text style={{ color: active ? color : C.textSecondary, fontWeight: active ? '700' : '400', fontSize: 15 }}>{h}</Text>
                <Text style={{ color: active ? color : C.textTertiary, fontSize: 9, marginTop: 1 }}>{h === 9 ? '9+h' : 'h'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Stress — Garmin-Stress hat Vorrang */}
      <Text style={[T.label, { color: C.textSecondary, marginBottom: 8 }]}>Stress</Text>
      {metrics.stressSource ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingVertical: 12, paddingHorizontal: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="activity" size={15} color={C.tint} />
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{STRESS_LABELS[metrics.stressLevel - 1]}</Text>
          <Text style={{ color: C.textTertiary, fontSize: 12, flex: 1, textAlign: 'right' }}>von {metrics.stressSource} · automatisch</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: S.md }}>
          {[1,2,3,4,5].map((lvl, idx) => {
            const active = stress === lvl;
            const color  = STRESS_COLORS[idx];
            const label  = STRESS_LABELS[idx];
            return (
              <TouchableOpacity
                key={lvl}
                onPress={() => setStress(lvl)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: R.md, alignItems: 'center', backgroundColor: active ? color + '25' : C.bgSecondary, borderWidth: active ? 1.5 : 0.5, borderColor: active ? color : C.border }}
              >
                <Text style={{ color: active ? color : C.textSecondary, fontWeight: active ? '700' : '400', fontSize: 15 }}>{lvl}</Text>
                <Text style={{ color: active ? color : C.textTertiary, fontSize: 9, marginTop: 1 }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Energie */}
      <Text style={[T.label, { color: C.textSecondary, marginBottom: 8 }]}>Energie</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: S.md }}>
        {[1,2,3,4,5].map((lvl, idx) => {
          const active = energy === lvl;
          const color  = ENERGY_COLORS[idx];
          const label  = ENERGY_LABELS[idx];
          return (
            <TouchableOpacity
              key={lvl}
              onPress={() => setEnergy(lvl)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: R.md, alignItems: 'center', backgroundColor: active ? color + '25' : C.bgSecondary, borderWidth: active ? 1.5 : 0.5, borderColor: active ? color : C.border }}
            >
              <Text style={{ color: active ? color : C.textSecondary, fontWeight: active ? '700' : '400', fontSize: 15 }}>{lvl}</Text>
              <Text style={{ color: active ? color : C.textTertiary, fontSize: 9, marginTop: 1 }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Muskelkater — misst kein Gerät, daher manuell (fließt ins Recovery-Coaching) */}
      <Text style={[T.label, { color: C.textSecondary, marginBottom: 8 }]}>Muskelkater</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: S.md }}>
        {[1,2,3,4,5].map((lvl, idx) => {
          const active = soreness === lvl;
          const color  = ['#22C55E','#86EFAC','#F59E0B','#F97316','#EF4444'][idx];
          const label  = ['Kein','Leicht','Mittel','Stark','Extrem'][idx];
          return (
            <TouchableOpacity
              key={lvl}
              onPress={() => setSoreness(lvl)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: R.md, alignItems: 'center', backgroundColor: active ? color + '25' : C.bgSecondary, borderWidth: active ? 1.5 : 0.5, borderColor: active ? color : C.border }}
            >
              <Text style={{ color: active ? color : C.textSecondary, fontWeight: active ? '700' : '400', fontSize: 15 }}>{lvl}</Text>
              <Text style={{ color: active ? color : C.textTertiary, fontSize: 9, marginTop: 1 }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={() => onSave({ sleepHours: metrics.sleepHours ?? sleep, stressLevel: metrics.stressLevel ?? stress, energyLevel: energy, soreness, readiness: metrics.readiness ?? null })}
        style={{ backgroundColor: C.accent, borderRadius: R.md, paddingVertical: 12, alignItems: 'center' }}
      >
        <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>Speichern</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    user, inventory, calorieTotals,
    fetchInventory, fetchCalories, fetchWeightAnalysis, weightAnalysis, addWeight,
    dailyContext, saveDailyContext, loadDailyContext,
    externalData, returnFromBreak, trainingPlan,
  } = useStore();
  const { sessions, fetchSessions } = useKraftStore();

  const [refreshing, setRefreshing]     = useState(false);
  const [dailyReview, setDailyReview]   = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [weightModal, setWeightModal]   = useState(false);
  const [weightInput, setWeightInput]   = useState('');
  const [adjustModal, setAdjustModal]   = useState(false);
  const [activityCalories, setActivityCalories] = useState(0);

  const expired = inventory.filter(i => getStatus(i.mhd) === 'expired').length;
  const soon    = inventory.filter(i => getStatus(i.mhd) === 'soon').length;
  const hour    = new Date().getHours();
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Hey' : 'Guten Abend';

  const rec         = weightAnalysis?.recommendation;
  const wData       = weightAnalysis?.weights?.slice(-14) || [];
  const currentW    = weightAnalysis?.currentWeight || user?.weight;
  const trendPerWeek = weightAnalysis?.weightChangePerWeek;

  // Heutiges Training: intensivste Belastung des Tages (Kraft ODER geplante Einheit ODER Wettkampf)
  const todayStr = new Date().toISOString().split('T')[0];
  const todayIdx = (new Date().getDay() + 6) % 7;
  const todaySession = sessions?.find(s => s.started_at?.startsWith(todayStr));
  const rankType = { rest: 0, easy: 1, medium: 2, hard: 3, race: 4 };
  const kraftType = classifyTrainingIntensity(todaySession);
  const planToday = planDayType(trainingPlan, todayIdx);
  const autoTrainingType = rankType[planToday] > rankType[kraftType] ? planToday : kraftType;
  const raceCtx = useMemo(() => getRaceContext(user, todayStr), [user, todayStr]);
  const trainingType = raceCtx.isRaceToday ? 'race' : (dailyContext?.trainingType || autoTrainingType);

  // Trainingsstatus: Pausenerkennung, Belastungs- & Ermüdungstrend
  const trainingStatus = useMemo(() =>
    analyzeTrainingStatus({ kraftSessions: sessions, externalData, manualOverride: returnFromBreak }),
    [sessions, externalData, returnFromBreak]
  );

  // Carb-Loading: Wettkampf heute / in ≤2 Tagen oder harte Einheit heute/morgen
  const carbActive = useMemo(() => {
    if (raceCtx.isRaceToday) return true;
    if (raceCtx.daysUntilNextRace !== null && raceCtx.daysUntilNextRace > 0 && raceCtx.daysUntilNextRace <= 2) return true;
    return !!getCarbLoadingStatus(trainingType, planDayType(trainingPlan, (todayIdx + 1) % 7))?.active;
  }, [raceCtx, trainingType, trainingPlan, todayIdx]);

  // Coaching nutzt das geglättete Gewicht (EWMA) statt des Tageswerts
  const coachUser = useMemo(() => ({ ...user, weight: getSmoothedWeight(weightAnalysis, user) || user?.weight }), [user, weightAnalysis]);
  // Personalisierte Tagesziele — identische Logik wie im Kalorien-Tab
  const adaptiveTargets = useMemo(() =>
    calculateDailyTargets(coachUser, { ...dailyContext, readiness: externalData?.oura?.readinessScore }, trendPerWeek, trainingType, trainingStatus, activityCalories, carbActive),
    [coachUser, dailyContext, externalData, trendPerWeek, trainingType, trainingStatus, activityCalories, carbActive]
  );

  const goal   = adaptiveTargets.calories;
  const calPct = Math.min(calorieTotals.calories / goal, 1);

  useEffect(() => {
    fetchInventory();
    fetchCalories();
    fetchWeightAnalysis();
    loadDailyContext();
    loadDailyReview();
    if (sessions.length === 0) fetchSessions(40);
  }, []);

  // Heute verbrannte Trainings-kcal laden (gleiche Basis wie der Kalorien-Tab)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const day = await api.getCalendarDay(todayStr);
        const done = day?.training?.completedAll?.length
          ? day.training.completedAll
          : (day?.training?.completed ? [day.training.completed] : []);
        const sum = done.reduce((a, w) => a + (w.calories || 0), 0);
        if (!cancelled) setActivityCalories(sum);
      } catch (e) { if (!cancelled) setActivityCalories(0); }
    })();
    return () => { cancelled = true; };
  }, [todayStr]);

  const loadDailyReview = async () => {
    setReviewLoading(true);
    try {
      const data = await api.getDailyReview();
      setDailyReview(data.review || '');
    } catch (e) {}
    setReviewLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchInventory(), fetchCalories(), fetchWeightAnalysis()]);
    await loadDailyReview();
    setRefreshing(false);
  };

  const saveWeight = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 20 || w > 300) return Alert.alert('Ungültiges Gewicht');
    await addWeight(w);
    setWeightModal(false);
    setWeightInput('');
  };

  const applyRecommendation = async () => {
    if (!rec) return;
    const { updateProfile } = useStore.getState();
    await updateProfile({
      calorieGoal: rec.suggestedGoal,
      proteinGoal: rec.macros?.protein,
      carbsGoal: rec.macros?.carbs,
      fatGoal: rec.macros?.fat,
    });
    setAdjustModal(false);
    Alert.alert('Angepasst', `Neues Kalorienziel: ${rec.suggestedGoal} kcal`);
  };

  const trainingColor = getTrainingDayColor(trainingType, C);
  const trainingLabel = getTrainingDayLabel(trainingType);

  // Trainingsstatus-Badge (Wiedereinstieg, Ermüdung, Volumentrend)
  const statusIcon = getTrainingStatusIcon(trainingStatus);
  const statusColor = getTrainingStatusColor(trainingStatus, C);
  const recovery = useMemo(() =>
    assessRecovery({ dailyContext, externalData, trainingStatus }),
    [dailyContext, externalData, trainingStatus]
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Weight Modal */}
      <Modal visible={weightModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: S.xl }}>
          <View style={{ backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <Text style={[T.h3, { color: C.text, marginBottom: S.md }]}>Gewicht eintragen</Text>
            <TextInput
              style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, color: C.text, fontSize: 32, fontWeight: '700', textAlign: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.sm }}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder={`${currentW || '75'}`}
              placeholderTextColor={C.textTertiary}
              autoFocus
            />
            <Text style={[T.caption, { color: C.textSecondary, textAlign: 'center', marginBottom: S.md }]}>kg</Text>
            <TouchableOpacity style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', marginBottom: S.sm }} onPress={saveWeight}>
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>Speichern</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: S.sm, alignItems: 'center' }} onPress={() => setWeightModal(false)}>
              <Text style={[T.caption, { color: C.textSecondary }]}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Adjust Modal */}
      <Modal visible={adjustModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingBottom: insets.bottom + S.lg }}>
            <Text style={[T.h3, { color: C.text, marginBottom: S.xs }]}>Kalorien anpassen</Text>
            <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.lg }]}>{rec?.reason}</Text>
            <View style={{ flexDirection: 'row', gap: S.md, marginBottom: S.lg }}>
              <View style={{ flex: 1, backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, alignItems: 'center' }}>
                <Text style={[T.label, { color: C.textSecondary, marginBottom: S.xs }]}>JETZT</Text>
                <Text style={[T.h2, { color: C.text }]}>{rec?.currentGoal}</Text>
                <Text style={[T.caption, { color: C.textSecondary }]}>kcal</Text>
              </View>
              <View style={{ alignSelf: 'center' }}>
                <Feather name="arrow-right" size={18} color={C.textSecondary} />
              </View>
              <View style={{ flex: 1, backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, alignItems: 'center', borderWidth: 1, borderColor: C.tint + '40' }}>
                <Text style={[T.label, { color: C.tint, marginBottom: S.xs }]}>NEU</Text>
                <Text style={[T.h2, { color: C.tint }]}>{rec?.suggestedGoal}</Text>
                <Text style={[T.caption, { color: C.tint }]}>kcal</Text>
              </View>
            </View>
            <TouchableOpacity style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', marginBottom: S.sm }} onPress={applyRecommendation}>
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>Anpassen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: S.sm, alignItems: 'center' }} onPress={() => setAdjustModal(false)}>
              <Text style={[T.caption, { color: C.textSecondary }]}>Ignorieren</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + S.lg, paddingBottom: 130, paddingHorizontal: S.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textSecondary} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xl }}>
          <View>
            <Text style={[T.caption, { color: C.textSecondary }]}>{greeting},</Text>
            <Text style={[T.h1, { color: C.text }]}>{user?.displayName || user?.username}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profil')}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[T.bodyMed, { color: C.text, fontWeight: '700' }]}>
              {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Daily Check-in (erscheint nur wenn noch nicht gemacht heute) ── */}
        {!dailyContext && (
          <DailyCheckin onSave={saveDailyContext} externalData={externalData} />
        )}

        {/* ── Tages-Coaching-Karte (nach Check-in) ── */}
        {dailyContext && (
          <Surface style={{ marginBottom: S.md, borderColor: trainingColor + '30' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: S.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                <Feather name="activity" size={14} color={trainingColor} />
                <Text style={[T.label, { color: trainingColor }]}>DEIN TAG</Text>
              </View>
              <TouchableOpacity
                onPress={() => useStore.setState({ dailyContext: null })}
                hitSlop={8}
              >
                <Text style={[T.caption, { color: C.textTertiary }]}>bearbeiten</Text>
              </TouchableOpacity>
            </View>

            {/* Training + Schlaf + Stress Tags */}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: S.sm }}>
              <View style={{ backgroundColor: trainingColor + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full }}>
                <Text style={[T.label, { color: trainingColor }]}>{trainingLabel}</Text>
              </View>
              <View style={{ backgroundColor: C.bgSecondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full }}>
                <Text style={[T.label, { color: C.textSecondary }]}>{dailyContext.sleepHours}h Schlaf</Text>
              </View>
              {dailyContext.stressLevel >= 4 && (
                <View style={{ backgroundColor: C.danger + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full }}>
                  <Text style={[T.label, { color: C.danger }]}>Stress {dailyContext.stressLevel}/5</Text>
                </View>
              )}
            </View>

            {/* Trainingsstatus */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: S.sm }}>
              <Feather name={statusIcon} size={12} color={statusColor} />
              <Text style={[T.caption, { color: statusColor, flex: 1 }]}>{trainingStatus.summaryDe}</Text>
            </View>

            {/* Recovery-Status: bei schlechter Erholung Hinweis (Aktion im Training/Mobility) */}
            {recovery.level !== 'good' && recovery.hasData && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: S.sm }}>
                <Feather name="moon" size={12} color={recovery.poor ? C.danger : C.warning} />
                <Text style={[T.caption, { color: recovery.poor ? C.danger : C.warning, flex: 1 }]}>
                  {recovery.summaryDe} — im Training „Einheit leichter“ oder Recovery-Flow
                </Text>
              </View>
            )}

            {/* Adaptive Kalorien */}
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              {[
                [adaptiveTargets.calories, 'kcal', C.tint],
                [adaptiveTargets.protein + 'g', 'Protein', C.success],
                [adaptiveTargets.carbs + 'g', adaptiveTargets.isCarboLoading ? 'Carbs+' : 'Carbs', C.warning],
                [adaptiveTargets.fat + 'g', 'Fett', C.textSecondary],
              ].map(([val, label, color]) => (
                <View key={label} style={{ flex: 1, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ color, fontWeight: '700', fontSize: 13 }}>{val}</Text>
                  <Text style={[T.label, { color: C.textTertiary, fontSize: 10, marginTop: 1 }]}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Anpassungs-Hinweise */}
            {adaptiveTargets.adjustmentReasons.length > 0 && (
              <View style={{ marginTop: S.sm, gap: 3 }}>
                {adaptiveTargets.adjustmentReasons.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Feather name="info" size={11} color={C.textTertiary} />
                    <Text style={[T.caption, { color: C.textTertiary, fontSize: 11, flex: 1 }]}>{r}</Text>
                  </View>
                ))}
              </View>
            )}
          </Surface>
        )}

        {/* ── Externe Metriken (Oura + Intervals) ── */}
        {(externalData?.oura || externalData?.intervals) && (() => {
          const oura = externalData.oura;
          const iv = externalData.intervals;
          const hasOura = oura && (oura.readinessScore != null || oura.sleepScore != null);
          const hasIntervals = iv && (iv.ctl != null || iv.activityCount > 0);
          if (!hasOura && !hasIntervals) return null;
          const tsbColor = iv?.tsb == null ? C.textSecondary : iv.tsb >= 5 ? '#22C55E' : iv.tsb >= -10 ? '#F59E0B' : '#EF4444';
          return (
            <Surface style={{ marginBottom: S.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm }}>
                <Feather name="activity" size={13} color={C.textSecondary} />
                <Text style={[T.label, { color: C.textSecondary }]}>BIOMETRIE & FORM</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {hasOura && oura.readinessScore != null && (
                  <View style={{ alignItems: 'center', minWidth: 56 }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: oura.readinessScore >= 70 ? '#1B998B' : '#F59E0B' }}>{oura.readinessScore}</Text>
                    <Text style={[T.caption, { color: C.textTertiary }]}>Readiness</Text>
                  </View>
                )}
                {hasOura && oura.sleepScore != null && (
                  <View style={{ alignItems: 'center', minWidth: 56 }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: C.text }}>{oura.sleepScore}</Text>
                    <Text style={[T.caption, { color: C.textTertiary }]}>Schlaf</Text>
                  </View>
                )}
                {hasIntervals && iv.ctl != null && (
                  <View style={{ alignItems: 'center', minWidth: 56 }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#5856D6' }}>{Math.round(iv.ctl)}</Text>
                    <Text style={[T.caption, { color: C.textTertiary }]}>CTL</Text>
                  </View>
                )}
                {hasIntervals && iv.atl != null && (
                  <View style={{ alignItems: 'center', minWidth: 56 }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#FF9500' }}>{Math.round(iv.atl)}</Text>
                    <Text style={[T.caption, { color: C.textTertiary }]}>ATL</Text>
                  </View>
                )}
                {hasIntervals && iv.tsb != null && (
                  <View style={{ alignItems: 'center', minWidth: 56 }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: tsbColor }}>{Math.round(iv.tsb)}</Text>
                    <Text style={[T.caption, { color: C.textTertiary }]}>Form (TSB)</Text>
                  </View>
                )}
                {hasIntervals && iv.activityCount > 0 && (
                  <View style={{ alignItems: 'center', minWidth: 56 }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: C.text }}>{iv.activityCount}</Text>
                    <Text style={[T.caption, { color: C.textTertiary }]}>Aktivitäten</Text>
                  </View>
                )}
              </View>
            </Surface>
          );
        })()}

        {/* AI Review */}
        {(dailyReview || reviewLoading) && (
          <Surface style={{ marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm }}>
              <Feather name="cpu" size={14} color={C.textSecondary} />
              <Text style={[T.label, { color: C.textSecondary }]}>KI TAGESANALYSE</Text>
            </View>
            <Text style={[T.caption, { color: reviewLoading ? C.textTertiary : C.text, lineHeight: 20 }]}>
              {reviewLoading ? 'Analysiere…' : dailyReview}
            </Text>
          </Surface>
        )}

        {/* AI Recommendation */}
        {rec && (
          <Surface onPress={() => setAdjustModal(true)} style={{ marginBottom: S.md, borderColor: C.tint + '40' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <Feather name="zap" size={18} color={C.tint} />
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyMed, { color: C.text }]}>Anpassung verfügbar</Text>
                <Text style={[T.caption, { color: C.textSecondary }]}>{rec.reason}</Text>
              </View>
              <View style={{ backgroundColor: C.tint + '20', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: 4 }}>
                <Text style={[T.label, { color: C.tint }]}>{rec.adjustment > 0 ? '+' : ''}{rec.adjustment} kcal</Text>
              </View>
            </View>
          </Surface>
        )}

        {/* Stats Row */}
        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
          <Surface style={{ flex: 1 }} onPress={() => navigation.navigate('Tracken')}>
            <Text style={[T.label, { color: C.textSecondary, marginBottom: S.xs }]}>KALORIEN</Text>
            <Text style={[T.h2, { color: C.text }]}>{Math.round(calorieTotals.calories)}</Text>
            <Text style={[T.caption, { color: C.textSecondary }]}>von {goal}</Text>
            <View style={{ height: 3, backgroundColor: C.bgTertiary, borderRadius: 2, marginTop: S.sm, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${calPct * 100}%`, backgroundColor: calPct >= 1 ? C.danger : C.tint, borderRadius: 2 }} />
            </View>
          </Surface>

          <Surface style={{ flex: 1 }} onPress={() => navigation.navigate('Speisekammer')}>
            <Text style={[T.label, { color: C.textSecondary, marginBottom: S.xs }]}>INVENTAR</Text>
            <Text style={[T.h2, { color: C.text }]}>{inventory.length}</Text>
            <Text style={[T.caption, { color: expired > 0 || soon > 0 ? C.warning : C.textSecondary }]}>
              {expired > 0 ? `${expired} abgelaufen` : soon > 0 ? `${soon} bald ab` : 'Alles frisch'}
            </Text>
          </Surface>
        </View>

        {/* Gewicht Card */}
        <Surface onPress={() => setWeightModal(true)} style={{ marginBottom: S.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: S.sm }}>
            <View>
              <Text style={[T.label, { color: C.textSecondary, marginBottom: S.xs }]}>GEWICHT</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={[T.h1, { color: C.text }]}>{currentW?.toFixed(1) || '—'}</Text>
                <Text style={[T.caption, { color: C.textSecondary }]}>kg</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: S.xs }}>
              <TouchableOpacity
                onPress={() => setWeightModal(true)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Feather name="plus" size={16} color={C.text} />
              </TouchableOpacity>
              {trendPerWeek !== undefined && trendPerWeek !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Feather
                    name={trendPerWeek >= 0 ? 'trending-up' : 'trending-down'}
                    size={11}
                    color={Math.abs(trendPerWeek) <= 0.5 ? C.success : C.warning}
                  />
                  <Text style={[T.caption, { color: Math.abs(trendPerWeek) <= 0.5 ? C.success : C.warning }]}>
                    {trendPerWeek >= 0 ? '+' : ''}{trendPerWeek?.toFixed(2)} kg/W
                  </Text>
                </View>
              )}
            </View>
          </View>
          {wData.length > 1 ? (() => {
            const chartData = wData.map((d, i) => ({
              value: parseFloat(d.weight || d.ewma || 0),
              label: i === 0 || i === wData.length - 1 ? (d.date || '').slice(5).replace('-', '.') : '',
            })).filter(d => d.value > 0);
            const chartW = Dimensions.get('window').width - 32 - 32;
            return <LineChart data={chartData} width={chartW} height={72} color={C.tint} colors={C} />;
          })() : (
            <Text style={[T.caption, { color: C.textTertiary }]}>Noch keine Messungen · Tippe zum Starten</Text>
          )}
        </Surface>

        {/* Quick Actions */}
        <Text style={[T.label, { color: C.textTertiary, marginBottom: S.sm, textTransform: 'uppercase' }]}>Schnellzugriff</Text>
        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
          {[
            { icon: 'camera', label: 'Scan', sub: 'Kassenzettel', nav: () => navigation.navigate('Speisekammer') },
            { icon: 'plus-circle', label: 'Eintragen', sub: 'Mahlzeit', nav: () => navigation.navigate('Tracken') },
            { icon: 'zap', label: 'Training', sub: 'Plan öffnen', nav: () => navigation.navigate('Training') },
          ].map(a => (
            <Surface key={a.label} style={{ flex: 1 }} onPress={a.nav}>
              <Feather name={a.icon} size={20} color={C.textSecondary} style={{ marginBottom: S.sm }} />
              <Text style={[T.label, { color: C.text }]}>{a.label}</Text>
              <Text style={[T.caption, { color: C.textTertiary }]}>{a.sub}</Text>
            </Surface>
          ))}
        </View>

        {/* MHD Warning */}
        {(expired > 0 || soon > 0) && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Speisekammer')}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.warning + '12', borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.warning + '40' }}
          >
            <Feather name="alert-triangle" size={18} color={C.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[T.bodyMed, { color: C.text }]}>MHD Warnungen</Text>
              <Text style={[T.caption, { color: C.textSecondary }]}>
                {expired > 0 ? `${expired} abgelaufen` : ''}
                {expired > 0 && soon > 0 ? ' · ' : ''}
                {soon > 0 ? `${soon} bald ablaufend` : ''}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.textTertiary} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
