import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Share } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { api } from '../api/client';

function Field({ label, value, onSave, placeholder, autoCapitalize }) {
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
        <Text style={[T.body, { color: val ? C.text : C.textTertiary }]}>{val || placeholder || '–'}</Text>
        <Feather name="edit-2" size={12} color={C.textTertiary} />
      </View>
    </TouchableOpacity>
  );
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
      <Text style={[T.body, { color: C.textSecondary }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          style={{ backgroundColor: C.bgTertiary, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6, color: C.text, fontSize: 15, minWidth: 120, textAlign: 'right', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
          value={val} onChangeText={setVal} autoFocus autoCapitalize={autoCapitalize || 'none'}
          onBlur={save} onSubmitEditing={save}
        />
        <TouchableOpacity onPress={save}><Feather name="check-circle" size={20} color={C.tint} /></TouchableOpacity>
      </View>
    </View>
  );
}

const EQUIPMENT_LIST = [
  { id: 'Airfryer', icon: 'wind' },
  { id: 'Backofen', icon: 'thermometer' },
  { id: 'Herd', icon: 'circle' },
  { id: 'Mikrowelle', icon: 'zap' },
  { id: 'Ninja Creami', icon: 'cpu' },
  { id: 'Mixer', icon: 'loader' },
  { id: 'Küchenmaschine', icon: 'settings' },
  { id: 'Sous-vide', icon: 'droplet' },
  { id: 'Dampfgarer', icon: 'cloud' },
  { id: 'Grillpfanne', icon: 'grid' },
  { id: 'Wok', icon: 'rotate-cw' },
  { id: 'Reiskocher', icon: 'package' },
  { id: 'Instanttopf', icon: 'clock' },
];

export default function KontoScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { user, updateProfile } = useStore();
  const setUser = useStore(s => s.setUser);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const save = async (updates) => {
    try { await updateProfile({ ...user, ...updates }); } catch(e) { Alert.alert('Fehler', e.message); }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return Alert.alert('Bitte einen Code eingeben.');
    setJoining(true);
    try {
      const result = await api.joinHousehold(code);
      // Backend returns a new JWT with updated householdId — store it
      if (result?.token) {
        await AsyncStorage.setItem('auth_token', result.token);
      }
      const profile = await api.getProfile();
      const updated = { ...user, ...profile };
      setUser?.(updated);
      await AsyncStorage.setItem('user', JSON.stringify(updated));
      setJoinCode('');
      Alert.alert('Erfolgreich!', 'Du bist dem Haushalt beigetreten.');
    } catch (e) {
      Alert.alert('Fehler', e.message || 'Code ungültig oder nicht gefunden.');
    } finally {
      setJoining(false);
    }
  };

  const divider = <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 16 }} />;

  const equipment = user?.kitchenEquipment || [];
  const [customEquip, setCustomEquip] = useState('');

  const toggleEquipment = async (id) => {
    const next = equipment.includes(id) ? equipment.filter(e => e !== id) : [...equipment, id];
    try { await updateProfile({ kitchenEquipment: next }); } catch(e) {}
  };

  const addCustomEquipment = async () => {
    const val = customEquip.trim();
    if (!val || equipment.map(e => e.toLowerCase()).includes(val.toLowerCase())) { setCustomEquip(''); return; }
    const next = [...equipment, val];
    setCustomEquip('');
    try { await updateProfile({ kitchenEquipment: next }); } catch(e) {}
  };

  const shareInviteCode = async () => {
    if (!user?.inviteCode) return;
    await Share.share({ message: `Tritt meinem keepr-Haushalt bei! Einladungscode: ${user.inviteCode}` });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bgSecondary }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingTop: 60, paddingBottom: S.md, backgroundColor: C.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.h3, { color: C.text }]}>Konto bearbeiten</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

        {/* Profil */}
        <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: S.md, paddingTop: S.lg, paddingBottom: 6 }]}>Profil</Text>
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Field label="Anzeigename" value={user?.displayName} onSave={v => save({ displayName: v })} placeholder="Manuel" autoCapitalize="words" />
          {divider}
          <Field label="Username" value={user?.username} onSave={v => save({ username: v })} placeholder="manuel_99" />
        </View>

        {/* Haushalt */}
        <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: S.md, paddingTop: S.lg, paddingBottom: 6 }]}>Haushalt</Text>
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          {/* Eigener Code */}
          <View style={{ padding: S.lg, alignItems: 'center' }}>
            <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }]}>Dein Einladungscode</Text>
            <Text style={{ color: C.tint, fontSize: 36, fontWeight: '800', letterSpacing: 10, marginBottom: 6 }}>{user?.inviteCode || '——'}</Text>
            <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center', marginBottom: S.md }]}>Teile diesen Code, um andere in deinen Haushalt einzuladen</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.tint + '15', paddingHorizontal: S.md, paddingVertical: 10, borderRadius: R.full, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '40' }}
              onPress={shareInviteCode}
            >
              <Feather name="share-2" size={15} color={C.tint} />
              <Text style={[T.label, { color: C.tint }]}>Code teilen</Text>
            </TouchableOpacity>
          </View>

          {divider}

          {/* Haushalt beitreten */}
          <View style={{ padding: S.lg }}>
            <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: S.sm }]}>Haushalt beitreten</Text>
            <Text style={[T.caption, { color: C.textTertiary, marginBottom: S.md }]}>
              Gib den Einladungscode eines anderen Haushalts ein, um beizutreten.
            </Text>
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: C.bgSecondary,
                  borderRadius: R.md,
                  paddingHorizontal: S.md,
                  paddingVertical: 12,
                  color: C.text,
                  fontSize: 18,
                  fontWeight: '700',
                  letterSpacing: 4,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: C.border,
                  textTransform: 'uppercase',
                }}
                placeholder="ABC123"
                placeholderTextColor={C.textTertiary}
                value={joinCode}
                onChangeText={v => setJoinCode(v.toUpperCase())}
                autoCapitalize="characters"
                maxLength={8}
                returnKeyType="done"
                onSubmitEditing={handleJoin}
              />
              <TouchableOpacity
                onPress={handleJoin}
                disabled={joining}
                style={{
                  backgroundColor: C.tint,
                  borderRadius: R.md,
                  paddingHorizontal: S.md,
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: joining ? 0.6 : 1,
                }}
              >
                {joining
                  ? <Text style={{ color: C.bg, fontWeight: '700' }}>…</Text>
                  : <Feather name="log-in" size={20} color={C.bg} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Küchenausstattung */}
        <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: S.md, paddingTop: S.lg, paddingBottom: 6 }]}>Küchenausstattung</Text>
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: S.md }}>
          <Text style={[T.caption, { color: C.textTertiary, marginBottom: S.md }]}>
            Welche Geräte habt ihr im Haushalt? Die KI berücksichtigt das bei der Rezeptplanung.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: S.md }}>
            {EQUIPMENT_LIST.map(({ id, icon }) => {
              const active = equipment.includes(id);
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => toggleEquipment(id)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingVertical: 8, paddingHorizontal: 12,
                    borderRadius: R.md,
                    backgroundColor: active ? C.tint + '18' : C.bgSecondary,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: active ? C.tint : C.border,
                  }}
                >
                  <Feather name={icon} size={13} color={active ? C.tint : C.textTertiary} />
                  <Text style={[T.label, { color: active ? C.tint : C.textSecondary }]}>{id}</Text>
                </TouchableOpacity>
              );
            })}
            {/* Custom equipment chips (not in preset list) */}
            {equipment.filter(e => !EQUIPMENT_LIST.find(p => p.id === e)).map(id => (
              <TouchableOpacity
                key={id}
                onPress={() => toggleEquipment(id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingVertical: 8, paddingLeft: 12, paddingRight: 8,
                  borderRadius: R.md,
                  backgroundColor: C.tint + '18',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: C.tint,
                }}
              >
                <Text style={[T.label, { color: C.tint }]}>{id}</Text>
                <Feather name="x" size={12} color={C.tint} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom input */}
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: C.bgSecondary, borderRadius: R.md,
                paddingHorizontal: S.md, paddingVertical: 10,
                color: C.text, fontSize: 14,
                borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
              }}
              placeholder="Eigenes Gerät hinzufügen…"
              placeholderTextColor={C.textTertiary}
              value={customEquip}
              onChangeText={setCustomEquip}
              returnKeyType="done"
              onSubmitEditing={addCustomEquipment}
              autoCapitalize="words"
            />
            <TouchableOpacity
              onPress={addCustomEquipment}
              style={{
                width: 40, borderRadius: R.md,
                backgroundColor: customEquip.trim() ? C.tint : C.bgSecondary,
                borderWidth: StyleSheet.hairlineWidth, borderColor: customEquip.trim() ? C.tint : C.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Feather name="plus" size={18} color={customEquip.trim() ? C.bg : C.textTertiary} />
            </TouchableOpacity>
          </View>
          {equipment.length > 0 && (
            <Text style={[T.caption, { color: C.textTertiary, marginTop: S.md }]}>
              {equipment.length} Gerät{equipment.length !== 1 ? 'e' : ''} ausgewählt
            </Text>
          )}
        </View>

        {/* Sicherheit */}
        <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: S.md, paddingTop: S.lg, paddingBottom: 6 }]}>Sicherheit</Text>
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingVertical: 14 }}
            onPress={() => Alert.alert('Passwort ändern', 'Diese Funktion wird bald verfügbar sein.')}
          >
            <View style={{ width: 32, height: 32, borderRadius: R.sm, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="lock" size={15} color={C.textSecondary} />
            </View>
            <Text style={[T.body, { flex: 1, color: C.text }]}>Passwort ändern</Text>
            <Feather name="chevron-right" size={16} color={C.textTertiary} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}
