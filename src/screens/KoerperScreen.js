import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { api } from '../api/client';

function Field({ label, value, onSave, placeholder, unit, numeric }) {
  const { colors: C, type: T, radius: R } = useTheme();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value?.toString() || '');
  const save = () => { setEditing(false); if (val !== value?.toString()) onSave(val); };
  if (!editing) return (
    <TouchableOpacity
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}
      onPress={() => setEditing(true)}
    >
      <Text style={[T.body, { color: C.textSecondary }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={[T.body, { color: val ? C.text : C.textTertiary }]}>{val ? `${val}${unit ? ` ${unit}` : ''}` : placeholder || '–'}</Text>
        <Feather name="edit-2" size={12} color={C.textTertiary} />
      </View>
    </TouchableOpacity>
  );
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
      <Text style={[T.body, { color: C.textSecondary }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          style={{ backgroundColor: C.bgTertiary, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6, color: C.text, fontSize: 15, minWidth: 80, textAlign: 'right', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
          value={val} onChangeText={setVal} autoFocus keyboardType={numeric ? 'decimal-pad' : 'default'}
          onBlur={save} onSubmitEditing={save}
        />
        {unit && <Text style={[T.caption, { color: C.textSecondary }]}>{unit}</Text>}
        <TouchableOpacity onPress={save}><Feather name="check-circle" size={20} color={C.tint} /></TouchableOpacity>
      </View>
    </View>
  );
}

export default function KoerperScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { user, updateProfile } = useStore();
  const [weightHistory, setWeightHistory] = useState([]);
  const [logWeight, setLogWeight] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const data = await api.getWeightHistory?.();
      if (Array.isArray(data)) setWeightHistory(data.slice(-14));
    } catch(e) {}
  };

  const save = async (updates) => {
    try { await updateProfile({ ...user, ...updates }); } catch(e) { Alert.alert('Fehler', e.message); }
  };

  const addWeightEntry = async () => {
    const w = parseFloat(logWeight.replace(',', '.'));
    if (!w || w < 20 || w > 300) return Alert.alert('Ungültiger Wert');
    setLogging(true);
    try {
      await api.logWeight?.({ weight: w, date: new Date().toISOString().split('T')[0] });
      await save({ weight: w });
      setLogWeight('');
      await loadHistory();
      Alert.alert('Gespeichert', `${w} kg eingetragen.`);
    } catch(e) { Alert.alert('Fehler', e.message); }
    setLogging(false);
  };

  // BMI calculation
  const bmi = user?.weight && user?.height
    ? (user.weight / ((user.height / 100) ** 2)).toFixed(1)
    : null;
  const bmiCategory = bmi
    ? bmi < 18.5 ? 'Untergewicht' : bmi < 25 ? 'Normalgewicht' : bmi < 30 ? 'Übergewicht' : 'Adipositas'
    : null;
  const bmiColor = bmi
    ? bmi < 18.5 ? C.warning : bmi < 25 ? C.success : bmi < 30 ? C.warning : C.danger
    : C.textSecondary;

  const divider = <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 16 }} />;
  const sectionLabel = (t) => (
    <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: S.md, paddingTop: S.lg, paddingBottom: 6 }]}>{t}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bgSecondary }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingTop: 60, paddingBottom: S.md, backgroundColor: C.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.h3, { color: C.text }]}>Körper & Gesundheit</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

        {/* BMI Card */}
        {bmi && (
          <>
            {sectionLabel('Körperindex')}
            <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[T.label, { color: C.textTertiary, marginBottom: 4 }]}>BMI</Text>
                <Text style={{ color: bmiColor, fontSize: 36, fontWeight: '800' }}>{bmi}</Text>
                <Text style={[T.caption, { color: bmiColor, marginTop: 2 }]}>{bmiCategory}</Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                {[['Gewicht', user?.weight, 'kg'], ['Größe', user?.height, 'cm'], ['Körperfett', user?.bodyFat, '%']].map(([l, v, u]) => (
                  <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[T.caption, { color: C.textSecondary }]}>{l}</Text>
                    <Text style={[T.caption, { color: C.text, fontWeight: '600' }]}>{v ? `${v} ${u}` : '–'}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Gewicht eintragen */}
        {sectionLabel('Gewicht eintragen')}
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center' }}>
            <TextInput
              style={{ flex: 1, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 12, color: C.text, fontSize: 22, fontWeight: '700', textAlign: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
              value={logWeight}
              onChangeText={setLogWeight}
              keyboardType="decimal-pad"
              placeholder={user?.weight?.toString() || '75.0'}
              placeholderTextColor={C.textTertiary}
            />
            <Text style={[T.body, { color: C.textSecondary }]}>kg</Text>
            <TouchableOpacity
              style={{ backgroundColor: C.accent, paddingHorizontal: S.md, paddingVertical: 12, borderRadius: R.md, opacity: logging ? 0.6 : 1 }}
              onPress={addWeightEntry}
              disabled={logging}
            >
              <Text style={[T.bodyMed, { color: C.accentText }]}>Speichern</Text>
            </TouchableOpacity>
          </View>
          {weightHistory.length > 0 && (
            <View style={{ marginTop: S.md, gap: 6 }}>
              <Text style={[T.label, { color: C.textTertiary }]}>Letzte Einträge</Text>
              {weightHistory.slice(-5).reverse().map((w, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[T.caption, { color: C.textSecondary }]}>{w.date || w.logged_at?.split('T')[0] || '—'}</Text>
                  <Text style={[T.caption, { color: C.text, fontWeight: '600' }]}>{w.weight || w.value} kg</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Körperdaten */}
        {sectionLabel('Körperdaten')}
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Field label="Gewicht" value={user?.weight} onSave={v => save({ weight: parseFloat(v) || null })} placeholder="75" unit="kg" numeric />
          {divider}
          <Field label="Größe" value={user?.height} onSave={v => save({ height: parseFloat(v) || null })} placeholder="180" unit="cm" numeric />
          {divider}
          <Field label="Zielgewicht" value={user?.targetWeight} onSave={v => save({ targetWeight: parseFloat(v) || null })} placeholder="70" unit="kg" numeric />
          {divider}
          <Field label="Körperfett" value={user?.bodyFat} onSave={v => save({ bodyFat: parseFloat(v) || null })} placeholder="15" unit="%" numeric />
          {divider}
          <Field label="Muskelmasse" value={user?.muscleMass} onSave={v => save({ muscleMass: parseFloat(v) || null })} placeholder="60" unit="kg" numeric />
          {divider}
          <Field label="Alter" value={user?.age} onSave={v => save({ age: parseInt(v) || null })} placeholder="25" unit="J." numeric />
          {divider}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 }}>
            <Text style={[T.body, { color: C.textSecondary }]}>Geschlecht</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[['male', '♂'], ['female', '♀']].map(([id, ico]) => (
                <TouchableOpacity key={id} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.sm, backgroundColor: user?.gender === id ? C.accent : C.bgTertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: user?.gender === id ? C.accent : C.border }} onPress={() => save({ gender: id })}>
                  <Text style={{ color: user?.gender === id ? C.accentText : C.textSecondary, fontSize: 14 }}>{ico}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Kalorienziele */}
        {sectionLabel('Kalorienziele')}
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Field label="Kalorienziel" value={user?.calorieGoal} onSave={v => save({ calorieGoal: parseInt(v) || null })} placeholder="2000" unit="kcal" numeric />
          {divider}
          <Field label="Proteinziel" value={user?.proteinGoal} onSave={v => save({ proteinGoal: parseInt(v) || null })} placeholder="150" unit="g" numeric />
          {divider}
          <Field label="Kohlenhydrate" value={user?.carbsGoal} onSave={v => save({ carbsGoal: parseInt(v) || null })} placeholder="250" unit="g" numeric />
          {divider}
          <Field label="Fettziel" value={user?.fatGoal} onSave={v => save({ fatGoal: parseInt(v) || null })} placeholder="65" unit="g" numeric />
          {divider}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 }}>
            <Text style={[T.body, { color: C.textSecondary }]}>Ernährungsweise</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[['omnivore', 'Alles'], ['vegetarian', 'Vegetarisch'], ['vegan', 'Vegan'], ['keto', 'Keto'], ['paleo', 'Paleo']].map(([id, l]) => (
                  <TouchableOpacity key={id} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm, backgroundColor: user?.dietType === id ? C.tint : C.bgTertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: user?.dietType === id ? C.tint : C.border }} onPress={() => save({ dietType: id })}>
                    <Text style={[T.label, { color: user?.dietType === id ? C.tintText : C.textSecondary }]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}
