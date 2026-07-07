/**
 * screens/kraft/LiveWorkoutScreen.js — Laufendes Workout
 *
 * Haupt-Screen während eines aktiven Workouts. Zeigt alle Übungen mit Sätzen,
 * Gewicht, Wiederholungen, Timer und Muskel-Heatmap.
 *
 * Interne Komponenten:
 *   PRToast              — Animiertes Toast bei neuem Persönlichem Rekord
 *   RestTimerBanner      — Sticky-Banner mit Pausentimer und Duration-Pills
 *   SetRow               — Einzelner Satz (swipeable, tippt Typ-Badge)
 *   ExerciseCard         — Übungs-Karte mit allen Sets, Notizen, Rest-Duration-Pills
 *   ExercisePickerModal  — Modal zum Hinzufügen von Übungen (Suche + Filter)
 *   ExercisePickerRow    — Einzelne Zeile im Picker
 *   BodyIconHalf         — Mini-Body-Icon (14×22dp) für Header-Thumbnail
 *   MuscleHeatmapSheet   — Bottom-Sheet mit MuscleMap + Balken für alle trainierten Muskeln
 *
 * Wichtige Implementierungsdetails:
 *   - muscleCountsLive: { [muscle]: { primary: n, secondary: m } } — KEIN einfaches n
 *   - REST_DURATIONS Pills: [60, 90, 120, 180]s, pro Übung speicherbar
 *   - 3-dots Menü → Alert.alert confirmation vor removeExercise
 *   - AppState-Listener für Hintergrund-Zeit-Ausgleich beim Workout-Timer
 *   - Vibration.vibrate([0, 500, 200, 500]) wenn Pausentimer abläuft
 */

// React/RN
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, PanResponder, Animated, AppState, Modal, FlatList, Image, Dimensions, Vibration,
} from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Internal
import { useTheme } from '../../theme';
import { useKraftStore } from '../../store/kraftStore';
import { EXERCISES, MUSCLE_GROUPS, EQUIPMENT_TYPES, MUSCLE_COLORS, getExerciseImageUrl, muscleIcon } from '../../data/exercises';
import MuscleMap, { OVERLAYS, MUSCLE_CONFIG, resolveOverlays } from '../../components/MuscleMap';

const BODY_FRONT       = require('../../../assets/muscles/body_front.png');
const BODY_BACK        = require('../../../assets/muscles/body_back.png');
const BODY_FRONT_DARK  = require('../../../assets/muscles/body_front_dark.png');
const BODY_BACK_DARK   = require('../../../assets/muscles/body_back_dark.png');

const SET_TYPE_ORDER = ['normal', 'warmup', 'dropset', 'failure'];
const SET_TYPE_CONFIG = {
  normal:  { label: null,  bg: 'transparent', color: null },
  warmup:  { label: 'W',   bg: '#F59E0B',     color: 'white' },
  dropset: { label: 'D',   bg: '#3B82F6',     color: 'white' },
  failure: { label: 'F',   bg: '#EF4444',     color: 'white' },
};

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatRestTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── PR Toast ──────────────────────────────────────────────────────
function PRToast({ visible, text }) {
  const { colors: C, spacing: S, radius: R } = useTheme();
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -60, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible && opacity._value === 0) return null;

  return (
    <Animated.View style={{
      position: 'absolute',
      top: 100,
      left: S.md,
      right: S.md,
      zIndex: 999,
      transform: [{ translateY }],
      opacity,
    }}>
      <View style={{
        backgroundColor: C.surface,
        borderRadius: R.md,
        borderWidth: 1.5,
        borderColor: C.accent,
        paddingHorizontal: S.md,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 6,
      }}>
        <MaterialCommunityIcons name="trophy" size={22} color="#E8C547" />
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, flex: 1 }}>{text}</Text>
      </View>
    </Animated.View>
  );
}

// ── Rest Timer Banner ─────────────────────────────────────────────
function RestTimerBanner({ restTimer, restTimerDuration, onDismiss, onSetDuration, accentColor }) {
  const { colors: C, spacing: S } = useTheme();
  if (!restTimer) return null;

  const { remaining, total } = restTimer;
  const progress = total > 0 ? remaining / total : 0;
  const isUrgent = remaining <= 10;
  const durations = [60, 90, 120, 180];

  return (
    <View style={{
      backgroundColor: C.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
      height: 52,
      overflow: 'hidden',
    }}>
      {/* Progress bar at bottom */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: C.border }}>
        <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: isUrgent ? '#EF4444' : accentColor }} />
      </View>

      {/* Content row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, height: 48, gap: S.sm }}>
        {/* Countdown */}
        <Text style={{ color: isUrgent ? '#EF4444' : accentColor, fontSize: 22, fontWeight: '700', minWidth: 54 }}>
          {formatRestTime(remaining)}
        </Text>

        {/* Duration pills */}
        <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
          {durations.map(d => {
            const selected = restTimerDuration === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => onSetDuration(d)}
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 99,
                  backgroundColor: selected ? accentColor : 'transparent',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: selected ? accentColor : C.border,
                }}
              >
                <Text style={{ color: selected ? 'white' : C.textTertiary, fontSize: 11, fontWeight: '700' }}>
                  {d}s
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Dismiss */}
        <TouchableOpacity onPress={onDismiss} style={{ padding: 4 }}>
          <Feather name="x" size={18} color={C.textTertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Swipeable Set Row ─────────────────────────────────────────────
function SetRow({ set, setIdx, exIdx, prevSet, onUpdate, onToggle, onDelete, onTypeChange, isFirst }) {
  const { colors: C, spacing: S, radius: R } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const deleteVisible = useRef(false);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => {
      if (g.dx < 0) translateX.setValue(Math.max(g.dx, -80));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -50) {
        Animated.spring(translateX, { toValue: -72, useNativeDriver: true }).start();
        deleteVisible.current = true;
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        deleteVisible.current = false;
      }
    },
  })).current;

  const currentType = set.type || 'normal';
  const typeConfig = SET_TYPE_CONFIG[currentType];

  const handleTypePress = () => {
    const currentIdx = SET_TYPE_ORDER.indexOf(currentType);
    const nextType = SET_TYPE_ORDER[(currentIdx + 1) % SET_TYPE_ORDER.length];
    onTypeChange(nextType);
  };

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Red delete background — only visible when swiped */}
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 72, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity onPress={onDelete}>
          <Feather name="trash-2" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={{ transform: [{ translateX }], backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: S.sm, gap: S.xs }}
        {...panResponder.panHandlers}
      >
        {/* Green completion overlay */}
        {set.completed && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#22C55E20' }} pointerEvents="none" />
        )}

        {/* SET type badge */}
        <View style={{ width: 32, alignItems: 'center' }}>
          <TouchableOpacity onPress={handleTypePress}>
            {currentType === 'normal' ? (
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.textSecondary, fontSize: 14, fontWeight: '600' }}>{setIdx + 1}</Text>
              </View>
            ) : (
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: typeConfig.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: typeConfig.color, fontSize: 13, fontWeight: '700' }}>{typeConfig.label}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* PREV */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: C.textTertiary, fontSize: 12 }} numberOfLines={1}>
            {prevSet ? `${prevSet.weight_kg}×${prevSet.reps}` : '—'}
          </Text>
        </View>

        {/* KG */}
        <TextInput
          style={{ flex: 1, backgroundColor: C.bg, borderRadius: R.sm, textAlign: 'center', color: C.text, paddingVertical: 6, fontSize: 15 }}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={C.textTertiary}
          value={set.weight_kg !== '' ? String(set.weight_kg) : ''}
          onChangeText={v => onUpdate('weight_kg', v)}
          returnKeyType="done"
        />

        {/* WDH */}
        <TextInput
          style={{ flex: 1, backgroundColor: C.bg, borderRadius: R.sm, textAlign: 'center', color: C.text, paddingVertical: 6, fontSize: 15 }}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={C.textTertiary}
          value={set.reps !== '' ? String(set.reps) : ''}
          onChangeText={v => onUpdate('reps', v)}
          returnKeyType="done"
        />

        {/* Checkmark */}
        <TouchableOpacity
          onPress={onToggle}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: set.completed ? '#22C55E' : C.surface, justifyContent: 'center', alignItems: 'center' }}
        >
          <Feather name="check" size={16} color={set.completed ? 'white' : C.textTertiary} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Exercise Card ─────────────────────────────────────────────────
const REST_DURATIONS = [60, 90, 120, 180];

function ExerciseCard({ exercise, exIdx, exCount, navigation, lastSets, onPRDetected, startRestTimer }) {
  const { colors: C, spacing: S, radius: R } = useTheme();
  const { updateSetWithFill, toggleSetComplete, addSet, deleteSet, removeExercise, moveExercise, updateExerciseNotes, updateSetType, checkAndNotifyPR, setExerciseRestDuration } = useKraftStore();
  const muscleColor = MUSCLE_COLORS[exercise.muscle_group] || C.accent;
  const restDuration = exercise.restDuration || 90;

  const handleToggle = (si) => {
    const set = exercise.sets[si];
    const wasCompleted = set.completed;
    toggleSetComplete(exIdx, si);

    if (!wasCompleted) {
      startRestTimer(restDuration);

      if (exercise.exerciseId && set.weight_kg && set.reps) {
        const isPR = checkAndNotifyPR(exercise.exerciseId, set.weight_kg, set.reps);
        if (isPR && onPRDetected) {
          onPRDetected('Neuer PR! ' + set.weight_kg + ' kg × ' + set.reps);
        }
      }
    }
  };

  const handleMenu = () => {
    Alert.alert(exercise.name, '', [
      { text: 'Übung entfernen', style: 'destructive', onPress: () => removeExercise(exIdx) },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: R.md, marginBottom: S.sm, overflow: 'hidden' }}>
      {/* Exercise header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.sm, paddingBottom: S.xs }}>
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('ExerciseDetail', { exercise: { id: exercise.exerciseId, name_de: exercise.name, muscle_group: exercise.muscle_group } })}
        >
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{exercise.name}</Text>
          {exercise.muscle_group ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: muscleColor, marginRight: 5 }} />
              <Text style={{ color: C.textSecondary, fontSize: 12 }}>{exercise.muscle_group}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        {/* Per-exercise rest duration pills */}
        <View style={{ flexDirection: 'row', gap: 3, marginRight: S.xs }}>
          {REST_DURATIONS.map(d => {
            const active = restDuration === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setExerciseRestDuration(exIdx, d)}
                style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 99, backgroundColor: active ? muscleColor + '33' : 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: active ? muscleColor : C.border }}
              >
                <Text style={{ color: active ? muscleColor : C.textTertiary, fontSize: 10, fontWeight: '700' }}>{d}s</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {/* Reorder buttons */}
        <View style={{ gap: 1, marginRight: 2 }}>
          <TouchableOpacity
            onPress={() => moveExercise(exIdx, exIdx - 1)}
            disabled={exIdx === 0}
            hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}
          >
            <Feather name="chevron-up" size={16} color={exIdx === 0 ? C.textTertiary + '33' : C.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => moveExercise(exIdx, exIdx + 1)}
            disabled={exIdx === exCount - 1}
            hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}
          >
            <Feather name="chevron-down" size={16} color={exIdx === exCount - 1 ? C.textTertiary + '33' : C.textTertiary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleMenu} style={{ padding: 4 }}>
          <Feather name="more-horizontal" size={20} color={C.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Column headers */}
      <View style={{ flexDirection: 'row', paddingHorizontal: S.sm, paddingTop: S.xs, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }}>
        <View style={{ width: 32, alignItems: 'center' }}><Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '600' }}>SET</Text></View>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '600' }}>VORIGE</Text></View>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '600' }}>KG</Text></View>
        <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '600' }}>WDH</Text></View>
        <View style={{ width: 32 }} />
      </View>

      {/* Sets */}
      {exercise.sets.map((set, si) => (
        <SetRow
          key={si}
          set={set}
          setIdx={si}
          exIdx={exIdx}
          prevSet={lastSets?.[si]}
          isFirst={si === 0}
          onUpdate={(field, val) => updateSetWithFill(exIdx, si, field, val)}
          onToggle={() => handleToggle(si)}
          onDelete={() => deleteSet(exIdx, si)}
          onTypeChange={(type) => updateSetType(exIdx, si, type)}
        />
      ))}

      {/* Add set */}
      <TouchableOpacity
        onPress={() => addSet(exIdx)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: S.sm, gap: S.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }}
      >
        <Feather name="plus" size={15} color={C.accent} />
        <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600' }}>Satz hinzufügen</Text>
      </TouchableOpacity>

      {/* Notes field */}
      <TextInput
        style={{ color: C.textSecondary, fontSize: 13, paddingHorizontal: S.sm, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, minHeight: 36 }}
        placeholder="Notizen zur Übung…"
        placeholderTextColor={C.textTertiary}
        value={exercise.notes || ''}
        onChangeText={v => updateExerciseNotes(exIdx, v)}
        multiline
      />
    </View>
  );
}

// ── Exercise Picker Row ───────────────────────────────────────────
function ExercisePickerRow({ ex, onSelect }) {
  const { colors: C, spacing: S } = useTheme();
  const [imgFailed, setImgFailed] = useState(false);
  const imgUrl = getExerciseImageUrl(ex);
  const muscleColor = MUSCLE_COLORS[ex.muscle_group] || C.accent;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
      <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: muscleColor + '22', marginRight: S.sm, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
        {imgUrl && !imgFailed ? (
          <Image source={{ uri: imgUrl }} style={{ width: 48, height: 48, resizeMode: 'cover' }} onError={() => setImgFailed(true)} />
        ) : (
          <MaterialCommunityIcons name={muscleIcon(ex.muscle_group)} size={22} color={C.textSecondary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{ex.name_de}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 6 }}>
          <View style={{ backgroundColor: muscleColor + '33', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ color: muscleColor, fontSize: 11, fontWeight: '700' }}>{ex.muscle_group}</Text>
          </View>
          <Text style={{ color: C.textTertiary, fontSize: 11 }}>{ex.equipment}</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onSelect(ex)}
        style={{ backgroundColor: C.accent, borderRadius: 8, padding: 8, marginLeft: 8 }}
      >
        <Feather name="plus" size={17} color={C.bg} />
      </TouchableOpacity>
    </View>
  );
}

// ── Exercise Picker Modal ─────────────────────────────────────────
function ExercisePickerModal({ visible, onClose, onSelect }) {
  const { colors: C, spacing: S, radius: R } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('Alle');
  const [equipment, setEquipment] = useState('Alle');

  const filtered = useMemo(() => EXERCISES.filter(ex => {
    const matchQ = !query || ex.name_de.toLowerCase().includes(query.toLowerCase());
    const matchM = muscle === 'Alle' || ex.muscle_group === muscle;
    const matchE = equipment === 'Alle' || ex.equipment === equipment;
    return matchQ && matchM && matchE;
  }), [query, muscle, equipment]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={{ paddingTop: S.lg, paddingHorizontal: S.md, paddingBottom: S.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 18, flex: 1 }}>Übung hinzufügen</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Feather name="x" size={22} color={C.textSecondary} />
            </TouchableOpacity>
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
              autoFocus
            />
            {query ? <TouchableOpacity onPress={() => setQuery('')}><Feather name="x" size={16} color={C.textSecondary} /></TouchableOpacity> : null}
          </View>
          {/* Muscle filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
            {MUSCLE_GROUPS.map(m => {
              const color = MUSCLE_COLORS[m];
              const active = muscle === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMuscle(m)}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: active ? (color || C.accent) : C.surface, marginRight: 6, borderWidth: active ? 0 : StyleSheet.hairlineWidth, borderColor: C.border }}
                >
                  <Text style={{ color: active ? 'white' : C.textSecondary, fontSize: 13, fontWeight: '600' }}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Equipment filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {EQUIPMENT_TYPES.map(eq => (
              <TouchableOpacity
                key={eq}
                onPress={() => setEquipment(eq)}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: equipment === eq ? C.accent + '22' : 'transparent', marginRight: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: equipment === eq ? C.accent : C.border }}
              >
                <Text style={{ color: equipment === eq ? C.accent : C.textTertiary, fontSize: 12, fontWeight: '600' }}>{eq}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: S.md, paddingVertical: 6, backgroundColor: C.accent + '18' }}>
          <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>{filtered.length} Übungen · Tippe auf + zum Hinzufügen</Text>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={ex => String(ex.id)}
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          renderItem={({ item: ex }) => (
            <ExercisePickerRow ex={ex} onSelect={onSelect} />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ color: C.textTertiary, fontSize: 16 }}>Keine Übungen gefunden</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

/** Deutsche Labels für Sub-Muskeln (für MuscleHeatmapSheet). */
const SUB_LABELS = {
  BrustOben: 'Obere Brust', BrustMitte: 'Mittlere Brust', BrustUnten: 'Untere Brust',
  BizepsLang: 'Langer Kopf', BizepsKurz: 'Kurzer Kopf', Brachialis: 'Brachialis',
  TrizepsLang: 'Langer Kopf', TrizepsLateral: 'Seitl. Kopf',
  LowerBack: 'Unterer Rücken', TrapezOben: 'Ob. Trapez', Rhomboiden: 'Rhomboiden', TeresMajor: 'Teres Major',
  Adduktoren: 'Adduktoren', Abduktoren: 'Abduktoren', GesäßMed: 'Gl. Medius',
  Hamstrings: 'Hamstrings', Obliques: 'Obliques',
};

// ── Mini Body Icon — 14×22dp Thumbnail für Header ────────────────────────────

/**
 * Rendert eine Körperhälfte (front oder back) als Mini-Thumbnail mit
 * intensitäts-basierten Farb-Overlays. Kein MuscleMap — eigene Implementierung
 * für sehr kleine Darstellung (14×22dp).
 */
function BodyIconHalf({ side, workedMuscles, muscleCounts, isDark }) {
  const baseSource = side === 'front'
    ? (isDark ? BODY_FRONT_DARK : BODY_FRONT)
    : (isDark ? BODY_BACK_DARK  : BODY_BACK);
  const W = 14, H = 22;
  const s = { width: W, height: H, position: 'absolute', top: 0, left: 0 };

  const maxCount = muscleCounts && Object.keys(muscleCounts).length > 0
    ? Math.max(...Object.values(muscleCounts).map(v => typeof v === 'object' ? (v.primary || 0) + (v.secondary || 0) * 0.33 : v), 1) : 1;

  // Build per-muscle overlays with intensity-scaled opacity
  const overlayMap = new Map();
  Object.entries(workedMuscles).forEach(([muscle, level]) => {
    const cfg = MUSCLE_CONFIG[muscle]?.[side];
    if (!cfg?.primary || !OVERLAYS[side]?.[cfg.primary]) return;
    const overlayKey = cfg.primary;
    const src = OVERLAYS[side][overlayKey];
    const raw = muscleCounts?.[muscle];
    const isPrimary = level === 'primary';
    const primSets = typeof raw === 'object' ? (raw.primary || 0) : (isPrimary ? (raw || 1) : 0);
    const secSets  = typeof raw === 'object' ? (raw.secondary || 0) : (!isPrimary ? (raw || 1) : 0);
    const count    = primSets + secSets * 0.33;
    const intensity = Math.max(0.2, count / maxCount);
    const opacity = isPrimary ? intensity : intensity * 0.6;
    const existing = overlayMap.get(overlayKey);
    if (!existing || intensity > existing.intensity || (isPrimary && !existing.isPrimary)) {
      overlayMap.set(overlayKey, { src, color: isPrimary ? '#EF4444' : '#F97316', opacity, isPrimary, intensity });
    }
  });
  const overlayEntries = [...overlayMap.values()].sort((a, b) => a.opacity - b.opacity);

  return (
    <View style={{ width: W, height: H }}>
      <Image source={baseSource} style={[s, { tintColor: isDark ? '#A8A4A0' : '#888' }]} resizeMode="contain" />
      {overlayEntries.map(({ src, color, opacity }, i) => (
        <Image key={i} source={src} style={[s, { tintColor: color, opacity }]} resizeMode="contain" />
      ))}
    </View>
  );
}

// ── Muscle Heatmap Sheet ──────────────────────────────────────────
function MuscleHeatmapSheet({ visible, onClose, exercises, muscleCounts }) {
  const { colors: C, spacing: S, radius: R, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const SCREEN_H = Dimensions.get('window').height;

  // Aggregate worked muscles for body map
  const workedMuscles = useMemo(() => {
    const result = {};
    exercises.forEach(ex => {
      if (!ex.sets.some(s => s.completed)) return;
      const dbEx = EXERCISES.find(e => e.id === ex.exerciseId);
      const muscles = dbEx?.worked_muscles || (ex.muscle_group ? { [ex.muscle_group]: 'primary' } : {});
      Object.entries(muscles).forEach(([m, lvl]) => {
        if (!result[m] || lvl === 'primary') result[m] = lvl;
      });
    });
    return result;
  }, [exercises]);

  // Hierarchical: parent group → completed sets + sub-muscle breakdown
  const muscleGroups = useMemo(() => {
    const parentCounts = {};
    const subCounts = {};   // { parent: { subMuscle: count } }

    exercises.forEach(ex => {
      const done = ex.sets.filter(s => s.completed).length;
      if (!done) return;
      const parent = ex.muscle_group || 'Sonstiges';
      parentCounts[parent] = (parentCounts[parent] || 0) + done;

      const dbEx = EXERCISES.find(e => e.id === ex.exerciseId);
      if (dbEx?.worked_muscles) {
        const primary = Object.entries(dbEx.worked_muscles).find(([, v]) => v === 'primary')?.[0];
        // Only add sub if it differs from parent (= actual specificity info)
        if (primary && primary !== parent) {
          if (!subCounts[parent]) subCounts[parent] = {};
          subCounts[parent][primary] = (subCounts[parent][primary] || 0) + done;
        }
      }
    });

    return Object.entries(parentCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([group, sets]) => ({
        group,
        sets,
        subs: Object.entries(subCounts[group] || {}).sort((a, b) => b[1] - a[1]),
      }));
  }, [exercises]);

  const maxSets = Math.max(...muscleGroups.map(g => g.sets), 1);
  const hasData = muscleGroups.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

      <View style={{
        backgroundColor: C.bg,
        borderTopLeftRadius: R.xl,
        borderTopRightRadius: R.xl,
        maxHeight: SCREEN_H * 0.62,
        paddingBottom: insets.bottom + S.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: C.border,
      }}>
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingTop: S.sm, paddingBottom: 2 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }} />
        </View>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.sm }}>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 17, flex: 1 }}>Muskelübersicht</Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={20} color={C.textTertiary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: S.sm }}>
          {!hasData ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: C.textTertiary, fontSize: 15 }}>Noch keine Sätze abgeschlossen</Text>
            </View>
          ) : (
            <>
              <MuscleMap workedMuscles={workedMuscles} muscleCounts={muscleCounts} />

              {/* Hierarchical set bars */}
              <View style={{ marginTop: S.md }}>
                {muscleGroups.map(({ group, sets, subs }, gi) => {
                  const color = MUSCLE_COLORS[group] || C.accent;
                  const pct = (sets / maxSets) * 100;
                  return (
                    <View key={group} style={{ marginTop: gi === 0 ? 0 : 10 }}>
                      {gi > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginBottom: 10 }} />}
                      {/* Parent row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                        <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', width: 88 }} numberOfLines={1}>{group}</Text>
                        <View style={{ flex: 1, height: 9, backgroundColor: C.surface, borderRadius: 5, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 5 }} />
                        </View>
                        <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '700', width: 28, textAlign: 'right' }}>{sets}×</Text>
                      </View>

                      {/* Sub-muscle rows */}
                      {subs.map(([sub, subCount]) => {
                        const subPct = (subCount / maxSets) * 100;
                        const label = SUB_LABELS[sub] || sub;
                        return (
                          <View key={sub} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: 4, paddingLeft: 12 }}>
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color + '99', marginRight: 2 }} />
                            <Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '500', width: 76 }} numberOfLines={1}>{label}</Text>
                            <View style={{ flex: 1, height: 5, backgroundColor: C.surface, borderRadius: 3, overflow: 'hidden' }}>
                              <View style={{ width: `${subPct}%`, height: '100%', backgroundColor: color + 'AA', borderRadius: 3 }} />
                            </View>
                            <Text style={{ color: C.textTertiary, fontSize: 11, width: 28, textAlign: 'right' }}>{subCount}×</Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────
export default function LiveWorkoutScreen({ navigation, route }) {
  const { colors: C, spacing: S, radius: R, type: T, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    activeWorkout, tickTimer, togglePause, discardWorkout, lastSessionSets, addExercise,
    restTimer, restTimerDuration, startRestTimer, tickRestTimer, dismissRestTimer, setRestTimerDuration,
  } = useKraftStore();
  const [showPicker, setShowPicker] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [prToast, setPrToast] = useState({ visible: false, text: '' });
  const timerRef = useRef(null);
  const restTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const bgTimeRef = useRef(null);
  const prevRestTimerRef = useRef(restTimer);
  const prToastTimeoutRef = useRef(null);
  const isPaused = activeWorkout?.isPaused;

  const showPRToast = useCallback((text) => {
    if (prToastTimeoutRef.current) clearTimeout(prToastTimeoutRef.current);
    setPrToast({ visible: true, text });
    prToastTimeoutRef.current = setTimeout(() => {
      setPrToast(t => ({ ...t, visible: false }));
    }, 2500);
  }, []);

  // Workout timer
  useEffect(() => {
    timerRef.current = setInterval(tickTimer, 1000);

    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current === 'active' && nextState !== 'active') {
        bgTimeRef.current = Date.now();
      } else if (nextState === 'active' && bgTimeRef.current) {
        const elapsed = Math.floor((Date.now() - bgTimeRef.current) / 1000);
        for (let i = 0; i < elapsed; i++) tickTimer();
        bgTimeRef.current = null;
      }
      appStateRef.current = nextState;
    });

    return () => {
      clearInterval(timerRef.current);
      sub.remove();
    };
  }, [tickTimer]);

  // Rest timer interval
  useEffect(() => {
    if (restTimer !== null) {
      restTimerRef.current = setInterval(tickRestTimer, 1000);
    } else {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
    return () => {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    };
  }, [restTimer !== null, tickRestTimer]);

  // Vibrate when rest timer hits 0 (restTimer transitions from non-null to null)
  useEffect(() => {
    if (prevRestTimerRef.current !== null && restTimer === null) {
      Vibration.vibrate([0, 500, 200, 500]);
    }
    prevRestTimerRef.current = restTimer;
  }, [restTimer]);

  // Cleanup PR toast timeout on unmount
  useEffect(() => {
    return () => {
      if (prToastTimeoutRef.current) clearTimeout(prToastTimeoutRef.current);
    };
  }, []);

  const handleFinish = () => {
    Alert.alert('Workout beenden?', 'Du wirst zur Zusammenfassung weitergeleitet.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Beenden', onPress: () => navigation.navigate('WorkoutSummary') },
    ]);
  };

  const handleDiscard = () => {
    Alert.alert('Workout verwerfen?', 'Alle Daten gehen verloren.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Verwerfen', style: 'destructive', onPress: async () => {
        clearInterval(timerRef.current);
        await discardWorkout();
        navigation.goBack();
      }},
    ]);
  };


  const workedMusclesLive = useMemo(() => {
    const result = {};
    (activeWorkout?.exercises || []).forEach(ex => {
      if (!ex.sets.some(s => s.completed)) return;
      const dbEx = EXERCISES.find(e => e.id === ex.exerciseId);
      const muscles = dbEx?.worked_muscles || (ex.muscle_group ? { [ex.muscle_group]: 'primary' } : {});
      Object.entries(muscles).forEach(([m, lvl]) => {
        if (!result[m] || lvl === 'primary') result[m] = lvl;
      });
    });
    return result;
  }, [activeWorkout?.exercises]);

  const muscleCountsLive = useMemo(() => {
    const result = {};
    (activeWorkout?.exercises || []).forEach(ex => {
      const done = ex.sets.filter(s => s.completed).length;
      if (!done) return;
      const dbEx = EXERCISES.find(e => e.id === ex.exerciseId);
      const muscles = dbEx?.worked_muscles || (ex.muscle_group ? { [ex.muscle_group]: 'primary' } : {});
      Object.entries(muscles).forEach(([m, lvl]) => {
        if (!result[m]) result[m] = { primary: 0, secondary: 0 };
        result[m][lvl === 'primary' ? 'primary' : 'secondary'] += done;
      });
    });
    return result;
  }, [activeWorkout?.exercises]);

  if (!activeWorkout) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: C.textTertiary }}>Kein aktives Workout</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: C.accent }}>Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const completedSets = activeWorkout.exercises?.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0) || 0;
  const totalVolume = activeWorkout.exercises?.reduce((acc, ex) =>
    acc + ex.sets.filter(s => s.completed).reduce((a, s) => a + (parseFloat(s.weight_kg) || 0) * (parseInt(s.reps) || 0), 0), 0) || 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* PR Toast — absolutely positioned, above everything */}
      <PRToast visible={prToast.visible} text={prToast.text} />

      {/* Sticky Header */}
      <View style={{
        paddingTop: insets.top + 4,
        paddingHorizontal: S.md,
        paddingBottom: S.sm,
        backgroundColor: C.bg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: C.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.xs }}>
          <TouchableOpacity onPress={handleDiscard} style={{ marginRight: S.sm }}>
            <Feather name="x" size={22} color={C.textSecondary} />
          </TouchableOpacity>
          <Text style={[T.h3, { color: C.text, flex: 1 }]}>{activeWorkout.routineName}</Text>
          <TouchableOpacity
            onPress={handleFinish}
            style={{ backgroundColor: C.accent, paddingHorizontal: S.md, paddingVertical: 8, borderRadius: R.full }}
          >
            <Text style={{ color: C.bg, fontWeight: '700', fontSize: 14 }}>Beenden</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 18, opacity: isPaused ? 0.4 : 1 }}>{formatTime(activeWorkout.elapsedSeconds || 0)}</Text>
            <Text style={{ color: C.textTertiary, fontSize: 11 }}>DAUER</Text>
          </View>
          <TouchableOpacity onPress={togglePause} style={{ padding: 4 }}>
            <Feather name={isPaused ? 'play' : 'pause'} size={18} color={C.accent} />
          </TouchableOpacity>
          <View style={{ width: 1, height: 28, backgroundColor: C.border }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 18 }}>{Math.round(totalVolume)}</Text>
            <Text style={{ color: C.textTertiary, fontSize: 11 }}>KG VOL.</Text>
          </View>
          <View style={{ width: 1, height: 28, backgroundColor: C.border }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 18 }}>{completedSets}</Text>
            <Text style={{ color: C.textTertiary, fontSize: 11 }}>SÄTZE</Text>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => setShowHeatmap(true)}
            style={{ width: 52, height: 52, borderRadius: R.md, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}
          >
            <BodyIconHalf side="front" workedMuscles={workedMusclesLive} muscleCounts={muscleCountsLive} isDark={isDark} />
            <BodyIconHalf side="back"  workedMuscles={workedMusclesLive} muscleCounts={muscleCountsLive} isDark={isDark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Rest Timer Banner — between header and scroll */}
      <RestTimerBanner
        restTimer={restTimer}
        restTimerDuration={restTimerDuration}
        onDismiss={dismissRestTimer}
        onSetDuration={setRestTimerDuration}
        accentColor={C.accent}
      />

      <ScrollView
        contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 80 }}
        keyboardDismissMode="interactive"
      >
        {activeWorkout.exercises?.map((ex, i) => (
          <ExerciseCard
            key={i}
            exercise={ex}
            exIdx={i}
            exCount={activeWorkout.exercises.length}
            navigation={navigation}
            lastSets={lastSessionSets[ex.exerciseId]}
            onPRDetected={showPRToast}
            startRestTimer={startRestTimer}
          />
        ))}

        <TouchableOpacity
          onPress={() => setShowPicker(true)}
          style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.xs }}
        >
          <Feather name="plus" size={18} color={C.accent} />
          <Text style={{ color: C.accent, fontWeight: '600' }}>Übung hinzufügen</Text>
        </TouchableOpacity>
      </ScrollView>

      <ExercisePickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(ex) => { addExercise(ex); setShowPicker(false); }}
      />
      <MuscleHeatmapSheet
        visible={showHeatmap}
        onClose={() => setShowHeatmap(false)}
        exercises={activeWorkout.exercises || []}
        muscleCounts={muscleCountsLive}
      />
    </View>
  );
}
