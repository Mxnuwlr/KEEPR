/**
 * screens/RecipeWizardScreen.js — Rezept-Wizard (Choosy-Style)
 *
 * 5-Schritt-Assistent für Erstellen + Bearbeiten von Rezepten.
 * route.params: { recipe? } — recipe undefined → Neu, sonst Bearbeiten
 *
 * Schritt 1: Allgemein (Titel, Beschreibung, Portionen, Zeit)
 * Schritt 2: Zutaten (IngredientSearch Modal)
 * Schritt 3: Zubereitung (Vorbereitung + Zubereitung Tabs)
 * Schritt 4: Kategorie (Mahlzeittyp + Rezeptkategorie)
 * Schritt 5: Rezeptbild + Speichern
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../store';
import { useTheme } from '../theme';
import { api, getBaseUrl } from '../api/client';
import IngredientSearch from '../components/IngredientSearch';

// ── Konstanten ────────────────────────────────────────────────────────────────

const MEAL_TYPES = [
  'Hauptspeise', 'Frühstück', 'Kleine Mahlzeit', 'Abendbrot',
  'Snack', 'Beilage', 'Aufstrich/Dip', 'Dessert', 'Gebäck',
];

const RECIPE_CATEGORIES = [
  'Pasta', 'Curry', 'Burger', 'Auflauf', 'Suppe/Eintopf', 'Salat',
  'Pizza', 'Reis', 'Pfannengericht', 'Fisch', 'Geflügel', 'Rindfleisch',
  'Schweinefleisch', 'Eier/Omelette', 'Sandwich/Wrap', 'Bowl',
  'Tarte/Quiche', 'Süßspeise', 'Anderes',
];

const TOTAL_STEPS = 5;

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function parseStepsFromRecipe(recipe) {
  if (!recipe?.steps) return { vorbereitung: [], zubereitung: [] };
  try {
    const parsed = typeof recipe.steps === 'string' ? JSON.parse(recipe.steps) : recipe.steps;
    if (Array.isArray(parsed)) {
      return {
        vorbereitung: parsed.filter(s => s.type === 'vorbereitung').map(s => s.text),
        zubereitung: parsed.filter(s => s.type !== 'vorbereitung').map(s => s.text),
      };
    }
  } catch {}
  // Legacy: plain string → zubereitung
  const text = typeof recipe.steps === 'string' ? recipe.steps : '';
  if (text) return { vorbereitung: [], zubereitung: [text] };
  return { vorbereitung: [], zubereitung: [] };
}

function parseRawTime(raw) {
  if (raw === null || raw === undefined || raw === '') return { hours: '0', minutes: '0' };

  // Numerischer Wert: > 300 → vermutlich Sekunden, sonst Minuten
  if (typeof raw === 'number' && raw > 0) {
    const totalMins = raw > 300 ? Math.round(raw / 60) : raw;
    return { hours: String(Math.floor(totalMins / 60)), minutes: String(totalMins % 60) };
  }

  const s = String(raw).trim();
  if (!s) return { hours: '0', minutes: '0' };

  // ISO 8601: PT3H15M, PT45M, PT1H30M
  const iso = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?/i);
  if (iso && (iso[1] || iso[2])) return { hours: iso[1] || '0', minutes: iso[2] || '0' };

  // Deutsche + englische Formate normalisieren
  const n = s
    .replace(/stunden?/gi, 'h').replace(/std\.?/gi, 'h')
    .replace(/minuten?/gi, 'min').replace(/\bmin\.?\b/gi, 'min')
    .replace(/hours?/gi, 'h').replace(/minutes?/gi, 'min');

  const hourMatch = n.match(/(\d+)\s*h/i);
  const minMatch = n.match(/(\d+)\s*min/i);
  if (hourMatch || minMatch) {
    return { hours: hourMatch ? hourMatch[1] : '0', minutes: minMatch ? minMatch[1] : '0' };
  }

  // "1:30" oder "3:15" → h:mm
  const colon = s.match(/^(\d+):(\d{2})$/);
  if (colon) return { hours: colon[1], minutes: colon[2] };

  // Nur Zahl → < 60 = Minuten, ≥ 60 = Gesamtminuten aufteilen
  const num = parseInt(s);
  if (!isNaN(num) && num > 0) {
    if (num < 60) return { hours: '0', minutes: String(num) };
    return { hours: String(Math.floor(num / 60)), minutes: String(num % 60) };
  }

  return { hours: '0', minutes: '0' };
}

function parseTimeFromRecipe(recipe) {
  // New JSON format: {"total":"30 min","active":"15 min","wait":"15 min"}
  try {
    const parsed = JSON.parse(recipe?.prep_time || '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const total = parseRawTime(parsed.total);
      const active = parseRawTime(parsed.active);
      const wait = parseRawTime(parsed.wait);
      return { ...total, activeHours: active.hours, activeMinutes: active.minutes, waitHours: wait.hours, waitMinutes: wait.minutes };
    }
  } catch {}
  // Legacy plain text in prep_time
  const total = parseRawTime(recipe?.prep_time || '');
  const active = parseRawTime(recipe?.active_time || '');
  const wait = parseRawTime(recipe?.wait_time || '');
  return { ...total, activeHours: active.hours, activeMinutes: active.minutes, waitHours: wait.hours, waitMinutes: wait.minutes };
}

function formatTime(hours, minutes) {
  const h = parseInt(hours) || 0;
  const m = parseInt(minutes) || 0;
  if (h === 0 && m === 0) return '';
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function formatMultiTime(hours, minutes, activeH, activeM, waitH, waitM) {
  const total = formatTime(hours, minutes);
  const active = formatTime(activeH, activeM);
  const wait = formatTime(waitH, waitM);
  if (!active && !wait) return total; // kein erweitertes Format nötig
  const obj = {};
  if (total) obj.total = total;
  if (active) obj.active = active;
  if (wait) obj.wait = wait;
  return JSON.stringify(obj);
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export default function RecipeWizardScreen({ route, navigation }) {
  const { colors: C, spacing: S, radius: R } = useTheme();
  const insets = useSafeAreaInsets();
  const { recipe } = route.params || {};
  const { createRecipe, updateRecipe, fetchRecipes } = useStore();

  const isEdit = !!recipe?.id; // prefill-objects ohne id → Neu erstellen

  // ── State ─────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [ingSearchVisible, setIngSearchVisible] = useState(false);
  const slugMatchDone = useRef(false);
  const autoCalcMounted = useRef(false);

  // Schritt 1
  const [title, setTitle] = useState(recipe?.name || '');
  const [description, setDescription] = useState(recipe?.description || '');
  const [servings, setServings] = useState(recipe?.servings || 2);
  const parsedTime = parseTimeFromRecipe(recipe);
  const [hours, setHours] = useState(parsedTime.hours);
  const [minutes, setMinutes] = useState(parsedTime.minutes);
  const [activeHours, setActiveHours] = useState(parsedTime.activeHours);
  const [activeMinutes, setActiveMinutes] = useState(parsedTime.activeMinutes);
  const [waitHours, setWaitHours] = useState(parsedTime.waitHours);
  const [waitMinutes, setWaitMinutes] = useState(parsedTime.waitMinutes);

  // Kalorien (werden beim Import übertragen, sonst 0)
  const [totalCalories] = useState(recipe?.total_calories || 0);
  const [totalProtein] = useState(recipe?.total_protein || 0);
  const [totalCarbs] = useState(recipe?.total_carbs || 0);
  const [totalFat] = useState(recipe?.total_fat || 0);

  // ── Effects (nach allen useState, damit Hooks-Reihenfolge stimmt) ──────────

  // Auto-Slug-Matching: bei Import haben Zutaten noch keine Slugs → DB abfragen
  useEffect(() => {
    if (slugMatchDone.current) return;
    const unmatched = ingredients.filter(i => !i.slug && i.name.trim());
    if (unmatched.length === 0) return;
    slugMatchDone.current = true;
    (async () => {
      const updated = [...ingredients];
      for (let i = 0; i < updated.length; i++) {
        if (!updated[i].slug && updated[i].name.trim()) {
          try {
            const results = await api.searchIngredients(updated[i].name);
            if (results.length > 0) {
              updated[i] = { ...updated[i], slug: results[0].slug, image_url: results[0].image_url };
            }
          } catch {}
        }
      }
      setIngredients(updated);
    })();
  }, []);

  // Auto-Gesamtzeit: Aktiv + Warten = Gesamt (live berechnen, aber nicht beim ersten Mount)
  useEffect(() => {
    if (!autoCalcMounted.current) { autoCalcMounted.current = true; return; }
    const aH = parseInt(activeHours) || 0;
    const aM = parseInt(activeMinutes) || 0;
    const wH = parseInt(waitHours) || 0;
    const wM = parseInt(waitMinutes) || 0;
    if (aH + aM + wH + wM === 0) return;
    const totalMins = (aH + wH) * 60 + aM + wM;
    setHours(String(Math.floor(totalMins / 60)));
    setMinutes(String(totalMins % 60));
  }, [activeHours, activeMinutes, waitHours, waitMinutes]);

  // Schritt 2
  const [ingredients, setIngredients] = useState(
    recipe?.ingredients?.map(i => ({
      id: i.id || null,
      name: i.name,
      slug: i.slug || null,
      image_url: i.image_url || null,
      amount: i.amount?.toString() || '',
      unit: i.unit || 'g',
    })) || []
  );

  // Schritt 3
  const parsedSteps = parseStepsFromRecipe(recipe);
  const [vorberSteps, setVorberSteps] = useState(parsedSteps.vorbereitung);
  const [zuberSteps, setZuberSteps] = useState(parsedSteps.zubereitung);
  const [stepsTab, setStepsTab] = useState('Zubereitung');
  const [newStep, setNewStep] = useState('');

  // Schritt 4
  const [mealTypes, setMealTypes] = useState(
    recipe?.meal_type ? recipe.meal_type.split(',').map(s => s.trim()) : []
  );
  const [recipeCategories, setRecipeCategories] = useState(
    recipe?.recipe_category ? recipe.recipe_category.split(',').map(s => s.trim()) : []
  );

  // Schritt 5
  const [imageUri, setImageUri] = useState(
    recipe?.image_path
      ? (recipe.image_path.startsWith('http') ? recipe.image_path : `${getBaseUrl()}${recipe.image_path}`)
      : null
  );
  const [imageIsNew, setImageIsNew] = useState(false);

  // ── Navigation ────────────────────────────────────────────────────────────

  const canGoNext = () => {
    if (step === 1) return title.trim().length > 0;
    return true;
  };

  const goNext = () => { if (step < TOTAL_STEPS) setStep(s => s + 1); };
  const goBack = () => { if (step > 1) setStep(s => s - 1); };

  // ── Zutat-Aktionen ────────────────────────────────────────────────────────

  const addIngredient = (ing) => {
    setIngredients(prev => [...prev, ing]);
  };

  const removeIngredient = (idx) => {
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  const moveIngredient = (from, to) => {
    if (to < 0 || to >= ingredients.length) return;
    const arr = [...ingredients];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setIngredients(arr);
  };

  // ── Schritt-Aktionen ──────────────────────────────────────────────────────

  const addStep = () => {
    if (!newStep.trim()) return;
    if (stepsTab === 'Vorbereitung') {
      setVorberSteps(prev => [...prev, newStep.trim()]);
    } else {
      setZuberSteps(prev => [...prev, newStep.trim()]);
    }
    setNewStep('');
  };

  const removeStep = (type, idx) => {
    if (type === 'vorbereitung') setVorberSteps(prev => prev.filter((_, i) => i !== idx));
    else setZuberSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const moveStep = (type, from, to) => {
    const arr = type === 'vorbereitung' ? [...vorberSteps] : [...zuberSteps];
    if (to < 0 || to >= arr.length) return;
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    if (type === 'vorbereitung') setVorberSteps(arr);
    else setZuberSteps(arr);
  };

  // ── Bild-Aktionen ─────────────────────────────────────────────────────────

  const pickImage = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Berechtigung fehlt'); return; }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
      setImageIsNew(true);
    }
  };

  const showImagePicker = () => {
    Alert.alert('Rezeptbild', 'Bild auswählen', [
      { text: 'Kamera', onPress: () => pickImage(true) },
      { text: 'Galerie', onPress: () => pickImage(false) },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  };

  // ── Speichern ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Titel fehlt', 'Bitte gib einen Titel ein.'); return; }
    setSaving(true);
    try {
      const stepsJson = JSON.stringify([
        ...vorberSteps.map(text => ({ type: 'vorbereitung', text })),
        ...zuberSteps.map(text => ({ type: 'zubereitung', text })),
      ]);

      const payload = {
        name: title.trim(),
        emoji: null,
        description: description.trim(),
        prepTime: formatMultiTime(hours, minutes, activeHours, activeMinutes, waitHours, waitMinutes),
        servings,
        steps: stepsJson,
        ingredients: ingredients.map(i => ({
          name: i.name,
          amount: parseFloat(i.amount) || 0,
          unit: i.unit,
          slug: i.slug || undefined,
        })),
        meal_type: mealTypes.join(', '),
        recipe_category: recipeCategories.join(', '),
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        source_url: recipe?.source_url || '',
      };

      let savedRecipe;
      if (isEdit) {
        await updateRecipe(recipe.id, payload);
        savedRecipe = { ...recipe, id: recipe.id };
      } else {
        savedRecipe = await createRecipe(payload);
      }

      // Bild: entweder neu hochladen oder Server-seitigen imagePath direkt setzen (URL-Import)
      if (savedRecipe?.id) {
        // Wenn imagePath bereits auf dem Server liegt (starts with /uploads/)
        if (!imageIsNew && recipe?.image_path && recipe.image_path.startsWith('/uploads/')) {
          try { await api.setRecipeImagePath(savedRecipe.id, recipe.image_path); } catch (e) {}
        } else if (imageIsNew && imageUri) {
          try { await api.uploadRecipeImage(savedRecipe.id, imageUri); } catch (e) {
            console.warn('Bild-Upload fehlgeschlagen:', e.message);
          }
        }
        // Nach Bild-Upload Store neu laden damit image_path im Rezept-Objekt erscheint
        await fetchRecipes();
      }

      navigation.goBack();
    } catch (e) {
      Alert.alert('Fehler beim Speichern', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert('Verwerfen?', 'Alle Änderungen gehen verloren.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Verwerfen', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  // ── Render Helpers ────────────────────────────────────────────────────────

  const renderProgressBar = () => (
    <View style={[styles.progressContainer, { borderBottomColor: C.border }]}>
      <View style={styles.progressTrack}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSegment,
              { backgroundColor: i < step ? C.accent : C.border, marginRight: i < TOTAL_STEPS - 1 ? 4 : 0 },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.stepLabel, { color: C.textTertiary }]}>Schritt {step} von {TOTAL_STEPS}</Text>
    </View>
  );

  const renderBottomBar = () => (
    <View style={[styles.bottomBar, { backgroundColor: C.bg, borderTopColor: C.border, paddingBottom: insets.bottom || 16 }]}>
      <TouchableOpacity style={[styles.bottomBtn, styles.discardBtn, {}]} onPress={handleDiscard}>
        <Feather name="trash-2" size={16} color={C.danger} />
        <Text style={[styles.discardLabel, { color: C.danger }]}>Verwerfen</Text>
      </TouchableOpacity>

      <View style={styles.bottomNavBtns}>
        {step > 1 && (
          <TouchableOpacity style={[styles.navBtn, { backgroundColor: C.surface }]} onPress={goBack}>
            <Feather name="chevron-left" size={18} color={C.text} />
          </TouchableOpacity>
        )}
        {step < TOTAL_STEPS ? (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: canGoNext() ? C.accent : C.border }]}
            onPress={goNext}
            disabled={!canGoNext()}
          >
            <Text style={[styles.nextLabel, { color: canGoNext() ? C.accentText : C.textTertiary }]}>Weiter</Text>
            <Feather name="chevron-right" size={16} color={canGoNext() ? C.accentText : C.textTertiary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: title.trim() ? C.accent : C.border }]}
            onPress={handleSave}
            disabled={!title.trim() || saving}
          >
            <Feather name="check" size={16} color={C.accentText} />
            <Text style={[styles.nextLabel, { color: C.accentText }]}>{saving ? 'Speichern...' : 'Speichern'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ── Step Renderers ────────────────────────────────────────────────────────

  const [showActiveTime, setShowActiveTime] = useState(
    parseInt(parsedTime.activeHours) > 0 || parseInt(parsedTime.activeMinutes) > 0
  );
  const [showWaitTime, setShowWaitTime] = useState(
    parseInt(parsedTime.waitHours) > 0 || parseInt(parsedTime.waitMinutes) > 0
  );

  const renderStep1 = () => (
    <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
      <Text style={[styles.stepTitle, { color: C.text }]}>Allgemein</Text>

      <Text style={[styles.label, { color: C.textSecondary }]}>Rezeptname *</Text>
      <TextInput
        style={[styles.input, { color: C.text, backgroundColor: C.surface }]}
        placeholder="z.B. Spaghetti Carbonara"
        placeholderTextColor={C.textTertiary}
        value={title}
        onChangeText={setTitle}
        autoFocus
        returnKeyType="next"
      />

      <Text style={[styles.label, { color: C.textSecondary }]}>Beschreibung</Text>
      <TextInput
        style={[styles.textarea, { color: C.text, backgroundColor: C.surface }]}
        placeholder="Kurze Beschreibung (optional)"
        placeholderTextColor={C.textTertiary}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />

      <Text style={[styles.label, { color: C.textSecondary }]}>Portionen</Text>
      <View style={[styles.stepper, { backgroundColor: C.surface }]}>
        <TouchableOpacity onPress={() => setServings(s => Math.max(1, s - 1))} style={styles.stepperBtn}>
          <Feather name="minus" size={20} color={C.accent} />
        </TouchableOpacity>
        <Text style={[styles.stepperValue, { color: C.text }]}>Für {servings} {servings === 1 ? 'Portion' : 'Portionen'}</Text>
        <TouchableOpacity onPress={() => setServings(s => s + 1)} style={styles.stepperBtn}>
          <Feather name="plus" size={20} color={C.accent} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { color: C.textSecondary }]}>Gesamtzeit</Text>
      <View style={styles.timeRow}>
        <View style={[styles.timeField, { backgroundColor: C.surface }]}>
          <TextInput style={[styles.timeInput, { color: C.text }]} value={hours} onChangeText={v => setHours(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={2} placeholder="0" placeholderTextColor={C.textTertiary} />
          <Text style={[styles.timeUnit, { color: C.textSecondary }]}>h</Text>
        </View>
        <Text style={[styles.timeSep, { color: C.textTertiary }]}>:</Text>
        <View style={[styles.timeField, { backgroundColor: C.surface }]}>
          <TextInput style={[styles.timeInput, { color: C.text }]} value={minutes} onChangeText={v => setMinutes(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={2} placeholder="0" placeholderTextColor={C.textTertiary} />
          <Text style={[styles.timeUnit, { color: C.textSecondary }]}>min</Text>
        </View>
      </View>

      {/* Reine Arbeitszeit — aufklappbar */}
      <TouchableOpacity
        onPress={() => setShowActiveTime(v => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: showActiveTime ? 8 : 16 }}
      >
        <Text style={[styles.label, { color: C.textSecondary, marginBottom: 0 }]}>
          Reine Arbeitszeit <Text style={{ fontWeight: '400', color: C.textTertiary }}>(optional)</Text>
        </Text>
        <Feather name={showActiveTime ? 'chevron-up' : 'chevron-down'} size={16} color={C.textTertiary} />
      </TouchableOpacity>
      {showActiveTime && (
        <View style={[styles.timeRow, { marginBottom: 16 }]}>
          <View style={[styles.timeField, { backgroundColor: C.surface }]}>
            <TextInput style={[styles.timeInput, { color: C.text }]} value={activeHours} onChangeText={v => setActiveHours(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={2} placeholder="0" placeholderTextColor={C.textTertiary} />
            <Text style={[styles.timeUnit, { color: C.textSecondary }]}>h</Text>
          </View>
          <Text style={[styles.timeSep, { color: C.textTertiary }]}>:</Text>
          <View style={[styles.timeField, { backgroundColor: C.surface }]}>
            <TextInput style={[styles.timeInput, { color: C.text }]} value={activeMinutes} onChangeText={v => setActiveMinutes(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={2} placeholder="0" placeholderTextColor={C.textTertiary} />
            <Text style={[styles.timeUnit, { color: C.textSecondary }]}>min</Text>
          </View>
        </View>
      )}

      {/* Wartezeit — aufklappbar */}
      <TouchableOpacity
        onPress={() => setShowWaitTime(v => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: showWaitTime ? 8 : 4 }}
      >
        <Text style={[styles.label, { color: C.textSecondary, marginBottom: 0 }]}>
          Wartezeit <Text style={{ fontWeight: '400', color: C.textTertiary }}>(Marinieren, Ruhen…)</Text>
        </Text>
        <Feather name={showWaitTime ? 'chevron-up' : 'chevron-down'} size={16} color={C.textTertiary} />
      </TouchableOpacity>
      {showWaitTime && (
        <View style={styles.timeRow}>
          <View style={[styles.timeField, { backgroundColor: C.surface }]}>
            <TextInput style={[styles.timeInput, { color: C.text }]} value={waitHours} onChangeText={v => setWaitHours(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={2} placeholder="0" placeholderTextColor={C.textTertiary} />
            <Text style={[styles.timeUnit, { color: C.textSecondary }]}>h</Text>
          </View>
          <Text style={[styles.timeSep, { color: C.textTertiary }]}>:</Text>
          <View style={[styles.timeField, { backgroundColor: C.surface }]}>
            <TextInput style={[styles.timeInput, { color: C.text }]} value={waitMinutes} onChangeText={v => setWaitMinutes(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={2} placeholder="0" placeholderTextColor={C.textTertiary} />
            <Text style={[styles.timeUnit, { color: C.textSecondary }]}>min</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );

  const renderStep2 = () => (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
        <Text style={[styles.stepTitle, { color: C.text }]}>Zutaten</Text>

        {ingredients.length === 0 && (
          <Text style={[styles.emptyHint, { color: C.textTertiary }]}>Noch keine Zutaten hinzugefügt.</Text>
        )}

        {ingredients.map((ing, idx) => (
          <View key={idx} style={[styles.ingRow, { backgroundColor: C.surface }]}>
            {ing.image_url ? (
              <Image source={{ uri: ing.image_url }} style={styles.ingThumb} />
            ) : (
              <View style={[styles.ingThumbPlaceholder, { backgroundColor: C.border }]}>
                <Feather name="box" size={16} color={C.textTertiary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.ingName, { color: C.text }]}>{ing.name}</Text>
              <Text style={[styles.ingAmount, { color: C.textSecondary }]}>{String(ing.amount)} {ing.unit}</Text>
            </View>
            <View style={styles.ingActions}>
              <TouchableOpacity onPress={() => moveIngredient(idx, idx - 1)} disabled={idx === 0} style={styles.moveBtn}>
                <Feather name="chevron-up" size={16} color={idx === 0 ? C.border : C.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moveIngredient(idx, idx + 1)} disabled={idx === ingredients.length - 1} style={styles.moveBtn}>
                <Feather name="chevron-down" size={16} color={idx === ingredients.length - 1 ? C.border : C.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeIngredient(idx)} style={styles.moveBtn}>
                <Feather name="x" size={16} color={C.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.addIngBtn, { backgroundColor: C.accent }]}
          onPress={() => setIngSearchVisible(true)}
        >
          <Feather name="plus" size={16} color={C.accentText} />
          <Text style={[styles.addIngLabel, { color: C.accentText }]}>Zutat hinzufügen</Text>
        </TouchableOpacity>
      </ScrollView>

      <IngredientSearch
        visible={ingSearchVisible}
        onClose={() => setIngSearchVisible(false)}
        onSelect={(ing) => { addIngredient(ing); setIngSearchVisible(false); }}
      />
    </View>
  );

  const renderStep3 = () => {
    const currentSteps = stepsTab === 'Vorbereitung' ? vorberSteps : zuberSteps;
    const stepType = stepsTab === 'Vorbereitung' ? 'vorbereitung' : 'zubereitung';

    return (
      <View style={{ flex: 1 }}>
        {/* Tabs */}
        <View style={[styles.tabRow, { borderBottomColor: C.border }]}>
          {['Vorbereitung', 'Zubereitung'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, { borderBottomColor: stepsTab === tab ? C.accent : 'transparent' }]}
              onPress={() => setStepsTab(tab)}
            >
              <Text style={[styles.tabBtnLabel, { color: stepsTab === tab ? C.text : C.textTertiary }]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
          <Text style={[styles.stepSubtitle, { color: C.textSecondary }]}>
            {stepsTab === 'Vorbereitung' ? 'Schnippeln, marinieren, etc.' : 'Kochen, braten, backen, etc.'}
          </Text>

          {currentSteps.length === 0 && (
            <Text style={[styles.emptyHint, { color: C.textTertiary }]}>Noch keine Schritte für {stepsTab}.</Text>
          )}

          {currentSteps.map((s, idx) => (
            <View key={idx} style={[styles.stepRow, { backgroundColor: C.surface }]}>
              <View style={[styles.stepNum, { backgroundColor: C.accent }]}>
                <Text style={styles.stepNumText}>{idx + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: C.text }]}>{s}</Text>
              <View style={styles.ingActions}>
                <TouchableOpacity onPress={() => moveStep(stepType, idx, idx - 1)} disabled={idx === 0} style={styles.moveBtn}>
                  <Feather name="chevron-up" size={16} color={idx === 0 ? C.border : C.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveStep(stepType, idx, idx + 1)} disabled={idx === currentSteps.length - 1} style={styles.moveBtn}>
                  <Feather name="chevron-down" size={16} color={idx === currentSteps.length - 1 ? C.border : C.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeStep(stepType, idx)} style={styles.moveBtn}>
                  <Feather name="x" size={16} color={C.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Neuer Schritt */}
          <View style={[styles.newStepRow, { backgroundColor: C.surface }]}>
            <TextInput
              style={[styles.newStepInput, { color: C.text }]}
              placeholder={`Schritt hinzufügen...`}
              placeholderTextColor={C.textTertiary}
              value={newStep}
              onChangeText={setNewStep}
              multiline
              onSubmitEditing={addStep}
            />
            <TouchableOpacity
              style={[styles.addStepBtn, { backgroundColor: newStep.trim() ? C.accent : C.border }]}
              onPress={addStep}
              disabled={!newStep.trim()}
            >
              <Feather name="plus" size={18} color={newStep.trim() ? C.accentText : C.textTertiary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderStep4 = () => (
    <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
      <Text style={[styles.stepTitle, { color: C.text }]}>Kategorie</Text>

      <Text style={[styles.label, { color: C.textSecondary }]}>Art der Mahlzeit</Text>
      <View style={styles.chipsWrap}>
        {MEAL_TYPES.map(t => {
          const active = mealTypes.includes(t);
          return (
            <TouchableOpacity
              key={t}
              style={[styles.chip, { backgroundColor: active ? C.accent : C.surface }]}
              onPress={() => setMealTypes(prev => active ? prev.filter(x => x !== t) : [...prev, t])}
            >
              <Text style={[styles.chipLabel, { color: active ? C.accentText : C.text }]}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, { color: C.textSecondary, marginTop: 20 }]}>Rezept-Kategorie</Text>
      <View style={styles.chipsWrap}>
        {RECIPE_CATEGORIES.map(t => {
          const active = recipeCategories.includes(t);
          return (
            <TouchableOpacity
              key={t}
              style={[styles.chip, { backgroundColor: active ? C.accent : C.surface }]}
              onPress={() => setRecipeCategories(prev => active ? prev.filter(x => x !== t) : [...prev, t])}
            >
              <Text style={[styles.chipLabel, { color: active ? C.accentText : C.text }]}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderStep5 = () => (
    <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
      <Text style={[styles.stepTitle, { color: C.text }]}>Rezeptbild</Text>

      <TouchableOpacity
        style={[styles.imagePicker, { backgroundColor: C.surface }]}
        onPress={showImagePicker}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.recipeImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="camera" size={32} color={C.textTertiary} />
            <Text style={[styles.imagePlaceholderText, { color: C.textTertiary }]}>Foto aufnehmen oder auswählen</Text>
          </View>
        )}
      </TouchableOpacity>

      {imageUri && (
        <TouchableOpacity style={{ alignItems: 'center', marginTop: 8 }} onPress={showImagePicker}>
          <Text style={{ color: C.accent, fontSize: 14 }}>Bild ändern</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.summaryBox, { backgroundColor: C.surface }]}>
        <Text style={[styles.summaryTitle, { color: C.text }]}>Zusammenfassung</Text>
        <Text style={[styles.summaryLine, { color: C.textSecondary }]}>{title || '—'}</Text>
        <Text style={[styles.summaryLine, { color: C.textTertiary }]}>{servings} Portionen · {formatTime(hours, minutes) || 'keine Zeit angegeben'}</Text>
        <Text style={[styles.summaryLine, { color: C.textTertiary }]}>{ingredients.length} Zutat{ingredients.length !== 1 ? 'en' : ''} · {vorberSteps.length + zuberSteps.length} Schritt{vorberSteps.length + zuberSteps.length !== 1 ? 'e' : ''}</Text>
        {mealTypes.length > 0 && <Text style={[styles.summaryLine, { color: C.textTertiary }]}>{mealTypes.join(', ')}</Text>}
      </View>
    </ScrollView>
  );

  // ── Main Render ───────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: C.border }]}>
        <Text style={[styles.headerTitle, { color: C.text }]}>
          {isEdit ? 'Rezept bearbeiten' : 'Neues Rezept'}
        </Text>
      </View>

      {renderProgressBar()}

      <View style={{ flex: 1 }}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </View>

      {renderBottomBar()}
    </View>
  );

}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 20, fontWeight: '700' },

  progressContainer: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  progressTrack: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressSegment: { flex: 1, borderRadius: 2 },
  stepLabel: { fontSize: 12 },

  stepContent: { padding: 20, paddingBottom: 100 },
  stepTitle: { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  stepSubtitle: { fontSize: 13, marginBottom: 16, marginTop: -8 },

  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16 },
  textarea: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 16, minHeight: 80, textAlignVertical: 'top' },

  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, marginBottom: 20 },
  stepperBtn: { padding: 14 },
  stepperValue: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  timeField: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  timeInput: { flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  timeUnit: { fontSize: 14, fontWeight: '500' },
  timeSep: { fontSize: 20, fontWeight: '300' },

  // Ingredients
  emptyHint: { textAlign: 'center', marginVertical: 24, fontSize: 14 },
  ingRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 10, marginBottom: 8, gap: 10 },
  ingThumb: { width: 44, height: 44, borderRadius: 8, resizeMode: 'contain' },
  ingThumbPlaceholder: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  ingName: { fontSize: 14, fontWeight: '600' },
  ingAmount: { fontSize: 13, marginTop: 1 },
  ingActions: { flexDirection: 'row', gap: 4 },
  moveBtn: { padding: 6 },
  addIngBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 14, borderRadius: 12, marginTop: 12 },
  addIngLabel: { fontSize: 15, fontWeight: '600' },

  // Steps
  tabRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2 },
  tabBtnLabel: { fontSize: 14, fontWeight: '600' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 10, marginBottom: 8, gap: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20, paddingTop: 2 },
  newStepRow: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 12, padding: 10, marginTop: 12, gap: 10 },
  newStepInput: { flex: 1, fontSize: 15, maxHeight: 120, minHeight: 40 },
  addStepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // Category chips
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipLabel: { fontSize: 13, fontWeight: '500' },

  // Image
  imagePicker: { borderRadius: 16, overflow: 'hidden', marginBottom: 8, height: 220 },
  recipeImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  imagePlaceholderText: { fontSize: 14 },

  // Summary
  summaryBox: { borderRadius: 14, padding: 16, marginTop: 20, gap: 4 },
  summaryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  summaryLine: { fontSize: 14 },

  // Bottom bar
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  bottomBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  discardBtn: {},
  discardLabel: { fontSize: 14, fontWeight: '600' },
  bottomNavBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  nextLabel: { fontSize: 15, fontWeight: '600' },
});
