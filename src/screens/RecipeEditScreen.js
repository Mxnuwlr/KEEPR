/**
 * screens/RecipeEditScreen.js — Rezept erstellen / bearbeiten
 *
 * Formular für Rezept-Erstellung und -Bearbeitung.
 * calculateNutrition() schätzt Nährwerte aus Zutaten via Gemini.
 * Foto-Upload via expo-image-picker.
 *
 * EMOJIS — Auswählbare Rezept-Emojis
 * DIFFICULTIES — ['Einfach','Mittel','Anspruchsvoll']
 * route.params: { recipe? } — recipe undefined → Neu, sonst Bearbeiten
 */

// React/RN
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Image } from 'react-native';

// Third-party
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';
import { api, calculateNutrition, getBaseUrl } from '../api/client';

const DIFFICULTIES = ['Einfach','Mittel','Anspruchsvoll'];

export default function RecipeEditScreen({ route, navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { recipe, prefill } = route.params || {};
  const { createRecipe, updateRecipe, geminiKey } = useStore();
  // prefill is used when importing from URL (pre-filled data + server-side image)
  const [form, setForm] = useState({
    name: prefill?.name || recipe?.name || '',
    emoji: prefill?.emoji || recipe?.emoji || null,
    description: prefill?.description || recipe?.description || '',
    prepTime: prefill?.prepTime || recipe?.prep_time || '',
    difficulty: prefill?.difficulty || recipe?.difficulty || 'Mittel',
    servings: (prefill?.servings || recipe?.servings)?.toString() || '2',
    steps: prefill?.steps || recipe?.steps || '',
    totalCalories: (prefill?.totalCalories || recipe?.total_calories)?.toString() || '',
    totalProtein: (prefill?.totalProtein || recipe?.total_protein)?.toString() || '',
    totalCarbs: (prefill?.totalCarbs || recipe?.total_carbs)?.toString() || '',
    totalFat: (prefill?.totalFat || recipe?.total_fat)?.toString() || '',
  });
  const [ingredients, setIngredients] = useState(
    prefill?.ingredients?.map(i => ({ name: i.name, amount: i.amount?.toString() || '', unit: i.unit || 'g' })) ||
    recipe?.ingredients?.map(i => ({ name: i.name, amount: i.amount?.toString() || '', unit: i.unit || 'g' })) || []
  );
  const [localImage, setLocalImage] = useState(null);
  // Server-side image already downloaded (from URL import)
  const importedImagePath = prefill?.importedImagePath || null;
  const [calcLoading, setCalcLoading] = useState(false);

  const addIngredient = () => setIngredients(p => [...p, { name: '', amount: '', unit: 'g' }]);
  const removeIngredient = (i) => setIngredients(p => p.filter((_, idx) => idx !== i));
  const updateIng = (i, key, val) => setIngredients(p => p.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!r.canceled) setLocalImage(r.assets[0].uri);
  };

  const autoCalc = async () => {
    if (!geminiKey) return Alert.alert('API Key fehlt');
    if (!form.name) return Alert.alert('Bitte Namen eingeben');
    setCalcLoading(true);
    try {
      const n = await calculateNutrition(form.name, geminiKey);
      const s = parseInt(form.servings) || 1;
      setForm(f => ({
        ...f,
        totalCalories: (n.calories * s).toString(),
        totalProtein: (n.protein * s).toString(),
        totalCarbs: (n.carbs * s).toString(),
        totalFat: (n.fat * s).toString(),
      }));
    } catch(e) { Alert.alert('Fehler', e.message); }
    setCalcLoading(false);
  };

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Bitte Namen eingeben');
    const data = {
      ...form,
      servings: parseInt(form.servings) || 2,
      totalCalories: parseFloat(form.totalCalories) || 0,
      totalProtein: parseFloat(form.totalProtein) || 0,
      totalCarbs: parseFloat(form.totalCarbs) || 0,
      totalFat: parseFloat(form.totalFat) || 0,
      ingredients: ingredients.filter(i => i.name).map(i => ({ name: i.name, amount: parseFloat(i.amount) || 0, unit: i.unit })),
    };
    try {
      if (recipe) {
        await updateRecipe(recipe.id, data);
        if (localImage) await api.uploadRecipeImage(recipe.id, localImage);
      } else {
        const r = await createRecipe(data);
        if (localImage) await api.uploadRecipeImage(r.id, localImage);
        else if (importedImagePath) await api.setRecipeImagePath(r.id, importedImagePath);
      }
      navigation.goBack();
    } catch(e) { Alert.alert('Fehler', e.message); }
  };

  const inputStyle = { backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.md, color: C.text, fontSize: 13, padding: 9 };
  const labelStyle = { fontSize: 11, fontWeight: '600', color: C.textTertiary, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.md, paddingTop: 60, paddingBottom: 130 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.lg }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: S.sm }}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.h3, { color: C.text }]}>{recipe ? 'Bearbeiten' : 'Neues Rezept'}</Text>
      </View>

      {/* Foto */}
      <TouchableOpacity
        style={{ backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.lg, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: S.md, overflow: 'hidden' }}
        onPress={pickImage}
      >
        {localImage
          ? <Image source={{ uri: localImage }} style={{ width: '100%', height: 80, resizeMode: 'cover' }} />
          : importedImagePath
            ? <Image source={{ uri: `${getBaseUrl()}${importedImagePath}` }} style={{ width: '100%', height: 80, resizeMode: 'cover' }} />
            : <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                <Feather name="camera" size={16} color={C.textTertiary} />
                <Text style={{ color: C.textTertiary, fontSize: 13 }}>Foto auswählen</Text>
              </View>
        }
      </TouchableOpacity>

      {/* Felder */}
      {[['Rezeptname *','name','z.B. Spaghetti'], ['Beschreibung','description','Kurze Beschreibung…'], ['Zubereitungszeit','prepTime','30 Min'], ['Portionen','servings','2']].map(([label, key, ph]) => (
        <View key={key} style={{ marginBottom: S.sm }}>
          <Text style={labelStyle}>{label}</Text>
          <TextInput
            style={inputStyle}
            value={form[key]}
            onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
            placeholder={ph}
            placeholderTextColor={C.textTertiary}
            keyboardType={key === 'servings' ? 'numeric' : 'default'}
          />
        </View>
      ))}

      {/* Schwierigkeit */}
      <Text style={labelStyle}>Schwierigkeit</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: S.md }}>
        {DIFFICULTIES.map(d => (
          <TouchableOpacity
            key={d}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: form.difficulty === d ? C.accent : C.border, backgroundColor: form.difficulty === d ? C.accent + '12' : 'transparent' }}
            onPress={() => setForm(f => ({ ...f, difficulty: d }))}
          >
            <Text style={{ color: form.difficulty === d ? C.accent : C.textSecondary, fontSize: 12 }}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Zutaten */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs }}>
        <Text style={labelStyle}>Zutaten</Text>
        <TouchableOpacity onPress={addIngredient}>
          <Text style={{ color: C.accent, fontSize: 13 }}>+ Zutat</Text>
        </TouchableOpacity>
      </View>
      {ingredients.map((ing, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <TextInput style={[inputStyle, { flex: 2 }]} value={ing.name} onChangeText={v => updateIng(i, 'name', v)} placeholder="Zutat" placeholderTextColor={C.textTertiary} />
          <TextInput style={[inputStyle, { flex: 1 }]} value={ing.amount} onChangeText={v => updateIng(i, 'amount', v)} placeholder="Menge" placeholderTextColor={C.textTertiary} keyboardType="numeric" />
          <TextInput style={[inputStyle, { flex: 1 }]} value={ing.unit} onChangeText={v => updateIng(i, 'unit', v)} placeholder="g" placeholderTextColor={C.textTertiary} />
          <TouchableOpacity onPress={() => removeIngredient(i)}>
            <Feather name="x" size={18} color={C.danger} />
          </TouchableOpacity>
        </View>
      ))}

      {/* Nährwerte */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: S.xs, marginBottom: S.xs }}>
        <Text style={labelStyle}>Nährwerte gesamt</Text>
        <TouchableOpacity
          onPress={autoCalc}
          style={{ backgroundColor: C.accent + '18', borderWidth: StyleSheet.hairlineWidth, borderColor: C.accent + '50', borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 4 }}
        >
          <Text style={{ color: C.accent, fontSize: 12 }}>{calcLoading ? '…' : 'Auto'}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: S.md }}>
        {[['totalCalories','kcal'], ['totalProtein','P g'], ['totalCarbs','C g'], ['totalFat','F g']].map(([key, label]) => (
          <View key={key} style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: C.textTertiary, marginBottom: 4, textAlign: 'center' }}>{label}</Text>
            <TextInput style={[inputStyle, { textAlign: 'center' }]} value={form[key]} onChangeText={v => setForm(f => ({ ...f, [key]: v }))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textTertiary} />
          </View>
        ))}
      </View>

      {/* Zubereitung */}
      <Text style={labelStyle}>Zubereitung</Text>
      <TextInput
        style={[inputStyle, { minHeight: 120, textAlignVertical: 'top', marginBottom: S.md }]}
        value={form.steps}
        onChangeText={v => setForm(f => ({ ...f, steps: v }))}
        placeholder="Schritt 1: Wasser kochen…"
        placeholderTextColor={C.textTertiary}
        multiline
      />

      {/* Speichern */}
      <TouchableOpacity
        style={{ backgroundColor: C.accent, borderRadius: R.lg, padding: S.md, alignItems: 'center', marginTop: S.xs }}
        onPress={save}
      >
        <Text style={{ color: C.accentText, fontWeight: '700', fontSize: 15 }}>Rezept speichern</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
