/**
 * screens/kraft/RoutineEditScreen.js — Routine erstellen/bearbeiten
 *
 * Reihenfolge ändern: ↑ ↓ Buttons pro Übung (funktioniert zuverlässig in Expo Go).
 * Echtes Drag & Drop kommt mit dem EAS / Dev-Client Build via RNGH.
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
  Modal, FlatList, Image, Linking, ActivityIndicator,
} from 'react-native';

import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../theme';
import { useKraftStore } from '../../store/kraftStore';
import { EXERCISES, MUSCLE_COLORS, getExerciseImageUrl, muscleIcon } from '../../data/exercises';
import {
  MUSCLE_GROUPS, EQUIPMENT_OPTIONS,
  EquipmentFilterModal, MuscleFilterModal, FilterButton,
} from '../../components/ExerciseFilterModals';

// ── Einzelne Übungszeile im Picker ───────────────────────────────────────────
function ExercisePickerRow({ item, onSelect, onDetail, colors: C, spacing: S }) {
  const [imgFailed, setImgFailed] = useState(false);
  const muscleColor = MUSCLE_COLORS[item.muscle_group] || C.accent;
  const imgUrl = getExerciseImageUrl(item);

  return (
    <TouchableOpacity
      onPress={() => onDetail(item)}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}
      activeOpacity={0.7}
    >
      <View style={{ width: 50, height: 50, borderRadius: 9, backgroundColor: C.surface, marginRight: S.sm, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
        {imgUrl && !imgFailed ? (
          <Image source={{ uri: imgUrl }} style={{ width: 50, height: 50, resizeMode: 'cover' }} onError={() => setImgFailed(true)} />
        ) : (
          <View style={{ width: 50, height: 50, backgroundColor: muscleColor + '22', justifyContent: 'center', alignItems: 'center' }}>
            <MaterialCommunityIcons name={muscleIcon(item.muscle_group)} size={22} color={muscleColor} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{item.name_de}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 }}>
          <View style={{ backgroundColor: muscleColor + '28', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 }}>
            <Text style={{ color: muscleColor, fontSize: 11, fontWeight: '700' }}>{item.muscle_group}</Text>
          </View>
          <Text style={{ color: C.textTertiary, fontSize: 11 }}>{item.equipment}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Feather name="chevron-right" size={15} color={C.textTertiary} />
        <TouchableOpacity
          onPress={() => onSelect(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ backgroundColor: C.accent, borderRadius: 8, padding: 7 }}
        >
          <Feather name="plus" size={16} color={C.bg} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── Übungs-Detail Inline (innerhalb Modal) ───────────────────────────────────
function ExerciseDetailInline({ exercise, onAdd, onBack, colors: C, spacing: S, radius: R }) {
  const insets = useSafeAreaInsets();
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const muscleColor = MUSCLE_COLORS[exercise.muscle_group] || C.accent;
  const imgUrl = getExerciseImageUrl(exercise);

  const steps = exercise.instructions_de
    ? exercise.instructions_de.split('\n').filter(Boolean)
    : [];

  const openVideo = () => {
    const q = encodeURIComponent(exercise.name_de + ' Ausführung Tutorial');
    Linking.openURL(`https://www.youtube.com/results?search_query=${q}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: 16, paddingHorizontal: S.md, paddingBottom: S.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={onBack} style={{ marginRight: S.sm }}>
            <Feather name="arrow-left" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 17 }} numberOfLines={1}>{exercise.name_de}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
              <View style={{ backgroundColor: muscleColor + '33', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
                <Text style={{ color: muscleColor, fontSize: 11, fontWeight: '700' }}>{exercise.muscle_group}</Text>
              </View>
              <Text style={{ color: C.textTertiary, fontSize: 11, alignSelf: 'center' }}>{exercise.equipment}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={openVideo} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
            <Feather name="youtube" size={13} color={C.accent} />
            <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>Video</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 100 }}>
        <View style={{ height: 200, backgroundColor: C.surface, borderRadius: R.md, overflow: 'hidden', marginBottom: S.md, justifyContent: 'center', alignItems: 'center' }}>
          {imgUrl && !imgFailed ? (
            <>
              {!imgLoaded && <ActivityIndicator color={muscleColor} style={{ position: 'absolute' }} />}
              <Image source={{ uri: imgUrl }} style={{ width: '100%', height: 200, resizeMode: 'contain' }} onLoad={() => setImgLoaded(true)} onError={() => setImgFailed(true)} />
            </>
          ) : (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: muscleColor + '22', justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name={muscleIcon(exercise.muscle_group)} size={34} color={muscleColor} />
              </View>
              <Text style={{ color: C.textTertiary, fontSize: 12 }}>Kein Bild verfügbar</Text>
            </View>
          )}
        </View>

        {steps.length > 0 && (
          <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md }}>
            <Text style={{ color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: S.sm }}>SCHRITT-FÜR-SCHRITT</Text>
            <View style={{ gap: 12 }}>
              {steps.map((step, i) => {
                const text = step.replace(/^\d+\.\s*/, '').trim();
                const num = step.match(/^(\d+)\./)?.[1] || String(i + 1);
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.accent + '22', justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700' }}>{num}</Text>
                    </View>
                    <Text style={{ color: C.text, fontSize: 14, lineHeight: 22, flex: 1 }}>{text}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: S.md, right: S.md }}>
        <TouchableOpacity
          onPress={onAdd}
          style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.xs }}
        >
          <Feather name="plus" size={18} color={C.bg} />
          <Text style={{ color: C.bg, fontWeight: '700', fontSize: 16 }}>Zur Routine hinzufügen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Exercise Picker Modal ─────────────────────────────────────────────────────
function ExercisePickerModal({ visible, onClose, onSelect, colors: C, spacing: S, radius: R }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [selectedMuscles, setSelectedMuscles] = useState([]);
  const [selectedEquipments, setSelectedEquipments] = useState([]);
  const [muscleModal, setMuscleModal] = useState(false);
  const [equipmentModal, setEquipmentModal] = useState(false);
  const [detailEx, setDetailEx] = useState(null);

  const activeMuscleIds = React.useMemo(() => {
    const ids = new Set(selectedMuscles);
    MUSCLE_GROUPS.forEach(g => {
      if (selectedMuscles.includes(g.id)) g.subs.forEach(s => ids.add(s.id));
    });
    return ids;
  }, [selectedMuscles]);

  const filtered = React.useMemo(() => EXERCISES.filter(ex => {
    const matchQ = !query || ex.name_de.toLowerCase().includes(query.toLowerCase());
    const matchE = selectedEquipments.length === 0 || selectedEquipments.includes(ex.equipment);
    const matchM = selectedMuscles.length === 0 ||
      activeMuscleIds.has(ex.muscle_group) ||
      Object.keys(ex.worked_muscles || {}).some(m => activeMuscleIds.has(m));
    return matchQ && matchM && matchE;
  }), [query, selectedMuscles, selectedEquipments, activeMuscleIds]);

  const handleAdd = (ex) => {
    onSelect(ex);
    setDetailEx(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (detailEx) setDetailEx(null); else onClose(); }}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {detailEx ? (
          <ExerciseDetailInline
            exercise={detailEx}
            onBack={() => setDetailEx(null)}
            onAdd={() => handleAdd(detailEx)}
            colors={C} spacing={S} radius={R}
          />
        ) : (
          <>
            <View style={{ paddingTop: 16, paddingHorizontal: S.md, paddingBottom: S.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 17, flex: 1 }}>Übung wählen</Text>
                <TouchableOpacity onPress={onClose}>
                  <Feather name="x" size={22} color={C.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, paddingHorizontal: S.sm, marginBottom: S.sm }}>
                <Feather name="search" size={15} color={C.textSecondary} style={{ marginRight: 6 }} />
                <TextInput
                  style={{ flex: 1, color: C.text, paddingVertical: 9, fontSize: 15 }}
                  placeholder="Suchen…"
                  placeholderTextColor={C.textTertiary}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                />
                {query ? <TouchableOpacity onPress={() => setQuery('')}><Feather name="x" size={15} color={C.textSecondary} /></TouchableOpacity> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <FilterButton onPress={() => setEquipmentModal(true)} icon="tool" label="Ausrüstung" count={selectedEquipments.length} />
                <FilterButton onPress={() => setMuscleModal(true)} icon="user" label="Alle Muskeln" count={selectedMuscles.length} />
              </View>
            </View>

            <FlatList
              data={filtered}
              keyExtractor={ex => String(ex.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              renderItem={({ item }) => (
                <ExercisePickerRow item={item} onSelect={(ex) => handleAdd(ex)} onDetail={setDetailEx} colors={C} spacing={S} />
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 60 }}>
                  <Text style={{ color: C.textTertiary }}>Keine Übungen gefunden</Text>
                </View>
              }
            />

            <EquipmentFilterModal
              visible={equipmentModal}
              onClose={() => setEquipmentModal(false)}
              selected={selectedEquipments}
              onChange={setSelectedEquipments}
            />
            <MuscleFilterModal
              visible={muscleModal}
              onClose={() => setMuscleModal(false)}
              selected={selectedMuscles}
              onChange={setSelectedMuscles}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function RoutineEditScreen({ navigation, route }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const existing = route?.params?.routine;
  const { createRoutine, updateRoutine } = useKraftStore();

  const [name, setName] = useState(existing?.name || '');
  const [folder, setFolder] = useState(existing?.folder_name || '');
  const [exercises, setExercises] = useState(() => {
    if (!existing?.exercises) return [];
    if (Array.isArray(existing.exercises)) return existing.exercises;
    try { return JSON.parse(existing.exercises); } catch { return []; }
  });
  const [saving, setSaving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const moveExercise = (from, to) => {
    if (to < 0 || to >= exercises.length) return;
    setExercises(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  const handleAddExercise = (ex) => {
    setExercises(prev => [...prev, {
      exercise_id: ex.id,
      name: ex.name_de || ex.name,
      muscle_group: ex.muscle_group,
      sets: [{ reps: 10, weight_kg: 0 }],
    }]);
  };

  const handleRemoveExercise = (i) => {
    setExercises(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Fehler', 'Bitte einen Namen eingeben'); return; }
    setSaving(true);
    try {
      const data = { name: name.trim(), folder_name: folder.trim() || null, exercises };
      if (existing?.id) {
        await updateRoutine(existing.id, data);
      } else {
        await createRoutine(data);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.md, paddingBottom: S.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: S.sm }}>
            <Feather name="x" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[T.h2, { color: C.text, flex: 1 }]}>{existing ? 'Routine bearbeiten' : 'Neue Routine'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={{ color: C.accent, fontWeight: '700', fontSize: 16 }}>{saving ? '…' : 'Speichern'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.xs }}>NAME</Text>
          <TextInput
            style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, color: C.text, fontSize: 16, marginBottom: S.md }}
            placeholder="z.B. Push A"
            placeholderTextColor={C.textTertiary}
            value={name}
            onChangeText={setName}
          />

          {/* Ordner */}
          <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.xs }}>ORDNER (optional)</Text>
          <TextInput
            style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, color: C.text, fontSize: 16, marginBottom: S.md }}
            placeholder="z.B. PPL"
            placeholderTextColor={C.textTertiary}
            value={folder}
            onChangeText={setFolder}
          />

          {/* Übungen */}
          <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.sm }}>ÜBUNGEN ({exercises.length})</Text>

          {exercises.map((ex, i) => {
            const setsCount = Array.isArray(ex.sets) ? ex.sets.length : 1;
            const defaultReps = ex.sets?.[0]?.reps ?? 10;
            const defaultWeight = ex.sets?.[0]?.weight_kg ?? 0;
            const accentColor = MUSCLE_COLORS[ex.muscle_group] || C.accent;

            const updateSetsCount = (val) => {
              const n = Math.max(1, Math.min(20, parseInt(val) || 1));
              const base = ex.sets?.[0] || { reps: 10, weight_kg: 0 };
              setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, sets: Array.from({ length: n }, () => ({ ...base })) } : e));
            };
            const updateReps = (val) => {
              const reps = parseInt(val) || 0;
              setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, sets: (e.sets || []).map(s => ({ ...s, reps })) } : e));
            };
            const updateWeight = (val) => {
              const weight_kg = parseFloat(val) || 0;
              setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, sets: (e.sets || []).map(s => ({ ...s, weight_kg })) } : e));
            };

            return (
              <View key={i} style={{ backgroundColor: C.surface, borderRadius: R.md, marginBottom: S.sm, overflow: 'hidden', flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <View style={{ width: 4, backgroundColor: accentColor }} />
                <View style={{ flex: 1, padding: S.sm }}>
                  {/* Exercise header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    {/* Up/Down reorder buttons */}
                    <View style={{ marginRight: 6, gap: 2 }}>
                      <TouchableOpacity
                        onPress={() => moveExercise(i, i - 1)}
                        disabled={i === 0}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Feather name="chevron-up" size={18} color={i === 0 ? C.textTertiary + '44' : C.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => moveExercise(i, i + 1)}
                        disabled={i === exercises.length - 1}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Feather name="chevron-down" size={18} color={i === exercises.length - 1 ? C.textTertiary + '44' : C.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{ex.name}</Text>
                      <Text style={{ color: C.textSecondary, fontSize: 12, marginTop: 1 }}>{ex.muscle_group}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveExercise(i)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Feather name="trash-2" size={16} color={C.danger} />
                    </TouchableOpacity>
                  </View>

                  {/* Sätze / Wdh / KG */}
                  <View style={{ flexDirection: 'row', gap: S.sm }}>
                    {[
                      { label: 'SÄTZE', value: String(setsCount), onChange: updateSetsCount, kbType: 'number-pad' },
                      { label: 'WDH',   value: String(defaultReps), onChange: updateReps,      kbType: 'number-pad' },
                      { label: 'KG',    value: defaultWeight ? String(defaultWeight) : '', onChange: updateWeight, kbType: 'decimal-pad', placeholder: '0' },
                    ].map(({ label, value, onChange, kbType, placeholder }) => (
                      <View key={label} style={{ flex: 1 }}>
                        <Text style={{ color: C.textTertiary, fontSize: 10, fontWeight: '600', marginBottom: 3 }}>{label}</Text>
                        <TextInput
                          style={{ backgroundColor: C.bg, borderRadius: R.sm, padding: 6, color: C.text, textAlign: 'center', fontSize: 15 }}
                          keyboardType={kbType}
                          value={value}
                          placeholder={placeholder}
                          placeholderTextColor={C.textTertiary}
                          onChangeText={onChange}
                          returnKeyType="done"
                        />
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            onPress={() => setPickerVisible(true)}
            style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.xs, borderWidth: 1, borderColor: C.accent + '55', borderStyle: 'dashed' }}
          >
            <Feather name="plus" size={18} color={C.accent} />
            <Text style={{ color: C.accent, fontWeight: '600' }}>Übung hinzufügen</Text>
          </TouchableOpacity>
        </ScrollView>

        <ExercisePickerModal
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelect={handleAddExercise}
          colors={C}
          spacing={S}
          radius={R}
        />

      </KeyboardAvoidingView>
    </View>
  );
}
