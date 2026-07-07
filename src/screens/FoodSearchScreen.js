/**
 * screens/FoodSearchScreen.js — Lebensmittelsuche & Eintrag
 *
 * Durchsucht Backend-Lebensmitteldatenbank (api.searchFood) und QUICK_ITEMS.
 * Unterstützt auch Foto-Analyse via Gemini (analyzeFoodPhoto).
 * Kann als eigenständiger Screen oder inline in CaloriesScreen eingebettet werden.
 *
 * QUICK_ITEMS — Häufige Lebensmittel mit vorkonfigurierten Portionen
 * COUNTS — [1..9999] für Mengenauswahl via Picker
 */

// React/RN
import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Modal, ScrollView, Alert } from 'react-native';

// Third-party
import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

// Internal
import { analyzeFoodPhoto, api } from '../api/client';
import { useStore } from '../store';
import { useTheme } from '../theme';

const COUNTS = Array.from({length: 9999}, (_, i) => i + 1);

const QUICK_ITEMS = [
  { name: 'Ei, gekocht', caloriesPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11, servings: [{ label: 'Klein (45g)', grams: 45 }, { label: 'Mittel (55g)', grams: 55 }, { label: 'Groß (65g)', grams: 65 }] },
  { name: 'Haferflocken', caloriesPer100g: 370, proteinPer100g: 13, carbsPer100g: 62, fatPer100g: 7, servings: [{ label: '1 Portion (50g)', grams: 50 }, { label: '1 Portion (80g)', grams: 80 }] },
  { name: 'Banane', caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3, servings: [{ label: 'Klein (100g)', grams: 100 }, { label: 'Mittel (130g)', grams: 130 }, { label: 'Groß (160g)', grams: 160 }] },
  { name: 'Hühnerbrust', caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, servings: [{ label: '1 Brust (150g)', grams: 150 }, { label: '1 Brust (200g)', grams: 200 }] },
  { name: 'Vollmilch', caloriesPer100g: 61, proteinPer100g: 3.2, carbsPer100g: 4.8, fatPer100g: 3.3, servings: [{ label: '1 Glas (200ml)', grams: 200 }, { label: '1 Glas (250ml)', grams: 250 }] },
  { name: 'Reis, gekocht', caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, servings: [{ label: '1 Portion (150g)', grams: 150 }, { label: '1 Portion (200g)', grams: 200 }] },
  { name: 'Nudeln, gekocht', caloriesPer100g: 158, proteinPer100g: 5.5, carbsPer100g: 31, fatPer100g: 0.9, servings: [{ label: '1 Portion (150g)', grams: 150 }, { label: '1 Portion (200g)', grams: 200 }] },
  { name: 'Apfel', caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2, servings: [{ label: 'Klein (130g)', grams: 130 }, { label: 'Mittel (170g)', grams: 170 }, { label: 'Groß (220g)', grams: 220 }] },
  { name: 'Quark', caloriesPer100g: 67, proteinPer100g: 12, carbsPer100g: 4, fatPer100g: 0.2, servings: [{ label: '1 Portion (150g)', grams: 150 }, { label: '1 Portion (250g)', grams: 250 }] },
  { name: 'Toastbrot', caloriesPer100g: 265, proteinPer100g: 8, carbsPer100g: 49, fatPer100g: 3.5, servings: [{ label: '1 Scheibe (25g)', grams: 25 }, { label: '2 Scheiben (50g)', grams: 50 }] },
  { name: 'Butter', caloriesPer100g: 740, proteinPer100g: 0.7, carbsPer100g: 0.6, fatPer100g: 82, servings: [{ label: '1 Portion (10g)', grams: 10 }, { label: '1 Portion (20g)', grams: 20 }] },
  { name: 'Lachs', caloriesPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13, servings: [{ label: '1 Filet (150g)', grams: 150 }, { label: '1 Filet (200g)', grams: 200 }] },
];

export default function FoodSearchScreen({ visible, onClose, onSelect, mealType, onBarcodePress, preselectedFood }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { geminiKey } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [servingIndex, setServingIndex] = useState(0);
  const [count, setCount] = useState(1);
  const [manualMode, setManualMode] = useState(false);
  const [manualForm, setManualForm] = useState({ name: '', protein: '', carbs: '', fat: '', amount: '100' });
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoHint, setPhotoHint] = useState('');
  const [photoComponents, setPhotoComponents] = useState(null);
  const searchTimeout = useRef(null);

  React.useEffect(() => {
    if (preselectedFood && visible) selectFood(preselectedFood);
  }, [preselectedFood, visible]);

  const isLiquid = (food) => !!food?.name?.toLowerCase().match(/milch|saft|wasser|getränk|drink|juice|joghurt|smoothie|öl|kaffee|tee|cola/);

  const getServings = (food) => {
    const base = food?.servings || [];
    const unit = isLiquid(food) ? 'Milliliter' : 'Gramm';
    return [...base, { label: unit, grams: null, isCustom: true }];
  };

  const getAmount = (food, sIdx, cnt) => {
    const servings = getServings(food);
    const serving = servings[sIdx];
    if (!serving || serving.isCustom) return cnt;
    return serving.grams * cnt;
  };

  const selectFood = (food) => { setSelectedFood(food); setServingIndex(0); setCount(1); setManualMode(false); };

  const calcMacros = () => {
    if (!selectedFood) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const amt = getAmount(selectedFood, servingIndex, count);
    const factor = amt / 100;
    return {
      calories: Math.round((selectedFood.caloriesPer100g || 0) * factor),
      protein: Math.round((selectedFood.proteinPer100g || 0) * factor * 10) / 10,
      carbs: Math.round((selectedFood.carbsPer100g || 0) * factor * 10) / 10,
      fat: Math.round((selectedFood.fatPer100g || 0) * factor * 10) / 10,
    };
  };

  const search = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try { setResults(await api.searchFood(q) || []); } catch(e) { setResults([]); }
    setLoading(false);
  };

  const onQueryChange = (q) => {
    setQuery(q);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => search(q), 500);
  };

  const confirmAdd = () => {
    if (!selectedFood) return;
    const macros = calcMacros();
    onSelect({ name: selectedFood.name, ...macros, amountG: getAmount(selectedFood, servingIndex, count), mealType });
    reset();
  };

  const confirmManual = () => {
    if (!manualForm.name?.trim()) return Alert.alert('Bitte Namen eingeben');
    const p = parseFloat(manualForm.protein) || 0;
    const c = parseFloat(manualForm.carbs) || 0;
    const f = parseFloat(manualForm.fat) || 0;
    onSelect({ name: manualForm.name, calories: Math.round(p*4+c*4+f*9), protein: p, carbs: c, fat: f, amountG: parseFloat(manualForm.amount) || 100, mealType });
    reset();
  };

  const analyzePhoto = async (fromCamera) => {
    if (!geminiKey) return Alert.alert('Kein API Key');
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Berechtigung fehlt');
    const result = fromCamera ? await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhotoComponents(null);
    setPhotoLoading(true);
    try {
      const b64 = asset.base64 || await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const res = await analyzeFoodPhoto(b64, asset.mimeType || 'image/jpeg', geminiKey, photoHint);
      if (res.components && res.components.length > 1) {
        setPhotoComponents(res);
      } else {
        const food = res.total || res.components?.[0] || res;
        onSelect({ name: res.name || food.name || '', calories: food.calories || 0, protein: food.protein || 0, carbs: food.carbs || 0, fat: food.fat || 0, amountG: food.amountG || 300, mealType });
        reset();
      }
    } catch(e) { Alert.alert('Fehler', e.message); }
    setPhotoLoading(false);
    setPhotoHint('');
  };

  const reset = () => {
    setSelectedFood(null); setQuery(''); setResults([]); setManualMode(false);
    setPhotoComponents(null); setPhotoHint('');
    setManualForm({ name: '', protein: '', carbs: '', fat: '', amount: '100' });
    onClose();
  };

  const macros = calcMacros();
  const servings = selectedFood ? getServings(selectedFood) : [];
  const isCustomServing = servings[servingIndex]?.isCustom;
  const displayList = query.trim() ? results : QUICK_ITEMS;

  const inputStyle = { backgroundColor: C.bgSecondary, borderRadius: R.md, color: C.text, fontSize: 15, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border };
  const labelStyle = [T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: S.md, paddingBottom: S.md }}>
          <View>
            <Text style={[T.h2, { color: C.text }]}>{mealType} hinzufügen</Text>
            <Text style={[T.caption, { color: C.textSecondary, marginTop: 2 }]}>Suche oder manuell eintragen</Text>
          </View>
          <TouchableOpacity
            onPress={reset}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name="x" size={18} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Komponenten-Ansicht */}
        {photoComponents && !photoLoading && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: 4 }}>
              <Feather name="cpu" size={15} color={C.tint} />
              <Text style={[T.bodyMed, { color: C.tint }]}>{photoComponents.name}</Text>
            </View>
            <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.md }]}>{photoComponents.components.length} Komponenten erkannt — einzeln oder gesamt eintragen</Text>
            {photoComponents.components.map((comp, i) => (
              <TouchableOpacity
                key={i}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, padding: 14, marginBottom: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                onPress={() => { onSelect({ name: comp.name, calories: comp.calories || 0, protein: comp.protein || 0, carbs: comp.carbs || 0, fat: comp.fat || 0, amountG: comp.amountG || 100, mealType }); reset(); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[T.bodyMed, { color: C.text }]}>{comp.name}</Text>
                  <Text style={[T.caption, { color: C.textSecondary, marginTop: 2 }]}>{comp.calories} kcal · P: {comp.protein||0}g · K: {comp.carbs||0}g · F: {comp.fat||0}g{comp.amountG ? ` · ${comp.amountG}g` : ''}</Text>
                </View>
                <Feather name="plus-circle" size={20} color={C.tint} />
              </TouchableOpacity>
            ))}
            {photoComponents.total && (
              <TouchableOpacity
                style={{ backgroundColor: C.tint, borderRadius: R.md, padding: 14, alignItems: 'center', marginTop: 4 }}
                onPress={() => { const t = photoComponents.total; onSelect({ name: photoComponents.name, calories: t.calories || 0, protein: t.protein || 0, carbs: t.carbs || 0, fat: t.fat || 0, amountG: t.amountG || 300, mealType }); reset(); }}
              >
                <Text style={[T.bodyMed, { color: C.tintText }]}>Gesamtgericht eintragen ({photoComponents.total.calories} kcal)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{ marginTop: S.sm, alignItems: 'center', padding: 12 }} onPress={() => setPhotoComponents(null)}>
              <Text style={[T.caption, { color: C.textSecondary }]}>Zurück zur Suche</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {!manualMode && !selectedFood && !photoComponents && <>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, marginHorizontal: S.md, marginBottom: S.sm, paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <Feather name="search" size={17} color={C.textSecondary} />
            <TextInput style={{ flex: 1, color: C.text, fontSize: 16 }} placeholder="Lebensmittel suchen…" placeholderTextColor={C.textTertiary} value={query} onChangeText={onQueryChange} autoFocus />
            {loading && <ActivityIndicator size="small" color={C.tint} />}
            {query ? <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}><Feather name="x-circle" size={17} color={C.textSecondary} /></TouchableOpacity> : null}
          </View>

          {photoLoading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: S.md, marginBottom: S.sm, padding: 14, backgroundColor: C.surface, borderRadius: R.md }}>
              <ActivityIndicator color={C.tint} size="small" />
              <Text style={[T.body, { color: C.text }]}>KI analysiert Foto…</Text>
            </View>
          )}

          <View style={{ marginHorizontal: S.md, marginBottom: S.sm }}>
            <TextInput
              style={{ backgroundColor: C.bgSecondary, paddingLeft: 14, fontSize: 13, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, color: C.text, paddingVertical: 10 }}
              placeholder="Hinweis für KI (optional, z.B. 'Pasta ca. 400g')"
              placeholderTextColor={C.textTertiary}
              value={photoHint}
              onChangeText={setPhotoHint}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: S.sm, marginHorizontal: S.md, marginBottom: S.sm }}>
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.tint + '10', borderRadius: R.md, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '30' }} onPress={() => analyzePhoto(true)}>
              <Feather name="camera" size={16} color={C.tint} />
              <Text style={[T.label, { color: C.tint }]}>Kamera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.tint + '10', borderRadius: R.md, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '30' }} onPress={() => analyzePhoto(false)}>
              <Feather name="image" size={16} color={C.tint} />
              <Text style={[T.label, { color: C.tint }]}>Galerie</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.tint + '10', borderRadius: R.md, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '30' }} onPress={() => { onClose(); if (onBarcodePress) setTimeout(onBarcodePress, 400); }}>
              <Feather name="maximize" size={16} color={C.tint} />
              <Text style={[T.label, { color: C.tint }]}>Barcode</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginHorizontal: S.md, marginBottom: S.sm, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: C.tint + '10', borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '30' }}
            onPress={() => { setManualMode(true); setManualForm(f => ({ ...f, name: query })); }}
          >
            <Feather name="edit" size={15} color={C.tint} />
            <Text style={[T.label, { color: C.tint }]}>Manuell eintragen{query ? ` "${query}"` : ''}</Text>
          </TouchableOpacity>

          {query.trim() && results.length === 0 && !loading && <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center', padding: S.lg }]}>Nichts gefunden</Text>}
          {!query.trim() && <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: S.md, marginBottom: S.sm }]}>Häufig verwendet</Text>}

          <FlatList
            data={displayList}
            keyExtractor={(item, i) => item.name + i}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}
                onPress={() => selectFood(item)}
                activeOpacity={0.7}
              >
                <View style={{ width: 36, height: 36, borderRadius: R.sm, backgroundColor: C.tint + '14', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="coffee" size={16} color={C.tint} />
                </View>
                <View style={{ flex: 1, marginLeft: S.sm }}>
                  <Text style={[T.bodyMed, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
                  {item.brand ? <Text style={[T.caption, { color: C.textTertiary, marginTop: 1 }]}>{item.brand}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', marginRight: S.sm }}>
                  <Text style={[T.bodyMed, { color: C.tint }]}>{item.caloriesPer100g ? Math.round(item.caloriesPer100g) : '?'}</Text>
                  <Text style={[T.caption, { color: C.textTertiary }]}>kcal/100g</Text>
                </View>
                <Feather name="chevron-right" size={13} color={C.textTertiary} />
              </TouchableOpacity>
            )}
          />
        </>}

        {selectedFood && !manualMode && (
          <ScrollView contentContainerStyle={{ padding: S.md }} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => setSelectedFood(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: S.md }}>
              <Feather name="chevron-left" size={15} color={C.tint} />
              <Text style={[T.body, { color: C.tint }]}>Zurück</Text>
            </TouchableOpacity>

            <Text style={[T.h2, { color: C.text, marginBottom: 4 }]}>{selectedFood.name}</Text>
            {selectedFood.brand ? <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.md }]}>{selectedFood.brand}</Text> : null}

            <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, marginBottom: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              {[['Kalorien', macros.calories + ' kcal', C.tint],
                ['Protein', macros.protein + 'g', C.success],
                ['Carbs', macros.carbs + 'g', C.warning],
                ['Fett', macros.fat + 'g', C.danger],
              ].map(([label, val, color]) => (
                <View key={label} style={{ alignItems: 'center' }}>
                  <Text style={{ color, fontSize: 18, fontWeight: '800' }}>{val}</Text>
                  <Text style={[T.caption, { color: C.textSecondary, marginTop: 2 }]}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', backgroundColor: C.bgSecondary, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden', marginBottom: S.md }}>
              <View style={{ flex: 1, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.border }}>
                <Picker
                  selectedValue={count}
                  onValueChange={setCount}
                  style={{ color: C.text }}
                  itemStyle={{ color: C.text, fontSize: 17, fontWeight: '600' }}
                >
                  {COUNTS.map(n => <Picker.Item key={n} label={String(n)} value={n} />)}
                </Picker>
              </View>
              <View style={{ flex: 2 }}>
                <Picker
                  selectedValue={servingIndex}
                  onValueChange={(idx) => { setServingIndex(idx); setCount(1); }}
                  style={{ color: C.text }}
                  itemStyle={{ color: C.text, fontSize: 15 }}
                >
                  {servings.map((s, i) => <Picker.Item key={i} label={s.label} value={i} />)}
                </Picker>
              </View>
            </View>

            {isCustomServing && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgSecondary, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden', marginBottom: S.md }}>
                <TouchableOpacity style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgTertiary }} onPress={() => setCount(c => Math.max(1, c - 10))}>
                  <Feather name="minus" size={18} color={C.text} />
                </TouchableOpacity>
                <TextInput
                  style={{ flex: 1, color: C.text, fontSize: 22, fontWeight: '700', textAlign: 'center' }}
                  value={count.toString()}
                  onChangeText={v => setCount(Math.min(9999, parseInt(v) || 1))}
                  keyboardType="numeric"
                />
                <Text style={[T.caption, { color: C.textSecondary, marginRight: S.sm }]}>{isLiquid(selectedFood) ? 'ml' : 'g'}</Text>
                <TouchableOpacity style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgTertiary }} onPress={() => setCount(c => Math.min(9999, c + 10))}>
                  <Feather name="plus" size={18} color={C.text} />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.tint, borderRadius: R.lg, padding: S.md }}
              onPress={confirmAdd}
            >
              <Feather name="plus-circle" size={18} color={C.tintText} />
              <Text style={[T.bodyMed, { color: C.tintText }]}>Hinzufügen · {macros.calories} kcal</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {manualMode && (
          <ScrollView contentContainerStyle={{ padding: S.md }} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => setManualMode(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: S.md }}>
              <Feather name="chevron-left" size={15} color={C.tint} />
              <Text style={[T.body, { color: C.tint }]}>Zurück</Text>
            </TouchableOpacity>
            <Text style={[T.h2, { color: C.text, marginBottom: 4 }]}>Manuell eintragen</Text>
            <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.lg }]}>Nicht verifiziert</Text>
            <Text style={labelStyle}>Name *</Text>
            <TextInput style={[inputStyle, { marginBottom: S.md }]} value={manualForm.name} onChangeText={v => setManualForm(f => ({ ...f, name: v }))} placeholder="z.B. Omas Kuchen" placeholderTextColor={C.textTertiary} />
            <Text style={labelStyle}>Menge (g/ml)</Text>
            <TextInput style={[inputStyle, { marginBottom: S.md }]} value={manualForm.amount} onChangeText={v => setManualForm(f => ({ ...f, amount: v }))} keyboardType="numeric" placeholder="100" placeholderTextColor={C.textTertiary} />
            <Text style={labelStyle}>Makros pro Menge</Text>
            <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
              {[['protein','P g'],['carbs','K g'],['fat','F g']].map(([key, label]) => (
                <View key={key} style={{ flex: 1 }}>
                  <Text style={[T.caption, { color: C.textSecondary, marginBottom: 4, textAlign: 'center' }]}>{label}</Text>
                  <TextInput style={[inputStyle, { textAlign: 'center', padding: 10 }]} value={manualForm[key]} onChangeText={v => setManualForm(f => ({ ...f, [key]: v }))} keyboardType="numeric" placeholder="0" placeholderTextColor={C.textTertiary} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, marginBottom: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              <Text style={[T.body, { color: C.textSecondary }]}>Kalorien (auto)</Text>
              <Text style={{ color: C.tint, fontSize: 20, fontWeight: '800' }}>
                {Math.round((parseFloat(manualForm.protein)||0)*4+(parseFloat(manualForm.carbs)||0)*4+(parseFloat(manualForm.fat)||0)*9)} kcal
              </Text>
            </View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.tint, borderRadius: R.lg, padding: S.md }}
              onPress={confirmManual}
            >
              <Text style={[T.bodyMed, { color: C.tintText }]}>Hinzufügen (nicht verifiziert)</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
