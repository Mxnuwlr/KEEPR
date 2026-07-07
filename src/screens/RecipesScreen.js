/**
 * screens/RecipesScreen.js — Rezept-Übersicht
 *
 * Primäransicht: Sammlungen (2-Spalten Grid)
 * Darunter: Unsortierte Rezepte (noch keiner Sammlung zugeordnet)
 * Header: Titel + Filter-Button
 * FAB: ActionSheet (Manuell / URL / KI / Neue Sammlung)
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image, Alert,
  ActivityIndicator, StyleSheet, Modal, TextInput, ActionSheetIOS,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';

import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../store';
import { getAiRecipeSuggestions, api, getBaseUrl } from '../api/client';
import { useTheme } from '../theme';
import { getDisplayTime } from '../utils/time';

export default function RecipesScreen({ navigation, tabBar }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    recipes, inventory, geminiKey,
    createRecipe, fetchRecipes, deleteRecipe,
    collections, createCollection, deleteCollection, addToCollection,
  } = useStore();

  // Unsortierte Rezepte (nicht in einer Sammlung)
  const [unsorted, setUnsorted] = useState([]);
  const [unsortedLoading, setUnsortedLoading] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [assignRecipe, setAssignRecipe] = useState(null);
  const [assignLoading, setAssignLoading] = useState(false);

  // Modals
  const [aiLoading, setAiLoading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [collectionModal, setCollectionModal] = useState(false);
  const [wish, setWish] = useState('');
  const [recipeCount, setRecipeCount] = useState(4);
  const [onlyInventory, setOnlyInventory] = useState(false);
  const [inventoryMode, setInventoryMode] = useState('suggest'); // 'suggest' | 'only' | 'free'
  const [kiModal, setKiModal] = useState(false);
  const [urlModal, setUrlModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [filterModal, setFilterModal] = useState(false);
  const [filterMealType, setFilterMealType] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);
  const [filterMaxTime, setFilterMaxTime] = useState(null);
  const [previewModal, setPreviewModal] = useState(false);
  const [previewSuggestions, setPreviewSuggestions] = useState([]);
  const [previewSaving, setPreviewSaving] = useState(false);

  const fetchUnsorted = useCallback(async () => {
    setUnsortedLoading(true);
    try {
      const data = await api.getUnsortedRecipes();
      setUnsorted(Array.isArray(data) ? data : []);
    } catch {
      setUnsorted([]);
    }
    setUnsortedLoading(false);
  }, []);

  useEffect(() => {
    fetchUnsorted();
  }, [fetchUnsorted, recipes]); // re-fetch whenever recipes change

  // --- Helpers ---

  const parsePrepTimeMinutes = (prepTime) => {
    const t = getDisplayTime(prepTime);
    if (!t) return null;
    let minutes = 0;
    const hourMatch = t.match(/(\d+)\s*(Std|Stunde|h)/i);
    const minMatch = t.match(/(\d+)\s*(Min|Minute|m)/i);
    if (hourMatch) minutes += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) minutes += parseInt(minMatch[1], 10);
    if (!hourMatch && !minMatch) {
      const plain = parseInt(t, 10);
      if (!isNaN(plain)) minutes = plain;
    }
    return minutes > 0 ? minutes : null;
  };

  const inventoryNames = useMemo(() =>
    new Set(inventory.map(i => i.name.toLowerCase().trim())),
    [inventory]
  );

  const getMissingCount = (recipe) => {
    const ings = recipe.ingredients || [];
    if (!ings.length) return 0;
    return ings.filter(ing => {
      const n = ing.name?.toLowerCase().trim();
      if (!n) return false;
      return ![...inventoryNames].some(inv => inv.includes(n) || n.includes(inv));
    }).length;
  };

  const activeFilterCount = [filterMealType, filterCategory, filterMaxTime].filter(Boolean).length;

  const filteredUnsorted = useMemo(() => unsorted.filter(r => {
    if (filterMealType && !(r.meal_type || '').split(',').map(s => s.trim()).includes(filterMealType)) return false;
    if (filterCategory && !(r.recipe_category || '').split(',').map(s => s.trim()).includes(filterCategory)) return false;
    if (filterMaxTime) {
      const mins = parsePrepTimeMinutes(r.prep_time);
      if (!mins || mins > filterMaxTime) return false;
    }
    return true;
  }), [unsorted, filterMealType, filterCategory, filterMaxTime]);

  // --- Actions ---

  // Löst Zutaten-Namen gegen die DB auf — gibt { name, slug } zurück
  // Behandelt auch "Weißbrot/Ciabatta"-Alternativen: erste mit DB-Match gewinnt
  const resolveIngredientSlugs = async (ings) => {
    return Promise.all(ings.map(async (ing) => {
      const candidates = ing.name.includes('/')
        ? ing.name.split('/').map(n => n.trim()).filter(Boolean)
        : [ing.name];

      for (const candidate of candidates) {
        try {
          const results = await api.searchIngredients(candidate);
          if (results?.length > 0) {
            const lower = candidate.toLowerCase();
            const match = results.find(r => r.name.toLowerCase() === lower) || results[0];
            if (match?.slug) return { ...ing, name: match.name || candidate, slug: match.slug };
            // Found results but no slug — still clean up the name
            return { ...ing, name: candidate };
          }
        } catch {}
      }

      // No DB match — use first alternative if it was a "/" name
      const cleanName = candidates[0];
      return { ...ing, name: cleanName };
    }));
  };

  const normalizeIngs = (list) => (list || []).flatMap(n => {
    const base = typeof n === 'string' ? { name: n, amount: 0, unit: '' } : { name: n.name, amount: n.amount || 0, unit: n.unit || '' };
    if (base.name.includes(' & ') || / und /i.test(base.name)) {
      return base.name.split(/ & | und /i).map(part => ({ ...base, name: part.trim(), amount: 0, unit: '' }));
    }
    return [base];
  });

  const parseSteps = (text, nameMap = {}) => {
    if (!text) return JSON.stringify([]);
    let fixed = text;
    for (const [orig, resolved] of Object.entries(nameMap)) {
      fixed = fixed.replace(new RegExp(orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), resolved);
    }
    let parts = fixed.split(/\n+/).map(l => l.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);
    if (parts.length <= 1) {
      const inline = fixed.split(/(?=\d+[\.\)]\s)/).map(l => l.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);
      if (inline.length > 1) parts = inline;
    }
    return JSON.stringify(parts.map(t => ({ type: 'zubereitung', text: t })));
  };

  const loadAiSuggestions = async () => {
    if (!geminiKey) return Alert.alert('KI nicht verfügbar', 'Kein API Key konfiguriert.');
    const today = new Date().toISOString().split('T')[0];
    const freshInventory = inventory.filter(i => !i.mhd || i.mhd >= today);
    if (inventoryMode !== 'free' && freshInventory.length === 0) return Alert.alert('Inventar leer', 'Keine frischen Produkte im Inventar.');
    setKiModal(false);
    setAiLoading(true);
    try {
      const invForAi = inventoryMode === 'free' ? [] : freshInventory;
      const suggestions = await getAiRecipeSuggestions(invForAi, geminiKey, wish, recipeCount, inventoryMode === 'only');
      // Zutaten auflösen + Vorschau vorbereiten (noch nicht speichern)
      const previews = await Promise.all(suggestions.map(async (s) => {
        const rawIngs = [...normalizeIngs(s.ingredients_used), ...normalizeIngs(s.ingredients_needed)];
        const ings = await resolveIngredientSlugs(rawIngs);
        const nameMap = {};
        rawIngs.forEach((raw, i) => { if (raw.name !== ings[i].name) nameMap[raw.name] = ings[i].name; });
        return { ...s, _ings: ings, _nameMap: nameMap, _kept: true };
      }));
      setPreviewSuggestions(previews);
      setPreviewModal(true);
    } catch (e) { Alert.alert('Fehler', e.message); }
    setAiLoading(false);
  };

  const savePreviewSuggestions = async () => {
    const kept = previewSuggestions.filter(s => s._kept);
    if (kept.length === 0) { setPreviewModal(false); return; }
    setPreviewSaving(true);
    try {
      const createdIds = [];
      for (const s of kept) {
        const neededCount = (s.ingredients_needed || []).length;
        const created = await createRecipe({
          name: s.name, emoji: s.emoji || null, description: '',
          prepTime: s.time || '', difficulty: s.difficulty || 'Mittel',
          servings: s.servings || 2, totalCalories: s.totalCalories || 0,
          totalProtein: s.totalProtein || 0, totalCarbs: s.totalCarbs || 0, totalFat: s.totalFat || 0,
          steps: parseSteps(s.steps || '', s._nameMap),
          isAiGenerated: true, missingCount: neededCount,
          ingredients: s._ings,
        });
        if (created?.id) createdIds.push({ id: created.id, name: s.name, ingredients: s._ings });
      }
      setPreviewModal(false);
      const timeHint = createdIds.length <= 1 ? ' (~10 Sek.)' : ` (~${createdIds.length} Min.)`;
      Alert.alert('Gespeichert', `${createdIds.length} Rezepte hinzugefügt. Bilder werden generiert…${timeHint}`);
      await fetchRecipes();
      fetchUnsorted();
      (async () => {
        for (let i = 0; i < createdIds.length; i++) {
          if (i > 0) await new Promise(res => setTimeout(res, 4000));
          const r = createdIds[i];
          try {
            await api.generateRecipeImage(r.id, r.name, r.ingredients);
            fetchRecipes();
            fetchUnsorted();
          } catch (err) { console.log('Image gen error:', err?.message); }
        }
      })();
    } catch (e) { Alert.alert('Fehler', e.message); }
    setPreviewSaving(false);
  };

  const handleImportUrl = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImportLoading(true);
    try {
      const data = await api.importRecipeFromUrl(url);
      setUrlModal(false);
      setImportUrl('');
      const parseImportSteps = (text) => {
        if (!text) return JSON.stringify([]);
        const parts = text.split(/\s*\d+[\.\)]\s+/).filter(s => s.trim());
        const steps = parts.length > 1 ? parts
          : text.split(/\n+/).filter(s => s.trim()).length > 1 ? text.split(/\n+/).filter(s => s.trim())
          : [text.trim()];
        return JSON.stringify(steps.map(t => ({ type: 'zubereitung', text: t.trim() })));
      };
      navigation.navigate('RecipeWizard', {
        recipe: {
          name: data.name || '',
          emoji: data.emoji || null,
          description: data.description || '',
          prep_time: data.totalTime || data.time || '',
          active_time: data.prepTime || data.activeTime || data.active_time || '',
          wait_time: data.cookTime || data.waitTime || data.restTime || data.passiveTime || data.wait_time || '',
          difficulty: data.difficulty || 'Mittel',
          servings: data.servings || 2,
          steps: parseImportSteps(data.steps),
          total_calories: data.totalCalories || 0,
          total_protein: data.totalProtein || 0,
          total_carbs: data.totalCarbs || 0,
          total_fat: data.totalFat || 0,
          ingredients: (data.ingredients || []).map(i => ({
            name: i.name || '', slug: null, image_url: null,
            amount: i.amount?.toString() || '', unit: i.unit || 'g',
          })),
          image_path: data.imagePath || null,
          meal_type: '', recipe_category: '', source_url: url,
        },
      });
    } catch (e) {
      Alert.alert('Import fehlgeschlagen', e.message);
    }
    setImportLoading(false);
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    await createCollection(newCollectionName.trim());
    setNewCollectionName('');
    setCollectionModal(false);
  };

  const showFab = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Abbrechen', 'Manuell erstellen', 'Von URL importieren', 'KI-Rezepte', 'Neue Sammlung'], cancelButtonIndex: 0 },
      (i) => {
        if (i === 1) navigation.navigate('RecipeWizard', { recipe: null });
        if (i === 2) setUrlModal(true);
        if (i === 3) setKiModal(true);
        if (i === 4) setCollectionModal(true);
      }
    );
  };

  // --- Recipe Card ---
  const renderRecipeCard = ({ item, onAssign }) => {
    const coverUrl = item.image_path ? `${getBaseUrl()}${item.image_path}` : null;
    const missing = getMissingCount(item);
    return (
      <TouchableOpacity
        style={{
          backgroundColor: C.surface, borderRadius: R.lg,
          borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
          marginBottom: S.sm, overflow: 'hidden',
        }}
        onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
        activeOpacity={0.7}
      >
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={{ width: '100%', height: 140, resizeMode: 'cover' }} />
        ) : null}
        <View style={{ padding: S.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: S.sm }}>
            {!coverUrl && <MaterialCommunityIcons name="silverware-fork-knife" size={20} color={C.textSecondary} style={{ marginRight: S.sm }} />}
            <View style={{ flex: 1 }}>
              <Text style={[T.bodyMed, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
              {item.description ? (
                <Text style={[T.caption, { color: C.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center' }}>
              {!!item.is_ai_generated && (
                <View style={{ backgroundColor: C.tint + '18', borderRadius: R.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={[T.label, { color: C.tint }]}>KI</Text>
                </View>
              )}
              {missing === 0 && !!(item.ingredients?.length) && (
                <View style={{ backgroundColor: '#22C55E18', borderRadius: R.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={[T.label, { color: '#22C55E' }]}>✓</Text>
                </View>
              )}
              {missing > 0 && (
                <View style={{ backgroundColor: C.warning + '18', borderRadius: R.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={[T.label, { color: C.warning }]}>{`−${missing} fehlen`}</Text>
                </View>
              )}
              {onAssign && (
                <TouchableOpacity onPress={onAssign} hitSlop={8}>
                  <Feather name="folder-plus" size={15} color={C.accent} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => navigation.navigate('RecipeWizard', { recipe: item })} hitSlop={8}>
                <Feather name="edit-2" size={15} color={C.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Alert.alert('Löschen?', item.name, [
                  { text: 'Abbrechen', style: 'cancel' },
                  { text: 'Löschen', style: 'destructive', onPress: () => { deleteRecipe(item.id); fetchUnsorted(); } },
                ])}
                hitSlop={8}
              >
                <Feather name="trash-2" size={15} color={C.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
            {(getDisplayTime(item.prep_time) || item.active_time) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="clock" size={11} color={C.textTertiary} />
                <Text style={[T.caption, { color: C.textSecondary }]}>{getDisplayTime(item.prep_time) || item.active_time}</Text>
              </View>
            ) : null}
            {item.difficulty ? (
              <Text style={[T.caption, { color: C.textSecondary }]}>{item.difficulty}</Text>
            ) : null}
            {item.total_calories ? (
              <Text style={[T.caption, { color: C.textSecondary }]}>{`${Math.round(item.total_calories)} kcal`}</Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // --- Collection Card ---
  const renderCollectionCard = (item) => {
    if (item.isNew) {
      return (
        <TouchableOpacity
          key="new-collection"
          style={{
            flex: 1, margin: S.xs, backgroundColor: C.surface,
            borderRadius: R.lg, overflow: 'hidden',
            borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
          }}
          onPress={() => setCollectionModal(true)}
          activeOpacity={0.75}
        >
          <View style={{ height: 130, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgSecondary }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="plus" size={22} color={C.accent} />
            </View>
          </View>
          <View style={{ padding: 10 }}>
            <Text style={[T.bodyMed, { color: C.accent }]}>Neue Sammlung</Text>
            <Text style={[T.caption, { color: C.textTertiary }]}>Tippe zum Erstellen</Text>
          </View>
        </TouchableOpacity>
      );
    }

    const firstImg = item.preview?.[0]?.image_path ? `${getBaseUrl()}${item.preview[0].image_path}` : null;
    return (
      <TouchableOpacity
        key={item.id.toString()}
        style={{ flex: 1, margin: S.xs, backgroundColor: C.surface, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
        onPress={() => navigation.navigate('CollectionDetail', { collectionId: item.id, collectionName: item.name })}
        onLongPress={() => Alert.alert('Löschen?', item.name, [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Löschen', style: 'destructive', onPress: () => deleteCollection(item.id) },
        ])}
        activeOpacity={0.85}
      >
        <View style={{ flexDirection: 'row', height: 130 }}>
          <View style={{ flex: 2, backgroundColor: C.bgSecondary, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.border }}>
            {firstImg ? (
              <Image source={{ uri: firstImg }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={require('../../assets/icon.png')} style={{ width: 36, height: 36, opacity: 0.2 }} resizeMode="contain" />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            {[1, 2].map((idx) => {
              const preview = item.preview?.[idx];
              const imgUrl = preview?.image_path ? `${getBaseUrl()}${preview.image_path}` : null;
              return (
                <View key={idx} style={{
                  flex: 1, backgroundColor: C.bgSecondary,
                  borderTopWidth: idx === 2 ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: C.border,
                }}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Image source={require('../../assets/icon.png')} style={{ width: 18, height: 18, opacity: 0.2 }} resizeMode="contain" />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
        <View style={{ padding: 10 }}>
          <Text style={[T.bodyMed, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[T.caption, { color: C.textTertiary }]}>{`${item.count ?? 0} Rezepte`}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Build collections rows for 2-column grid
  const collectionItems = [...collections, { id: 'new', isNew: true }];
  const collectionRows = [];
  for (let i = 0; i < collectionItems.length; i += 2) {
    collectionRows.push(collectionItems.slice(i, i + 2));
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* KI Loading Overlay */}
      <Modal visible={aiLoading} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: S.md }}>
          <View style={{ backgroundColor: C.surface, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, minWidth: 200 }}>
            <ActivityIndicator size="large" color={C.tint} />
            <Text style={[T.bodyMed, { color: C.text, fontWeight: '600' }]}>KI erstellt Rezepte…</Text>
            <Text style={[T.caption, { color: C.textSecondary, textAlign: 'center' }]}>Das dauert kurz, bitte warten</Text>
          </View>
        </View>
      </Modal>

      {tabBar}

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: S.sm,
      }}>
        <Text style={[T.h2, { color: C.text, flex: 1 }]}>Rezepte</Text>
        <TouchableOpacity
          onPress={() => setFilterModal(true)}
          hitSlop={8}
          style={{
            width: 34, height: 34, borderRadius: 17,
            backgroundColor: activeFilterCount > 0 ? C.accent : C.bgSecondary,
            borderWidth: StyleSheet.hairlineWidth, borderColor: activeFilterCount > 0 ? C.accent : C.border,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Feather name="sliders" size={15} color={activeFilterCount > 0 ? C.accentText : C.textSecondary} />
          {activeFilterCount > 0 && (
            <View style={{
              position: 'absolute', top: -4, right: -4,
              width: 16, height: 16, borderRadius: 8,
              backgroundColor: C.accent, borderWidth: 2, borderColor: C.bg,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 9, color: C.accentText, fontWeight: '700' }}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Main Scroll */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: S.sm, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Sammlungen Section */}
        <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: S.xs, marginTop: S.xs, marginBottom: S.xs }]}>
          Sammlungen
        </Text>

        {collectionRows.map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: 'row' }}>
            {row.map(item => renderCollectionCard(item))}
            {/* Fill empty slot if odd number */}
            {row.length === 1 && <View style={{ flex: 1, margin: S.xs }} />}
          </View>
        ))}

        {/* Unsortiert Section */}
        {(filteredUnsorted.length > 0 || unsortedLoading) && (
          <View style={{ marginTop: S.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: S.xs, marginBottom: S.sm }}>
              <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 }]}>
                Unsortiert
              </Text>
              {unsortedLoading && <ActivityIndicator size="small" color={C.textTertiary} />}
              {!unsortedLoading && filteredUnsorted.length > 0 && (
                <Text style={[T.caption, { color: C.textTertiary }]}>{filteredUnsorted.length}</Text>
              )}
            </View>
            {filteredUnsorted.map(item => (
              <View key={item.id.toString()}>
                {renderRecipeCard({ item, onAssign: () => { setAssignRecipe(item); setAssignModal(true); } })}
              </View>
            ))}
          </View>
        )}

        {/* Empty state when no unsorted and no collections */}
        {!unsortedLoading && filteredUnsorted.length === 0 && collections.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 40, gap: S.sm }}>
            <Feather name="book-open" size={40} color={C.textTertiary} />
            <Text style={[T.h3, { color: C.textSecondary }]}>Noch keine Rezepte</Text>
            <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center', paddingHorizontal: S.xl }]}>
              Tippe auf + um ein Rezept zu erstellen oder KI-Vorschläge zu generieren
            </Text>
          </View>
        )}
      </ScrollView>

      {/* KI Vorschau Modal */}
      <Modal visible={previewModal} transparent animationType="slide" onRequestClose={() => !previewSaving && setPreviewModal(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          {/* Header */}
          <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Feather name="zap" size={18} color={C.accent} />
            <Text style={[T.h3, { color: C.text, flex: 1 }]}>KI-Vorschläge</Text>
            <Text style={[T.caption, { color: C.textTertiary }]}>
              {previewSuggestions.filter(s => s._kept).length} von {previewSuggestions.length} ausgewählt
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}>
            {previewSuggestions.map((s, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.85}
                onPress={() => setPreviewSuggestions(prev => prev.map((p, i) => i === idx ? { ...p, _kept: !p._kept } : p))}
                style={{
                  backgroundColor: s._kept ? C.surface : C.bgSecondary,
                  borderRadius: R.lg,
                  borderWidth: 2,
                  borderColor: s._kept ? C.accent : C.border,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  opacity: s._kept ? 1 : 0.5,
                }}
              >
                <MaterialCommunityIcons name="silverware-fork-knife" size={26} color={C.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.bodyMed, { color: C.text, marginBottom: 2 }]}>{s.name}</Text>
                  {(s.time || s.difficulty) ? (
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
                      {s.time ? <Text style={[T.caption, { color: C.textTertiary }]}>⏱ {s.time}</Text> : null}
                      {s.difficulty ? <Text style={[T.caption, { color: C.textTertiary }]}>{s.difficulty}</Text> : null}
                    </View>
                  ) : null}
                  {s._ings?.length > 0 && (
                    <Text style={[T.caption, { color: C.textSecondary }]} numberOfLines={2}>
                      {s._ings.slice(0, 5).map(i => i.name).join(', ')}{s._ings.length > 5 ? ` +${s._ings.length - 5}` : ''}
                    </Text>
                  )}
                </View>
                <View style={{
                  width: 26, height: 26, borderRadius: 13,
                  backgroundColor: s._kept ? C.accent : 'transparent',
                  borderWidth: 2, borderColor: s._kept ? C.accent : C.border,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {s._kept && <Feather name="check" size={14} color={C.accentText} />}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Bottom Bar */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 12, flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              disabled={previewSaving}
              onPress={() => setPreviewModal(false)}
              style={{ flex: 1, paddingVertical: 14, borderRadius: R.md, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center' }}
            >
              <Text style={[T.bodyMed, { color: C.textSecondary }]}>Verwerfen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={previewSaving || previewSuggestions.filter(s => s._kept).length === 0}
              onPress={savePreviewSuggestions}
              style={{ flex: 2, paddingVertical: 14, borderRadius: R.md, backgroundColor: C.accent, alignItems: 'center', opacity: previewSuggestions.filter(s => s._kept).length === 0 ? 0.4 : 1 }}
            >
              {previewSaving
                ? <ActivityIndicator color={C.accentText} />
                : <Text style={[T.bodyMed, { color: C.accentText }]}>
                    {previewSuggestions.filter(s => s._kept).length === previewSuggestions.length
                      ? 'Alle übernehmen'
                      : `${previewSuggestions.filter(s => s._kept).length} übernehmen`}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Zu Sammlung Modal */}
      <Modal visible={assignModal} transparent animationType="slide" onRequestClose={() => setAssignModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setAssignModal(false)} />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16, maxHeight: '60%' }}>
          <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
            <Feather name="folder-plus" size={16} color={C.accent} style={{ marginRight: 8 }} />
            <Text style={[T.bodyMed, { color: C.text, flex: 1 }]} numberOfLines={1}>
              {assignRecipe?.name || 'Zu Sammlung'}
            </Text>
            <TouchableOpacity onPress={() => setAssignModal(false)} hitSlop={10}>
              <Feather name="x" size={18} color={C.textTertiary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {collections.length === 0 ? (
              <Text style={[T.caption, { color: C.textSecondary, textAlign: 'center', paddingVertical: 20 }]}>
                Noch keine Sammlungen. Erstelle zuerst eine Sammlung.
              </Text>
            ) : (
              collections.map(col => (
                <TouchableOpacity
                  key={col.id}
                  disabled={assignLoading}
                  onPress={async () => {
                    setAssignLoading(true);
                    try {
                      await addToCollection(col.id, assignRecipe.id);
                      setAssignModal(false);
                      fetchUnsorted();
                    } catch (e) { Alert.alert('Fehler', e.message); }
                    setAssignLoading(false);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: C.surface, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, gap: 12 }}
                >
                  <Feather name="folder" size={18} color={C.accent} />
                  <Text style={[T.body, { color: C.text, flex: 1 }]}>{col.name}</Text>
                  {assignLoading ? <ActivityIndicator size="small" color={C.accent} /> : <Feather name="chevron-right" size={16} color={C.textTertiary} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal visible={filterModal} transparent animationType="slide" onRequestClose={() => setFilterModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setFilterModal(false)} />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16, maxHeight: '80%' }}>
          <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
            <Text style={[T.bodyMed, { color: C.text, flex: 1 }]}>Filter</Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={() => { setFilterMealType(null); setFilterCategory(null); setFilterMaxTime(null); }} hitSlop={10}>
                <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600', marginRight: 12 }}>Zurücksetzen</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setFilterModal(false)} hitSlop={10}>
              <Feather name="x" size={18} color={C.textTertiary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 20 }}>
            <View>
              <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }]}>Art der Mahlzeit</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['Hauptspeise', 'Frühstück', 'Kleine Mahlzeit', 'Abendbrot', 'Snack', 'Beilage', 'Aufstrich/Dip', 'Dessert', 'Gebäck'].map(m => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setFilterMealType(filterMealType === m ? null : m)}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: filterMealType === m ? C.accent : C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: filterMealType === m ? C.accent : C.border }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '500', color: filterMealType === m ? C.accentText : C.text }}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }]}>Kategorie</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['Pasta', 'Curry', 'Burger', 'Auflauf', 'Suppe/Eintopf', 'Salat', 'Pizza', 'Reis', 'Pfannengericht', 'Fisch', 'Geflügel', 'Rindfleisch', 'Schweinefleisch', 'Eier/Omelette', 'Sandwich/Wrap', 'Bowl', 'Tarte/Quiche', 'Süßspeise', 'Anderes'].map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setFilterCategory(filterCategory === c ? null : c)}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: filterCategory === c ? C.accent : C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: filterCategory === c ? C.accent : C.border }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '500', color: filterCategory === c ? C.accentText : C.text }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }]}>Zubereitungszeit</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[{ label: '≤ 15 Min', value: 15 }, { label: '≤ 30 Min', value: 30 }, { label: '≤ 60 Min', value: 60 }].map(t => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setFilterMaxTime(filterMaxTime === t.value ? null : t.value)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: filterMaxTime === t.value ? C.accent : C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: filterMaxTime === t.value ? C.accent : C.border }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '500', color: filterMaxTime === t.value ? C.accentText : C.text }}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <TouchableOpacity
              onPress={() => setFilterModal(false)}
              style={{ backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>
                {activeFilterCount > 0 ? `${filteredUnsorted.length} Rezepte anzeigen` : 'Fertig'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Neue Sammlung Modal */}
      <Modal visible={collectionModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { setCollectionModal(false); setNewCollectionName(''); }} />
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: S.lg, paddingBottom: insets.bottom + S.lg }}>
            <Text style={[T.h3, { color: C.text, marginBottom: S.md }]}>Neue Sammlung</Text>
            <TextInput
              style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 12, color: C.text, fontSize: 16, marginBottom: S.md }}
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              placeholder="z.B. Lieblingsrezepte, Schnell & einfach…"
              placeholderTextColor={C.textTertiary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateCollection}
            />
            <TouchableOpacity
              onPress={handleCreateCollection}
              disabled={!newCollectionName.trim()}
              style={{ backgroundColor: newCollectionName.trim() ? C.accent : C.bgSecondary, borderRadius: R.md, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={[T.bodyMed, { color: newCollectionName.trim() ? C.accentText : C.textTertiary, fontWeight: '700' }]}>Erstellen</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* URL Import Modal */}
      <Modal visible={urlModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { setUrlModal(false); setImportUrl(''); }} />
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: S.lg, paddingBottom: insets.bottom + S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <Text style={[T.h3, { color: C.text, marginBottom: 4 }]}>Rezept importieren</Text>
            <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.md }]}>
              Füge eine URL ein — z.B. von Chefkoch, Lecker, AllRecipes oder einem Blog. Bilder werden automatisch übernommen.
            </Text>
            <TextInput
              style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 12, color: C.text, fontSize: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.md }}
              value={importUrl}
              onChangeText={setImportUrl}
              placeholder="https://www.chefkoch.de/rezepte/..."
              placeholderTextColor={C.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleImportUrl}
            />
            <TouchableOpacity
              onPress={handleImportUrl}
              disabled={!importUrl.trim() || importLoading}
              style={{ backgroundColor: importUrl.trim() ? C.accent : C.bgSecondary, borderRadius: R.md, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm }}
            >
              {importLoading
                ? <ActivityIndicator size="small" color={C.accentText} />
                : <Feather name="download" size={16} color={importUrl.trim() ? C.accentText : C.textTertiary} />
              }
              <Text style={[T.bodyMed, { color: importUrl.trim() ? C.accentText : C.textTertiary, fontWeight: '700' }]}>
                {importLoading ? 'Importiere…' : 'Rezept importieren'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* KI Modal */}
      <Modal visible={kiModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setKiModal(false)} />
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: S.lg, paddingBottom: insets.bottom + S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <Text style={[T.h3, { color: C.text, marginBottom: S.md }]}>KI-Rezepte erstellen</Text>
            <Text style={[T.label, { color: C.textSecondary, marginBottom: 6 }]}>WORAUF HAST DU LUST?</Text>
            <TextInput
              style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 10, color: C.text, fontSize: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.md }}
              value={wish}
              onChangeText={setWish}
              placeholder="z.B. schnell, vegetarisch, Pasta, Suppe…"
              placeholderTextColor={C.textTertiary}
              returnKeyType="done"
            />
            <Text style={[T.label, { color: C.textSecondary, marginBottom: 8 }]}>ANZAHL REZEPTE</Text>
            <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
              {[1, 2, 3, 4, 5, 6].map(n => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setRecipeCount(n)}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: R.md, alignItems: 'center', backgroundColor: recipeCount === n ? C.accent : C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: recipeCount === n ? C.accent : C.border }}
                >
                  <Text style={{ color: recipeCount === n ? C.accentText : C.text, fontWeight: '700' }}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[T.label, { color: C.textSecondary, marginBottom: 8 }]}>INVENTAR</Text>
            <View style={{ flexDirection: 'row', gap: S.xs, marginBottom: S.md }}>
              {[
                { value: 'suggest', label: 'Als Inspiration' },
                { value: 'only', label: 'Nur Inventar' },
                { value: 'free', label: 'Ignorieren' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setInventoryMode(opt.value)}
                  style={{
                    flex: 1, paddingVertical: 9, borderRadius: R.md, alignItems: 'center',
                    backgroundColor: inventoryMode === opt.value ? C.accent : C.bgSecondary,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: inventoryMode === opt.value ? C.accent : C.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: inventoryMode === opt.value ? C.accentText : C.text, textAlign: 'center' }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {inventoryMode !== 'free' && (
              <Text style={[T.caption, { color: C.textTertiary, marginBottom: S.md }]}>
                {inventory.filter(i => !i.mhd || i.mhd >= new Date().toISOString().split('T')[0]).length} frische Zutaten verfügbar
              </Text>
            )}
            <TouchableOpacity
              onPress={loadAiSuggestions}
              style={{ backgroundColor: C.accent, borderRadius: R.md, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm }}
            >
              <Feather name="cpu" size={16} color={C.accentText} />
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>{recipeCount} Rezepte erstellen</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* FAB */}
      <TouchableOpacity
        onPress={showFab}
        activeOpacity={0.85}
        style={{
          position: 'absolute', bottom: insets.bottom + 80, right: 20,
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
        }}
      >
        <Feather name="plus" size={24} color={C.accentText} />
      </TouchableOpacity>
    </View>
  );
}
