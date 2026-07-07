/**
 * components/ActivityLogModal.js — Freie Aktivität eintragen
 *
 * Erlaubt das Protokollieren JEDER Sportart (z.B. "2h Beachvolleyball"),
 * unabhängig vom generierten Trainingsplan. Nutzt den zentralen Sport-Katalog
 * (src/data/sports.js) für Auswahl, Icons, Farben und kcal-Schätzung.
 *
 * Speichert über api.completeWorkout() als eigenständige Einheit
 * (sessionId/planId = null, dafür sportType + title gesetzt).
 *
 * Props:
 *   visible   — boolean
 *   date      — 'YYYY-MM-DD' (Vorauswahl; editierbar im Modal)
 *   onClose   — () => void
 *   onSaved   — () => void   (nach erfolgreichem Speichern)
 *   initialSport — optionaler Sport-Key zur Vorauswahl
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '../theme';
import { useStore } from '../store';
import {
  listSports, searchSports, getSport, estimateActivityCalories, SPORT_CATEGORIES,
} from '../data/sports';
import { getSmoothedWeight } from '../utils/coaching';

const todayStr = () => new Date().toISOString().split('T')[0];
const mondayIndex = (dateStr) => (new Date(dateStr + 'T12:00:00').getDay() + 6) % 7;

export default function ActivityLogModal({ visible, date, onClose, onSaved, initialSport = null }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { user, completeWorkout, weightAnalysis } = useStore();
  const bodyWeight = getSmoothedWeight(weightAnalysis, user) || user?.weight;

  const [sportKey, setSportKey] = useState(initialSport);
  const [query, setQuery] = useState('');
  const [activeDate, setActiveDate] = useState(date || todayStr());
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [effort, setEffort] = useState(null);
  const [avgHr, setAvgHr] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset bei (Wieder-)Öffnen
  React.useEffect(() => {
    if (visible) {
      setSportKey(initialSport);
      setQuery('');
      setActiveDate(date || todayStr());
      setDuration(''); setDistance(''); setEffort(null); setAvgHr(''); setNotes('');
    }
  }, [visible, date, initialSport]);

  const sport = sportKey ? getSport(sportKey) : null;
  const results = useMemo(() => (query ? searchSports(query) : listSports()), [query]);

  // Nach Kategorie gruppieren für die Auswahl
  const grouped = useMemo(() => {
    const g = {};
    results.forEach(s => { (g[s.category] = g[s.category] || []).push(s); });
    return Object.entries(g).sort(
      ([a], [b]) => (SPORT_CATEGORIES[a]?.order || 99) - (SPORT_CATEGORIES[b]?.order || 99)
    );
  }, [results]);

  const estKcal = useMemo(
    () => (sport && duration ? estimateActivityCalories(sportKey, parseInt(duration) || 0, bodyWeight) : null),
    [sport, sportKey, duration, bodyWeight]
  );

  const shiftDate = (d) => {
    const nd = new Date(activeDate + 'T12:00:00');
    nd.setDate(nd.getDate() + d);
    const s = nd.toISOString().split('T')[0];
    if (s <= todayStr()) setActiveDate(s);
  };

  const save = async () => {
    if (!sportKey) return Alert.alert('Sportart wählen', 'Bitte zuerst eine Sportart auswählen.');
    if (!duration || parseInt(duration) <= 0) return Alert.alert('Dauer fehlt', 'Bitte eine Dauer in Minuten eingeben.');
    setSaving(true);
    try {
      await completeWorkout({
        sessionId: null,
        planId: null,
        date: activeDate,
        dayIndex: mondayIndex(activeDate),
        sportType: sportKey,
        title: sport.label,
        focus: sport.label,
        exercisesCompleted: {},
        rating: null,
        perceivedEffort: effort,
        notes: notes.trim() || null,
        durationMinutes: parseInt(duration) || null,
        distance: parseFloat(distance) || null,
        avgHr: parseInt(avgHr) || null,
        calories: estKcal,
        manualActivity: true,
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      Alert.alert('Fehler', e.message || 'Konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    borderRadius: R.md, color: C.text, fontSize: 15, padding: S.md,
  };
  const lbl = (t) => <Text style={[T.label, { color: C.textTertiary, marginBottom: S.xs, marginTop: S.md }]}>{t}</Text>;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.lg, paddingTop: S.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Feather name="x" size={22} color={C.textSecondary} />
          </TouchableOpacity>
          <Text style={[T.h3, { color: C.text, flex: 1 }]}>Aktivität eintragen</Text>
          {sport && (
            <TouchableOpacity
              onPress={save}
              disabled={saving}
              style={{ backgroundColor: C.accent, borderRadius: R.full, paddingHorizontal: 16, paddingVertical: 8, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? <ActivityIndicator size="small" color={C.accentText} /> : <Text style={[T.label, { color: C.accentText, fontWeight: '700' }]}>Speichern</Text>}
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

          {/* Ausgewählte Sportart (oder Hinweis) */}
          {sport ? (
            <TouchableOpacity
              onPress={() => setSportKey(null)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: `${sport.color}18`, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: `${sport.color}50` }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${sport.color}25`, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name={sport.mci} size={24} color={sport.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyMed, { color: C.text }]}>{sport.label}</Text>
                <Text style={[T.caption, { color: C.textSecondary }]}>{SPORT_CATEGORIES[sport.category]?.label} · Tippen zum Ändern</Text>
              </View>
              <Feather name="edit-2" size={16} color={C.textTertiary} />
            </TouchableOpacity>
          ) : (
            <>
              {/* Suche */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <Feather name="search" size={16} color={C.textTertiary} />
                <TextInput
                  style={{ flex: 1, color: C.text, fontSize: 15, padding: S.md }}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Sportart suchen (z.B. Beachvolleyball)…"
                  placeholderTextColor={C.textTertiary}
                  autoCorrect={false}
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                    <Feather name="x-circle" size={16} color={C.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Gruppierte Sport-Liste */}
              {grouped.map(([cat, sports]) => (
                <View key={cat} style={{ marginTop: S.lg }}>
                  <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: S.sm }]}>
                    {SPORT_CATEGORIES[cat]?.label || cat}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
                    {sports.map(s => (
                      <TouchableOpacity
                        key={s.key}
                        onPress={() => { setSportKey(s.key); setQuery(''); }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderRadius: R.full, paddingVertical: 8, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                      >
                        <MaterialCommunityIcons name={s.mci} size={15} color={s.color} />
                        <Text style={[T.label, { color: C.text }]}>{s.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
              {grouped.length === 0 && (
                <Text style={[T.body, { color: C.textTertiary, textAlign: 'center', marginTop: S.xl }]}>
                  Keine Sportart gefunden — wähle „Andere Aktivität".
                </Text>
              )}
            </>
          )}

          {/* Formular (nur wenn Sport gewählt) */}
          {sport && (
            <>
              {/* Datum */}
              {lbl('Datum')}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgSecondary, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <TouchableOpacity onPress={() => shiftDate(-1)} style={{ padding: S.md }} hitSlop={8}>
                  <Feather name="chevron-left" size={18} color={C.textSecondary} />
                </TouchableOpacity>
                <Text style={[T.bodyMed, { flex: 1, textAlign: 'center', color: C.text }]}>
                  {activeDate === todayStr() ? 'Heute' : new Date(activeDate + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
                <TouchableOpacity onPress={() => shiftDate(1)} style={{ padding: S.md }} hitSlop={8} disabled={activeDate >= todayStr()}>
                  <Feather name="chevron-right" size={18} color={activeDate >= todayStr() ? C.textTertiary : C.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Dauer + Distanz */}
              <View style={{ flexDirection: 'row', gap: S.md }}>
                <View style={{ flex: 1 }}>
                  {lbl('Dauer (Min)')}
                  <TextInput style={inputStyle} value={duration} onChangeText={setDuration} placeholder="z.B. 120" placeholderTextColor={C.textTertiary} keyboardType="number-pad" />
                </View>
                {sport.distance && (
                  <View style={{ flex: 1 }}>
                    {lbl('Distanz (km)')}
                    <TextInput style={inputStyle} value={distance} onChangeText={setDistance} placeholder="z.B. 5.0" placeholderTextColor={C.textTertiary} keyboardType="decimal-pad" />
                  </View>
                )}
              </View>

              {/* RPE */}
              {lbl('Anstrengung (RPE)')}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setEffort(effort === n ? null : n)}
                    style={{ width: 30, height: 34, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: effort === n ? sport.color : C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: effort === n ? sport.color : C.border }}
                  >
                    <Text style={{ color: effort === n ? '#fff' : C.textSecondary, fontWeight: '700', fontSize: 13 }}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Ø HF */}
              {lbl('Ø Herzfrequenz (optional)')}
              <TextInput style={inputStyle} value={avgHr} onChangeText={setAvgHr} placeholder="z.B. 145 bpm" placeholderTextColor={C.textTertiary} keyboardType="number-pad" />

              {/* Notiz */}
              {lbl('Notiz (optional)')}
              <TextInput style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Wie lief's?" placeholderTextColor={C.textTertiary} multiline />

              {/* kcal-Schätzung */}
              {estKcal != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.lg, backgroundColor: C.surface, borderRadius: R.md, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                  <Feather name="zap" size={16} color={sport.color} />
                  <Text style={[T.caption, { color: C.textSecondary, flex: 1 }]}>Geschätzter Verbrauch</Text>
                  <Text style={[T.bodyMed, { color: C.text }]}>≈ {estKcal} kcal</Text>
                </View>
              )}
              <Text style={[T.caption, { color: C.textTertiary, marginTop: S.sm }]}>
                Schätzung über MET-Wert & dein Gewicht — dient als Richtwert fürs Tagesziel.
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
