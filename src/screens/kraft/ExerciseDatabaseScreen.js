/**
 * screens/kraft/ExerciseDatabaseScreen.js — Übungsdatenbank
 *
 * Durchsuchbare und filterbare Liste aller Übungen aus data/exercises.js.
 * Kann in zwei Modi betrieben werden:
 *   - Normal: Tippen → ExerciseDetail-Screen
 *   - selectMode (route.params.returnTo gesetzt): Tippen auf "+" → setPendingExercise + goBack
 *
 * Filterung:
 *   - Freitext-Suche (name_de)
 *   - Muskel-Filter (Multi-Select, hierarchisch via MuscleFilterModal)
 *   - Ausrüstungs-Filter (Multi-Select via EquipmentFilterModal)
 *   - activeMuscleIds: expandiert Elterngruppen auf alle Sub-IDs für korrektes Matching
 */

// React/RN
import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Internal
import { useTheme } from '../../theme';
import { EXERCISES, MUSCLE_COLORS, getExerciseImageUrl, muscleIcon } from '../../data/exercises';
import { useKraftStore } from '../../store/kraftStore';
import {
  MUSCLE_GROUPS, EQUIPMENT_OPTIONS,
  EquipmentFilterModal, MuscleFilterModal, FilterButton,
} from '../../components/ExerciseFilterModals';

// ─── Exercise row ───────────────────────────────────────────────────────────
function ExerciseRow({ item, selectMode, onSelect, onDetail }) {
  const { colors: C, spacing: S } = useTheme();
  const imgUrl = getExerciseImageUrl(item);
  const [imgFailed, setImgFailed] = useState(false);
  const muscleColor = MUSCLE_COLORS[item.muscle_group] || C.accent;

  return (
    <TouchableOpacity
      onPress={() => onDetail(item)}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}
      activeOpacity={0.7}
    >
      <View style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: C.surface, marginRight: S.sm, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
        {imgUrl && !imgFailed ? (
          <Image source={{ uri: imgUrl }} style={{ width: 54, height: 54, resizeMode: 'cover' }} onError={() => setImgFailed(true)} />
        ) : (
          <View style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: muscleColor + '22', justifyContent: 'center', alignItems: 'center' }}>
            <MaterialCommunityIcons name={muscleIcon(item.muscle_group)} size={24} color={muscleColor} />
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
      {selectMode ? (
        <TouchableOpacity
          onPress={() => onSelect(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ backgroundColor: C.accent, borderRadius: 8, padding: 8, marginLeft: 8 }}
        >
          <Feather name="plus" size={17} color={C.bg} />
        </TouchableOpacity>
      ) : (
        <Feather name="chevron-right" size={18} color={C.textTertiary} style={{ marginLeft: 4 }} />
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────
export default function ExerciseDatabaseScreen({ navigation, route }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const selectMode = !!route?.params?.returnTo;
  const { setPendingExercise } = useKraftStore();

  const [query, setQuery] = useState('');
  const [selectedMuscles, setSelectedMuscles] = useState([]);
  const [selectedEquipments, setSelectedEquipments] = useState([]);
  const [muscleModal, setMuscleModal] = useState(false);
  const [equipmentModal, setEquipmentModal] = useState(false);

  // Expand all sub-IDs for selected muscles
  const activeMuscleIds = useMemo(() => {
    const ids = new Set(selectedMuscles);
    MUSCLE_GROUPS.forEach(g => {
      if (selectedMuscles.includes(g.id)) {
        g.subs.forEach(s => ids.add(s.id));
      }
    });
    return ids;
  }, [selectedMuscles]);

  const filtered = useMemo(() => EXERCISES.filter(ex => {
    const matchQ = !query || ex.name_de.toLowerCase().includes(query.toLowerCase());
    const matchE = selectedEquipments.length === 0 || selectedEquipments.includes(ex.equipment);
    const matchM = selectedMuscles.length === 0 ||
      activeMuscleIds.has(ex.muscle_group) ||
      Object.keys(ex.worked_muscles || {}).some(m => activeMuscleIds.has(m));
    return matchQ && matchE && matchM;
  }), [query, selectedMuscles, selectedEquipments, activeMuscleIds]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.md, paddingBottom: S.sm, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: S.sm }}>
            <Feather name="arrow-left" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[T.h2, { color: C.text, flex: 1 }]}>
            {selectMode ? 'Übung hinzufügen' : 'Übungsdatenbank'}
          </Text>
          <Text style={{ color: C.textTertiary, fontSize: 13 }}>{filtered.length}</Text>
        </View>

        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, paddingHorizontal: S.sm, marginBottom: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="search" size={16} color={C.textSecondary} style={{ marginRight: S.xs }} />
          <TextInput
            style={{ flex: 1, color: C.text, paddingVertical: 10, fontSize: 15 }}
            placeholder="Übung suchen…"
            placeholderTextColor={C.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoFocus={selectMode}
          />
          {query ? <TouchableOpacity onPress={() => setQuery('')}><Feather name="x" size={16} color={C.textSecondary} /></TouchableOpacity> : null}
        </View>

        {/* Two filter buttons */}
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <FilterButton
            onPress={() => setEquipmentModal(true)}
            icon="tool"
            label="Ausrüstung"
            count={selectedEquipments.length}
          />
          <FilterButton
            onPress={() => setMuscleModal(true)}
            icon="user"
            label="Alle Muskeln"
            count={selectedMuscles.length}
          />
        </View>
      </View>

      {selectMode && (
        <View style={{ paddingHorizontal: S.md, paddingVertical: 6, backgroundColor: C.accent + '18' }}>
          <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>
            Tippe auf "+" um hinzuzufügen · Tippe auf Name für Details
          </Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={ex => String(ex.id)}
        renderItem={({ item }) => (
          <ExerciseRow
            item={item}
            selectMode={selectMode}
            onSelect={(ex) => { setPendingExercise(ex); navigation.goBack(); }}
            onDetail={(ex) => navigation.navigate('ExerciseDetail', { exercise: ex })}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ color: C.textTertiary, fontSize: 16 }}>Keine Übungen gefunden</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        keyboardDismissMode="on-drag"
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
    </View>
  );
}
