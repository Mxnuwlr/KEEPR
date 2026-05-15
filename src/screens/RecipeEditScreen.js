import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store';
import { api, calculateNutrition } from '../api/client';

const C = { bg: '#0f0e0c', surface: '#1a1916', surface2: '#242220', border: '#2e2c29', accent: '#e8c547', text: '#f0ece3', text2: '#9b9489', red: '#e05252' };
const EMOJIS = ['🍽️','🥗','🍝','🍲','🥘','🫕','🍛','🍜','🥩','🐟','🥚','🧇','🥞','🥪','🌮','🌯'];
const DIFFICULTIES = ['Einfach','Mittel','Anspruchsvoll'];

export default function RecipeEditScreen({ route, navigation }) {
  const { recipe } = route.params || {};
  const { createRecipe, updateRecipe, geminiKey } = useStore();
  const [form, setForm] = useState({ name: recipe?.name || '', emoji: recipe?.emoji || '🍽️', description: recipe?.description || '', prepTime: recipe?.prep_time || '', difficulty: recipe?.difficulty || 'Mittel', servings: recipe?.servings?.toString() || '2', steps: recipe?.steps || '', totalCalories: recipe?.total_calories?.toString() || '', totalProtein: recipe?.total_protein?.toString() || '', totalCarbs: recipe?.total_carbs?.toString() || '', totalFat: recipe?.total_fat?.toString() || '' });
  const [ingredients, setIngredients] = useState(recipe?.ingredients?.map(i => ({ name: i.name, amount: i.amount?.toString() || '', unit: i.unit || 'g' })) || []);
  const [localImage, setLocalImage] = useState(null);
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
      setForm(f => ({ ...f, totalCalories: (n.calories * s).toString(), totalProtein: (n.protein * s).toString(), totalCarbs: (n.carbs * s).toString(), totalFat: (n.fat * s).toString() }));
    } catch(e) { Alert.alert('Fehler', e.message); }
    setCalcLoading(false);
  };

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Bitte Namen eingeben');
    const data = { ...form, servings: parseInt(form.servings) || 2, totalCalories: parseFloat(form.totalCalories) || 0, totalProtein: parseFloat(form.totalProtein) || 0, totalCarbs: parseFloat(form.totalCarbs) || 0, totalFat: parseFloat(form.totalFat) || 0, ingredients: ingredients.filter(i => i.name).map(i => ({ name: i.name, amount: parseFloat(i.amount) || 0, unit: i.unit })) };
    try {
      if (recipe) { await updateRecipe(recipe.id, data); if (localImage) await api.uploadRecipeImage(recipe.id, localImage); }
      else { const r = await createRecipe(data); if (localImage) await api.uploadRecipeImage(r.id, localImage); }
      navigation.goBack();
    } catch(e) { Alert.alert('Fehler', e.message); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 130 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}><Text style={{ color: C.accent, fontSize: 16 }}>← Zurück</Text></TouchableOpacity>
        <Text style={styles.header}>{recipe ? 'Bearbeiten' : 'Neues Rezept'}</Text>
      </View>
      <Text style={styles.label}>Emoji</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        {EMOJIS.map(e => <TouchableOpacity key={e} style={[styles.emojiBtn, form.emoji === e && styles.emojiBtnActive]} onPress={() => setForm(f => ({ ...f, emoji: e }))}><Text style={{ fontSize: 22 }}>{e}</Text></TouchableOpacity>)}
      </ScrollView>
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {localImage ? <Image source={{ uri: localImage }} style={{ width: '100%', height: 140, borderRadius: 10, resizeMode: 'cover' }} /> : <Text style={{ color: C.text2 }}>📷 Foto auswählen</Text>}
      </TouchableOpacity>
      {[['Rezeptname *','name','z.B. Spaghetti'],['Beschreibung','description','Kurze Beschreibung…'],['Zubereitungszeit','prepTime','30 Min'],['Portionen','servings','2']].map(([label, key, ph]) => (
        <View key={key} style={{ marginBottom: 12 }}>
          <Text style={styles.label}>{label}</Text>
          <TextInput style={styles.input} value={form[key]} onChangeText={v => setForm(f => ({ ...f, [key]: v }))} placeholder={ph} placeholderTextColor={C.text2} keyboardType={key === 'servings' ? 'numeric' : 'default'} />
        </View>
      ))}
      <Text style={styles.label}>Schwierigkeit</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
        {DIFFICULTIES.map(d => <TouchableOpacity key={d} style={[styles.chip, form.difficulty === d && styles.chipActive]} onPress={() => setForm(f => ({ ...f, difficulty: d }))}><Text style={[styles.chipText, form.difficulty === d && styles.chipTextActive]}>{d}</Text></TouchableOpacity>)}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={styles.label}>Zutaten</Text>
        <TouchableOpacity onPress={addIngredient}><Text style={{ color: C.accent, fontSize: 13 }}>+ Zutat</Text></TouchableOpacity>
      </View>
      {ingredients.map((ing, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <TextInput style={[styles.input, { flex: 2 }]} value={ing.name} onChangeText={v => updateIng(i, 'name', v)} placeholder="Zutat" placeholderTextColor={C.text2} />
          <TextInput style={[styles.input, { flex: 1 }]} value={ing.amount} onChangeText={v => updateIng(i, 'amount', v)} placeholder="Menge" placeholderTextColor={C.text2} keyboardType="numeric" />
          <TextInput style={[styles.input, { flex: 1 }]} value={ing.unit} onChangeText={v => updateIng(i, 'unit', v)} placeholder="g" placeholderTextColor={C.text2} />
          <TouchableOpacity onPress={() => removeIngredient(i)}><Text style={{ color: C.red, fontSize: 18 }}>×</Text></TouchableOpacity>
        </View>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 8 }}>
        <Text style={styles.label}>Nährwerte gesamt</Text>
        <TouchableOpacity onPress={autoCalc} style={styles.calcBtn}><Text style={styles.calcBtnText}>{calcLoading ? '…' : '✨ Auto'}</Text></TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {[['totalCalories','kcal'],['totalProtein','P g'],['totalCarbs','C g'],['totalFat','F g']].map(([key, label]) => (
          <View key={key} style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: C.text2, marginBottom: 4, textAlign: 'center' }}>{label}</Text>
            <TextInput style={[styles.input, { textAlign: 'center' }]} value={form[key]} onChangeText={v => setForm(f => ({ ...f, [key]: v }))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.text2} />
          </View>
        ))}
      </View>
      <Text style={styles.label}>Zubereitung</Text>
      <TextInput style={[styles.input, { minHeight: 120, textAlignVertical: 'top', marginBottom: 14 }]} value={form.steps} onChangeText={v => setForm(f => ({ ...f, steps: v }))} placeholder="Schritt 1: Wasser kochen…" placeholderTextColor={C.text2} multiline />
      <TouchableOpacity style={styles.btnSave} onPress={save}><Text style={styles.btnSaveText}>💾 Rezept speichern</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 20, color: '#f0ece3', fontWeight: '300' },
  label: { fontSize: 11, fontWeight: '600', color: '#9b9489', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#242220', borderWidth: 1, borderColor: '#2e2c29', borderRadius: 10, color: '#f0ece3', fontSize: 13, padding: 9 },
  emojiBtn: { width: 46, height: 46, backgroundColor: '#242220', borderWidth: 1, borderColor: '#2e2c29', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  emojiBtnActive: { borderColor: '#e8c547', backgroundColor: 'rgba(232,197,71,0.1)' },
  imagePicker: { backgroundColor: '#1a1916', borderWidth: 1, borderColor: '#2e2c29', borderRadius: 12, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 14, overflow: 'hidden' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#2e2c29' },
  chipActive: { borderColor: '#e8c547', backgroundColor: 'rgba(232,197,71,0.07)' },
  chipText: { color: '#9b9489', fontSize: 12 },
  chipTextActive: { color: '#e8c547' },
  calcBtn: { backgroundColor: 'rgba(232,197,71,0.1)', borderWidth: 1, borderColor: 'rgba(232,197,71,0.3)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  calcBtnText: { color: '#e8c547', fontSize: 12 },
  btnSave: { backgroundColor: '#e8c547', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 10 },
  btnSaveText: { color: '#0f0e0c', fontWeight: '700', fontSize: 15 },
});
