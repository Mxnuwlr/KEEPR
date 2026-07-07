/**
 * screens/ShoppingListScreen.js — Einkaufsliste
 *
 * - Artikel nach Kategorie gruppiert mit Emoji-Header
 * - Menge + Einheit pro Artikel
 * - "KI sortieren" Button: Gemini normalisiert Mengen + kategorisiert alles
 * - Manuell Artikel hinzufügen
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';

import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../theme';
import { api, normalizeShoppingList } from '../api/client';
import { useStore } from '../store';
import { categorizeItem } from '../utils/categorize';

// ── Kategorie-Konfiguration ──────────────────────────────────────────────────

const CATEGORY_ORDER = [
  'Obst & Gemüse',
  'Milch & Eier',
  'Fleisch & Fisch',
  'Brot & Backwaren',
  'Tiefkühl',
  'Getränke',
  'Konserven & Trockenware',
  'Gewürze & Öle',
  'Sonstiges',
];

const CATEGORY_ICON = {
  'Obst & Gemüse': 'food-apple',
  'Milch & Eier': 'cup',
  'Fleisch & Fisch': 'food-steak',
  'Brot & Backwaren': 'bread-slice',
  'Tiefkühl': 'snowflake',
  'Getränke': 'bottle-soda',
  'Konserven & Trockenware': 'food-variant',
  'Gewürze & Öle': 'bottle-tonic',
  'Sonstiges': 'cart',
};

// ── Helper ───────────────────────────────────────────────────────────────────

function formatAmount(item) {
  if (item.amount && item.unit) return `${item.amount} ${item.unit}`;
  if (item.amount) return String(item.amount);
  if (item.unit) return item.unit;
  return null;
}

// ── ShoppingItem Component ───────────────────────────────────────────────────

function ShoppingItem({ item, onToggle, onDelete }) {
  const { colors: C, spacing: S, type: T } = useTheme();
  const amountText = formatAmount(item);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 11, gap: S.sm }}>
      <TouchableOpacity onPress={() => onToggle(item)} hitSlop={8}>
        <View style={{
          width: 22, height: 22, borderRadius: 11,
          borderWidth: 2,
          borderColor: item.checked ? C.success : C.border,
          backgroundColor: item.checked ? C.success : 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {!!item.checked && <Feather name="check" size={12} color="#fff" />}
        </View>
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <Text style={[T.body, { color: item.checked ? C.textTertiary : C.text, textDecorationLine: item.checked ? 'line-through' : 'none' }]}>
          {item.name}
        </Text>
        {amountText && (
          <Text style={[T.caption, { color: C.textTertiary }]}>{amountText}</Text>
        )}
      </View>

      <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={8}>
        <Feather name="x" size={16} color={C.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ShoppingListScreen({ navigation, tabBar }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { geminiKey } = useStore();

  const [shoppingList, setShoppingList] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [normalizing, setNormalizing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getShoppingList();
      setShoppingList(data || []);
    } catch (e) {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const addItem = async () => {
    const name = newItem.trim();
    if (!name) return;
    setAdding(true);
    try {
      const category = categorizeItem(name);
      const item = await api.addShoppingItem({ name, amount: newAmount.trim() || null, category });
      setShoppingList(prev => [item, ...prev]);
      setNewItem('');
      setNewAmount('');
      setShowAddRow(false);
    } catch (e) {
      const category = categorizeItem(name);
      setShoppingList(prev => [{ id: Date.now(), name, amount: newAmount.trim() || null, category, checked: false }, ...prev]);
      setNewItem('');
      setNewAmount('');
      setShowAddRow(false);
    }
    setAdding(false);
  };

  const toggleItem = async (item) => {
    setShoppingList(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
    try { await api.toggleShoppingItem(item.id, !item.checked); } catch (e) {}
  };

  const deleteItem = async (id) => {
    setShoppingList(prev => prev.filter(i => i.id !== id));
    try { await api.deleteShoppingItem(id); } catch (e) {}
  };

  const clearChecked = () => {
    Alert.alert(
      'Erledigte löschen?',
      'Alle abgehakten Einträge werden entfernt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: async () => {
          setShoppingList(prev => prev.filter(i => !i.checked));
          try { await api.clearCheckedItems(); } catch (e) {}
        }},
      ]
    );
  };

  const handleNormalize = async () => {
    if (!geminiKey) return Alert.alert('KI nicht verfügbar', 'Kein Gemini API-Key konfiguriert.');
    const uncheckedItems = shoppingList.filter(i => !i.checked);
    if (uncheckedItems.length === 0) return Alert.alert('Liste leer', 'Keine offenen Artikel zum Sortieren.');
    setNormalizing(true);
    try {
      const normalized = await normalizeShoppingList(uncheckedItems, geminiKey);
      if (!Array.isArray(normalized)) throw new Error('Ungültige KI-Antwort');

      // Merge normalized data back into local state
      const updatedList = shoppingList.map(item => {
        const n = normalized.find(x => x.id === item.id);
        if (!n) return item;
        return { ...item, name: n.name || item.name, amount: n.amount ?? item.amount, unit: n.unit || item.unit, category: n.category || item.category };
      });
      setShoppingList(updatedList);

      // Batch-update backend
      const batchItems = updatedList.filter(i => !i.checked).map(i => ({
        id: i.id, name: i.name, amount: i.amount, unit: i.unit, category: i.category,
      }));
      await api.batchUpdateShoppingItems(batchItems);
    } catch (e) {
      Alert.alert('Fehler', e.message);
    }
    setNormalizing(false);
  };

  // Group unchecked items by category
  const { grouped, checked } = useMemo(() => {
    const unchecked = shoppingList.filter(i => !i.checked);
    const chk = shoppingList.filter(i => !!i.checked);

    const groups = {};
    for (const item of unchecked) {
      const cat = item.category || categorizeItem(item.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }

    // Sort by CATEGORY_ORDER
    const sorted = CATEGORY_ORDER
      .filter(c => groups[c])
      .map(c => ({ category: c, items: groups[c] }));

    // Any unknown categories at the end
    for (const cat of Object.keys(groups)) {
      if (!CATEGORY_ORDER.includes(cat)) {
        sorted.push({ category: cat, items: groups[cat] });
      }
    }

    return { grouped: sorted, checked: chk };
  }, [shoppingList]);

  const uncheckedCount = shoppingList.filter(i => !i.checked).length;
  const hasCategories = grouped.some(g => g.category !== 'Sonstiges') ||
    grouped.some(g => g.items.some(i => i.category));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {tabBar}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.textSecondary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textSecondary} />}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
            <Text style={[T.h3, { color: C.text, flex: 1 }]}>
              Einkaufsliste
              {uncheckedCount > 0 && (
                <Text style={{ color: C.textTertiary, fontWeight: '400', fontSize: 16 }}> ({uncheckedCount})</Text>
              )}
            </Text>
            {/* KI sortieren Button */}
            {uncheckedCount > 0 && (
              <TouchableOpacity
                onPress={handleNormalize}
                disabled={normalizing}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: C.tint + '18', borderRadius: R.full,
                  paddingHorizontal: 12, paddingVertical: 6,
                  marginRight: checked.length > 0 ? S.sm : 0,
                }}
              >
                {normalizing
                  ? <ActivityIndicator size="small" color={C.tint} />
                  : <Feather name="cpu" size={13} color={C.tint} />
                }
                <Text style={[T.label, { color: C.tint }]}>
                  {normalizing ? 'KI…' : 'Mengen anpassen'}
                </Text>
              </TouchableOpacity>
            )}
            {checked.length > 0 && (
              <TouchableOpacity onPress={clearChecked} hitSlop={8}>
                <Text style={[T.caption, { color: C.danger }]}>Erledigte löschen</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Add item form */}
          {showAddRow ? (
            <View style={{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: S.md, marginBottom: S.sm, gap: S.sm }}>
              <TextInput
                style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 10, color: C.text, fontSize: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                placeholder="Artikel eingeben…"
                placeholderTextColor={C.textTertiary}
                value={newItem}
                onChangeText={setNewItem}
                autoFocus
                returnKeyType="next"
                onSubmitEditing={addItem}
              />
              <TextInput
                style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 10, color: C.text, fontSize: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                placeholder="Menge (optional, z.B. 500g, 2 Stück)"
                placeholderTextColor={C.textTertiary}
                value={newAmount}
                onChangeText={setNewAmount}
                returnKeyType="done"
                onSubmitEditing={addItem}
              />
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <TouchableOpacity
                  onPress={() => { setShowAddRow(false); setNewItem(''); setNewAmount(''); }}
                  style={{ flex: 1, borderRadius: R.md, paddingVertical: 10, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                >
                  <Text style={[T.body, { color: C.textSecondary }]}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={addItem}
                  disabled={!newItem.trim() || adding}
                  style={{ flex: 2, borderRadius: R.md, paddingVertical: 10, alignItems: 'center', backgroundColor: newItem.trim() ? C.accent : C.bgSecondary, flexDirection: 'row', justifyContent: 'center', gap: S.xs }}
                >
                  {adding && <ActivityIndicator size="small" color={C.accentText} />}
                  <Text style={[T.body, { color: newItem.trim() ? C.accentText : C.textTertiary, fontWeight: '600' }]}>Hinzufügen</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowAddRow(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingHorizontal: S.md, paddingVertical: 14, marginBottom: S.sm }}
            >
              <Feather name="plus-circle" size={18} color={C.accent} />
              <Text style={[T.body, { color: C.accent }]}>Artikel hinzufügen</Text>
            </TouchableOpacity>
          )}

          {/* Grouped unchecked items */}
          {grouped.map(({ category, items }) => (
            <View key={category} style={{ marginBottom: S.sm }}>
              {/* Category header — only show if there's more than one category or items have been categorized */}
              {(grouped.length > 1 || hasCategories) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, marginLeft: 2 }}>
                  <MaterialCommunityIcons name={CATEGORY_ICON[category] || 'cart'} size={14} color={C.textSecondary} />
                  <Text style={[T.label, { color: C.textSecondary }]}>{category}</Text>
                </View>
              )}
              <View style={{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' }}>
                {items.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    {idx > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: S.md }} />}
                    <ShoppingItem item={item} onToggle={toggleItem} onDelete={deleteItem} />
                  </React.Fragment>
                ))}
              </View>
            </View>
          ))}

          {/* Checked items */}
          {checked.length > 0 && (
            <>
              <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: S.xs }]}>Erledigt</Text>
              <View style={{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' }}>
                {checked.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    {idx > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: S.md }} />}
                    <ShoppingItem item={item} onToggle={toggleItem} onDelete={deleteItem} />
                  </React.Fragment>
                ))}
              </View>
            </>
          )}

          {/* Empty state */}
          {shoppingList.length === 0 && !showAddRow && (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Feather name="shopping-cart" size={40} color={C.textTertiary} style={{ marginBottom: S.md }} />
              <Text style={[T.h3, { color: C.text, marginBottom: S.xs }]}>Liste ist leer</Text>
              <Text style={[T.caption, { color: C.textSecondary, textAlign: 'center' }]}>
                Füge Artikel hinzu oder lass die KI fehlende Zutaten aus deinem Ernährungsplan eintragen.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
