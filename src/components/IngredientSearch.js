/**
 * IngredientSearch.js
 *
 * Modal zum Suchen und Auswählen von Zutaten aus der Datenbank.
 * Zeigt Foto + Name in einem Grid, bei Auswahl öffnet sich ein
 * Bottom Sheet für Menge + Einheit.
 *
 * Props:
 *   visible      boolean
 *   onClose      () => void
 *   onSelect     (ingredient) => void
 *                ingredient = { id, name, slug, category, image_url, amount, unit }
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  FlatList, Image, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { api } from '../api/client';

const UNITS = ['g', 'kg', 'ml', 'L', 'Stk.', 'EL', 'TL', 'Bund', 'Prise', 'n.B.'];

export default function IngredientSearch({ visible, onClose, onSelect }) {
  const { colors: C } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // ingredient being configured
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('g');

  // Search
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, visible]);

  useEffect(() => {
    if (visible) doSearch('');
  }, [visible]);

  const doSearch = useCallback(async (q) => {
    setLoading(true);
    try {
      const data = await api.searchIngredients(q);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelect = (ing) => {
    setSelected(ing);
    setAmount('');
    setUnit('g');
  };

  const handleConfirm = () => {
    if (!selected) return;
    onSelect({ ...selected, amount: amount || '1', unit });
    setSelected(null);
    setQuery('');
    onClose();
  };

  const handleClose = () => {
    setSelected(null);
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <Text style={[styles.headerTitle, { color: C.text }]}>Zutat hinzufügen</Text>
          <TouchableOpacity onPress={handleClose}>
            <Feather name="x" size={22} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        {!selected ? (
          <>
            {/* Search */}
            <View style={[styles.searchRow, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Feather name="search" size={16} color={C.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: C.text }]}
                placeholder="Zutat suchen..."
                placeholderTextColor={C.textTertiary}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Feather name="x-circle" size={16} color={C.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />
            ) : (
              <FlatList
                data={results}
                numColumns={3}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={styles.grid}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.card, { backgroundColor: C.surface }]} onPress={() => handleSelect(item)}>
                    <View style={styles.cardImageWrap}>
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.cardImage}
                        defaultSource={require('../../assets/icon.png')}
                      />
                    </View>
                    <Text style={[styles.cardName, { color: C.text }]} numberOfLines={2}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={[styles.empty, { color: C.textTertiary }]}>Keine Zutaten gefunden</Text>
                }
              />
            )}

            {/* Freitext-Fallback */}
            {query.length > 1 && results.length === 0 && !loading && (
              <TouchableOpacity
                style={[styles.freetext, { backgroundColor: C.accent }]}
                onPress={() => handleSelect({ id: null, name: query, slug: null, image_url: null })}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.freetextLabel}>"{query}" als Freitext hinzufügen</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          /* Menge + Einheit konfigurieren */
          <ScrollView contentContainerStyle={styles.config}>
            {selected.image_url && (
              <Image source={{ uri: selected.image_url }} style={styles.configImage} />
            )}
            <Text style={[styles.configName, { color: C.text }]}>{selected.name}</Text>

            <Text style={[styles.label, { color: C.textSecondary }]}>Menge</Text>
            <View style={[styles.amountRow, { borderColor: C.border }]}>
              <TouchableOpacity onPress={() => setAmount(a => String(Math.max(0, (parseFloat(a) || 0) - 1)))}>
                <Feather name="minus" size={20} color={C.accent} />
              </TouchableOpacity>
              <TextInput
                style={[styles.amountInput, { color: C.text }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="100"
                placeholderTextColor={C.textTertiary}
              />
              <TouchableOpacity onPress={() => setAmount(a => String((parseFloat(a) || 0) + 1))}>
                <Feather name="plus" size={20} color={C.accent} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: C.textSecondary }]}>Einheit</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              <View style={styles.unitRow}>
                {UNITS.map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitPill, { borderColor: C.border, backgroundColor: unit === u ? C.accent : C.surface }]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.unitLabel, { color: unit === u ? '#fff' : C.text }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: C.accent }]} onPress={handleConfirm}>
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.confirmLabel}>Hinzufügen</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={() => setSelected(null)}>
              <Text style={{ color: C.textSecondary, fontSize: 14 }}>← Zurück zur Suche</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  grid: { padding: 8 },
  card: { flex: 1, margin: 4, borderRadius: 12, padding: 8, alignItems: 'center', maxWidth: '33%' },
  cardImageWrap: { width: 72, height: 72, borderRadius: 8, marginBottom: 6, backgroundColor: '#fff', overflow: 'hidden' },
  cardImage: { width: 72, height: 72, resizeMode: 'contain' },
  cardName: { fontSize: 11, textAlign: 'center', fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  freetext: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, padding: 14, borderRadius: 12 },
  freetextLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  config: { padding: 24, alignItems: 'center' },
  configImage: { width: 120, height: 120, borderRadius: 16, resizeMode: 'contain', marginBottom: 12 },
  configName: { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  label: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 20, width: '100%', justifyContent: 'space-between' },
  amountInput: { fontSize: 24, fontWeight: '700', textAlign: 'center', minWidth: 60 },
  unitRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  unitPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  unitLabel: { fontSize: 14, fontWeight: '500' },
  confirmBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, marginTop: 8 },
  confirmLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
