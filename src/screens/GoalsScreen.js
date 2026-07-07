/**
 * screens/GoalsScreen.js — Ziele & Wettkampfplanung
 *
 * Verwaltet Sport-Ziele (Rennen, Wettkämpfe) mit Zieldatum und Distanz.
 * SPORT_TYPES — Verfügbare Sportarten mit Emoji, Farbe und key
 *
 * Ziele werden via api.getGoals() / api.saveGoal() / api.deleteGoal() persistiert.
 * DateTimePicker für Zieldatum (iOS/Android).
 */

// React/RN
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, RefreshControl, Platform,
} from 'react-native';

// Third-party
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

// Internal
import { api } from '../api/client';
import { useTheme } from '../theme';

const SPORT_TYPES = [
  { key: 'run',       label: 'Laufen',    mci: 'run', color: '#4CAF50' },
  { key: 'bike',      label: 'Radfahren', mci: 'bike', color: '#FF9800' },
  { key: 'swim',      label: 'Schwimmen', mci: 'swim', color: '#2196F3' },
  { key: 'triathlon', label: 'Triathlon', mci: 'medal', color: '#FF5722' },
  { key: 'strength',  label: 'Kraft',     mci: 'weight-lifter', color: '#E8C547' },
  { key: 'other',     label: 'Sonstiges', mci: 'target', color: '#9C27B0' },
];

const GOAL_TYPES = [
  { key: 'race',     label: 'Wettkampf',  mci: 'flag-checkered' },
  { key: 'fitness',  label: 'Fitness',    mci: 'arm-flex' },
  { key: 'weight',   label: 'Gewicht',    mci: 'scale-balance' },
  { key: 'habit',    label: 'Gewohnheit', mci: 'calendar-check' },
  { key: 'distance', label: 'Distanz',    mci: 'map-marker-distance' },
  { key: 'time',     label: 'Zeit / PB',  mci: 'timer-outline' },
];

const DISTANCES = ['Sprint', 'Olympic', 'Half (70.3)', 'Full (140.6)', '5k', '10k', 'Half Marathon', 'Marathon', '50k', '100k', 'Sonstiges'];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + 'T00:00:00') - new Date(new Date().toDateString());
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function GoalFormModal({ visible, goal, onClose, onSave }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const [name, setName] = useState('');
  const [goalType, setGoalType] = useState('race');
  const [sportType, setSportType] = useState('run');
  const [date, setDate] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [distance, setDistance] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [priority, setPriority] = useState('A');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (goal) {
      setName(goal.name || ''); setGoalType(goal.goalType || 'race'); setSportType(goal.sportType || 'run');
      setDate(goal.date || ''); setDistance(goal.distance || ''); setTargetTime(goal.targetTime || '');
      setPriority(goal.priority || 'A'); setNotes(goal.notes || ''); setLocation(goal.location || '');
    } else {
      setName(''); setGoalType('race'); setSportType('run'); setDate('');
      setDistance(''); setTargetTime(''); setPriority('A'); setNotes(''); setLocation('');
    }
  }, [goal, visible]);

  const onDateChange = (event, selectedDate) => {
    setDatePickerVisible(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate.toISOString().split('T')[0]);
  };

  const save = () => {
    if (!name.trim()) { Alert.alert('Fehler', 'Bitte einen Namen eingeben'); return; }
    onSave({ name: name.trim(), goalType, sportType, date, distance, targetTime, priority, notes, location });
  };

  const priorityColor = (p) => p === 'A' ? C.danger : p === 'B' ? C.warning : C.textSecondary;

  const inputStyle = { backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15, marginBottom: 2 };
  const labelStyle = [T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 14 }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.lg, paddingTop: 40, paddingBottom: 130 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg }}>
          <Text style={[T.h2, { color: C.text }]}>{goal ? 'Ziel bearbeiten' : 'Neues Ziel'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Feather name="x" size={22} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={labelStyle}>Name</Text>
        <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="z.B. München Marathon 2026" placeholderTextColor={C.textTertiary} />

        <Text style={labelStyle}>Zieltyp</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: 4 }}>
          {GOAL_TYPES.map(g => (
            <TouchableOpacity
              key={g.key}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: goalType === g.key ? C.tint : C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: goalType === g.key ? C.tint : C.border, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6 }}
              onPress={() => setGoalType(g.key)}
            >
              <MaterialCommunityIcons name={g.mci} size={14} color={goalType === g.key ? C.tintText : C.textSecondary} />
              <Text style={[T.label, { color: goalType === g.key ? C.tintText : C.textSecondary }]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={labelStyle}>Sportart</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: 4 }}>
          {SPORT_TYPES.map(s => (
            <TouchableOpacity
              key={s.key}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: sportType === s.key ? s.color : C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: sportType === s.key ? s.color : C.border, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6 }}
              onPress={() => setSportType(s.key)}
            >
              <MaterialCommunityIcons name={s.mci} size={14} color={sportType === s.key ? '#fff' : C.textSecondary} />
              <Text style={[T.label, { color: sportType === s.key ? '#fff' : C.textSecondary }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={labelStyle}>Priorität</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
          {['A', 'B', 'C'].map(p => (
            <TouchableOpacity
              key={p}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: priority === p ? priorityColor(p) : C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: priority === p ? priorityColor(p) : C.border, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6 }}
              onPress={() => setPriority(p)}
            >
              <Text style={[T.label, { color: priority === p ? '#fff' : C.textSecondary, fontWeight: '800' }]}>Prio {p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={labelStyle}>Datum</Text>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 2 }}
          onPress={() => setDatePickerVisible(true)}
        >
          <Feather name="calendar" size={17} color={C.tint} />
          <Text style={{ color: date ? C.text : C.textTertiary, fontSize: 15, flex: 1 }}>
            {date ? new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Datum auswählen'}
          </Text>
          {date && <TouchableOpacity onPress={() => setDate('')} hitSlop={8}><Feather name="x-circle" size={17} color={C.textTertiary} /></TouchableOpacity>}
        </TouchableOpacity>
        {datePickerVisible && (
          <DateTimePicker
            value={date ? new Date(date + 'T12:00:00') : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={onDateChange}
            style={{ backgroundColor: C.surface }}
          />
        )}

        <Text style={labelStyle}>Ort (optional)</Text>
        <TextInput style={inputStyle} value={location} onChangeText={setLocation} placeholder="München" placeholderTextColor={C.textTertiary} />

        {(goalType === 'race' || goalType === 'distance') && (
          <>
            <Text style={labelStyle}>Distanz</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: 4 }}>
              {DISTANCES.map(d => (
                <TouchableOpacity
                  key={d}
                  style={{ backgroundColor: distance === d ? C.tint : C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: distance === d ? C.tint : C.border, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6 }}
                  onPress={() => setDistance(d)}
                >
                  <Text style={[T.label, { color: distance === d ? C.tintText : C.textSecondary }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {(goalType === 'race' || goalType === 'time') && (
          <>
            <Text style={labelStyle}>Zielzeit (optional)</Text>
            <TextInput style={inputStyle} value={targetTime} onChangeText={setTargetTime} placeholder="3:45:00" placeholderTextColor={C.textTertiary} />
          </>
        )}

        <Text style={labelStyle}>Notizen (optional)</Text>
        <TextInput style={[inputStyle, { minHeight: 80 }]} value={notes} onChangeText={setNotes} placeholder="Weitere Details…" placeholderTextColor={C.textTertiary} multiline textAlignVertical="top" />

        <TouchableOpacity
          style={{ backgroundColor: C.accent, borderRadius: R.md, paddingVertical: 16, alignItems: 'center', marginTop: S.lg }}
          onPress={save}
        >
          <Text style={[T.bodyMed, { color: C.accentText }]}>Speichern</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

function GoalCard({ goal, onEdit, onDelete }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const days = daysUntil(goal.date);
  const sport = SPORT_TYPES.find(s => s.key === goal.sportType) || SPORT_TYPES[0];
  const isExpired = days !== null && days < 0;
  const priorityColor = goal.priority === 'A' ? C.danger : goal.priority === 'B' ? C.warning : C.textSecondary;

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, opacity: isExpired ? 0.55 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.sm }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${sport.color}20`, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name={sport.mci} size={24} color={sport.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <Text style={[T.label, { color: priorityColor }]}>Prio {goal.priority}</Text>
            <Text style={[T.label, { color: C.textTertiary }]}>·</Text>
            <Text style={[T.label, { color: C.textTertiary }]}>{GOAL_TYPES.find(g => g.key === goal.goalType)?.label || 'Ziel'}</Text>
          </View>
          <Text style={[T.bodyMed, { color: C.text, marginBottom: 4 }]}>{goal.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, alignItems: 'center' }}>
            {goal.date && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="calendar" size={11} color={C.textTertiary} />
                <Text style={[T.caption, { color: C.textSecondary }]}>{goal.date}</Text>
              </View>
            )}
            {goal.location && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="map-pin" size={11} color={C.textTertiary} />
                <Text style={[T.caption, { color: C.textSecondary }]}>{goal.location}</Text>
              </View>
            )}
            {goal.distance && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="map" size={11} color={C.textTertiary} />
                <Text style={[T.caption, { color: C.textSecondary }]}>{goal.distance}</Text>
              </View>
            )}
            {goal.targetTime && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="clock" size={11} color={C.textTertiary} />
                <Text style={[T.caption, { color: C.textSecondary }]}>Ziel: {goal.targetTime}</Text>
              </View>
            )}
          </View>
          {goal.notes ? <Text style={[T.caption, { color: C.textTertiary, marginTop: 6, fontStyle: 'italic' }]} numberOfLines={2}>{goal.notes}</Text> : null}
        </View>
        {days !== null && (
          <View style={{ alignItems: 'center', backgroundColor: isExpired ? C.bgTertiary : days <= 14 ? C.danger + '20' : days <= 60 ? C.warning + '20' : C.success + '20', borderRadius: R.sm, width: 52, height: 52, justifyContent: 'center' }}>
            <Text style={{ color: isExpired ? C.textTertiary : days <= 14 ? C.danger : days <= 60 ? C.warning : C.success, fontSize: 16, fontWeight: '800' }}>
              {isExpired ? '✓' : days}
            </Text>
            <Text style={[T.label, { color: C.textTertiary, marginTop: 1 }]}>{isExpired ? 'vorbei' : 'Tage'}</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: S.sm, marginTop: 10 }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }} onPress={onEdit}>
          <Feather name="edit-2" size={13} color={C.textSecondary} />
          <Text style={[T.caption, { color: C.textSecondary }]}>Bearbeiten</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.danger + '40' }} onPress={onDelete}>
          <Feather name="trash-2" size={13} color={C.danger} />
          <Text style={[T.caption, { color: C.danger }]}>Löschen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function GoalsScreen() {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const profile = await api.getProfile();
      const raw = profile.competitionGoals || profile.competition_goals;
      setGoals(raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []);
    } catch(e) { setGoals([]); }
    setLoading(false);
    setRefreshing(false);
  };

  const saveGoals = async (newGoals) => {
    await api.updateProfile({ competitionGoals: JSON.stringify(newGoals) });
    setGoals(newGoals);
  };

  const handleSave = async (goalData) => {
    let newGoals;
    if (editGoal?.id !== undefined) {
      newGoals = goals.map(g => g.id === editGoal.id ? { ...g, ...goalData } : g);
    } else {
      newGoals = [...goals, { ...goalData, id: Date.now() }];
    }
    newGoals.sort((a, b) => { if (!a.date) return 1; if (!b.date) return -1; return a.date.localeCompare(b.date); });
    await saveGoals(newGoals);
    setModalVisible(false);
    setEditGoal(null);
  };

  const handleDelete = (goal) => {
    Alert.alert('Ziel löschen', `"${goal.name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => { await saveGoals(goals.filter(g => g.id !== goal.id)); } },
    ]);
  };

  const openNew = () => { setEditGoal(null); setModalVisible(true); };
  const openEdit = (g) => { setEditGoal(g); setModalVisible(true); };

  const today = new Date().toISOString().split('T')[0];
  const filtered = goals.filter(g => {
    if (filter === 'upcoming') return !g.date || g.date >= today;
    if (filter === 'past') return g.date && g.date < today;
    return true;
  });

  const upcoming = goals.filter(g => g.date && g.date >= today).slice(0, 1)[0];

  return (
    <>
      <GoalFormModal
        visible={modalVisible}
        goal={editGoal}
        onClose={() => { setModalVisible(false); setEditGoal(null); }}
        onSave={handleSave}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ paddingHorizontal: S.md, paddingTop: 60, paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.tint} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg }}>
          <Text style={[T.h1, { color: C.text }]}>Ziele</Text>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accent, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 8 }}
            onPress={openNew}
          >
            <Feather name="plus" size={18} color={C.accentText} />
            <Text style={[T.label, { color: C.accentText }]}>Neu</Text>
          </TouchableOpacity>
        </View>

        {upcoming && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.xl, padding: 18, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '40' }}>
            <View style={{ flex: 1 }}>
              <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }]}>Nächstes Ziel</Text>
              <Text style={[T.bodyMed, { color: C.text, marginBottom: 2 }]}>{upcoming.name}</Text>
              <Text style={[T.caption, { color: C.textSecondary }]}>{upcoming.date}{upcoming.location ? ` · ${upcoming.location}` : ''}</Text>
            </View>
            <View style={{ alignItems: 'center', marginLeft: S.sm }}>
              <Text style={{ color: C.tint, fontSize: 32, fontWeight: '900' }}>{daysUntil(upcoming.date)}</Text>
              <Text style={[T.caption, { color: C.textSecondary }]}>Tage</Text>
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
          {[['upcoming', 'Bevorstehend'], ['past', 'Vergangen'], ['all', 'Alle']].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={{ flex: 1, paddingVertical: 8, borderRadius: R.sm, backgroundColor: filter === key ? C.accent : C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: filter === key ? C.accent : C.border, alignItems: 'center' }}
              onPress={() => setFilter(key)}
            >
              <Text style={[T.label, { color: filter === key ? C.accentText : C.textSecondary }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <Text style={[T.body, { color: C.textSecondary, textAlign: 'center', marginTop: 40 }]}>Lade…</Text>
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <MaterialCommunityIcons name="flag-checkered" size={44} color={C.tint} style={{ marginBottom: S.sm }} />
            <Text style={[T.h3, { color: C.text, marginBottom: 6 }]}>Noch keine Ziele</Text>
            <Text style={[T.body, { color: C.textSecondary, textAlign: 'center', marginBottom: S.lg }]}>
              {filter === 'upcoming' ? 'Füge deinen nächsten Wettkampf oder dein Fitnessziel hinzu.' : 'Keine vergangenen Ziele.'}
            </Text>
            {filter === 'upcoming' && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accent, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 8 }}
                onPress={openNew}
              >
                <Feather name="plus" size={16} color={C.accentText} />
                <Text style={[T.label, { color: C.accentText }]}>Erstes Ziel hinzufügen</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{ gap: S.sm }}>
            {filtered.map(g => (
              <GoalCard key={g.id} goal={g} onEdit={() => openEdit(g)} onDelete={() => handleDelete(g)} />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}
