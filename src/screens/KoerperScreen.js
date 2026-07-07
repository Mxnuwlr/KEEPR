/**
 * screens/KoerperScreen.js — Körperdaten & Gewichtstracking
 *
 * Aufbau:
 *   1. BMI-Karte mit visueller Skala (Marker auf Farbband)
 *   2. Fortschrittsfotos-Einstieg
 *   3. Neuer Eintrag (Gewicht + optional KF/Muskel, z.B. von der Renpho-Waage)
 *   4. Verlauf (Gewichts- und KF-Chart + letzte Einträge)
 *   5. Körperdaten + Kalorienziele als FieldRow-Listen (ui.js)
 */

// React/RN
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Dimensions } from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';
import { ScreenHeader, Surface, SectionLabel, FieldRow, PrimaryButton } from '../components/ui';
import { api } from '../api/client';
import { calcCalorieGoalFromProfile, getSmoothedWeight } from '../utils/coaching';
import LineChart from '../components/LineChart';

/** Horizontale BMI-Skala (15–35) mit Marker auf der eigenen Position. */
function BmiScale({ bmi }) {
  const { colors: C, type: T } = useTheme();
  const MIN = 15, MAX = 35;
  const pct = Math.max(0, Math.min(1, (bmi - MIN) / (MAX - MIN)));
  // Segmente: Untergewicht bis 18.5 | normal bis 25 | Übergewicht bis 30 | darüber
  const seg = (from, to) => `${((to - from) / (MAX - MIN)) * 100}%`;
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ width: seg(15, 18.5), backgroundColor: C.warning }} />
        <View style={{ width: seg(18.5, 25), backgroundColor: C.success }} />
        <View style={{ width: seg(25, 30), backgroundColor: C.warning }} />
        <View style={{ flex: 1, backgroundColor: C.danger }} />
      </View>
      <View style={{ position: 'absolute', top: -3, left: `${pct * 100}%`, marginLeft: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: C.text, borderWidth: 2, borderColor: C.surface }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={[T.caption, { color: C.textTertiary, fontSize: 10 }]}>15</Text>
        <Text style={[T.caption, { color: C.textTertiary, fontSize: 10 }]}>18,5</Text>
        <Text style={[T.caption, { color: C.textTertiary, fontSize: 10 }]}>25</Text>
        <Text style={[T.caption, { color: C.textTertiary, fontSize: 10 }]}>30</Text>
        <Text style={[T.caption, { color: C.textTertiary, fontSize: 10 }]}>35</Text>
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

  // BMI
  const bmi = user?.weight && user?.height
    ? (user.weight / ((user.height / 100) ** 2)).toFixed(1)
    : null;
  const bmiCategory = bmi
    ? bmi < 18.5 ? 'Untergewicht' : bmi < 25 ? 'Normalgewicht' : bmi < 30 ? 'Übergewicht' : 'Adipositas'
    : null;
  const bmiColor = bmi
    ? bmi < 18.5 ? C.warning : bmi < 25 ? C.success : bmi < 30 ? C.warning : C.danger
    : C.textSecondary;

  const chartW = Dimensions.get('window').width - S.md * 2 - S.md * 2 - 2;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Körper & Gesundheit" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

        {/* BMI mit Skala */}
        {bmi && (
          <>
            <SectionLabel>Körperindex</SectionLabel>
            <Surface style={{ marginHorizontal: S.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <View>
                  <Text style={{ color: bmiColor, fontSize: 36, fontWeight: '800' }}>{bmi}</Text>
                  <Text style={[T.caption, { color: bmiColor }]}>{bmiCategory}</Text>
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  {[['Gewicht', user?.weight, 'kg'], ['Größe', user?.height, 'cm'], ['Körperfett', user?.bodyFat, '%']].map(([l, v, u]) => (
                    <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[T.caption, { color: C.textSecondary }]}>{l}</Text>
                      <Text style={[T.caption, { color: C.text, fontWeight: '600' }]}>{v ? `${v} ${u}` : '–'}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <BmiScale bmi={parseFloat(bmi)} />
            </Surface>
          </>
        )}

        {/* Neuer Eintrag */}
        <SectionLabel>Neuer Eintrag</SectionLabel>
        <Surface style={{ marginHorizontal: S.md }}>
          <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center' }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bgSecondary, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingHorizontal: S.md }}>
              <TextInput
                style={{ flex: 1, paddingVertical: 12, color: C.text, fontSize: 22, fontWeight: '700', textAlign: 'center' }}
                value={logWeight}
                onChangeText={setLogWeight}
                keyboardType="decimal-pad"
                placeholder={user?.weight?.toString() || '75.0'}
                placeholderTextColor={C.textTertiary}
              />
              <Text style={[T.body, { color: C.textSecondary }]}>kg</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bgSecondary, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingHorizontal: S.md }}>
              <TextInput
                style={{ flex: 1, paddingVertical: 12, color: C.text, fontSize: 16, fontWeight: '600', textAlign: 'center' }}
                value={logBodyFat} onChangeText={setLogBodyFat} keyboardType="decimal-pad"
                placeholder={user?.bodyFat?.toString() || '–'} placeholderTextColor={C.textTertiary}
              />
              <Text style={[T.caption, { color: C.textSecondary }]}>% KF</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bgSecondary, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingHorizontal: S.md }}>
              <TextInput
                style={{ flex: 1, paddingVertical: 12, color: C.text, fontSize: 16, fontWeight: '600', textAlign: 'center' }}
                value={logMuscle} onChangeText={setLogMuscle} keyboardType="decimal-pad"
                placeholder={user?.muscleMass?.toString() || '–'} placeholderTextColor={C.textTertiary}
              />
              <Text style={[T.caption, { color: C.textSecondary }]}>kg M.</Text>
            </View>
          </View>
          <Text style={[T.caption, { color: C.textTertiary, marginTop: 8 }]}>Werte von deiner Renpho-Waage — Körperfett & Muskelmasse optional.</Text>
          <PrimaryButton
            label={logging ? 'Speichert…' : 'Eintrag speichern'}
            icon={logging ? undefined : 'check'}
            onPress={addWeightEntry}
            disabled={logging}
            style={{ marginTop: S.sm }}
          />
        </Surface>

        {/* Verlauf */}
        {weightHistory.length >= 2 && (
          <>
            <SectionLabel>Verlauf</SectionLabel>
            <Surface style={{ marginHorizontal: S.md }}>
              {(() => {
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
                return (
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm, marginBottom: S.sm }}>
                      <Text style={[T.label, { color: C.textTertiary }]}>GEWICHT ({weightHistory.length} Einträge)</Text>
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
                return (
                  <View style={{ marginTop: S.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm, marginBottom: S.sm }}>
                      <Text style={[T.label, { color: C.textTertiary }]}>KÖRPERFETT</Text>
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

              <View style={{ marginTop: S.md, gap: 6 }}>
                <Text style={[T.label, { color: C.textTertiary }]}>LETZTE EINTRÄGE</Text>
                {weightHistory.slice(-5).reverse().map((w, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[T.caption, { color: C.textSecondary }]}>{w.date || w.logged_at?.split('T')[0] || '—'}</Text>
                    <Text style={[T.caption, { color: C.text, fontWeight: '600' }]}>{w.weight || w.value} kg{w.body_fat ? ` · ${w.body_fat} %` : ''}</Text>
                  </View>
                ))}
              </View>
            </Surface>
          </>
        )}

        {/* Fortschrittsfotos */}
        <SectionLabel>Fortschritt</SectionLabel>
        <Surface style={{ marginHorizontal: S.md, flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={() => navigation.navigate('ProgressPhotos')}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="camera" size={16} color={C.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T.body, { color: C.text }]}>Fortschrittsfotos</Text>
            <Text style={[T.caption, { color: C.textTertiary, marginTop: 1 }]}>Alle 4 Wochen · 4 Posen · Vergleich über die Zeit</Text>
          </View>
          <Feather name="chevron-right" size={16} color={C.textTertiary} />
        </Surface>

        {/* Körperdaten */}
        <SectionLabel>Körperdaten</SectionLabel>
        <Surface style={{ marginHorizontal: S.md, padding: 0, overflow: 'hidden' }}>
          <FieldRow icon="trending-down" label="Gewicht" value={user?.weight} onSave={v => save({ weight: parseFloat(v) || null })} placeholder="75" unit="kg" numeric />
          <FieldRow icon="arrow-up" label="Größe" value={user?.height} onSave={v => save({ height: parseFloat(v) || null })} placeholder="180" unit="cm" numeric />
          <FieldRow icon="target" label="Zielgewicht" value={user?.targetWeight} onSave={v => save({ targetWeight: parseFloat(v) || null })} placeholder="70" unit="kg" numeric />
          <FieldRow icon="percent" label="Körperfett" value={user?.bodyFat} onSave={v => save({ bodyFat: parseFloat(v) || null })} placeholder="15" unit="%" numeric />
          <FieldRow icon="zap" label="Muskelmasse" value={user?.muscleMass} onSave={v => save({ muscleMass: parseFloat(v) || null })} placeholder="60" unit="kg" numeric />
          <FieldRow icon="calendar" label="Alter" value={user?.age} onSave={v => save({ age: parseInt(v) || null })} placeholder="25" unit="J." numeric />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: S.md, paddingVertical: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="user" size={16} color={C.textSecondary} />
            </View>
            <Text style={[T.body, { color: C.text, flex: 1 }]}>Geschlecht</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[['male', 'gender-male'], ['female', 'gender-female']].map(([id, ico]) => (
                <TouchableOpacity key={id} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.full, backgroundColor: user?.gender === id ? C.accent : C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: user?.gender === id ? C.accent : C.border }} onPress={() => save({ gender: id })}>
                  <MaterialCommunityIcons name={ico} size={16} color={user?.gender === id ? C.accentText : C.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Surface>

        {/* Kalorienziele */}
        <SectionLabel>Ernährungsziele</SectionLabel>
        <Surface style={{ marginHorizontal: S.md, padding: 0, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: S.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="activity" size={16} color={C.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[T.body, { color: C.text }]}>Kalorienziel</Text>
              <Text style={[T.caption, { color: C.textTertiary, marginTop: 1 }]}>Automatisch aus Gewicht, Aktivität & Ziel</Text>
            </View>
            <View style={{ backgroundColor: C.tint + '20', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={[T.bodyMed, { color: C.text, fontSize: 14 }]}>{calcCalorieGoalFromProfile({ ...user, weight: getSmoothedWeight(weightAnalysis, user) || user?.weight }) || user?.calorieGoal || 2000} kcal</Text>
            </View>
          </View>
          <FieldRow icon="box" label="Proteinziel" value={user?.proteinGoal} onSave={v => save({ proteinGoal: parseInt(v) || null })} placeholder="150" unit="g" numeric />
          <FieldRow icon="layers" label="Kohlenhydrate" value={user?.carbsGoal} onSave={v => save({ carbsGoal: parseInt(v) || null })} placeholder="250" unit="g" numeric />
          <FieldRow icon="droplet" label="Fettziel" value={user?.fatGoal} onSave={v => save({ fatGoal: parseInt(v) || null })} placeholder="65" unit="g" numeric />
          <View style={{ paddingHorizontal: S.md, paddingVertical: 12 }}>
            <Text style={[T.body, { color: C.text, marginBottom: S.sm }]}>Ernährungsweise</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[['omnivore', 'Alles'], ['vegetarian', 'Vegetarisch'], ['vegan', 'Vegan'], ['keto', 'Keto'], ['paleo', 'Paleo']].map(([id, l]) => (
                <TouchableOpacity key={id} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.full, backgroundColor: user?.dietType === id ? C.accent : C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: user?.dietType === id ? C.accent : C.border }} onPress={() => save({ dietType: id })}>
                  <Text style={[T.label, { color: user?.dietType === id ? C.accentText : C.textSecondary }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Surface>

      </ScrollView>
    </View>
  );
}
