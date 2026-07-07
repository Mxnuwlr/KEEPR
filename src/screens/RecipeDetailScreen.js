/**
 * screens/RecipeDetailScreen.js — Rezept-Detailansicht
 *
 * Zeigt Rezept mit Zutaten, Nährwerten, Schritt-für-Schritt Anleitung und Foto.
 * cookRecipe(id) → Zutaten aus Inventar abziehen (fuzzy matching in store).
 * addCalorieEntry() → Mahlzeit in Kalorien-Log übertragen.
 *
 * route.params: { recipeId } — Rezept wird aus useStore().recipes gesucht.
 * Rezept-Fotos: BASE_URL + recipe.photo_url
 */

// React/RN
import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, StyleSheet, Linking, Modal, FlatList, TextInput, ActivityIndicator } from 'react-native';

// Third-party
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';
import { getBaseUrl, api, askRecipeQuestion, parseRecipeChanges } from '../api/client';
import { categorizeItem, roundToPracticalAmount } from '../utils/categorize';

export default function RecipeDetailScreen({ route, navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { recipeId } = route.params;
  const { recipes, inventory, collections, cookRecipe, addCalorieEntry, addToCollection, createCollection, updateRecipe, geminiKey } = useStore();
  const recipe = recipes.find(r => r.id === recipeId);

  const totalServings = recipe?.servings || 1;
  const [cookPortions, setCookPortions] = useState(recipe?.servings || 1);
  const [stepsTab, setStepsTab] = useState('Zubereitung');
  const [collectionModal, setCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [savingCollection, setSavingCollection] = useState(false);
  const [kiQuestion, setKiQuestion] = useState('');
  const [kiAnswer, setKiAnswer] = useState('');
  const [kiLoading, setKiLoading] = useState(false);
  const [kiLastQuestion, setKiLastQuestion] = useState('');
  const [kiChanges, setKiChanges] = useState(null);
  const [kiChangesLoading, setKiChangesLoading] = useState(false);
  const [kiChangesModal, setKiChangesModal] = useState(false);
  const [kiSelectedAlts, setKiSelectedAlts] = useState({}); // { "originalName": "chosenOption" }
  const kiScrollRef = useRef(null);

  if (!recipe) return null;

  const scale = cookPortions / totalServings;

  // Parse steps — new JSON format or legacy plain text
  const parsedSteps = (() => {
    if (!recipe.steps) return { vorbereitung: [], zubereitung: [] };
    try {
      const arr = JSON.parse(recipe.steps);
      if (Array.isArray(arr)) return {
        vorbereitung: arr.filter(s => s.type === 'vorbereitung').map(s => s.text),
        zubereitung: arr.filter(s => s.type !== 'vorbereitung').map(s => s.text),
      };
    } catch {}
    // Legacy: plain text
    return { vorbereitung: [], zubereitung: [recipe.steps] };
  })();

  // Zeit parsen — neues JSON-Format oder Legacy-Plaintext
  const parsedTime = (() => {
    try {
      const t = JSON.parse(recipe.prep_time || '');
      if (t && typeof t === 'object' && !Array.isArray(t)) return t;
    } catch {}
    return recipe.prep_time ? { total: recipe.prep_time } : null;
  })();

  const mealTypeTags = recipe.meal_type ? recipe.meal_type.split(',').map(s => s.trim()).filter(Boolean) : [];
  const categoryTags = recipe.recipe_category ? recipe.recipe_category.split(',').map(s => s.trim()).filter(Boolean) : [];

  const perPortion = totalServings > 0 ? 1 / totalServings : 0;
  const macros = [
    { label: 'kcal', value: Math.round((recipe.total_calories || 0) * scale), perP: Math.round((recipe.total_calories || 0) * perPortion), color: C.warning },
    { label: 'Protein', value: Math.round((recipe.total_protein || 0) * scale) + 'g', perP: Math.round((recipe.total_protein || 0) * perPortion) + 'g', color: C.success },
    { label: 'Carbs', value: Math.round((recipe.total_carbs || 0) * scale) + 'g', perP: Math.round((recipe.total_carbs || 0) * perPortion) + 'g', color: C.tint },
    { label: 'Fett', value: Math.round((recipe.total_fat || 0) * scale) + 'g', perP: Math.round((recipe.total_fat || 0) * perPortion) + 'g', color: C.danger },
  ];

  const handleAddToCart = async () => {
    const inventoryNames = inventory.map(i => i.name.toLowerCase().trim());
    const missing = (recipe.ingredients || []).filter(ing => {
      const n = ing.name.toLowerCase().trim();
      return !inventoryNames.some(inv => inv.includes(n) || n.includes(inv));
    });
    if (missing.length === 0) return Alert.alert('Alles da', 'Alle Zutaten sind im Inventar vorhanden.');
    await Promise.all(missing.map(ing => {
      const { amount, unit } = roundToPracticalAmount(ing.amount, ing.unit);
      const category = categorizeItem(ing.name);
      return api.addShoppingItem({ name: ing.name, amount, unit, category }).catch(() => {});
    }));
    Alert.alert('Hinzugefügt', `${missing.length} fehlende Zutat${missing.length > 1 ? 'en' : ''} zur Einkaufsliste hinzugefügt.`);
  };

  const handleAddToCollection = async (collectionId) => {
    setSavingCollection(true);
    try {
      await addToCollection(collectionId, recipe.id);
      setCollectionModal(false);
      Alert.alert('Hinzugefügt', 'Rezept wurde zur Sammlung hinzugefügt.');
    } catch (e) {
      Alert.alert('Fehler', e.message);
    } finally {
      setSavingCollection(false);
    }
  };

  const handleCreateAndAdd = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    setSavingCollection(true);
    try {
      const c = await createCollection(name);
      await addToCollection(c.id, recipe.id);
      setNewCollectionName('');
      setCollectionModal(false);
      Alert.alert('Erstellt', `Sammlung „${name}" erstellt und Rezept hinzugefügt.`);
    } catch (e) {
      Alert.alert('Fehler', e.message);
    } finally {
      setSavingCollection(false);
    }
  };

  const handleKiSend = async () => {
    const q = kiQuestion.trim();
    if (!q || kiLoading) return;
    setKiLoading(true);
    setKiAnswer('');
    setKiChanges(null);
    setKiLastQuestion(q);
    setKiQuestion('');
    try {
      const ans = await askRecipeQuestion(recipe, q, geminiKey);
      setKiAnswer(ans);
    } catch {
      Alert.alert('Fehler', 'KI konnte nicht antworten.');
    } finally {
      setKiLoading(false);
    }
  };

  const handlePrepareChanges = async () => {
    setKiChangesLoading(true);
    try {
      const changes = await parseRecipeChanges(recipe, kiLastQuestion, kiAnswer, geminiKey);
      const hasChanges =
        changes.zutatenHinzufuegen?.length > 0 ||
        changes.zutatenEntfernen?.length > 0 ||
        changes.zutatenAnpassen?.length > 0 ||
        changes.alternativen?.length > 0 ||
        changes.schritteAnpassen?.length > 0 ||
        changes.schritteHinzufuegen?.length > 0;
      if (!hasChanges) {
        Alert.alert('Nichts erkannt', 'Stelle eine konkretere Frage, z.B. "Welches Brot kann ich statt Weißbrot nehmen?" oder "Füge Knoblauch hinzu".');
        return;
      }
      setKiChanges(changes);
      // Pre-select first option for each alternative
      const preSelected = {};
      (changes.alternativen || []).forEach(a => { if (a.optionen?.length) preSelected[a.fuerZutat] = a.optionen[0]; });
      setKiSelectedAlts(preSelected);
      setKiChangesModal(true);
    } catch {
      Alert.alert('Fehler', 'Änderungen konnten nicht analysiert werden.');
    } finally {
      setKiChangesLoading(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!kiChanges) return;
    try {
      let newIngredients = [...(recipe.ingredients || [])];
      // Alternativen: Original ersetzen durch gewählte Option
      const altReplacements = [];
      (kiChanges.alternativen || []).forEach(a => {
        const chosen = kiSelectedAlts[a.fuerZutat];
        if (chosen) {
          // Finde Originalmenge/-einheit für die Ersatz-Zutat
          const original = newIngredients.find(i => i.name.toLowerCase() === a.fuerZutat.toLowerCase());
          altReplacements.push({ remove: a.fuerZutat, add: { name: chosen, amount: original?.amount || 0, unit: original?.unit || '' } });
        }
      });
      altReplacements.forEach(({ remove, add }) => {
        newIngredients = newIngredients.filter(i => i.name.toLowerCase() !== remove.toLowerCase());
        newIngredients.push(add);
      });
      // Entfernen
      if (kiChanges.zutatenEntfernen?.length) {
        newIngredients = newIngredients.filter(ing =>
          !kiChanges.zutatenEntfernen.some(n => n.toLowerCase() === ing.name.toLowerCase())
        );
      }
      // Hinzufügen
      if (kiChanges.zutatenHinzufuegen?.length) {
        newIngredients = [...newIngredients, ...kiChanges.zutatenHinzufuegen.map(i => ({ name: i.name, amount: i.amount || 0, unit: i.unit || '' }))];
      }
      // Mengen anpassen
      if (kiChanges.zutatenAnpassen?.length) {
        kiChanges.zutatenAnpassen.forEach(({ index, neueMenge, neueEinheit }) => {
          if (newIngredients[index]) newIngredients[index] = { ...newIngredients[index], amount: neueMenge ?? newIngredients[index].amount, unit: neueEinheit || newIngredients[index].unit };
        });
      }
      // Schritte
      let stepsArr = [];
      try { const p = JSON.parse(recipe.steps || ''); if (Array.isArray(p)) stepsArr = [...p]; } catch {}

      // Zutaten-Namensänderungen aus Alternativen + expliziten Ersetzungen in Schritte übertragen
      const nameChanges = [
        ...altReplacements.map(({ remove, add }) => ({ from: remove, to: add.name })),
        ...(kiChanges.zutatenEntfernen || []).flatMap(removed => {
          const added = (kiChanges.zutatenHinzufuegen || []).find(() => true);
          return added ? [{ from: removed, to: added.name }] : [];
        }),
      ];
      if (nameChanges.length > 0) {
        stepsArr = stepsArr.map(step => {
          let text = step.text || '';
          nameChanges.forEach(({ from, to }) => {
            const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            text = text.replace(regex, to);
          });
          return { ...step, text };
        });
      }

      if (kiChanges.schritteAnpassen?.length) {
        kiChanges.schritteAnpassen.forEach(({ index, neuerText }) => {
          if (stepsArr[index]) stepsArr[index] = { ...stepsArr[index], text: neuerText };
        });
      }
      if (kiChanges.schritteHinzufuegen?.length) {
        kiChanges.schritteHinzufuegen.forEach(({ nachIndex, text }) => {
          const step = { type: 'zubereitung', text };
          if (nachIndex == null || nachIndex < 0 || nachIndex >= stepsArr.length - 1) stepsArr.push(step);
          else stepsArr.splice(nachIndex + 1, 0, step);
        });
      }
      await updateRecipe(recipe.id, {
        name: recipe.name,
        emoji: recipe.emoji || null,
        description: recipe.description || '',
        prepTime: recipe.prep_time || '',
        servings: recipe.servings || 1,
        difficulty: recipe.difficulty || '',
        totalCalories: recipe.total_calories || 0,
        totalProtein: recipe.total_protein || 0,
        totalCarbs: recipe.total_carbs || 0,
        totalFat: recipe.total_fat || 0,
        meal_type: recipe.meal_type || '',
        recipe_category: recipe.recipe_category || '',
        source_url: recipe.source_url || '',
        steps: JSON.stringify(stepsArr),
        ingredients: newIngredients.map(i => ({ name: i.name, amount: i.amount || 0, unit: i.unit || '', slug: i.slug || undefined })),
      });
      setKiChangesModal(false);
      setKiAnswer('');
      setKiChanges(null);
      Alert.alert('Übernommen ✓', 'Rezept wurde aktualisiert.');
    } catch (e) {
      Alert.alert('Fehler', e.message);
    }
  };

  const handleCook = () => {
    Alert.alert(
      'Kochen?',
      `${cookPortions} Portion${cookPortions !== 1 ? 'en' : ''} · Zutaten werden anteilig abgezogen.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Kochen!', onPress: async () => {
          try {
            const r = await cookRecipe(recipe.id, cookPortions, totalServings);
            await addCalorieEntry({
              mealType: 'Mittagessen', name: recipe.name,
              calories: Math.round((recipe.total_calories || 0) * scale),
              protein: Math.round((recipe.total_protein || 0) * scale),
              carbs: Math.round((recipe.total_carbs || 0) * scale),
              fat: Math.round((recipe.total_fat || 0) * scale),
            });
            Alert.alert('Gekocht!', `${cookPortions} Portion${cookPortions !== 1 ? 'en' : ''} · ${r.removed} Zutaten angepasst.`);
            navigation.goBack();
          } catch(e) { Alert.alert('Fehler', e.message); }
        }},
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 8, paddingBottom: S.md,
        paddingHorizontal: S.md,
        flexDirection: 'row', alignItems: 'center', gap: S.sm,
        backgroundColor: C.bg,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="arrow-left" size={18} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.bodyMed, { flex: 1, color: C.text }]} numberOfLines={1}>{recipe.name}</Text>
        <TouchableOpacity onPress={handleAddToCart} hitSlop={10}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="shopping-cart" size={15} color={C.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCollectionModal(true)} hitSlop={10}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="bookmark" size={15} color={C.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('RecipeWizard', { recipe })} hitSlop={10}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="edit-2" size={15} color={C.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Collection Modal */}
      <Modal visible={collectionModal} transparent animationType="slide" onRequestClose={() => setCollectionModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={() => setCollectionModal(false)} />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16, maxHeight: '70%' }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
            <Text style={[T.bodyMed, { color: C.text, flex: 1 }]}>Zu Sammlung hinzufügen</Text>
            <TouchableOpacity onPress={() => setCollectionModal(false)} hitSlop={10}>
              <Feather name="x" size={18} color={C.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Neue Sammlung erstellen */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
            <TextInput
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              placeholder="Neue Sammlung..."
              placeholderTextColor={C.textTertiary}
              style={{ flex: 1, backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: C.text, fontSize: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
            />
            <TouchableOpacity
              onPress={handleCreateAndAdd}
              disabled={!newCollectionName.trim() || savingCollection}
              style={{ backgroundColor: newCollectionName.trim() ? C.accent : C.bgSecondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }}
            >
              {savingCollection
                ? <ActivityIndicator size="small" color={C.accentText} />
                : <Text style={{ color: newCollectionName.trim() ? C.accentText : C.textTertiary, fontWeight: '600', fontSize: 14 }}>Erstellen</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Vorhandene Sammlungen */}
          <FlatList
            data={collections}
            keyExtractor={i => i.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleAddToCollection(item.id)}
                disabled={savingCollection}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="bookmark" size={16} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { color: C.text }]}>{item.name}</Text>
                  <Text style={[T.caption, { color: C.textTertiary }]}>{`${item.recipe_count ?? 0} Rezepte`}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={C.textTertiary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                <Feather name="bookmark" size={32} color={C.border} />
                <Text style={[T.caption, { color: C.textTertiary }]}>Noch keine Sammlungen — erstelle eine oben.</Text>
              </View>
            }
          />
        </View>
      </Modal>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 160 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
        {/* Cover image */}
        {recipe.image_path && (
          <Image source={{ uri: `${getBaseUrl()}${recipe.image_path}` }} style={{ width: '100%', height: 220, resizeMode: 'cover' }} />
        )}

        <View style={{ paddingHorizontal: S.md, paddingTop: S.lg }}>
          {/* Title */}
          <Text style={[T.h2, { color: C.text, marginBottom: S.sm }]}>{recipe.name}</Text>

          {/* Tags — meal_type + recipe_category */}
          {(mealTypeTags.length > 0 || categoryTags.length > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: S.md }}>
              {[...mealTypeTags, ...categoryTags].map(tag => (
                <View key={tag} style={{ backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, color: C.textSecondary, fontWeight: '500' }}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Meta: Zeit + Schwierigkeit */}
          <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg, flexWrap: 'wrap' }}>
            {parsedTime?.total && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Feather name="clock" size={12} color={C.textSecondary} />
                <Text style={[T.caption, { color: C.textSecondary }]}>Gesamt: {parsedTime.total}</Text>
              </View>
            )}
            {parsedTime?.wait && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Feather name="coffee" size={12} color={C.textSecondary} />
                <Text style={[T.caption, { color: C.textSecondary }]}>Warten: {parsedTime.wait}</Text>
              </View>
            )}
            {recipe.difficulty && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Feather name="bar-chart-2" size={12} color={C.textSecondary} />
                <Text style={[T.caption, { color: C.textSecondary }]}>{recipe.difficulty}</Text>
              </View>
            )}
            {recipe.source_url ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(recipe.source_url)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 5 }}
              >
                <Feather name="external-link" size={12} color={C.accent} />
                <Text style={[T.caption, { color: C.accent }]}>Original ansehen</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Portion stepper */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth,
            borderColor: C.border, paddingHorizontal: S.md, paddingVertical: 12, marginBottom: S.lg,
          }}>
            <View>
              <Text style={[T.label, { color: C.textSecondary }]}>Portionen kochen</Text>
              <Text style={[T.caption, { color: C.textTertiary }]}>Rezept für {totalServings} Portionen</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <TouchableOpacity
                onPress={() => setCookPortions(p => Math.max(1, p - 1))}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Feather name="minus" size={16} color={cookPortions <= 1 ? C.textTertiary : C.text} />
              </TouchableOpacity>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 22, minWidth: 30, textAlign: 'center' }}>{cookPortions}</Text>
              <TouchableOpacity
                onPress={() => setCookPortions(p => p + 1)}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Feather name="plus" size={16} color={C.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Macros — skaliert + pro Portion */}
          <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
            {macros.map(m => (
              <View key={m.label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.lg, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: m.color, fontWeight: '700', fontSize: 16 }}>{m.value}</Text>
                <Text style={[T.caption, { color: C.textTertiary, fontSize: 10, marginTop: 2 }]}>{m.label}</Text>
                {totalServings > 1 && <Text style={{ color: C.textTertiary, fontSize: 9, marginTop: 1 }}>{m.perP}/Port.</Text>}
              </View>
            ))}
          </View>

          {/* Ingredients — mit Thumbnails */}
          {recipe.ingredients?.length > 0 && (
            <View style={{ marginBottom: S.lg }}>
              <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: S.sm }]}>Zutaten</Text>
              <View style={{ backgroundColor: C.surface, borderRadius: R.lg }}>
                {recipe.ingredients.map((ing, i) => {
                  const rawAmt = ing.amount > 0 ? ing.amount * scale : 0;
                  const scaledAmt = rawAmt <= 0 ? 0 : rawAmt < 1 ? Math.round(rawAmt * 100) / 100 : rawAmt < 10 ? Math.round(rawAmt * 2) / 2 : Math.round(rawAmt);
                  const imgUrl = ing.slug ? `${getBaseUrl()}/uploads/ingredients/${ing.slug}.png` : null;
                  return (
                    <View key={i} style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: S.md, paddingVertical: 10,
                      borderBottomWidth: i < recipe.ingredients.length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: C.border, gap: S.sm,
                    }}>
                      {imgUrl ? (
                        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden', flexShrink: 0 }}>
                          <Image source={{ uri: imgUrl }} style={{ width: 36, height: 36, resizeMode: 'contain' }} />
                        </View>
                      ) : (
                        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Feather name="box" size={14} color={C.textTertiary} />
                        </View>
                      )}
                      <Text style={[T.body, { color: C.text, flex: 1 }]}>{ing.name}</Text>
                      {scaledAmt > 0 && (
                        <Text style={[T.bodyMed, { color: C.textSecondary }]}>{scaledAmt} {ing.unit}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Steps — Vorbereitung + Zubereitung Tabs */}
          {(parsedSteps.vorbereitung.length > 0 || parsedSteps.zubereitung.length > 0) && (
            <View style={{ marginBottom: S.lg }}>
              <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: S.sm }]}>Zubereitung</Text>

              {/* Tabs — nur wenn beide vorhanden */}
              {parsedSteps.vorbereitung.length > 0 && (
                <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.md, padding: 3, marginBottom: S.md }}>
                  {['Vorbereitung', 'Zubereitung'].map(tab => (
                    <TouchableOpacity
                      key={tab}
                      onPress={() => setStepsTab(tab)}
                      style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: R.md - 2, backgroundColor: stepsTab === tab ? C.bg : 'transparent' }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: stepsTab === tab ? C.text : C.textTertiary }}>{tab}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, gap: 16 }}>
                {(stepsTab === 'Vorbereitung' ? parsedSteps.vorbereitung : parsedSteps.zubereitung).map((step, i) => {
                  // Zutaten-Bilder: Zutaten-Name im Schritt-Text finden (nur Zutaten mit Bild)
                  const stepLower = step.toLowerCase();
                  const matchedIngredients = (recipe.ingredients || []).filter(ing =>
                    ing.slug && stepLower.includes(ing.name.toLowerCase())
                  );
                  return (
                    <View key={i}>
                      {/* Zutaten-Thumbnails über dem Schritt-Text */}
                      {matchedIngredients.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8, marginLeft: 36 }}>
                          {matchedIngredients.map((ing, j) => (
                            <View key={j} style={{ alignItems: 'center', gap: 2 }}>
                              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                                <Image
                                  source={{ uri: `${getBaseUrl()}/uploads/ingredients/${ing.slug}.png` }}
                                  style={{ width: 36, height: 36, resizeMode: 'contain' }}
                                />
                              </View>
                              <Text style={{ fontSize: 9, color: C.textTertiary, maxWidth: 48, textAlign: 'center' }} numberOfLines={1}>{ing.name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          <Text style={{ color: C.accentText, fontSize: 12, fontWeight: '700' }}>{i + 1}</Text>
                        </View>
                        <Text style={[T.body, { color: C.text, flex: 1, lineHeight: 22 }]}>{step}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* KI Koch-Assistent */}
          {geminiKey ? (
            <View style={{ marginBottom: S.lg }}>
              <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: S.sm }]}>Koch-Assistent</Text>
              <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, gap: S.sm }}>
                {kiAnswer ? (
                  <View style={{ backgroundColor: C.accent + '12', borderRadius: R.md, padding: S.sm, borderLeftWidth: 3, borderLeftColor: C.accent, gap: S.sm }}>
                    <Text style={[T.body, { color: C.text, lineHeight: 20 }]}>{kiAnswer}</Text>
                    <View style={{ flexDirection: 'row', gap: S.sm, justifyContent: 'flex-end' }}>
                      <TouchableOpacity
                        onPress={handlePrepareChanges}
                        disabled={kiChangesLoading}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.accent, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 7 }}
                      >
                        {kiChangesLoading
                          ? <ActivityIndicator size="small" color={C.accentText} />
                          : <Feather name="check-circle" size={13} color={C.accentText} />
                        }
                        <Text style={{ fontSize: 13, fontWeight: '600', color: C.accentText }}>Ins Rezept übernehmen</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setKiAnswer(''); setKiChanges(null); }} style={{ paddingHorizontal: 10, paddingVertical: 7 }}>
                        <Text style={[T.caption, { color: C.textTertiary }]}>Schließen</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center' }}>
                  <TextInput
                    style={{
                      flex: 1, backgroundColor: C.bgSecondary, borderRadius: R.md,
                      paddingHorizontal: S.sm, paddingVertical: 10,
                      color: C.text, fontSize: 14,
                      borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
                    }}
                    placeholder="Frage zur Zubereitung…"
                    placeholderTextColor={C.textTertiary}
                    value={kiQuestion}
                    onChangeText={setKiQuestion}
                    returnKeyType="send"
                    onSubmitEditing={handleKiSend}
                  />
                  <TouchableOpacity
                    disabled={!kiQuestion.trim() || kiLoading}
                    onPress={handleKiSend}
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: kiQuestion.trim() && !kiLoading ? C.accent : C.bgSecondary,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {kiLoading
                      ? <ActivityIndicator size="small" color={C.accent} />
                      : <Feather name="send" size={16} color={kiQuestion.trim() ? C.accentText : C.textTertiary} />
                    }
                  </TouchableOpacity>
                </View>
                <Text style={[T.caption, { color: C.textTertiary }]}>z.B. "Was kann ich statt Sahne nehmen?" oder "Füge Knoblauch hinzu"</Text>
              </View>
            </View>
          ) : null}

          {/* KI-Änderungen Bestätigungs-Modal */}
          <Modal visible={kiChangesModal} transparent animationType="slide" onRequestClose={() => setKiChangesModal(false)}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={() => setKiChangesModal(false)} />
            <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16, maxHeight: '75%' }}>
              <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
                <Text style={[T.bodyMed, { color: C.text, flex: 1 }]}>Vorgeschlagene Änderungen</Text>
                <TouchableOpacity onPress={() => setKiChangesModal(false)} hitSlop={10}>
                  <Feather name="x" size={18} color={C.textTertiary} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 12 }} showsVerticalScrollIndicator={false}>
                {kiChanges?.zusammenfassung ? (
                  <Text style={[T.body, { color: C.text, lineHeight: 20 }]}>{kiChanges.zusammenfassung}</Text>
                ) : null}
                {kiChanges?.alternativen?.length > 0 && (
                  <View style={{ gap: 10 }}>
                    <Text style={[T.label, { color: C.tint, textTransform: 'uppercase', letterSpacing: 0.6 }]}>Alternativen wählen</Text>
                    {kiChanges.alternativen.map((alt, idx) => (
                      <View key={idx} style={{ gap: 6 }}>
                        <Text style={[T.caption, { color: C.textSecondary }]}>Ersatz für <Text style={{ color: C.text, fontWeight: '600' }}>{alt.fuerZutat}</Text>:</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {(alt.optionen || []).map(opt => {
                            const selected = kiSelectedAlts[alt.fuerZutat] === opt;
                            return (
                              <TouchableOpacity
                                key={opt}
                                onPress={() => setKiSelectedAlts(prev => ({ ...prev, [alt.fuerZutat]: opt }))}
                                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: selected ? C.accent : C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: selected ? C.accent : C.border }}
                              >
                                <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? C.accentText : C.text }}>{opt}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                {kiChanges?.zutatenHinzufuegen?.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <Text style={[T.label, { color: '#22C55E', textTransform: 'uppercase', letterSpacing: 0.6 }]}>Zutaten hinzufügen</Text>
                    {kiChanges.zutatenHinzufuegen.map((i, idx) => (
                      <Text key={idx} style={[T.body, { color: C.text }]}>+ {i.name}{i.amount > 0 ? ` (${i.amount} ${i.unit})` : ''}</Text>
                    ))}
                  </View>
                )}
                {kiChanges?.zutatenEntfernen?.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <Text style={[T.label, { color: C.danger, textTransform: 'uppercase', letterSpacing: 0.6 }]}>Zutaten entfernen</Text>
                    {kiChanges.zutatenEntfernen.map((n, idx) => (
                      <Text key={idx} style={[T.body, { color: C.text }]}>− {n}</Text>
                    ))}
                  </View>
                )}
                {kiChanges?.zutatenAnpassen?.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <Text style={[T.label, { color: C.warning, textTransform: 'uppercase', letterSpacing: 0.6 }]}>Mengen anpassen</Text>
                    {kiChanges.zutatenAnpassen.map((c, idx) => {
                      const ing = recipe.ingredients?.[c.index];
                      return ing ? (
                        <Text key={idx} style={[T.body, { color: C.text }]}>{ing.name}: {ing.amount} {ing.unit} → {c.neueMenge} {c.neueEinheit || ing.unit}</Text>
                      ) : null;
                    })}
                  </View>
                )}
                {kiChanges?.schritteAnpassen?.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <Text style={[T.label, { color: C.warning, textTransform: 'uppercase', letterSpacing: 0.6 }]}>Schritte anpassen</Text>
                    {kiChanges.schritteAnpassen.map((c, idx) => (
                      <Text key={idx} style={[T.body, { color: C.text }]}>Schritt {c.index + 1}: {c.neuerText}</Text>
                    ))}
                  </View>
                )}
                {kiChanges?.schritteHinzufuegen?.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <Text style={[T.label, { color: '#22C55E', textTransform: 'uppercase', letterSpacing: 0.6 }]}>Schritte hinzufügen</Text>
                    {kiChanges.schritteHinzufuegen.map((c, idx) => (
                      <Text key={idx} style={[T.body, { color: C.text }]}>+ {c.text}</Text>
                    ))}
                  </View>
                )}
              </ScrollView>
              <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setKiChangesModal(false)}
                  style={{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                >
                  <Text style={[T.bodyMed, { color: C.text, fontWeight: '600' }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleApplyChanges}
                  style={{ flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: C.accent }}
                >
                  <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>Übernehmen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Cook button */}
          <TouchableOpacity
            style={{ backgroundColor: C.accent, borderRadius: R.lg, padding: S.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm }}
            onPress={handleCook}
            activeOpacity={0.85}
          >
            <Feather name="check-circle" size={18} color={C.accentText} />
            <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>
              {cookPortions} Portion{cookPortions !== 1 ? 'en' : ''} kochen & abziehen
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
