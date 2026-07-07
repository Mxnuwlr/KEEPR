/**
 * screens/KoerperScreen.js — Körperdaten & Gewichtstracking
 *
 * Zeigt Gewichtsverlauf, Körperfettanteil und weitere Körpermaße.
 * Einträge werden via api.getWeightHistory() / api.logWeight() gespeichert.
 *
 * Field — Inline-editierbares Feld (Tap zum Bearbeiten, Blur/Enter zum Speichern)
 */

// React/RN
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Dimensions } from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';
import { ScreenHeader } from '../components/ui';
import { api } from '../api/client';
import { calcCalorieGoalFromProfile, getSmoothedWeight } from '../utils/coaching';
import LineChart from '../components/LineChart';

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
  const { user, updateProfile, weightAnalysis } = useStore();
  const [weightHistory, setWeightHistory] = useState([]);
  const [logWeight, setLogWeight] = useState('');
  const [logBodyFat, setLogBodyFat] = useState('');
  const [logMuscle, setLogMuscle] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const data = await api.getWeightHistory?.();
      // chronologisch (älteste zuerst) für die Verlaufskurven
      if (Array.isArray(data)) setWeightHistory(data.slice().reverse().slice(-30));
    } catch(e) {}
  };

  const save = async (updates) => {
    try { await updateProfile({ ...user, ...updates }); } catch(e) { Alert.alert('Fehler', e.message); }
  };

  const addWeightEntry = async () => {
    const w = parseFloat(logWeight.replace(',', '.'));
    if (!w || w < 20 || w > 300) return Alert.alert('Ungültiges Gewicht');
    const bf = logBodyFat ? parseFloat(logBodyFat.replace(',', '.')) : null;
    const mm = logMuscle ? parseFloat(logMuscle.replace(',', '.')) : null;
    if (bf != null && (bf < 3 || bf > 60)) return Alert.alert('Ungültiger KF-Wert', 'Körperfett in % (z.B. 18).');
    if (mm != null && (mm < 10 || mm > 120)) return Alert.alert('Ungültiger Muskelwert', 'Muskelmasse in kg.');
    setLogging(true);
    try {
      await api.addWeight({ weight: w, date: new Date().toISOString().split('T')[0], bodyFat: bf, muscleMass: mm });
      await save({ weight: w, ...(bf != null ? { bodyFat: bf } : {}), ...(mm != null ? { muscleMass: mm } : {}) });
      setLogWeight(''); setLogBodyFat(''); setLogMuscle('');
      await loadHistory();
      Alert.alert('Gespeichert', `${w} kg${bf != null ? ` · ${bf} % KF` : ''}${mm != null ? ` · ${mm} kg Muskeln` : ''} eingetragen.`);
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
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Körper & Gesundheit" onBack={() => navigation.goBack()} />

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

        {/* Fortschrittsfotos */}
        {sectionLabel('Fortschritt')}
        <TouchableOpacity
          onPress={() => navigation.navigate('ProgressPhotos')}
          style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: S.md }}
        >
          <View style={{ width: 40, height: 40, borderRadius: R.md, backgroundColor: C.accent + '18', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="camera" size={20} color={C.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T.body, { color: C.text, fontWeight: '600' }]}>Fortschrittsfotos</Text>
            <Text style={[T.caption, { color: C.textSecondary }]}>Alle 4 Wochen · 4 Posen · Vergleich über die Zeit</Text>
          </View>
          <Feather name="chevron-right" size={20} color={C.textTertiary} />
        </TouchableOpacity>

        {/* Körperzusammensetzung */}
        {sectionLabel('Körperzusammensetzung (z.B. Renpho)')}
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

          {/* KF % + Muskel (optional, von der Renpho-Waage) */}
          <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bgSecondary, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingHorizontal: S.md }}>
              <TextInput
                style={{ flex: 1, paddingVertical: 10, color: C.text, fontSize: 16, fontWeight: '600', textAlign: 'center' }}
                value={logBodyFat} onChangeText={setLogBodyFat} keyboardType="decimal-pad"
                placeholder={user?.bodyFat?.toString() || 'KF'} placeholderTextColor={C.textTertiary}
              />
              <Text style={[T.caption, { color: C.textSecondary }]}>% KF</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bgSecondary, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingHorizontal: S.md }}>
              <TextInput
                style={{ flex: 1, paddingVertical: 10, color: C.text, fontSize: 16, fontWeight: '600', textAlign: 'center' }}
                value={logMuscle} onChangeText={setLogMuscle} keyboardType="decimal-pad"
                placeholder={user?.muscleMass?.toString() || 'Muskel'} placeholderTextColor={C.textTertiary}
              />
              <Text style={[T.caption, { color: C.textSecondary }]}>kg M.</Text>
            </View>
          </View>
          <Text style={[T.caption, { color: C.textTertiary, marginTop: 6 }]}>Werte von deiner Renpho-Waage — KF & Muskel optional.</Text>

          {weightHistory.length >= 2 && (() => {
            const chartData = weightHistory.map((w, i) => ({
              value: parseFloat(w.weight || w.value || 0),
              label: i % Math.ceil(weightHistory.length / 5) === 0
                ? (w.date || w.logged_at?.split('T')[0] || '').slice(5).replace('-', '.')
                : '',
            })).filter(d => d.value > 0);
            const minW = Math.min(...chartData.map(d => d.value));
            const maxW = Math.max(...chartData.map(d => d.value));
            const trend = chartData.length >= 2 ? chartData[chartData.length - 1].value - chartData[0].value : 0;
            const trendColor = trend < -0.1 ? C.success : trend > 0.1 ? C.danger : C.textSecondary;
            const chartW = Dimensions.get('window').width - S.md * 2 - S.md * 2 - 2;
            return (
              <View style={{ marginTop: S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm, marginBottom: S.sm }}>
                  <Text style={[T.label, { color: C.textTertiary }]}>VERLAUF ({weightHistory.length} Einträge)</Text>
                  <Text style={{ color: trendColor, fontSize: 12, fontWeight: '700' }}>
                    {trend > 0.1 ? `+${trend.toFixed(1)}` : trend < -0.1 ? trend.toFixed(1) : '±0'} kg
                  </Text>
                </View>
                <LineChart data={chartData} width={chartW} height={100} color={C.accent} colors={C} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={[T.caption, { color: C.textTertiary }]}>Min: {minW} kg</Text>
                  <Text style={[T.caption, { color: C.textTertiary }]}>Max: {maxW} kg</Text>
                </View>
              </View>
            );
          })()}

          {/* Körperfett-Verlauf (aus body_fat der Einträge, z.B. Renpho) */}
          {(() => {
            const kf = weightHistory.map((w) => ({ value: parseFloat(w.body_fat || 0), date: w.date })).filter((d) => d.value > 0);
            if (kf.length < 2) return null;
            const data = kf.map((d, i) => ({ value: d.value, label: i % Math.ceil(kf.length / 5) === 0 ? (d.date || '').slice(5).replace('-', '.') : '' }));
            const minK = Math.min(...kf.map((d) => d.value));
            const maxK = Math.max(...kf.map((d) => d.value));
            const tr = kf[kf.length - 1].value - kf[0].value;
            const trC = tr < -0.1 ? C.success : tr > 0.1 ? C.danger : C.textSecondary;
            const chartW = Dimensions.get('window').width - S.md * 2 - S.md * 2 - 2;
            return (
              <View style={{ marginTop: S.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm, marginBottom: S.sm }}>
                  <Text style={[T.label, { color: C.textTertiary }]}>KÖRPERFETT-VERLAUF</Text>
                  <Text style={{ color: trC, fontSize: 12, fontWeight: '700' }}>{tr > 0.1 ? `+${tr.toFixed(1)}` : tr < -0.1 ? tr.toFixed(1) : '±0'} %</Text>
                </View>
                <LineChart data={data} width={chartW} height={100} color={C.tint} colors={C} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={[T.caption, { color: C.textTertiary }]}>Min: {minK} %</Text>
                  <Text style={[T.caption, { color: C.textTertiary }]}>Max: {maxK} %</Text>
                </View>
              </View>
            );
          })()}

          {weightHistory.length > 0 && (
            <View style={{ marginTop: S.md, gap: 6 }}>
              <Text style={[T.label, { color: C.textTertiary }]}>Letzte Einträge</Text>
              {weightHistory.slice(-5).reverse().map((w, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[T.caption, { color: C.textSecondary }]}>{w.date || w.logged_at?.split('T')[0] || '—'}</Text>
                  <Text style={[T.caption, { color: C.text, fontWeight: '600' }]}>{w.weight || w.value} kg{w.body_fat ? ` · ${w.body_fat} %` : ''}</Text>
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
              {[['male', 'gender-male'], ['female', 'gender-female']].map(([id, ico]) => (
                <TouchableOpacity key={id} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.sm, backgroundColor: user?.gender === id ? C.accent : C.bgTertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: user?.gender === id ? C.accent : C.border }} onPress={() => save({ gender: id })}>
                  <MaterialCommunityIcons name={ico} size={16} color={user?.gender === id ? C.accentText : C.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Kalorienziele */}
        {sectionLabel('Kalorienziele')}
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={[T.body, { color: C.textSecondary }]}>Kalorienziel</Text>
              <Text style={[T.caption, { color: C.textTertiary, marginTop: 2 }]}>Automatisch aus Gewicht, Aktivität & Ziel</Text>
            </View>
            <Text style={[T.body, { color: C.text }]}>{calcCalorieGoalFromProfile({ ...user, weight: getSmoothedWeight(weightAnalysis, user) || user?.weight }) || user?.calorieGoal || 2000} kcal</Text>
          </View>
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
                  <TouchableOpacity key={id} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm, backgroundColor: user?.dietType === id ? C.accent : C.bgTertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: user?.dietType === id ? C.accent : C.border }} onPress={() => save({ dietType: id })}>
                    <Text style={[T.label, { color: user?.dietType === id ? C.accentText : C.textSecondary }]}>{l}</Text>
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
