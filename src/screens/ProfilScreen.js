import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { api, BASE_URL, secondsToPace } from '../api/client';

const GOAL_LABELS = { lose: 'Abnehmen', maintain: 'Halten', gain: 'Zunehmen', muscle: 'Muskelaufbau', fitness: 'Fitness', ironman: 'Ironman', race: 'Wettkampf' };
const FITNESS_LABELS = { beginner: 'Anfänger', intermediate: 'Fortgeschritten', advanced: 'Fortgeschritten+', elite: 'Elite' };

function SectionHeader({ title }) {
  const { colors: C, type: T, spacing: S } = useTheme();
  return (
    <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: S.md, paddingTop: S.lg, paddingBottom: 6 }]}>
      {title}
    </Text>
  );
}

function MenuRow({ icon, label, value, onPress, destructive, chevron = true }) {
  const { colors: C, type: T, spacing: S, radius: R } = useTheme();
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 14, backgroundColor: C.surface, gap: S.sm }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && (
        <View style={{ width: 32, height: 32, borderRadius: R.sm, backgroundColor: destructive ? C.danger + '18' : C.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={icon} size={16} color={destructive ? C.danger : C.textSecondary} />
        </View>
      )}
      <Text style={[T.body, { flex: 1, color: destructive ? C.danger : C.text }]}>{label}</Text>
      {value && <Text style={[T.caption, { color: C.textSecondary }]}>{value}</Text>}
      {chevron && !destructive && <Feather name="chevron-right" size={16} color={C.textTertiary} />}
    </TouchableOpacity>
  );
}

function Divider() {
  const { colors: C, spacing: S } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: S.md + 32 + S.sm }} />;
}

function SectionCard({ children }) {
  const { colors: C, radius: R, spacing: S } = useTheme();
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: R.lg, marginHorizontal: S.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
      {children}
    </View>
  );
}

export default function ProfilScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { user, updateProfile, logout } = useStore();
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [weightHistory, setWeightHistory] = useState([]);

  useEffect(() => {
    loadWeightHistory();
  }, []);

  const loadWeightHistory = async () => {
    try {
      const data = await api.getWeightHistory?.();
      if (data) setWeightHistory(data.slice(-7));
    } catch(e) {}
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Berechtigung fehlt');
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;
    setAvatarLoading(true);
    try {
      const data = await api.uploadAvatar(result.assets[0].uri);
      if (data?.avatarPath) await updateProfile({ avatarPath: data.avatarPath });
    } catch(e) { Alert.alert('Fehler beim Upload', e.message); }
    setAvatarLoading(false);
  };

  const confirmLogout = () => {
    Alert.alert('Abmelden?', 'Möchtest du dich wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const initials = (user?.displayName || user?.username || '?')[0].toUpperCase();

  // Mini sparkline for weight
  const hasWeight = weightHistory.length >= 2;
  const weightValues = weightHistory.map(w => w.weight || w.value || 0).filter(Boolean);
  const minW = weightValues.length ? Math.min(...weightValues) - 1 : 0;
  const maxW = weightValues.length ? Math.max(...weightValues) + 1 : 1;
  const sparkH = 32;
  const sparkW = 80;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bgSecondary }} contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

      {/* ── Hero ── */}
      <View style={{ backgroundColor: C.bg, paddingHorizontal: S.md, paddingTop: 60, paddingBottom: S.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          {/* Avatar */}
          <TouchableOpacity onPress={pickAvatar} style={{ position: 'relative' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.tint + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.tint + '40' }}>
              {avatarLoading
                ? <ActivityIndicator color={C.tint} />
                : user?.avatarPath
                  ? <Image source={{ uri: `${BASE_URL}${user.avatarPath}` }} style={{ width: 72, height: 72, borderRadius: 36 }} />
                  : <Text style={{ color: C.tint, fontSize: 28, fontWeight: '700' }}>{initials}</Text>
              }
            </View>
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg }}>
              <Feather name="camera" size={10} color={C.tintText} />
            </View>
          </TouchableOpacity>

          {/* Name + Badges */}
          <View style={{ flex: 1 }}>
            <Text style={[T.h3, { color: C.text }]}>{user?.displayName || user?.username || 'Nutzer'}</Text>
            <Text style={[T.caption, { color: C.textSecondary, marginTop: 2 }]}>@{user?.username}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {user?.goal && (
                <View style={{ backgroundColor: C.tint + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.full }}>
                  <Text style={[T.label, { color: C.tint }]}>{GOAL_LABELS[user.goal] || user.goal}</Text>
                </View>
              )}
              {user?.fitnessLevel && (
                <View style={{ backgroundColor: C.bgTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.full }}>
                  <Text style={[T.label, { color: C.textSecondary }]}>{FITNESS_LABELS[user.fitnessLevel] || user.fitnessLevel}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.md }}>
          {[
            [user?.weight ? `${user.weight} kg` : '–', 'Gewicht', 'trending-down'],
            [user?.ftp ? `${user.ftp} W` : '–', 'FTP', 'zap'],
            [user?.maxHr ? `${user.maxHr}` : '–', 'HFmax', 'heart'],
            [user?.runPace ? secondsToPace(user.runPace) : '–', '/km', 'activity'],
          ].map(([val, label, ico]) => (
            <View key={label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.md, padding: 10, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              <Feather name={ico} size={13} color={C.textTertiary} style={{ marginBottom: 4 }} />
              <Text style={[T.bodyMed, { color: C.text, fontSize: 14 }]}>{val}</Text>
              <Text style={[T.label, { color: C.textTertiary, marginTop: 1 }]}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Mein Profil ── */}
      <SectionHeader title="Mein Profil" />
      <SectionCard>
        <MenuRow icon="user" label="Konto bearbeiten" value={user?.username} onPress={() => navigation.navigate('Konto')} />
        <Divider />
        <MenuRow icon="activity" label="Körper & Gesundheit" value={user?.weight ? `${user.weight} kg` : undefined} onPress={() => navigation.navigate('Koerper')} />
        <Divider />
        <MenuRow icon="zap" label="Sportprofil" value={user?.fitnessLevel ? FITNESS_LABELS[user.fitnessLevel] : undefined} onPress={() => navigation.navigate('Sportprofil')} />
        <Divider />
        <MenuRow icon="award" label="Ziele & Wettkämpfe" onPress={() => navigation.navigate('Goals')} />
      </SectionCard>

      {/* ── Ernährung ── */}
      <SectionHeader title="Ernährung" />
      <SectionCard>
        <MenuRow icon="target" label="Kalorienziel" value={user?.calorieGoal ? `${user.calorieGoal} kcal` : undefined} onPress={() => navigation.navigate('Koerper')} />
        <Divider />
        <MenuRow icon="pie-chart" label="Makroziele" value={user?.proteinGoal ? `P ${user.proteinGoal}g` : undefined} onPress={() => navigation.navigate('Koerper')} />
        <Divider />
        <MenuRow icon="coffee" label="Ernährungsweise" value={user?.dietType ? { omnivore: 'Alles', vegetarian: 'Vegetarisch', vegan: 'Vegan', pescatarian: 'Pescetarisch', keto: 'Keto', paleo: 'Paleo' }[user.dietType] : undefined} onPress={() => navigation.navigate('Koerper')} />
      </SectionCard>

      {/* ── Daten & Verbindungen ── */}
      <SectionHeader title="Daten & Verbindungen" />
      <SectionCard>
        <MenuRow icon="link" label="Verbundene Apps" onPress={() => navigation.navigate('ConnectedApps')} />
        <Divider />
        <MenuRow icon="home" label="Haushalt" value={user?.inviteCode || undefined} onPress={() => navigation.navigate('Konto')} />
      </SectionCard>

      {/* ── App ── */}
      <SectionHeader title="App" />
      <SectionCard>
        <MenuRow icon="settings" label="Einstellungen" onPress={() => navigation.navigate('Einstellungen')} />
        <Divider />
        <MenuRow icon="bell" label="Benachrichtigungen" onPress={() => navigation.navigate('Einstellungen')} />
        <Divider />
        <MenuRow icon="shield" label="Datenschutz" onPress={() => navigation.navigate('Einstellungen')} />
        <Divider />
        <MenuRow icon="info" label="Über keepr" value="v1.0" onPress={() => navigation.navigate('Einstellungen')} />
      </SectionCard>

      {/* ── Abmelden ── */}
      <SectionHeader title="" />
      <SectionCard>
        <MenuRow icon="log-out" label="Abmelden" onPress={confirmLogout} destructive chevron={false} />
      </SectionCard>

    </ScrollView>
  );
}
