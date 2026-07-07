/**
 * screens/OnboardingScreen.js — Ersteinrichtung / Onboarding
 *
 * Mehrstufiger Onboarding-Flow (TOTAL_STEPS = 6) für neue Nutzer.
 * Erfasst: Name, Gewicht, Größe, Alter, Geschlecht, Sportprofil, Ziel-Pace.
 *
 * calcBMR(weight, height, age, gender) — Mifflin-St.-Jeor BMR-Berechnung
 * paceToSeconds() aus api/client für Pace-Validierung
 */

// React/RN
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { getSportMci } from '../data/sports';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';
import { paceToSeconds } from '../api/client';

const TOTAL_STEPS = 6;

function calcBMR(weight, height, age, gender) {
  if (!weight || !height || !age) return 2000;
  if (gender === 'female') {
    return 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
  }
  return 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
}

const ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, extreme: 1.9 };
const GOAL_ADJUSTMENTS = { lose: -500, gain: 300, muscle: -200, maintain: 0, triathlon: 200, race: 150, fitness: 0 };

function calcCalorieGoal(weight, height, age, gender, activityLevel, goals) {
  const bmr = calcBMR(weight, height, age, gender);
  const tdee = bmr * (ACTIVITY_FACTORS[activityLevel] || 1.55);
  const arr = Array.isArray(goals) ? goals : (goals ? [goals] : []);
  const adjustment = arr.length > 0
    ? arr.reduce((sum, g) => sum + (GOAL_ADJUSTMENTS[g] || 0), 0) / arr.length
    : 0;
  return Math.round(Math.max(1200, tdee + adjustment));
}

function Chip({ label, selected, onPress, color }) {
  const { colors: C, radius: R, type: T } = useTheme();
  const activeColor = color || C.tint;
  return (
    <TouchableOpacity
      style={{
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.full,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? activeColor : C.border,
        backgroundColor: selected ? activeColor + '18' : C.surface,
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[T.label, { color: selected ? activeColor : C.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, unit, hint }) {
  const { colors: C, type: T, radius: R } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }]}>{label}</Text>
      {hint && <Text style={[T.caption, { color: C.textTertiary, marginBottom: 6 }]}>{hint}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          style={{ flex: 1, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.md, color: C.text, fontSize: 15, padding: 14 }}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder || ''}
          placeholderTextColor={C.textTertiary}
          keyboardType={keyboardType || 'default'}
          autoCorrect={false}
        />
        {unit && <Text style={[T.body, { color: C.textSecondary }]}>{unit}</Text>}
      </View>
    </View>
  );
}

function ProgressBar({ step }) {
  const { colors: C, radius: R } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 28 }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 4, borderRadius: R.sm, backgroundColor: i < step ? C.accent : C.border }}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen({ onComplete }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { updateProfile } = useStore();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('male');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [goals, setGoals] = useState([]);
  const [activityLevel, setActivityLevel] = useState('');
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState('');
  const [trainingHoursPerWeek, setTrainingHoursPerWeek] = useState('');
  const [availableDays, setAvailableDays] = useState([]);
  const [fitnessLevel, setFitnessLevel] = useState('');
  const [sportTypes, setSportTypes] = useState([]);
  const [ftp, setFtp] = useState('');
  const [swimPace, setSwimPace] = useState('');
  const [runPace, setRunPace] = useState('');
  const [maxHr, setMaxHr] = useState('');
  const [equipment, setEquipment] = useState([]);
  const [longSessionDays, setLongSessionDays] = useState([]);
  const [dietType, setDietType] = useState('omnivore');
  const [allergies, setAllergies] = useState([]);
  const [aiNotes, setAiNotes] = useState('');

  const toggleArr = (arr, setArr, val) => {
    setArr(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  };

  // Mutually exclusive weight-direction goals
  const WEIGHT_GOALS = ['lose', 'maintain', 'gain'];
  const toggleGoal = (v) => {
    setGoals(prev => {
      if (prev.includes(v)) return prev.filter(g => g !== v);
      // Deselect any conflicting weight-direction goals
      const filtered = WEIGHT_GOALS.includes(v) ? prev.filter(g => !WEIGHT_GOALS.includes(g)) : [...prev];
      return [...filtered, v];
    });
  };

  const hasEnduranceGoal = goals.includes('triathlon') || goals.includes('race');

  const age = (() => {
    if (!birthday || birthday.length < 4) return null;
    const parts = birthday.split('.');
    if (parts.length === 3) {
      const year = parseInt(parts[2]);
      return isNaN(year) ? null : new Date().getFullYear() - year;
    }
    return null;
  })();

  const next = () => {
    if (step === 1 && !displayName.trim()) return Alert.alert('Bitte gib deinen Namen ein.');
    if (step === 2 && (!weight || !height)) return Alert.alert('Bitte Gewicht und Größe eingeben.');
    if (step === 3 && goals.length === 0) return Alert.alert('Bitte mindestens ein Ziel wählen.');
    if (step === 4 && !activityLevel) return Alert.alert('Bitte Aktivitätslevel wählen.');
    if (step === 4 && !trainingHoursPerWeek) return Alert.alert('Bitte Max. Stunden pro Woche eingeben.');
    if (step < TOTAL_STEPS) setStep(s => s + 1);
    else finish();
  };

  const finish = async () => {
    setSaving(true);
    const w = parseFloat(weight) || 75;
    const h = parseFloat(height) || 175;
    const a = age || 30;
    const calorieGoal = calcCalorieGoal(w, h, a, gender, activityLevel, goals);
    const proteinGoal = Math.round(w * 2);
    const fatGoal = Math.round(calorieGoal * 0.28 / 9);
    const carbsGoal = Math.round((calorieGoal - proteinGoal * 4 - fatGoal * 9) / 4);
    try {
      await updateProfile({
        displayName: displayName.trim(), age: a, gender,
        weight: w, height: h, targetWeight: parseFloat(targetWeight) || null,
        goal: goals.join(','), activityLevel,
        trainingDaysPerWeek: parseInt(trainingDaysPerWeek) || 4,
        trainingHoursPerWeek: parseInt(trainingHoursPerWeek) || 0,
        availableDays, longSessionDays, fitnessLevel: fitnessLevel || 'intermediate',
        sportTypes, ftp: parseInt(ftp) || null,
        swimPace: paceToSeconds(swimPace), runPace: paceToSeconds(runPace),
        maxHr: parseInt(maxHr) || null, equipment,
        dietType, allergies: allergies.length > 0 ? JSON.stringify(allergies) : null,
        aiNotes: aiNotes.trim() || null,
        calorieGoal, proteinGoal, carbsGoal, fatGoal,
        onboardingComplete: true,
      });
      onComplete?.();
    } catch(e) { Alert.alert('Fehler', e.message); }
    setSaving(false);
  };

  const stepTitles = ['Wer bist du?', 'Dein Körper', 'Dein Ziel', 'Deine Aktivität', 'Dein Sport', 'Ernährung'];

  const sectionLabel = [T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 }];
  const inputStyle = { backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.md, color: C.text, fontSize: 15, padding: 14 };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: S.lg, paddingTop: 56, paddingBottom: 130 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <Text style={{ color: C.text, fontSize: 28, fontWeight: '800', letterSpacing: -1, marginBottom: 28 }}>keepr</Text>

        <ProgressBar step={step} />

        <View style={{ marginBottom: S.lg }}>
          <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Schritt {step} von {TOTAL_STEPS}</Text>
          <Text style={[T.h1, { color: C.text, marginTop: 4 }]}>{stepTitles[step - 1]}</Text>
        </View>

        {/* Step 1: Name + Geburtstag + Geschlecht */}
        {step === 1 && (
          <View>
            <Field label="Dein Name" value={displayName} onChange={setDisplayName} placeholder="Manuel" />
            <Field label="Geburtstag" value={birthday} onChange={setBirthday} placeholder="15.03.1990" hint="Format: TT.MM.JJJJ" />
            <Text style={sectionLabel}>Geschlecht</Text>
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              {[['male', 'Männlich'], ['female', 'Weiblich']].map(([v, l]) => (
                <Chip key={v} label={l} selected={gender === v} onPress={() => setGender(v)} />
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Körper */}
        {step === 2 && (
          <View>
            <Field label="Aktuelles Gewicht" value={weight} onChange={setWeight} placeholder="75" keyboardType="decimal-pad" unit="kg" />
            <Field label="Körpergröße" value={height} onChange={setHeight} placeholder="178" keyboardType="decimal-pad" unit="cm" />
            <Field label="Zielgewicht (optional)" value={targetWeight} onChange={setTargetWeight} placeholder="70" keyboardType="decimal-pad" unit="kg" />
          </View>
        )}

        {/* Step 3: Ziele (Mehrfachauswahl) */}
        {step === 3 && (
          <View>
            <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.md }]}>
              Mehrere Ziele möglich — Kalorien werden automatisch berechnet.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {[
                ['lose',     'trending-down',  'Abnehmen',        '-500 kcal/Tag'],
                ['maintain', 'scale-balance',  'Gewicht halten',  'Erhaltungskalorien'],
                ['gain',     'trending-up',    'Zunehmen',        '+300 kcal/Tag'],
                ['muscle',   'arm-flex',       'Muskelaufbau',    'Defizit + Protein'],
                ['triathlon','swim',           'Triathlon',       '+200 kcal Ausdauer'],
                ['race',     'flag-checkered', 'Wettkampf',       'Leistungsoptimierung'],
                ['fitness',  'heart-pulse',    'Allg. Fitness',   'Ausgeglichene Makros'],
              ].map(([v, icon, label, sub]) => {
                const sel = goals.includes(v);
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => toggleGoal(v)}
                    activeOpacity={0.7}
                    style={{
                      width: '47.5%',
                      backgroundColor: sel ? C.tint + '12' : C.surface,
                      borderRadius: R.md,
                      borderWidth: 1.5,
                      borderColor: sel ? C.tint : C.border,
                      padding: S.sm,
                      alignItems: 'center',
                      paddingVertical: 14,
                    }}
                  >
                    {sel && (
                      <View style={{ position: 'absolute', top: 8, right: 8 }}>
                        <Feather name="check-circle" size={14} color={C.tint} />
                      </View>
                    )}
                    <MaterialCommunityIcons name={icon} size={28} color={sel ? C.tint : C.textSecondary} style={{ marginBottom: 6 }} />
                    <Text style={{ color: sel ? C.tint : C.text, fontWeight: '700', fontSize: 14, textAlign: 'center' }}>{label}</Text>
                    <Text style={{ color: C.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 2 }}>{sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 4: Aktivität */}
        {step === 4 && (
          <View>
            <Text style={sectionLabel}>Aktivitätslevel</Text>
            <View style={{ gap: S.sm, marginBottom: S.lg }}>
              {[
                ['sedentary', 'Sitzend', 'Bürojob, kaum Sport'],
                ['light', 'Leicht aktiv', '1–3x/Woche Sport'],
                ['moderate', 'Moderat aktiv', '3–5x/Woche Sport'],
                ['active', 'Sehr aktiv', '6–7x/Woche Sport'],
                ['extreme', 'Extrem aktiv', '2x täglich, Profi-Athlet'],
              ].map(([v, l, sub]) => (
                <TouchableOpacity
                  key={v}
                  style={{ borderRadius: R.md, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: activityLevel === v ? C.tint : C.border, flexDirection: 'row', alignItems: 'center', backgroundColor: activityLevel === v ? C.tint + '08' : C.surface }}
                  onPress={() => setActivityLevel(v)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[T.bodyMed, { color: activityLevel === v ? C.tint : C.text, marginBottom: 2 }]}>{l}</Text>
                    <Text style={[T.caption, { color: C.textTertiary }]}>{sub}</Text>
                  </View>
                  {activityLevel === v && <Feather name="check-circle" size={18} color={C.tint} />}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={sectionLabel}>Trainingsniveau</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: S.lg }}>
              {[['beginner', 'Anfänger'], ['intermediate', 'Mittel'], ['advanced', 'Fortgeschritten'], ['elite', 'Elite']].map(([v, l]) => (
                <Chip key={v} label={l} selected={fitnessLevel === v} onPress={() => setFitnessLevel(v)} />
              ))}
            </View>

            <Field label="Max. Stunden pro Woche" value={trainingHoursPerWeek} onChange={setTrainingHoursPerWeek} placeholder="8" keyboardType="numeric" unit="h" />

            <Text style={sectionLabel}>An welchen Tagen trainierst du?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: S.lg }}>
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => (
                <Chip key={i} label={d} selected={availableDays.includes(i)} onPress={() => toggleArr(availableDays, setAvailableDays, i)} />
              ))}
            </View>

            {hasEnduranceGoal && (
              <>
                <Text style={sectionLabel}>An welchen Tagen hast du Zeit für lange Einheiten?</Text>
                <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.sm, marginTop: -S.xs }]}>
                  z.B. langer Lauf, langer Ride (2–5h)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => (
                    <Chip key={i} label={d} selected={longSessionDays.includes(i)} onPress={() => toggleArr(longSessionDays, setLongSessionDays, i)} />
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* Step 5: Sport + Leistung */}
        {step === 5 && (
          <View>
            <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.md }]}>
              Triathlon wählt Schwimmen, Rad & Laufen automatisch mit aus.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: S.lg }}>
              {[
                ['swim',         'Schwimmen',          '#2196F3'],
                ['bike',         'Radfahren',          '#FF9800'],
                ['run',          'Laufen',             '#4CAF50'],
                ['strength',     'Krafttraining',      '#E8C547'],
                ['triathlon',    'Triathlon',          '#FF5722'],
                ['hyrox',        'Hyrox / Functional', '#FBC02D'],
                ['calisthenics', 'Calisthenics',       '#F9A825'],
                ['row',          'Rudern',             '#26C6DA'],
                ['hike',         'Wandern',            '#689F38'],
                ['climbing',     'Klettern',           '#795548'],
                ['pilates',      'Pilates',            '#AB47BC'],
                ['mobility',     'Mobility',           '#CE93D8'],
              ].map(([v, label, color]) => {
                const sel = sportTypes.includes(v);
                return (
                  <TouchableOpacity
                    key={v}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (v === 'triathlon') {
                        setSportTypes(prev => {
                          if (prev.includes('triathlon')) return prev.filter(s => s !== 'triathlon');
                          const next = prev.filter(s => s !== 'triathlon');
                          for (const s of ['swim', 'bike', 'run']) { if (!next.includes(s)) next.push(s); }
                          next.push('triathlon');
                          return next;
                        });
                      } else {
                        toggleArr(sportTypes, setSportTypes, v);
                      }
                    }}
                    style={{
                      width: '47.5%',
                      backgroundColor: sel ? color + '18' : C.surface,
                      borderRadius: R.md,
                      borderWidth: 1.5,
                      borderColor: sel ? color : C.border,
                      padding: S.sm,
                      paddingVertical: 14,
                      alignItems: 'center',
                    }}
                  >
                    {sel && (
                      <View style={{ position: 'absolute', top: 8, right: 8 }}>
                        <Feather name="check-circle" size={14} color={color} />
                      </View>
                    )}
                    <MaterialCommunityIcons name={getSportMci(v)} size={28} color={sel ? color : C.textSecondary} style={{ marginBottom: 6 }} />
                    <Text style={{ color: sel ? color : C.text, fontWeight: '700', fontSize: 14, textAlign: 'center' }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Performance inputs — only when relevant sport selected */}
            {(sportTypes.includes('swim') || sportTypes.includes('bike') || sportTypes.includes('run') || sportTypes.includes('triathlon')) && (
              <>
                <Text style={sectionLabel}>Leistungsdaten</Text>
                <View style={{ gap: S.sm }}>
                  <Field label="Maximale Herzfrequenz" value={maxHr} onChange={setMaxHr} placeholder="185" keyboardType="numeric" unit="bpm" />
                  {sportTypes.includes('bike') && (
                    <Field label="FTP" value={ftp} onChange={setFtp} placeholder="250" keyboardType="numeric" unit="W" hint="Schwellenleistung Rad" />
                  )}
                  {sportTypes.includes('swim') && (
                    <Field label="Schwimm-Pace" value={swimPace} onChange={setSwimPace} placeholder="1:45" unit="/100m" hint="Format M:SS" />
                  )}
                  {sportTypes.includes('run') && (
                    <Field label="Lauf-Pace" value={runPace} onChange={setRunPace} placeholder="5:00" unit="/km" hint="Format M:SS" />
                  )}
                </View>
              </>
            )}
          </View>
        )}

        {/* Step 6: Ernährung */}
        {step === 6 && (
          <View>
            <Text style={sectionLabel}>Ernährungsweise</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: S.lg }}>
              {[['omnivore', 'Alles'], ['vegetarian', 'Vegetarisch'], ['vegan', 'Vegan'], ['pescatarian', 'Pescetarisch'], ['keto', 'Keto'], ['paleo', 'Paleo']].map(([v, l]) => (
                <Chip key={v} label={l} selected={dietType === v} onPress={() => setDietType(v)} />
              ))}
            </View>

            <Text style={sectionLabel}>Allergien & Unverträglichkeiten</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: S.lg }}>
              {[['gluten', 'Gluten'], ['lactose', 'Laktose'], ['nuts', 'Nüsse'], ['eggs', 'Eier'], ['soy', 'Soja'], ['fish', 'Fisch'], ['shellfish', 'Meeresfrüchte']].map(([v, l]) => (
                <Chip key={v} label={l} selected={allergies.includes(v)} onPress={() => toggleArr(allergies, setAllergies, v)} color={C.danger} />
              ))}
            </View>

            <Text style={sectionLabel}>Hinweis für die KI (optional)</Text>
            <TextInput
              style={[inputStyle, { height: 80, textAlignVertical: 'top', marginBottom: S.md }]}
              value={aiNotes}
              onChangeText={setAiNotes}
              placeholder="z.B. Ich esse kein Schweinefleisch, trainiere morgens vor der Arbeit, Wettkampf am 15. September…"
              placeholderTextColor={C.textTertiary}
              multiline
            />

            {weight && height && activityLevel && goals.length > 0 && (
              <View style={{ backgroundColor: C.tint + '08', borderRadius: R.md, padding: S.md, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '25' }}>
                <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Dein Kalorienziel</Text>
                <Text style={{ color: C.tint, fontSize: 32, fontWeight: '800', marginTop: 4 }}>
                  {calcCalorieGoal(parseFloat(weight), parseFloat(height), age || 30, gender, activityLevel, goals)}
                </Text>
                <Text style={[T.caption, { color: C.textSecondary }]}>kcal/Tag · berechnet mit Harris-Benedict</Text>
              </View>
            )}
          </View>
        )}

        {/* Navigation */}
        <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg }}>
          {step > 1 && (
            <TouchableOpacity
              style={{ width: 50, height: 54, borderRadius: R.md, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setStep(s => s - 1)}
            >
              <Feather name="arrow-left" size={18} color={C.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: C.accent, borderRadius: R.md, padding: 15, alignItems: 'center', opacity: saving ? 0.6 : 1 }}
            onPress={next}
            disabled={saving}
          >
            <Text style={[T.bodyMed, { color: C.accentText, fontSize: 17 }]}>
              {saving ? 'Speichert…' : step === TOTAL_STEPS ? 'Loslegen' : 'Weiter'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center', marginTop: S.md }]}>
          Du kannst alles später im Profil ändern.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
