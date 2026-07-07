/**
 * components/ExerciseFilterModals.js — Gemeinsame Filter-Modals für Übungsauswahl
 *
 * Genutzt von: ExerciseDatabaseScreen, RoutineEditScreen (ExercisePickerModal)
 *
 * Exports:
 *   MUSCLE_GROUPS          — Hierarchische Muskelgruppen-Definition (Eltern + Sub-Muskeln)
 *   EQUIPMENT_OPTIONS      — Ausrüstungs-Optionen mit Icons und Farben
 *   getSubIds(groupId)     — Alle Sub-IDs einer Muskelgruppe
 *   MiniBody               — Kleines Körper-Thumbnail mit einem Overlay-PNG
 *   EquipmentFilterModal   — Bottom-Sheet Modal für Ausrüstungsfilter (Multi-Select)
 *   MuscleFilterModal      — Bottom-Sheet Modal für Muskelfilter (hierarchisch, Multi-Select)
 *   FilterButton           — Kompakter Filter-Button mit aktivem Zähler
 */

// React/RN
import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, Modal, ScrollView,
  StyleSheet, Pressable,
} from 'react-native';

// Third-party
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Internal
import { useTheme } from '../theme';

// ─── Assets ────────────────────────────────────────────────────────────────
const BODY_IMG = {
  front_light: require('../../assets/muscles/body_front.png'),
  back_light:  require('../../assets/muscles/body_back.png'),
  front_dark:  require('../../assets/muscles/body_front_dark.png'),
  back_dark:   require('../../assets/muscles/body_back_dark.png'),
};

const OVERLAYS = {
  front: {
    Brust:       require('../../assets/muscles/front/chest.png'),
    BrustOben:   require('../../assets/muscles/front/chest_upper.png'),
    BrustUnten:  require('../../assets/muscles/front/chest_lower.png'),
    Schultern:   require('../../assets/muscles/front/shoulders_front.png'),
    Bizeps:      require('../../assets/muscles/front/biceps.png'),
    BizepsLang:  require('../../assets/muscles/front/biceps_long.png'),
    BizepsKurz:  require('../../assets/muscles/front/biceps_short.png'),
    Brachialis:  require('../../assets/muscles/front/brachialis.png'),
    Bauch:       require('../../assets/muscles/front/abs.png'),
    Obliques:    require('../../assets/muscles/front/obliques.png'),
    Beine:       require('../../assets/muscles/front/quads.png'),
    Unterarme:   require('../../assets/muscles/front/forearms.png'),
    Nacken:      require('../../assets/muscles/front/neck_front.png'),
    Adduktoren:  require('../../assets/muscles/front/adductors.png'),
    Abduktoren:  require('../../assets/muscles/front/abductors.png'),
  },
  back: {
    Rücken:          require('../../assets/muscles/back/lats.png'),
    Trapez:          require('../../assets/muscles/back/traps.png'),
    TrapezOben:      require('../../assets/muscles/back/upper_traps.png'),
    Rhomboiden:      require('../../assets/muscles/back/rhomboids.png'),
    LowerBack:       require('../../assets/muscles/back/lower_back.png'),
    TeresMajor:      require('../../assets/muscles/back/teres_major.png'),
    Trizeps:         require('../../assets/muscles/back/triceps.png'),
    TrizepsLang:     require('../../assets/muscles/back/triceps_long.png'),
    TrizepsLateral:  require('../../assets/muscles/back/triceps_lateral.png'),
    Gesäß:           require('../../assets/muscles/back/glutes.png'),
    GesäßMed:        require('../../assets/muscles/back/glutes_med.png'),
    Hamstrings:      require('../../assets/muscles/back/hamstrings.png'),
    Waden:           require('../../assets/muscles/back/calves.png'),
  },
};

// ─── Filter data ────────────────────────────────────────────────────────────
export const MUSCLE_GROUPS = [
  {
    id: 'Brust', label: 'Brust', side: 'front', overlay: 'Brust',
    subs: [
      { id: 'Brust',     label: 'Mittlere Brust', side: 'front', overlay: 'Brust' },
      { id: 'BrustOben', label: 'Obere Brust',    side: 'front', overlay: 'BrustOben' },
      { id: 'BrustUnten',label: 'Untere Brust',   side: 'front', overlay: 'BrustUnten' },
    ],
  },
  {
    id: 'Rücken', label: 'Rücken', side: 'back', overlay: 'Rücken',
    subs: [
      { id: 'Rücken',     label: 'Latissimus',      side: 'back', overlay: 'Rücken' },
      { id: 'Trapez',     label: 'Trapez',           side: 'back', overlay: 'Trapez' },
      { id: 'TrapezOben', label: 'Oberer Trapez',    side: 'back', overlay: 'TrapezOben' },
      { id: 'Rhomboiden', label: 'Rhomboiden',       side: 'back', overlay: 'Rhomboiden' },
      { id: 'LowerBack',  label: 'Unterer Rücken',   side: 'back', overlay: 'LowerBack' },
      { id: 'TeresMajor', label: 'Teres Major',      side: 'back', overlay: 'TeresMajor' },
    ],
  },
  {
    id: 'Schultern', label: 'Schultern', side: 'front', overlay: 'Schultern',
    subs: [
      { id: 'Schultern', label: 'Schultern', side: 'front', overlay: 'Schultern' },
    ],
  },
  {
    id: 'Arme', label: 'Arme', side: 'front', overlay: 'Bizeps',
    subs: [
      { id: 'Bizeps',         label: 'Bizeps',           side: 'front', overlay: 'Bizeps' },
      { id: 'BizepsLang',     label: 'Langer Bizepskopf',side: 'front', overlay: 'BizepsLang' },
      { id: 'BizepsKurz',     label: 'Kurzer Bizepskopf',side: 'front', overlay: 'BizepsKurz' },
      { id: 'Brachialis',     label: 'Brachialis',       side: 'front', overlay: 'Brachialis' },
      { id: 'Trizeps',        label: 'Trizeps',          side: 'back',  overlay: 'Trizeps' },
      { id: 'TrizepsLang',    label: 'Langer Trizepskopf',side: 'back', overlay: 'TrizepsLang' },
      { id: 'TrizepsLateral', label: 'Seitl. Trizepskopf',side: 'back', overlay: 'TrizepsLateral' },
      { id: 'Unterarme',      label: 'Unterarme',        side: 'front', overlay: 'Unterarme' },
    ],
  },
  {
    id: 'Beine', label: 'Beine', side: 'front', overlay: 'Beine',
    subs: [
      { id: 'Beine',      label: 'Quadrizeps',  side: 'front', overlay: 'Beine' },
      { id: 'Hamstrings', label: 'Hamstrings',  side: 'back',  overlay: 'Hamstrings' },
      { id: 'Gesäß',      label: 'Gesäß',       side: 'back',  overlay: 'Gesäß' },
      { id: 'Waden',      label: 'Waden',       side: 'back',  overlay: 'Waden' },
      { id: 'Adduktoren', label: 'Adduktoren',  side: 'front', overlay: 'Adduktoren' },
      { id: 'Abduktoren', label: 'Abduktoren',  side: 'front', overlay: 'Abduktoren' },
    ],
  },
  {
    id: 'Core', label: 'Core', side: 'front', overlay: 'Bauch',
    subs: [
      { id: 'Bauch',    label: 'Bauch',    side: 'front', overlay: 'Bauch' },
      { id: 'Obliques', label: 'Obliques', side: 'front', overlay: 'Obliques' },
    ],
  },
  {
    id: 'Nacken', label: 'Nacken', side: 'front', overlay: 'Nacken',
    subs: [
      { id: 'Nacken', label: 'Nacken', side: 'front', overlay: 'Nacken' },
    ],
  },
  {
    id: 'Ganzkörper', label: 'Ganzkörper', side: 'front', overlay: null,
    subs: [
      { id: 'Ganzkörper', label: 'Ganzkörper', side: 'front', overlay: null },
    ],
  },
];

export const EQUIPMENT_OPTIONS = [
  { id: 'Langhantel',    label: 'Langhantel',    icon: 'minus',    color: '#3B82F6' },
  { id: 'Kurzhantel',    label: 'Kurzhantel',    icon: 'disc',     color: '#8B5CF6' },
  { id: 'Kabelzug',      label: 'Kabelzug',      icon: 'link',     color: '#EC4899' },
  { id: 'Maschine',      label: 'Maschine',      icon: 'settings', color: '#F59E0B' },
  { id: 'Körpergewicht', label: 'Körpergewicht', icon: 'user',     color: '#10B981' },
  { id: 'Kettlebell',    label: 'Kettlebell',    icon: 'circle',   color: '#EF4444' },
];

// All sub-IDs for a main group
export function getSubIds(groupId) {
  const g = MUSCLE_GROUPS.find(g => g.id === groupId);
  return g ? g.subs.map(s => s.id) : [];
}

// ─── Mini body thumbnail ────────────────────────────────────────────────────
const THUMB_W = 48;
const THUMB_H = Math.round(THUMB_W * 1.45);

export function MiniBody({ side, overlayKey, size = 'md' }) {
  const { isDark } = useTheme();
  const w = size === 'sm' ? 36 : THUMB_W;
  const h = Math.round(w * 1.45);
  const bodyImg = BODY_IMG[`${side}_${isDark ? 'dark' : 'light'}`];
  const overlay = overlayKey ? OVERLAYS[side]?.[overlayKey] : null;
  const s = { width: w, height: h, position: 'absolute', top: 0, left: 0 };
  return (
    <View style={{ width: w, height: h, overflow: 'hidden' }}>
      <Image source={bodyImg} style={[s, isDark ? { tintColor: '#6B7280' } : null]} resizeMode="cover" />
      {overlay && <Image source={overlay} style={[s, { tintColor: '#EF4444' }]} resizeMode="cover" />}
    </View>
  );
}

// ─── Equipment Modal ────────────────────────────────────────────────────────
export function EquipmentFilterModal({ visible, onClose, selected, onChange }) {
  const { colors: C, spacing: S } = useTheme();
  const insets = useSafeAreaInsets();

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + S.md, maxHeight: '70%' }}>
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: S.sm }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingBottom: S.sm }}>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 17, flex: 1 }}>Ausrüstung</Text>
          {selected.length > 0 && (
            <TouchableOpacity onPress={() => onChange([])}>
              <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>Zurücksetzen</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView>
          {EQUIPMENT_OPTIONS.map(opt => {
            const sel = selected.includes(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => toggle(opt.id)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, backgroundColor: sel ? C.accent + '10' : 'transparent' }}
                activeOpacity={0.7}
              >
                <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: opt.color + '22', justifyContent: 'center', alignItems: 'center', marginRight: S.md }}>
                  <Feather name={opt.icon} size={20} color={opt.color} />
                </View>
                <Text style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: sel ? '700' : '400' }}>{opt.label}</Text>
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: sel ? C.accent : C.border, backgroundColor: sel ? C.accent : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                  {sel && <Feather name="check" size={13} color={C.bg} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Muscle Modal ────────────────────────────────────────────────────────────
export function MuscleFilterModal({ visible, onClose, selected, onChange }) {
  const { colors: C, spacing: S } = useTheme();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(null);

  const toggleSub = (id) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const toggleGroup = (group) => {
    const subIds = group.subs.map(s => s.id);
    const allSelected = subIds.every(id => selected.includes(id));
    if (allSelected) {
      onChange(selected.filter(id => !subIds.includes(id)));
    } else {
      const newSel = [...selected];
      subIds.forEach(id => { if (!newSel.includes(id)) newSel.push(id); });
      onChange(newSel);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + S.md, maxHeight: '80%' }}>
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: S.sm }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingBottom: S.sm }}>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 17, flex: 1 }}>Muskelgruppe</Text>
          {selected.length > 0 && (
            <TouchableOpacity onPress={() => onChange([])}>
              <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>Zurücksetzen</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          {MUSCLE_GROUPS.map(group => {
            const subIds = group.subs.map(s => s.id);
            const selectedCount = subIds.filter(id => selected.includes(id)).length;
            const allSel = selectedCount === subIds.length;
            const partSel = selectedCount > 0 && !allSel;
            const isExpanded = expanded === group.id;

            return (
              <View key={group.id}>
                {/* Main group row */}
                <TouchableOpacity
                  onPress={() => setExpanded(isExpanded ? null : group.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}
                  activeOpacity={0.7}
                >
                  {/* Thumbnail */}
                  <View style={{ width: THUMB_W + 8, height: THUMB_H + 8, borderRadius: 10, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', marginRight: S.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                    <MiniBody side={group.side} overlayKey={group.overlay} />
                  </View>

                  {/* Label + badge */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }}>{group.label}</Text>
                    {selectedCount > 0 && (
                      <Text style={{ color: C.accent, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                        {selectedCount} ausgewählt
                      </Text>
                    )}
                  </View>

                  {/* Group toggle checkbox */}
                  <TouchableOpacity
                    onPress={() => toggleGroup(group)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: allSel ? C.accent : partSel ? C.accent : C.border, backgroundColor: allSel ? C.accent : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: S.sm }}
                  >
                    {allSel && <Feather name="check" size={13} color={C.bg} />}
                    {partSel && <View style={{ width: 10, height: 2, backgroundColor: C.accent, borderRadius: 1 }} />}
                  </TouchableOpacity>

                  <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.textTertiary} />
                </TouchableOpacity>

                {/* Sub-muscles */}
                {isExpanded && group.subs.map(sub => {
                  const sel = selected.includes(sub.id);
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => toggleSub(sub.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: S.md + THUMB_W + 8 + S.md, paddingRight: S.md, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, backgroundColor: sel ? C.accent + '08' : C.bgSecondary }}
                      activeOpacity={0.7}
                    >
                      {/* Small thumbnail */}
                      <View style={{ width: 36, height: Math.round(36 * 1.45), borderRadius: 6, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', marginRight: S.sm, overflow: 'hidden' }}>
                        <MiniBody side={sub.side} overlayKey={sub.overlay} size="sm" />
                      </View>
                      <Text style={{ flex: 1, color: sel ? C.text : C.textSecondary, fontSize: 14, fontWeight: sel ? '600' : '400' }}>{sub.label}</Text>
                      <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: sel ? C.accent : C.border, backgroundColor: sel ? C.accent : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                        {sel && <Feather name="check" size={12} color={C.bg} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Filter button helper ────────────────────────────────────────────────────
export function FilterButton({ onPress, icon, label, count }) {
  const { colors: C, spacing: S } = useTheme();
  const active = count > 0;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: S.sm, paddingVertical: 9,
        backgroundColor: active ? C.accent + '15' : C.surface,
        borderRadius: 10,
        borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
        borderColor: active ? C.accent : C.border,
      }}
    >
      <Feather name={icon} size={13} color={active ? C.accent : C.textSecondary} />
      <Text style={{ flex: 1, color: active ? C.accent : C.textSecondary, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
        {active ? `${count} aktiv` : label}
      </Text>
      <Feather name="chevron-down" size={12} color={active ? C.accent : C.textTertiary} />
    </TouchableOpacity>
  );
}
