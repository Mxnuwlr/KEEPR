/**
 * screens/ProfilScreen.js — Nutzerprofil (Hauptseite des Profil-Tabs)
 *
 * Aufbau (übersichtlich in klaren Blöcken):
 *   1. Hero: Avatar + Name + Ziel/Level-Badges
 *   2. Quick Stats (Gewicht, FTP, HFmax, Pace)
 *   3. Fortschrittsfotos-Karte — prominenter Einstieg mit Thumbnails je Pose
 *      (+ Schnellzugriff auf den Körper-Vergleich, wenn eine Analyse existiert)
 *   4. Menü-Sektionen via ui.js (SectionLabel + Surface + MenuRow)
 *
 * Profilfoto: expo-image-picker → api.uploadAvatar().
 */

// React/RN
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator } from 'react-native';

// Third-party
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';
import { api, getBaseUrl, secondsToPace } from '../api/client';
import { Surface, MenuRow, SectionLabel } from '../components/ui';
import { PROGRESS_POSES } from './ProgressPhotosScreen';

const GOAL_LABELS = { lose: 'Abnehmen', maintain: 'Halten', gain: 'Zunehmen', muscle: 'Muskelaufbau', fitness: 'Fitness', ironman: 'Ironman', race: 'Wettkampf' };
const FITNESS_LABELS = { beginner: 'Anfänger', intermediate: 'Fortgeschritten', advanced: 'Fortgeschritten+', elite: 'Elite' };

/** "vor 3 Tagen" / "vor 5 Wochen" für den letzten Foto-Check-in */
function agoLabel(dateStr) {
  if (!dateStr) return null;
  const days = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00')) / 86400000);
  if (isNaN(days) || days < 0) return null;
  if (days === 0) return 'heute';
  if (days < 14) return `vor ${days} Tag${days === 1 ? '' : 'en'}`;
  return `vor ${Math.floor(days / 7)} Wochen`;
}

export default function ProfilScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, updateProfile, logout, progressPhotos, fetchProgressPhotos, progressAnalysis, fetchProgressAnalysis } = useStore();
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => { fetchProgressPhotos(); fetchProgressAnalysis(); }, []);

  // Neuestes Foto je Pose (für die Thumbnail-Reihe) + letzter Check-in-Tag
  const { poseThumbs, lastPhotoDate } = useMemo(() => {
    const newest = {};
    let last = null;
    for (const ph of progressPhotos || []) {
      if (!newest[ph.pose] || ph.date > newest[ph.pose].date) newest[ph.pose] = ph;
      if (!last || ph.date > last) last = ph.date;
    }
    return {
      poseThumbs: PROGRESS_POSES.map(p => ({ ...p, photo: newest[p.key] || null })),
      lastPhotoDate: last,
    };
  }, [progressPhotos]);
  const hasPhotos = !!lastPhotoDate;

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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: insets.top + S.lg, paddingBottom: 130 }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Hero: Avatar + Name ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.md }}>
        <TouchableOpacity onPress={pickAvatar} style={{ position: 'relative' }}>
          <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.bgTertiary, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong, overflow: 'hidden' }}>
            {avatarLoading
              ? <ActivityIndicator color={C.text} />
              : user?.avatarPath
                ? <Image source={{ uri: `${getBaseUrl()}${user.avatarPath}` }} style={{ width: 68, height: 68 }} />
                : <Text style={[T.h2, { color: C.textSecondary }]}>{initials}</Text>
            }
          </View>
          <View style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg }}>
            <Feather name="camera" size={11} color={C.accentText} />
          </View>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[T.h2, { color: C.text }]}>{user?.displayName || user?.username || 'Nutzer'}</Text>
          <Text style={[T.caption, { color: C.textSecondary, marginTop: 2 }]}>@{user?.username}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
            {user?.goal ? (
              <View style={{ backgroundColor: C.tint, paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.full }}>
                <Text style={[T.label, { color: C.tintText }]}>{GOAL_LABELS[user.goal] || user.goal}</Text>
              </View>
            ) : null}
            {user?.fitnessLevel ? (
              <View style={{ backgroundColor: C.bgTertiary, paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.full }}>
                <Text style={[T.label, { color: C.textSecondary }]}>{FITNESS_LABELS[user.fitnessLevel] || user.fitnessLevel}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* ── Quick Stats ── */}
      <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg, paddingHorizontal: S.md }}>
        {[
          [user?.weight ? `${user.weight}` : '–', 'kg', 'trending-down'],
          [user?.ftp ? `${user.ftp}` : '–', 'FTP (W)', 'zap'],
          [user?.maxHr ? `${user.maxHr}` : '–', 'HFmax', 'heart'],
          [user?.runPace ? secondsToPace(user.runPace) : '–', 'Pace /km', 'activity'],
        ].map(([val, label, ico]) => (
          <View key={label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.md, paddingVertical: 10, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <Feather name={ico} size={13} color={C.textTertiary} style={{ marginBottom: 4 }} />
            <Text style={[T.bodyMed, { color: C.text, fontSize: 14 }]}>{val}</Text>
            <Text style={[T.label, { color: C.textTertiary, marginTop: 1 }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Fortschrittsfotos ── */}
      <SectionLabel>Fortschritt</SectionLabel>
      <Surface style={{ marginHorizontal: S.md, padding: 0, overflow: 'hidden' }}>
        <TouchableOpacity activeOpacity={0.75} onPress={() => navigation.navigate('ProgressPhotos')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: hasPhotos ? S.sm : S.md }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="camera" size={17} color={C.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[T.body, { color: C.text }]}>Fortschrittsfotos</Text>
              <Text style={[T.caption, { color: C.textTertiary, marginTop: 1 }]}>
                {hasPhotos ? `Letztes Check-in ${agoLabel(lastPhotoDate)}` : 'Halte deine Entwicklung alle 4 Wochen fest'}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.textTertiary} />
          </View>

          {hasPhotos && (
            <View style={{ flexDirection: 'row', gap: S.sm, paddingHorizontal: S.md, paddingBottom: S.md }}>
              {poseThumbs.map(p => (
                <View key={p.key} style={{ flex: 1 }}>
                  {p.photo ? (
                    <Image source={{ uri: p.photo.imageUrl }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: R.sm, backgroundColor: C.bgTertiary }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: R.sm, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                      <Feather name="user" size={16} color={C.textTertiary} />
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>

        {Array.isArray(progressAnalysis?.regionen) && progressAnalysis.regionen.length > 0 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('ProgressCompare')}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: S.md, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }}
          >
            <Feather name="crosshair" size={15} color={C.text} />
            <Text style={[T.bodyMed, { color: C.text, flex: 1 }]}>Körper-Vergleich ansehen</Text>
            <Feather name="chevron-right" size={16} color={C.textTertiary} />
          </TouchableOpacity>
        )}
      </Surface>

      {/* ── Mein Profil ── */}
      <SectionLabel>Mein Profil</SectionLabel>
      <Surface style={{ marginHorizontal: S.md, padding: 0, overflow: 'hidden' }}>
        <MenuRow icon="user" label="Konto & Profil" value={user?.username} onPress={() => navigation.navigate('Konto')} />
        <MenuRow icon="activity" label="Körper, Ernährung & Ziele" value={user?.weight ? `${user.weight} kg` : undefined} onPress={() => navigation.navigate('Koerper')} />
        <MenuRow icon="zap" label="Sportprofil" value={user?.fitnessLevel ? FITNESS_LABELS[user.fitnessLevel] : undefined} onPress={() => navigation.navigate('Sportprofil')} />
        <MenuRow icon="award" label="Ziele & Wettkämpfe" onPress={() => navigation.navigate('Goals')} last />
      </Surface>

      {/* ── Verbindungen ── */}
      <SectionLabel>Verbindungen</SectionLabel>
      <Surface style={{ marginHorizontal: S.md, padding: 0, overflow: 'hidden' }}>
        <MenuRow icon="link" label="Verbundene Apps" onPress={() => navigation.navigate('ConnectedApps')} />
        <MenuRow icon="home" label="Haushalt" value={user?.inviteCode || undefined} onPress={() => navigation.navigate('Household')} last />
      </Surface>

      {/* ── App ── */}
      <SectionLabel>App</SectionLabel>
      <Surface style={{ marginHorizontal: S.md, padding: 0, overflow: 'hidden' }}>
        <MenuRow icon="settings" label="Einstellungen" onPress={() => navigation.navigate('Einstellungen')} />
        <MenuRow icon="log-out" label="Abmelden" onPress={confirmLogout} danger last />
      </Surface>

      <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center', marginTop: S.lg }]}>keepr v1.0</Text>

    </ScrollView>
  );
}
