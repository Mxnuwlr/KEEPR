/**
 * screens/CaloriesScreen.js — Kalorienzählung & KI-Mahlzeitenplanung
 *
 * Zentraler Ernährungs-Screen. Zeigt Tages-Makros (Kalorien, Protein, Carbs, Fett)
 * und KI-generierten Mahlzeitenplan. Unterstützt:
 *   - Foto-Analyse via Gemini (analyzeFoodPhoto)
 *   - Mahlzeitenplan-Generierung (generateMealPlanWithGemini)
 *   - Einzelmahlzeit generieren (generateSingleMealWithGemini)
 *   - Schritt-für-Schritt Zubereitung (generateDetailedStepsWithGemini)
 *   - Zutat tauschen (swapIngredientWithGemini)
 *   - Manuelle Suche via FoodSearchScreen (inline embedded)
 *
 * MEAL_TYPES: ['Frühstück','Mittagessen','Abendessen','Snack']
 * PORTIONS: [0.5 … 8] für Portionsauswahl
 */

// React/RN
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, Modal,
  TextInput, Alert, Image, ActivityIndicator,
  RefreshControl, StyleSheet,
} from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Internal
import { useStore } from '../store';
import { useKraftStore } from '../store/kraftStore';
import FoodSearchScreen from './FoodSearchScreen';
import { analyzeFoodPhoto, generateMealPlanWithGemini, generateSingleMealWithGemini, generateDetailedStepsWithGemini, swapIngredientWithGemini, api } from '../api/client';
import { useTheme } from '../theme';
import { calculateDailyTargets, buildMealPlanContext, classifyTrainingIntensity, planDayType, getCarbLoadingStatus, getRaceContext, calcWaterGoal, getSmoothedWeight } from '../utils/coaching';
import { analyzeTrainingStatus } from '../utils/trainingStatus';

const MEAL_TYPES = ['Frühstück','Mittagessen','Abendessen','Snack'];
const MEAL_ICONS = { 'Frühstück': 'sunrise', 'Mittagessen': 'sun', 'Abendessen': 'moon', 'Snack': 'coffee' };


const PORTIONS = [0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8];
const PORTION_ITEM_H = 56;
const BASE_SERVINGS = 1; // AI generates for 1 person; factor = selectedPortions / 1

function scaleIngredient(text, factor) {
  if (Math.abs(factor - 1) < 0.01) return text;
  return text.replace(/(\d+(?:[.,]\d+)?)/g, (match) => {
    const num = parseFloat(match.replace(',', '.'));
    const scaled = Math.round(num * factor * 10) / 10;
    return scaled % 1 === 0 ? String(Math.round(scaled)) : scaled.toFixed(1).replace('.', ',');
  });
}

function MealDetailModal({ meal, mealKey, initialServings, onClose, onLog, onSaveServings, geminiKey, overrides, onOverridesChange, onAddToShoppingList }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const [localPortions, setLocalPortions] = useState(initialServings);
  const [stepsMode, setStepsMode] = useState('short');
  const [detailedSteps, setDetailedSteps] = useState(overrides?.detailedSteps || null);
  const [loadingDetailed, setLoadingDetailed] = useState(false);
  const [localIngredients, setLocalIngredients] = useState(overrides?.ingredients || (Array.isArray(meal.ingredients) ? meal.ingredients : []));
  const [localMacros, setLocalMacros] = useState(overrides?.macros || { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat });
  const [swapModal, setSwapModal] = useState(null); // { index, ingredient }
  const [swapInput, setSwapInput] = useState('');
  const [swapping, setSwapping] = useState(false);

  const factor = localPortions / BASE_SERVINGS;
  const scaledCal = Math.round((localMacros.calories || 0) * factor);
  const scaledP = Math.round((localMacros.protein || 0) * factor);
  const scaledC = Math.round((localMacros.carbs || 0) * factor);
  const scaledF = Math.round((localMacros.fat || 0) * factor);
  const stepsShortArr = Array.isArray(meal.stepsShort) ? meal.stepsShort : [];
  const portionLabel = localPortions % 1 === 0 ? localPortions : localPortions.toFixed(1);

  const saveIngredients = (next, newMacros) => {
    setLocalIngredients(next);
    if (newMacros) setLocalMacros(newMacros);
    onOverridesChange(mealKey, { ...overrides, ingredients: next, macros: newMacros || localMacros, detailedSteps: null });
  };

  const switchToDetailed = async () => {
    setStepsMode('detailed');
    if (detailedSteps) return;
    setLoadingDetailed(true);
    try {
      const steps = await generateDetailedStepsWithGemini({ ...meal, ingredients: localIngredients }, geminiKey);
      setDetailedSteps(steps);
      onOverridesChange(mealKey, { ...overrides, ingredients: localIngredients, detailedSteps: steps });
    } catch(e) { Alert.alert('Fehler', e.message); setStepsMode('short'); }
    setLoadingDetailed(false);
  };

  const handleSwap = async () => {
    const text = swapInput.trim();
    if (!text || !swapModal) return;
    setSwapping(true);
    try {
      const result = await swapIngredientWithGemini(
        { ...meal, ingredients: localIngredients }, swapModal.ingredient, text, geminiKey
      );
      const next = [...localIngredients];
      next.splice(swapModal.index, 1, ...result.ingredients);
      setDetailedSteps(null);
      const newMacros = { calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat };
      saveIngredients(next, newMacros);
      setSwapModal(null);
      setSwapInput('');
    } catch(e) { Alert.alert('Fehler', e.message); }
    setSwapping(false);
  };

  const activeSteps = stepsMode === 'short' ? stepsShortArr : (detailedSteps || []);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingTop: S.xl, paddingBottom: S.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={{ marginRight: S.md }}>
            <Feather name="x" size={22} color={C.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[T.label, { color: C.textSecondary }]}>{meal.type?.toUpperCase()} · {meal.prepTime}</Text>
            <Text style={[T.h3, { color: C.text }]} numberOfLines={1}>{meal.name}</Text>
          </View>
          <TouchableOpacity
            onPress={() => onAddToShoppingList(meal)}
            hitSlop={8}
            style={{ padding: 6, marginLeft: S.sm }}
          >
            <Feather name="shopping-cart" size={20} color={C.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { onLog(meal); onClose(); }}
            style={{ backgroundColor: C.accent, borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: 8, marginLeft: S.sm }}
          >
            <Text style={[T.label, { color: C.accentText, fontWeight: '700' }]}>+ Log</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

          {/* Portions + live macros */}
          <View style={{ paddingHorizontal: S.md, paddingTop: S.lg, paddingBottom: S.md }}>
            {/* Compact stepper */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.md, paddingVertical: 10, paddingHorizontal: S.md }}>
              <Text style={[T.label, { color: C.textSecondary, flex: 1 }]}>Portionen</Text>
              <TouchableOpacity hitSlop={10} onPress={() => { const v = Math.max(0.5, localPortions - 0.5); setLocalPortions(v); onSaveServings(mealKey, v); }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="minus" size={16} color={C.textSecondary} />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, minWidth: 48, textAlign: 'center' }}>
                {localPortions % 1 === 0 ? localPortions : localPortions.toFixed(1)}×
              </Text>
              <TouchableOpacity hitSlop={10} onPress={() => { const v = Math.min(8, localPortions + 0.5); setLocalPortions(v); onSaveServings(mealKey, v); }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="plus" size={16} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Live macros */}
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              {[[scaledCal,'kcal',C.tint],[scaledP+'g','Protein',C.success],[scaledC+'g','Carbs',C.warning],[scaledF+'g','Fett',C.textSecondary]].map(([val,label,color]) => (
                <View key={label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.md, paddingVertical: 10, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                  <Text style={{ color, fontWeight: '700', fontSize: 14 }}>{val}</Text>
                  <Text style={[T.caption, { color: C.textTertiary, fontSize: 10 }]}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Ingredients */}
          {localIngredients.length > 0 && (
            <View style={{ marginHorizontal: S.md, marginBottom: S.lg }}>
              <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: S.sm }]}>
                Zutaten · {portionLabel} {localPortions === 1 ? 'Person' : 'Personen'}
              </Text>
              <View style={{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                {localIngredients.map((ing, j) => (
                  <TouchableOpacity
                    key={j}
                    onPress={() => { setSwapModal({ index: j, ingredient: ing }); setSwapInput(''); }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 11, borderBottomWidth: j < localIngredients.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: C.border }}
                    activeOpacity={0.6}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, marginRight: S.sm, flexShrink: 0 }} />
                    <Text style={[T.body, { color: C.text, flex: 1 }]}>{scaleIngredient(ing, factor)}</Text>
                    <Feather name="refresh-cw" size={12} color={C.textTertiary} style={{ marginLeft: S.sm }} />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[T.caption, { color: C.textTertiary, marginTop: 6 }]}>Zutat antippen um sie auszutauschen</Text>
            </View>
          )}

          {/* Steps */}
          {stepsShortArr.length > 0 && (
            <View style={{ marginHorizontal: S.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm }}>
                <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }]}>Zubereitung</Text>
                <View style={{ flexDirection: 'row', backgroundColor: C.bgSecondary, borderRadius: R.full, padding: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                  <TouchableOpacity
                    onPress={() => setStepsMode('short')}
                    style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full, backgroundColor: stepsMode === 'short' ? C.accent : 'transparent' }}
                  >
                    <Text style={[T.label, { color: stepsMode === 'short' ? C.accentText : C.textSecondary, fontSize: 11 }]}>Kurz</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={switchToDetailed}
                    style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full, backgroundColor: stepsMode === 'detailed' ? C.accent : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    {loadingDetailed
                      ? <ActivityIndicator size={10} color={C.accentText} />
                      : null}
                    <Text style={[T.label, { color: stepsMode === 'detailed' ? C.accentText : C.textSecondary, fontSize: 11 }]}>Ausführlich</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {stepsMode === 'detailed' && loadingDetailed ? (
                <View style={{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: S.xl, alignItems: 'center', gap: S.sm }}>
                  <ActivityIndicator color={C.accent} />
                  <Text style={[T.caption, { color: C.textSecondary }]}>KI erstellt perfekte Anleitung…</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                  {activeSteps.map((step, j) => (
                    <View key={`${stepsMode}-${j}`} style={{ flexDirection: 'row', paddingHorizontal: S.md, paddingVertical: S.md, borderBottomWidth: j < activeSteps.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: C.border, gap: S.md }}>
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.accent + '20', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 }}>
                        <Text style={{ color: C.accent, fontWeight: '700', fontSize: 12 }}>{j + 1}</Text>
                      </View>
                      <Text style={[T.body, { color: C.text, flex: 1, lineHeight: stepsMode === 'detailed' ? 24 : 22 }]}>{scaleIngredient(step, factor)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Ingredient swap sheet */}
        <Modal visible={!!swapModal} transparent animationType="slide" onRequestClose={() => setSwapModal(null)}>
          <View style={{ flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: S.lg, paddingBottom: 130 }}>
              <Text style={[T.h3, { color: C.text, marginBottom: 4 }]}>Zutat ersetzen</Text>
              <Text style={[T.body, { color: C.tint, marginBottom: S.lg }]} numberOfLines={1}>{swapModal?.ingredient}</Text>
              <Text style={[T.label, { color: C.textSecondary, marginBottom: S.xs }]}>Wie ersetzen?</Text>
              <TextInput
                style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, color: C.text, fontSize: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.lg }}
                placeholder="z.B. selbst machen, vegan, weglassen…"
                placeholderTextColor={C.textTertiary}
                value={swapInput}
                onChangeText={setSwapInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSwap}
              />
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <TouchableOpacity
                  onPress={() => { setSwapModal(null); setSwapInput(''); }}
                  style={{ flex: 1, backgroundColor: C.bgSecondary, borderRadius: R.lg, padding: S.md, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                >
                  <Text style={[T.bodyMed, { color: C.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSwap}
                  disabled={swapping || !swapInput.trim()}
                  style={{ flex: 2, backgroundColor: swapInput.trim() ? C.accent : C.bgSecondary, borderRadius: R.lg, padding: S.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm, opacity: swapping ? 0.7 : 1 }}
                >
                  {swapping && <ActivityIndicator size="small" color={C.accentText} />}
                  <Text style={[T.bodyMed, { color: swapInput.trim() ? C.accentText : C.textTertiary, fontWeight: '700' }]}>
                    {swapping ? 'KI ersetzt…' : 'Ersetzen'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

function calcCalories(protein, carbs, fat) {
  return Math.round((parseFloat(protein)||0)*4 + (parseFloat(carbs)||0)*4 + (parseFloat(fat)||0)*9);
}

export default function CaloriesScreen({ navigation, tabBar }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const {
    calorieLog, calorieTotals, selectedDate,
    fetchCalories, addCalorieEntry, updateCalorieEntry, deleteCalorieEntry,
    user, inventory, geminiKey, updateProfile,
    dailyContext, weightAnalysis, externalData, returnFromBreak, trainingPlan,
  } = useStore();
  const { sessions, fetchSessions } = useKraftStore();

  // Adaptive Tagesziele
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySession = sessions?.find(s => s.started_at?.startsWith(todayStr));
  // Trainingstyp = intensivste Belastung des Tages (Kraft-Session ODER geplante Einheit),
  // damit Kalorien/Makros das echte Trainingsvolumen widerspiegeln.
  const todayIdx = (new Date().getDay() + 6) % 7;
  const rankType = { rest: 0, easy: 1, medium: 2, hard: 3, race: 4 };
  const kraftType = classifyTrainingIntensity(todaySession);
  const planToday = planDayType(trainingPlan, todayIdx);
  const autoType = rankType[planToday] > rankType[kraftType] ? planToday : kraftType;
  // Wettkampf-Kontext aus dem Wettkampf-Kalender (heute Wettkampf → Race-Tag)
  const raceCtx = useMemo(() => getRaceContext(user, todayStr), [user, todayStr]);
  const trainingType = raceCtx.isRaceToday ? 'race' : (dailyContext?.trainingType || autoType);
  const trainingStatus = useMemo(() =>
    analyzeTrainingStatus({ kraftSessions: sessions, externalData, manualOverride: returnFromBreak }),
    [sessions, externalData, returnFromBreak]
  );
  // Tatsächlich an diesem Tag verbrannte Trainings-kcal (aus geloggten Aktivitäten/Einheiten)
  const [activityCalories, setActivityCalories] = useState(0);

  // Carb-Loading-Status: Wettkampf heute/in den nächsten Tagen hat Vorrang,
  // sonst aus dem Trainingsplan (heute/morgen intensiv).
  const carbStatus = useMemo(() => {
    if (raceCtx.isRaceToday) {
      return { active: true, scope: 'today', title: 'Wettkampftag', message: `Heute: ${raceCtx.nextRace?.name || 'Wettkampf'} — Glykogenspeicher voll halten, gut hydriert starten.` };
    }
    if (raceCtx.daysUntilNextRace !== null && raceCtx.daysUntilNextRace > 0 && raceCtx.daysUntilNextRace <= 2) {
      return { active: true, scope: 'race', title: `Carb-Loading für ${raceCtx.nextRace?.name || 'Wettkampf'}`, message: `In ${raceCtx.daysUntilNextRace} Tag${raceCtx.daysUntilNextRace === 1 ? '' : 'en'} steht dein Wettkampf an — jetzt Kohlenhydratspeicher auffüllen und ausreichend trinken.` };
    }
    return getCarbLoadingStatus(trainingType, planDayType(trainingPlan, (todayIdx + 1) % 7));
  }, [raceCtx, trainingPlan, trainingType, todayIdx]);

  // Coaching nutzt das geglättete Gewicht (EWMA) statt des Tageswerts
  const coachUser = useMemo(() => ({ ...user, weight: getSmoothedWeight(weightAnalysis, user) || user?.weight }), [user, weightAnalysis]);
  const adaptiveTargets = useMemo(() =>
    calculateDailyTargets(coachUser, { ...dailyContext, readiness: externalData?.oura?.readinessScore }, weightAnalysis?.weightChangePerWeek, trainingType, trainingStatus, activityCalories, carbStatus?.active),
    [coachUser, dailyContext, externalData, weightAnalysis, trainingType, trainingStatus, activityCalories, carbStatus]
  );

  const [modal, setModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [mealType, setMealType] = useState('Frühstück');
  const [form, setForm] = useState({ name:'', calories:'', protein:'', carbs:'', fat:'', amountG:'100' });
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('log');
  const [aiPlan, setAiPlan] = useState(null);
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [aiPlanDay, setAiPlanDay] = useState(0);
  const [mealServings, setMealServings] = useState({}); // { 'dayIdx-mealIdx': number }
  const [selectedMeal, setSelectedMeal] = useState(null); // { meal, mealKey }
  const [replaceModal, setReplaceModal] = useState(null); // { dayIdx, mealIdx, mealType }
  const [replaceInput, setReplaceInput] = useState('');
  const [replacingKey, setReplacingKey] = useState(null); // 'dayIdx-mealIdx' while loading
  const [planSheet, setPlanSheet] = useState(false);
  const [wishDishes, setWishDishes] = useState('');
  const [mealOverrides, setMealOverrides] = useState({}); // { mealKey: { ingredients, detailedSteps } }
  const [photoHint, setPhotoHint] = useState('');
  const [photoComponents, setPhotoComponents] = useState(null);
  const [waterData, setWaterData] = useState({ total: 0, goal: 2500, logs: [] });
  const [inventoryPick, setInventoryPick] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [foodSearchVisible, setFoodSearchVisible] = useState(false);
  const [activeMealType, setActiveMealType] = useState('Frühstück');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Adaptive Tagesziele (Coaching) — heute angepasst, sonst statisches Ziel
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const goal    = isToday ? adaptiveTargets.calories : (user?.calorieGoal || 2000);
  const pGoal   = isToday ? adaptiveTargets.protein  : (user?.proteinGoal || 150);
  const cGoal   = isToday ? adaptiveTargets.carbs    : (user?.carbsGoal || 250);
  const fGoal   = isToday ? adaptiveTargets.fat      : (user?.fatGoal || 65);
  const remaining = Math.max(0, goal - calorieTotals.calories);
  const pct = Math.min(calorieTotals.calories / goal, 1);

  useEffect(() => { fetchCalories(selectedDate); loadWater(selectedDate); }, [selectedDate]);

  // Verbrannte Trainings-kcal des Tages laden (für volumenabhängiges Kalorienziel)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const day = await api.getCalendarDay(selectedDate);
        const done = day?.training?.completedAll?.length
          ? day.training.completedAll
          : (day?.training?.completed ? [day.training.completed] : []);
        const sum = done.reduce((a, w) => a + (w.calories || 0), 0);
        if (!cancelled) setActivityCalories(sum);
      } catch (e) { if (!cancelled) setActivityCalories(0); }
    })();
    return () => { cancelled = true; };
  }, [selectedDate]);

  useEffect(() => { if (sessions.length === 0) fetchSessions(40); }, []);

  // Persist AI plan + overrides across app restarts
  useEffect(() => {
    AsyncStorage.getItem('ai_meal_plan').then(raw => {
      if (raw) { try { setAiPlan(JSON.parse(raw)); } catch(e) {} }
    });
    AsyncStorage.getItem('ai_meal_overrides').then(raw => {
      if (raw) { try { setMealOverrides(JSON.parse(raw)); } catch(e) {} }
    });
  }, []);
  useEffect(() => {
    if (aiPlan) AsyncStorage.setItem('ai_meal_plan', JSON.stringify(aiPlan));
    else AsyncStorage.removeItem('ai_meal_plan');
  }, [aiPlan]);
  useEffect(() => {
    if (Object.keys(mealOverrides).length > 0) AsyncStorage.setItem('ai_meal_overrides', JSON.stringify(mealOverrides));
    else AsyncStorage.removeItem('ai_meal_overrides');
  }, [mealOverrides]);

  const loadWater = async (date) => {
    try { const d = await api.getWater(date); setWaterData(d); } catch (e) {}
  };

  const addWater = async (ml) => {
    try { await api.addWater(ml, selectedDate); await loadWater(selectedDate); } catch (e) {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCalories(selectedDate), loadWater(selectedDate)]);
    setRefreshing(false);
  };

  const loadAIPlan = async (wishes = '') => {
    setPlanSheet(false);
    setAiPlanLoading(true);
    setAiPlan(null);
    setAiPlanDay(0);
    setSelectedMeal(null);
    setMealServings({});
    setMealOverrides({});
    try {
      if (!geminiKey) throw new Error('KI nicht verfügbar');
      const coachCtx = buildMealPlanContext(dailyContext, adaptiveTargets, trainingType);
      const plan = await generateMealPlanWithGemini(user, geminiKey, 1, wishes, user?.kitchenEquipment || [], coachCtx);
      setAiPlan(plan);
    } catch (e) { Alert.alert('Fehler', e.message); }
    setAiPlanLoading(false);
  };

  const replaceMeal = async (dayIdx, mealIdx, mealType, preference) => {
    const key = `${dayIdx}-${mealIdx}`;
    setReplaceModal(null);
    setReplaceInput('');
    setReplacingKey(key);
    try {
      const sv = mealServings[key] ?? BASE_SERVINGS;
      const newMeal = await generateSingleMealWithGemini(user, geminiKey, mealType, sv, preference);
      setAiPlan(prev => {
        const days = prev.days.map((day, di) => {
          if (di !== dayIdx) return day;
          const meals = day.meals.map((m, mi) => mi === mealIdx ? newMeal : m);
          return { ...day, meals };
        });
        return { ...prev, days };
      });
    } catch (e) { Alert.alert('Fehler', e.message); }
    setReplacingKey(null);
  };

  const addMealToShoppingList = async (meal) => {
    const ingredients = meal.ingredients || [];
    if (ingredients.length === 0) {
      Alert.alert('Keine Zutaten', 'Für dieses Gericht sind keine Zutaten hinterlegt.');
      return;
    }

    // Prüfen welche Zutaten bereits im Inventar sind
    const inventoryNames = inventory.map(i => i.name?.toLowerCase()).filter(Boolean);
    const missing = ingredients.filter(ing => {
      if (!ing || typeof ing !== 'string') return false;
      const ingLower = ing.toLowerCase();
      // Zutatenname ohne führende Mengenangabe extrahieren
      const ingName = ingLower.replace(/^\d+[\s,./]*[a-zA-Z]*\s*/, '').trim();
      return !inventoryNames.some(name => ingLower.includes(name) || (ingName && name.includes(ingName)));
    });

    if (missing.length === 0) {
      Alert.alert('Alles vorhanden!', 'Alle Zutaten sind bereits in deiner Speisekammer.');
      return;
    }

    Alert.alert(
      `${missing.length} Zutat${missing.length === 1 ? '' : 'en'} hinzufügen?`,
      missing.slice(0, 6).join('\n') + (missing.length > 6 ? `\n… +${missing.length - 6} weitere` : ''),
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Zur Einkaufsliste', onPress: async () => {
          for (const ing of missing) {
            try { await api.addShoppingItem({ name: ing }); } catch (e) {}
          }
          Alert.alert('Hinzugefügt', `${missing.length} Zutat${missing.length === 1 ? '' : 'en'} zur Einkaufsliste hinzugefügt.`);
        }},
      ]
    );
  };

  const addAIMeal = async (meal) => {
    try {
      await addCalorieEntry({ date: selectedDate, mealType: meal.type, name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, amountG: 300 });
      Alert.alert('Hinzugefügt', `${meal.name} eingetragen.`);
    } catch (e) {}
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setMealType(entry.meal_type || 'Frühstück');
    setForm({ name: entry.name||'', calories: entry.calories?.toString()||'', protein: entry.protein?.toString()||'', carbs: entry.carbs?.toString()||'', fat: entry.fat?.toString()||'', amountG: entry.amount_g?.toString()||'100' });
    setModal(true);
  };

  const closeModal = () => {
    setModal(false); setEditingEntry(null); setPhotoPreview(null); setPhotoComponents(null);
    setForm({ name:'', calories:'', protein:'', carbs:'', fat:'', amountG:'100' });
  };

  const save = async () => {
    if (!form.name) return Alert.alert('Bitte Namen eingeben');
    const entry = { date: selectedDate, mealType, name: form.name, calories: parseFloat(form.calories)||0, protein: parseFloat(form.protein)||0, carbs: parseFloat(form.carbs)||0, fat: parseFloat(form.fat)||0, amountG: parseFloat(form.amountG)||100 };
    if (editingEntry) await updateCalorieEntry(editingEntry.id, entry);
    else await addCalorieEntry(entry);
    closeModal();
  };

  const updateMacros = (key, val) => {
    const newForm = { ...form, [key]: val };
    if (key !== 'calories') newForm.calories = calcCalories(newForm.protein, newForm.carbs, newForm.fat).toString();
    setForm(newForm);
  };

  const pickFromInventory = (item) => {
    const factor = (parseFloat(form.amountG)||100) / 100;
    const p = item.protein_per_100g ? (item.protein_per_100g * factor).toFixed(1) : '';
    const c = item.carbs_per_100g ? (item.carbs_per_100g * factor).toFixed(1) : '';
    const f = item.fat_per_100g ? (item.fat_per_100g * factor).toFixed(1) : '';
    setForm(prev => ({ ...prev, name: item.name, protein: p, carbs: c, fat: f, calories: calcCalories(p, c, f).toString() }));
    setInventoryPick(false);
  };

  const analyzePhoto = async (fromCamera) => {
    const key = geminiKey;
    if (!key) return Alert.alert('API Key fehlt');
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Berechtigung fehlt');
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhotoPreview(asset.uri); setPhotoComponents(null); setModal(true); setPhotoLoading(true);
    try {
      const b64 = asset.base64 || await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const mimeType = asset.mimeType || (asset.uri.match(/\.png$/i) ? 'image/png' : asset.uri.match(/\.heic$/i) ? 'image/heic' : 'image/jpeg');
      const res = await analyzeFoodPhoto(b64, mimeType, key, photoHint);
      if (res.components && res.components.length > 1) {
        setPhotoComponents(res.components);
        const t = res.total || {};
        setForm({ name: res.name||'', calories: (t.calories||0).toString(), protein: (t.protein||0).toString(), carbs: (t.carbs||0).toString(), fat: (t.fat||0).toString(), amountG: (t.amountG||300).toString() });
      } else {
        const food = res.total || res.components?.[0] || res;
        setForm({ name: res.name||food.name||'', calories: (food.calories||0).toString(), protein: (food.protein||0).toString(), carbs: (food.carbs||0).toString(), fat: (food.fat||0).toString(), amountG: (food.amountG||300).toString() });
      }
    } catch (e) { Alert.alert('Fehler', e.message); }
    setPhotoLoading(false); setPhotoHint('');
  };

  const addAllComponents = async () => {
    if (!photoComponents) return;
    for (const comp of photoComponents) {
      await addCalorieEntry({ date: selectedDate, mealType, name: comp.name, calories: comp.calories, protein: comp.protein||0, carbs: comp.carbs||0, fat: comp.fat||0, amountG: comp.amountG||100 });
    }
    setPhotoComponents(null); closeModal();
  };

  const openFoodSearch = (meal) => { setActiveMealType(meal||'Frühstück'); setFoodSearchVisible(true); };

  const grouped = useMemo(
    () => MEAL_TYPES.reduce((acc, m) => { acc[m] = calorieLog.filter(l => l.meal_type === m); return acc; }, {}),
    [calorieLog]
  );
  const macros = useMemo(() => [
    { label: 'Protein', value: calorieTotals.protein, goal: pGoal, color: C.success },
    { label: 'Carbs', value: calorieTotals.carbs, goal: cGoal, color: C.warning },
    { label: 'Fett', value: calorieTotals.fat, goal: fGoal, color: C.danger },
  ], [calorieTotals, pGoal, cGoal, fGoal, C.success, C.warning, C.danger]);

  // 7-day date strip (current week)
  const today = new Date().toISOString().split('T')[0];
  const monday = new Date(); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7); monday.setHours(0,0,0,0);
  const weekDays = Array.from({length:7}, (_,i) => { const d = new Date(monday); d.setDate(monday.getDate()+i); return d; });
  const dayLabels = ['Mo','Di','Mi','Do','Fr','Sa','So'];

  return (
    <View style={{ flex: 1 }}>
      {tabBar}
      <FoodSearchScreen
        visible={foodSearchVisible}
        onClose={() => { setFoodSearchVisible(false); setScannedProduct(null); }}
        mealType={activeMealType}
        preselectedFood={scannedProduct}
        onBarcodePress={() => navigation.navigate('BarcodeScanner', { onScanned: (product) => {
          if (!product) return;
          setScannedProduct(product.manual ? null : product);
          setFoodSearchVisible(true);
        }})}
        onSelect={async (food) => {
          try {
            await addCalorieEntry({ date: selectedDate, mealType: food.mealType||activeMealType, name: food.name, calories: food.calories||0, protein: food.protein||0, carbs: food.carbs||0, fat: food.fat||0, amountG: food.amountG||100 });
            setFoodSearchVisible(false);
          } catch (e) { Alert.alert('Fehler', e.message); }
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textSecondary} />}
      >
        <View style={{ paddingHorizontal: S.md }}>
          {/* Log / KI-Plan toggle */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: S.sm }}>
            <View style={{
              flexDirection: 'row', backgroundColor: C.bgSecondary,
              borderRadius: R.md, padding: 3,
              borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
            }}>
              {[['log','Log'],['aiplan','KI-Plan']].map(([t,l]) => (
                <TouchableOpacity
                  key={t}
                  style={[{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: R.sm }, activeTab===t && { backgroundColor: C.accent }]}
                  onPress={() => setActiveTab(t)}
                >
                  <Text style={[T.label, { color: activeTab===t ? C.accentText : C.textSecondary }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 7-day strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm, paddingVertical: S.xs }}>
            <TouchableOpacity
              onPress={() => fetchCalories(today)}
              style={{
                paddingHorizontal: S.md, paddingVertical: 8, borderRadius: R.md,
                backgroundColor: selectedDate===today ? C.accent : C.bgSecondary,
                borderWidth: StyleSheet.hairlineWidth, borderColor: selectedDate===today ? C.accent : C.border,
              }}
            >
              <Text style={[T.label, { color: selectedDate===today ? C.accentText : C.textSecondary }]}>Heute</Text>
            </TouchableOpacity>
            {weekDays.map((d, i) => {
              const ds = d.toISOString().split('T')[0];
              const isSel = ds === selectedDate;
              const isTod = ds === today;
              return (
                <TouchableOpacity
                  key={ds} onPress={() => fetchCalories(ds)}
                  style={{
                    paddingHorizontal: S.md, paddingVertical: 8, borderRadius: R.md,
                    alignItems: 'center', minWidth: 44,
                    backgroundColor: isSel ? C.accent : C.bgSecondary,
                    borderWidth: StyleSheet.hairlineWidth, borderColor: isSel ? C.accent : isTod ? C.tint + '60' : C.border,
                  }}
                >
                  <Text style={[T.label, { color: isSel ? C.accentText : isTod ? C.tint : C.textTertiary }]}>{dayLabels[i]}</Text>
                  <Text style={[T.bodyMed, { color: isSel ? C.accentText : C.text, fontSize: 16 }]}>{d.getDate()}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Calorie summary card */}
          <View style={{
            backgroundColor: C.surface, borderRadius: R.lg,
            borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
            padding: S.md, marginTop: S.md, marginBottom: S.md,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: S.md }}>
              {[
                ['Gegessen', Math.round(calorieTotals.calories), C.tint],
                ['Ziel', goal, C.text],
                ['Verbleibend', remaining, remaining > 0 ? C.success : C.danger],
              ].map(([label, val, color]) => (
                <View key={label} style={{ alignItems: 'center' }}>
                  <Text style={[T.h2, { color }]}>{val}</Text>
                  <Text style={[T.caption, { color: C.textSecondary }]}>{label}</Text>
                </View>
              ))}
            </View>
            <View style={{ height: 3, backgroundColor: C.bgTertiary, borderRadius: 2, overflow: 'hidden', marginBottom: S.md }}>
              <View style={{ height: '100%', width: `${pct*100}%`, backgroundColor: pct>=1 ? C.danger : C.tint, borderRadius: 2 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              {macros.map(m => (
                <View key={m.label} style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={[T.caption, { color: C.textSecondary }]}>{m.label}</Text>
                    <Text style={[T.caption, { color: m.color, fontWeight: '600' }]}>{Math.round(m.value)}g</Text>
                  </View>
                  <View style={{ height: 2, backgroundColor: C.bgTertiary, borderRadius: 1, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${Math.min(m.value/m.goal,1)*100}%`, backgroundColor: m.color, borderRadius: 1 }} />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Log Tab */}
          {activeTab === 'log' && (
            <>
              {isToday && carbStatus?.active && (
                <View style={{ flexDirection: 'row', gap: S.sm, backgroundColor: '#F9731612', borderRadius: R.md, padding: S.md, marginBottom: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: '#F9731640' }}>
                  <MaterialCommunityIcons name="pasta" size={18} color="#F97316" />
                  <View style={{ flex: 1 }}>
                    <Text style={[T.bodyMed, { color: '#F97316' }]}>{carbStatus.title}</Text>
                    <Text style={[T.caption, { color: C.textSecondary, marginTop: 2, lineHeight: 17 }]}>{carbStatus.message}</Text>
                    {isToday && (
                      <Text style={[T.caption, { color: '#F97316', marginTop: 4, fontWeight: '700' }]}>
                        Ziel: ~{adaptiveTargets.carbs} g Kohlenhydrate ({(adaptiveTargets.carbs / (coachUser?.weight || 75)).toFixed(1)} g/kg)
                      </Text>
                    )}
                  </View>
                </View>
              )}
              {MEAL_TYPES.map(meal => (
                <View key={meal} style={{ marginBottom: S.lg }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                      <Feather name={MEAL_ICONS[meal]} size={15} color={C.textSecondary} />
                      <Text style={[T.bodyMed, { color: C.text }]}>{meal}</Text>
                      {grouped[meal].length > 0 && (
                        <Text style={[T.caption, { color: C.textSecondary }]}>
                          {Math.round(grouped[meal].reduce((s,l)=>s+l.calories,0))} kcal
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => openFoodSearch(meal)}
                      style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Feather name="plus" size={14} color={C.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {grouped[meal].length === 0
                    ? <Text style={[T.caption, { color: C.textTertiary }]}>Noch nichts eingetragen</Text>
                    : grouped[meal].map(l => (
                      <TouchableOpacity
                        key={l.id}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingVertical: 10, paddingHorizontal: S.sm,
                          backgroundColor: C.bgSecondary, borderRadius: R.md,
                          borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
                          marginBottom: S.xs,
                        }}
                        onPress={() => openEdit(l)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[T.body, { color: C.text }]}>{l.name}</Text>
                          <Text style={[T.caption, { color: C.textSecondary }]}>
                            P: {l.protein?.toFixed(0)}g · K: {l.carbs?.toFixed(0)}g · F: {l.fat?.toFixed(0)}g
                          </Text>
                        </View>
                        <Text style={[T.bodyMed, { color: C.tint, marginRight: S.md }]}>{Math.round(l.calories)}</Text>
                        <TouchableOpacity onPress={() => deleteCalorieEntry(l.id)} hitSlop={8}>
                          <Feather name="x" size={16} color={C.textTertiary} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))
                  }
                </View>
              ))}

              {/* Water */}
              <View style={{
                backgroundColor: C.surface, borderRadius: R.lg,
                borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
                padding: S.md, marginBottom: S.lg,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                    <Feather name="droplet" size={16} color="#60A5FA" />
                    <Text style={[T.bodyMed, { color: C.text }]}>Wasser</Text>
                  </View>
                  <Text style={[T.bodyMed, { color: '#60A5FA' }]}>{Math.round(waterData.total)} / {isToday ? calcWaterGoal(coachUser, trainingType) : waterData.goal} ml</Text>
                </View>
                <View style={{ height: 4, backgroundColor: C.bgTertiary, borderRadius: 2, overflow: 'hidden', marginBottom: S.md }}>
                  <View style={{ height: '100%', width: `${Math.min(waterData.total/(isToday ? calcWaterGoal(coachUser, trainingType) : waterData.goal),1)*100}%`, backgroundColor: '#60A5FA', borderRadius: 2 }} />
                </View>
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                  {[150, 250, 330, 500].map(ml => (
                    <TouchableOpacity
                      key={ml} onPress={() => addWater(ml)}
                      style={{ flex: 1, backgroundColor: '#60A5FA18', borderRadius: R.sm, paddingVertical: 8, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#60A5FA30' }}
                    >
                      <Text style={[T.label, { color: '#60A5FA' }]}>+{ml}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* AI Plan Tab */}
          {activeTab === 'aiplan' && (
            <>
              {aiPlanLoading && (
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  <ActivityIndicator color={C.textSecondary} size="large" />
                  <Text style={[T.caption, { color: C.textSecondary, marginTop: S.md }]}>KI erstellt deinen Plan…</Text>
                </View>
              )}
              {!aiPlanLoading && !aiPlan && (
                <View style={{ alignItems: 'center', paddingVertical: S.xl }}>
                  <Feather name="cpu" size={40} color={C.textTertiary} style={{ marginBottom: S.md }} />
                  <Text style={[T.h3, { color: C.text, marginBottom: S.sm }]}>KI Wochenplan</Text>
                  <Text style={[T.caption, { color: C.textSecondary, textAlign: 'center', marginBottom: S.lg }]}>
                    Gemini erstellt einen 7-Tage-Ernährungsplan mit Kochanleitungen.
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: C.accent, borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: S.md }}
                    onPress={() => { setWishDishes(''); setPlanSheet(true); }}
                  >
                    <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>Plan erstellen</Text>
                  </TouchableOpacity>
                </View>
              )}
              {aiPlan && (() => {
                const days = aiPlan.days || [];
                const currentDay = days[aiPlanDay] || days[0];
                const DAY_LABELS = ['Mo','Di','Mi','Do','Fr','Sa','So'];
                return (
                  <>
                    {/* Header row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm }}>
                      <Text style={[T.caption, { color: C.textSecondary }]}>
                        {(currentDay?.meals||[]).reduce((a, m, i) => {
                          const mk = `${aiPlanDay}-${i}`;
                          const sv = mealServings[mk] ?? BASE_SERVINGS;
                          return a + Math.round((m.calories||0) * sv / BASE_SERVINGS);
                        }, 0)} kcal gesamt
                      </Text>
                      <TouchableOpacity onPress={() => { setWishDishes(''); setPlanSheet(true); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Feather name="refresh-cw" size={14} color={C.textSecondary} />
                        <Text style={[T.caption, { color: C.textSecondary }]}>Neu</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Day selector */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S.md }}
                      contentContainerStyle={{ gap: S.xs }}>
                      {DAY_LABELS.map((d, i) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => { setAiPlanDay(i); setSelectedMeal(null); }}
                          style={{
                            paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.full,
                            backgroundColor: aiPlanDay === i ? C.accent : C.bgSecondary,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: aiPlanDay === i ? C.accent : C.border,
                          }}
                        >
                          <Text style={[T.label, { color: aiPlanDay === i ? C.accentText : C.textSecondary }]}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {/* Meals */}
                    {(currentDay?.meals || []).map((meal, i) => {
                      const mealKey = `${aiPlanDay}-${i}`;
                      const sv = mealServings[mealKey] ?? BASE_SERVINGS;
                      const f = sv / BASE_SERVINGS;
                      const sCal = Math.round(meal.calories * f);
                      const sP = Math.round(meal.protein * f);
                      const sC = Math.round(meal.carbs * f);
                      const svLabel = sv % 1 === 0 ? sv : sv.toFixed(1);
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setSelectedMeal({ meal, mealKey })}
                          activeOpacity={0.75}
                          style={{
                            backgroundColor: C.surface, borderRadius: R.lg,
                            borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
                            padding: S.md, marginBottom: S.sm, flexDirection: 'row', alignItems: 'center',
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[T.label, { color: C.textSecondary }]}>{meal.type?.toUpperCase()} · {meal.prepTime}</Text>
                            <Text style={[T.bodyMed, { color: C.text, marginTop: 2, marginBottom: 6 }]}>{meal.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', gap: S.md }}>
                                <Text style={[T.caption, { color: C.tint }]}>{sCal} kcal</Text>
                                <Text style={[T.caption, { color: C.success }]}>{sP}g P</Text>
                                <Text style={[T.caption, { color: C.warning }]}>{sC}g K</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                                <TouchableOpacity
                                  hitSlop={8}
                                  onPress={e => { e.stopPropagation?.(); const next = Math.max(0.5, sv - 0.5); setMealServings(prev => ({ ...prev, [mealKey]: next })); }}
                                  style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                                >
                                  <Feather name="minus" size={14} color={C.textSecondary} />
                                </TouchableOpacity>
                                <Text style={[T.label, { color: C.text, minWidth: 28, textAlign: 'center' }]}>{svLabel}×</Text>
                                <TouchableOpacity
                                  hitSlop={8}
                                  onPress={e => { e.stopPropagation?.(); const next = Math.min(8, sv + 0.5); setMealServings(prev => ({ ...prev, [mealKey]: next })); }}
                                  style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                                >
                                  <Feather name="plus" size={14} color={C.textSecondary} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                          <TouchableOpacity
                            hitSlop={8}
                            onPress={e => { e.stopPropagation?.(); setReplaceInput(''); setReplaceModal({ dayIdx: aiPlanDay, mealIdx: i, mealType: meal.type }); }}
                            style={{ marginLeft: S.sm, padding: 4 }}
                          >
                            {replacingKey === mealKey
                              ? <ActivityIndicator size="small" color={C.textTertiary} />
                              : <Feather name="refresh-cw" size={16} color={C.textTertiary} />
                            }
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                );
              })()}
            </>
          )}
        </View>
      </ScrollView>

      {/* Plan erstellen Sheet */}
      <Modal visible={planSheet} transparent animationType="slide" onRequestClose={() => setPlanSheet(false)}>
        <View style={{ flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: S.lg, paddingBottom: 130 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg }}>
              <Text style={[T.h3, { color: C.text }]}>Wochenplan erstellen</Text>
              <TouchableOpacity onPress={() => setPlanSheet(false)} hitSlop={8}>
                <Feather name="x" size={20} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[T.label, { color: C.textSecondary, marginBottom: S.xs }]}>Wunschgerichte (optional)</Text>
            <TextInput
              style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, color: C.text, fontSize: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.xs, minHeight: 64, textAlignVertical: 'top' }}
              placeholder={'z.B. Pasta Carbonara, Lachs mit Reis…'}
              placeholderTextColor={C.textTertiary}
              value={wishDishes}
              onChangeText={setWishDishes}
              multiline
            />
            <Text style={[T.caption, { color: C.textTertiary, marginBottom: S.lg }]}>Leer lassen = KI entscheidet frei</Text>

            {(user?.kitchenEquipment?.length > 0) && (
              <View style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.lg, flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <Feather name="tool" size={14} color={C.textTertiary} />
                <Text style={[T.caption, { color: C.textSecondary, flex: 1 }]} numberOfLines={2}>
                  {(user.kitchenEquipment).join(' · ')}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={{ backgroundColor: C.accent, borderRadius: R.lg, padding: S.md, alignItems: 'center' }}
              onPress={() => loadAIPlan(wishDishes)}
            >
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>Generieren</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Replace Meal Modal */}
      <Modal visible={!!replaceModal} transparent animationType="fade" onRequestClose={() => setReplaceModal(null)}>
        <View style={{ flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: S.lg, paddingBottom: 130 }}>
            <Text style={[T.h3, { color: C.text, marginBottom: 4 }]}>Mahlzeit ersetzen</Text>
            <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.lg }]}>{replaceModal?.mealType} — neue Mahlzeit generieren</Text>
            <Text style={[T.label, { color: C.textSecondary, marginBottom: S.xs }]}>Vorgabe (optional)</Text>
            <TextInput
              style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, color: C.text, fontSize: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.lg }}
              placeholder="z.B. vegetarisch, schnell, ohne Gluten…"
              placeholderTextColor={C.textTertiary}
              value={replaceInput}
              onChangeText={setReplaceInput}
              autoFocus
              returnKeyType="done"
            />
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <TouchableOpacity
                onPress={() => setReplaceModal(null)}
                style={{ flex: 1, backgroundColor: C.bgSecondary, borderRadius: R.lg, padding: S.md, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
              >
                <Text style={[T.bodyMed, { color: C.textSecondary }]}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => replaceMeal(replaceModal.dayIdx, replaceModal.mealIdx, replaceModal.mealType, replaceInput)}
                style={{ flex: 2, backgroundColor: C.accent, borderRadius: R.lg, padding: S.md, alignItems: 'center' }}
              >
                <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>Neu generieren</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Meal Detail Page */}
      {selectedMeal && (
        <MealDetailModal
          meal={selectedMeal.meal}
          mealKey={selectedMeal.mealKey}
          initialServings={mealServings[selectedMeal.mealKey] ?? BASE_SERVINGS}
          onClose={() => setSelectedMeal(null)}
          onLog={addAIMeal}
          onSaveServings={(key, val) => setMealServings(prev => ({ ...prev, [key]: val }))}
          geminiKey={geminiKey}
          overrides={mealOverrides[selectedMeal.mealKey]}
          onOverridesChange={(key, val) => setMealOverrides(prev => ({ ...prev, [key]: val }))}
          onAddToShoppingList={addMealToShoppingList}
        />
      )}

      {/* Entry Modal */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.md, paddingTop: S.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg }}>
            <Text style={[T.h2, { color: C.text }]}>{editingEntry ? 'Eintrag bearbeiten' : 'Mahlzeit eintragen'}</Text>
            {!editingEntry && (
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <TouchableOpacity onPress={() => analyzePhoto(true)} style={{ width: 38, height: 38, borderRadius: R.md, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="camera" size={17} color={C.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => analyzePhoto(false)} style={{ width: 38, height: 38, borderRadius: R.md, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="image" size={17} color={C.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {!editingEntry && (
            <>
              <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs }]}>HINWEIS FÜR KI (OPTIONAL)</Text>
              <TextInput
                style={[{ backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, color: C.text, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.md }, T.body]}
                value={photoHint} onChangeText={setPhotoHint}
                placeholder="z.B. 'Pasta mit Tomatensauce, ca. 400g'"
                placeholderTextColor={C.textTertiary}
              />
            </>
          )}

          {photoLoading && (
            <View style={{ alignItems: 'center', padding: S.xl, backgroundColor: C.bgSecondary, borderRadius: R.lg, marginBottom: S.md }}>
              <ActivityIndicator color={C.textSecondary} size="large" />
              <Text style={[T.caption, { color: C.textSecondary, marginTop: S.md }]}>KI analysiert Foto…</Text>
            </View>
          )}

          {photoPreview && !photoLoading && (
            <View style={{ marginBottom: S.md }}>
              <Image source={{ uri: photoPreview }} style={{ width: '100%', height: 140, borderRadius: R.lg, marginBottom: S.sm, resizeMode: 'cover' }} />
            </View>
          )}

          {photoComponents && !photoLoading && (
            <View style={{
              backgroundColor: C.bgSecondary, borderRadius: R.lg, padding: S.md,
              marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint+'40',
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm }}>
                <Text style={[T.label, { color: C.tint }]}>{photoComponents.length} KOMPONENTEN ERKANNT</Text>
                <TouchableOpacity onPress={() => setPhotoComponents(null)} hitSlop={8}>
                  <Feather name="x" size={16} color={C.textTertiary} />
                </TouchableOpacity>
              </View>
              {photoComponents.map((comp, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: S.sm, borderTopWidth: i===0?0:StyleSheet.hairlineWidth, borderTopColor: C.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { color: C.text }]}>{comp.name}</Text>
                    <Text style={[T.caption, { color: C.textSecondary }]}>{comp.calories} kcal · P:{comp.protein||0}g K:{comp.carbs||0}g F:{comp.fat||0}g</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { setForm({ name: comp.name, calories: (comp.calories||0).toString(), protein: (comp.protein||0).toString(), carbs: (comp.carbs||0).toString(), fat: (comp.fat||0).toString(), amountG: (comp.amountG||100).toString() }); setPhotoComponents(null); }}
                    hitSlop={8}
                  >
                    <Feather name="edit-2" size={15} color={C.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', marginTop: S.sm }}
                onPress={addAllComponents}
              >
                <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>Alle {photoComponents.length} hinzufügen</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs }]}>MAHLZEIT-TYP</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm, marginBottom: S.md }}>
            {MEAL_TYPES.map(m => {
              const active = mealType === m;
              return (
                <TouchableOpacity
                  key={m} onPress={() => setMealType(m)}
                  style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: R.full, backgroundColor: active ? C.accent : 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: active ? C.accent : C.border }}
                >
                  <Text style={[T.label, { color: active ? C.accentText : C.textSecondary }]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
            <View style={{ flex: 1 }}>
              <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs }]}>NAME</Text>
              <TextInput style={[T.body, { backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, color: C.text, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }]} value={form.name} onChangeText={v => setForm(f=>({...f,name:v}))} placeholder="z.B. Haferflocken" placeholderTextColor={C.textTertiary} />
            </View>
            <TouchableOpacity
              onPress={() => setInventoryPick(true)}
              style={{ alignSelf: 'flex-end', width: 44, height: 44, borderRadius: R.md, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name="package" size={18} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs }]}>MENGE (g/ml)</Text>
          <TextInput style={[T.body, { backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, color: C.text, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.md }]} value={form.amountG} onChangeText={v => setForm(f=>({...f,amountG:v}))} keyboardType="numeric" placeholderTextColor={C.textTertiary} />

          <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs }]}>MAKROS</Text>
          <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.sm }}>
            {[['protein','Protein g'],['carbs','Carbs g'],['fat','Fett g']].map(([key, label]) => (
              <View key={key} style={{ flex: 1 }}>
                <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs, textAlign: 'center' }]}>{label}</Text>
                <TextInput style={[T.body, { backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.sm, color: C.text, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, textAlign: 'center' }]} value={form[key]} onChangeText={v => updateMacros(key, v)} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textTertiary} />
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, marginBottom: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <Text style={[T.body, { color: C.textSecondary }]}>Kalorien (auto)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <TextInput style={[T.bodyMed, { color: C.tint, minWidth: 60, textAlign: 'right' }]} value={form.calories} onChangeText={v => setForm(f=>({...f,calories:v}))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textTertiary} />
              <Text style={[T.caption, { color: C.textSecondary }]}>kcal</Text>
            </View>
          </View>

          <TouchableOpacity style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', marginBottom: S.sm }} onPress={save}>
            <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>Speichern</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: S.md, alignItems: 'center' }} onPress={closeModal}>
            <Text style={[T.caption, { color: C.textSecondary }]}>Abbrechen</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* Inventory Picker */}
      <Modal visible={inventoryPick} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.md, paddingTop: S.xl }}>
          <Text style={[T.h2, { color: C.text, marginBottom: S.lg }]}>Aus Inventar wählen</Text>
          {inventory.filter(i => i.calories_per_100g).map(item => (
            <TouchableOpacity key={item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: S.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }} onPress={() => pickFromInventory(item)}>
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { color: C.text }]}>{item.name}</Text>
                <Text style={[T.caption, { color: C.textSecondary }]}>{item.calories_per_100g} kcal/100g</Text>
              </View>
              <Feather name="plus" size={18} color={C.textTertiary} />
            </TouchableOpacity>
          ))}
          {inventory.filter(i => i.calories_per_100g).length === 0 && (
            <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center', marginTop: S.xl }]}>Keine Produkte mit Kalorien.</Text>
          )}
          <TouchableOpacity style={{ padding: S.md, alignItems: 'center', marginTop: S.lg }} onPress={() => setInventoryPick(false)}>
            <Text style={[T.caption, { color: C.textSecondary }]}>Schließen</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}
