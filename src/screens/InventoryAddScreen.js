/**
 * screens/InventoryAddScreen.js — Artikel hinzufügen / bearbeiten
 *
 * Formular zum Anlegen oder Bearbeiten eines Inventar-Artikels.
 * Wird mit route.params.item für Bearbeitung aufgerufen (item === undefined → Neu).
 *
 * CATEGORIES — Auswahlmöglichkeiten für Kategorie
 * UNITS — Auswahlmöglichkeiten für Einheit (Stück, g, kg, ml …)
 *
 * Speichert via addItem() oder updateItem() aus useStore().
 */

// React/RN
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';

// Third-party
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';

const CATEGORIES = ['Milchprodukte','Fleisch','Fisch','Gemüse','Obst','Brot','Getreide','Konserven','Tiefkühl','Gewürze','Süßes','Sonstiges'];
const UNITS = ['Stück','g','kg','ml','L','Packung','Dose','Flasche','Beutel','Tüte'];

export default function InventoryAddScreen({ route, navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { item } = route.params || {};
  const { addItem, updateItem } = useStore();
  const [form, setForm] = useState({
    name: item?.name || '',
    mhd: item?.mhd || '',
    qtyNum: item ? (item.qty?.split(' ')[0] || '1') : '1',
    qtyUnit: item ? (item.qty?.split(' ').slice(1).join(' ') || 'Stück') : 'Stück',
    category: item?.category || 'Sonstiges',
    caloriesPer100g: (item?.calories_per_100g ?? item?.caloriesPer100g)?.toString() || '',
    proteinPer100g: (item?.protein_per_100g ?? item?.proteinPer100g)?.toString() || '',
    carbsPer100g: (item?.carbs_per_100g ?? item?.carbsPer100g)?.toString() || '',
    fatPer100g: (item?.fat_per_100g ?? item?.fatPer100g)?.toString() || '',
  });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Bitte Namen eingeben');
    try {
      const data = {
        name: form.name,
        mhd: form.mhd,
        qty: `${form.qtyNum} ${form.qtyUnit}`,
        category: form.category,
        caloriesPer100g: parseFloat(form.caloriesPer100g) || null,
        proteinPer100g: parseFloat(form.proteinPer100g) || null,
        carbsPer100g: parseFloat(form.carbsPer100g) || null,
        fatPer100g: parseFloat(form.fatPer100g) || null,
      };
      if (item?.id) await updateItem(item.id, data);
      else await addItem(data);
      if (route.params?.onSaved) route.params.onSaved();
      navigation.goBack();
    } catch(e) { Alert.alert('Fehler', e.message); }
  };

  const inputStyle = {
    backgroundColor: C.bgSecondary, borderRadius: R.md, color: C.text,
    fontSize: 15, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
  };
  const labelStyle = [T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }];
  const divider = <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 0 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.md, paddingTop: 60, paddingBottom: S.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[T.body, { color: C.textSecondary }]}>Abbrechen</Text>
        </TouchableOpacity>
        <Text style={[T.bodyMed, { color: C.text }]}>{item?.id ? 'Bearbeiten' : 'Hinzufügen'}</Text>
        <TouchableOpacity onPress={save}>
          <Text style={[T.bodyMed, { color: C.tint }]}>Speichern</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">

        {/* Name */}
        <Text style={labelStyle}>Name *</Text>
        <TextInput
          style={[inputStyle, { marginBottom: S.md }]}
          value={form.name}
          onChangeText={v => setForm(f => ({ ...f, name: v }))}
          placeholder="z.B. Vollmilch"
          placeholderTextColor={C.textTertiary}
          autoFocus
        />

        {/* MHD */}
        <Text style={labelStyle}>Mindesthaltbarkeitsdatum</Text>
        <TouchableOpacity
          style={[inputStyle, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: showCalendar ? 0 : S.md }]}
          onPress={() => setShowCalendar(!showCalendar)}
        >
          <Text style={{ color: form.mhd ? C.text : C.textTertiary, fontSize: 15 }}>
            {form.mhd ? new Date(form.mhd + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Datum auswählen'}
          </Text>
          <Feather name={showCalendar ? 'chevron-up' : 'calendar'} size={18} color={C.tint} />
        </TouchableOpacity>
        {showCalendar && (
          <View style={{ marginBottom: S.md, backgroundColor: C.bg, borderRadius: R.md, overflow: 'hidden' }}>
            <DateTimePicker
              value={form.mhd ? new Date(form.mhd + 'T12:00:00') : new Date()}
              mode="date"
              display="inline"
              minimumDate={new Date()}
              locale="de-DE"
              accentColor={C.tint}
              style={{ backgroundColor: C.bg }}
              onChange={(event, date) => {
                if (date) {
                  setForm(f => ({ ...f, mhd: date.toISOString().split('T')[0] }));
                  setShowCalendar(false);
                }
              }}
            />
          </View>
        )}

        {/* Menge */}
        <Text style={labelStyle}>Menge</Text>
        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
          <TextInput
            style={[inputStyle, { flex: 1 }]}
            value={form.qtyNum}
            onChangeText={v => setForm(f => ({ ...f, qtyNum: v }))}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor={C.textTertiary}
          />
          <TouchableOpacity
            style={[inputStyle, { flex: 1.5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
            onPress={() => setShowUnitPicker(!showUnitPicker)}
          >
            <Text style={{ color: C.text, fontSize: 15 }}>{form.qtyUnit}</Text>
            <Feather name={showUnitPicker ? 'chevron-up' : 'chevron-down'} size={16} color={C.textSecondary} />
          </TouchableOpacity>
        </View>
        {showUnitPicker && (
          <View style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' }}>
            {UNITS.map((u, i) => (
              <TouchableOpacity
                key={u}
                style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }, i < UNITS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}
                onPress={() => { setForm(f => ({ ...f, qtyUnit: u })); setShowUnitPicker(false); }}
              >
                <Text style={{ color: form.qtyUnit === u ? C.tint : C.text, fontSize: 15 }}>{u}</Text>
                {form.qtyUnit === u && <Feather name="check" size={16} color={C.tint} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Kategorie */}
        <Text style={labelStyle}>Kategorie</Text>
        <TouchableOpacity
          style={[inputStyle, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }]}
          onPress={() => setShowCategoryPicker(!showCategoryPicker)}
        >
          <Text style={{ color: C.text, fontSize: 15 }}>{form.category}</Text>
          <Feather name={showCategoryPicker ? 'chevron-up' : 'chevron-down'} size={16} color={C.textSecondary} />
        </TouchableOpacity>
        {showCategoryPicker && (
          <View style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' }}>
            {CATEGORIES.map((cat, i) => (
              <TouchableOpacity
                key={cat}
                style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }, i < CATEGORIES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}
                onPress={() => { setForm(f => ({ ...f, category: cat })); setShowCategoryPicker(false); }}
              >
                <Text style={{ color: form.category === cat ? C.tint : C.text, fontSize: 15 }}>{cat}</Text>
                {form.category === cat && <Feather name="check" size={16} color={C.tint} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Nährwerte */}
        <Text style={labelStyle}>Nährwerte pro 100g (optional)</Text>
        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.xl }}>
          {[['caloriesPer100g','kcal'],['proteinPer100g','P'],['carbsPer100g','K'],['fatPer100g','F']].map(([key, label]) => (
            <View key={key} style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: C.textSecondary, marginBottom: 4, textAlign: 'center' }}>{label}</Text>
              <TextInput
                style={[inputStyle, { textAlign: 'center', paddingHorizontal: 4, paddingVertical: 10 }]}
                value={form[key]}
                onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={C.textTertiary}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={{ backgroundColor: C.accent, borderRadius: R.md, padding: 16, alignItems: 'center' }}
          onPress={save}
        >
          <Text style={[T.bodyMed, { color: C.accentText }]}>Speichern</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
