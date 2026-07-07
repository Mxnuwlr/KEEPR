/**
 * screens/EinstellungenScreen.js — App-Einstellungen
 *
 * Einstellungen-Screen mit Sektionen für Darstellung, Konto und Info.
 * Unterstützt:
 *   - Dark/Light Mode Toggle (useThemeMode)
 *   - Gemini API-Key setzen (AsyncStorage)
 *   - Logout
 *   - Links zu Datenschutz/Impressum via Linking
 *
 * SectionLabel — Wiederverwendbare Sektion-Überschrift
 */

// React/RN
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert, TextInput, Share, ActivityIndicator } from 'react-native';

// Third-party
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

// Internal
import { useTheme, useThemeMode } from '../theme';
import { useStore } from '../store';
import { getBaseUrl, setBaseUrl, DEFAULT_BASE_URL, api } from '../api/client';
import { removeSecureItem } from '../utils/secureStorage';
import { requestNotificationPermission, scheduleMealReminders, scheduleTrainingReminder, scheduleMHDWarnings } from '../notifications';

function SectionLabel({ title }) {
  const { colors: C, type: T, spacing: S } = useTheme();
  return (
    <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: S.md, paddingTop: S.lg, paddingBottom: 6 }]}>
      {title}
    </Text>
  );
}

function SettingsRow({ icon, label, value, onPress, destructive, rightElement, chevron = true }) {
  const { colors: C, type: T, spacing: S, radius: R } = useTheme();
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 13, gap: S.sm }}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {icon && (
        <View style={{ width: 32, height: 32, borderRadius: R.sm, backgroundColor: destructive ? C.danger + '18' : C.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={icon} size={16} color={destructive ? C.danger : C.textSecondary} />
        </View>
      )}
      <Text style={[T.body, { flex: 1, color: destructive ? C.danger : C.text }]}>{label}</Text>
      {value && !rightElement && <Text style={[T.caption, { color: C.textSecondary }]}>{value}</Text>}
      {rightElement || (chevron && onPress && !destructive && <Feather name="chevron-right" size={16} color={C.textTertiary} />)}
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

export default function EinstellungenScreen({ navigation }) {
  const { colors: C, spacing: S, type: T } = useTheme();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const { user, updateProfile, logout, inventory } = useStore();

  const [notifMeals, setNotifMeals] = useState(user?.notifMeals ?? true);
  const [notifTraining, setNotifTraining] = useState(user?.notifTraining ?? true);
  const [notifExpiry, setNotifExpiry] = useState(user?.notifExpiry ?? true);
  const [notifTips, setNotifTips] = useState(user?.notifTips ?? false);

  const [serverUrl, setServerUrl] = useState(getBaseUrl());
  const [urlSaved, setUrlSaved] = useState(false);

  const handleSaveUrl = () => {
    if (!serverUrl.trim()) {
      Alert.alert('Ungültige URL', 'Bitte eine gültige Server-URL eingeben.');
      return;
    }
    setBaseUrl(serverUrl.trim());
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2000);
  };

  const handleResetUrl = () => {
    setServerUrl(DEFAULT_BASE_URL);
    setBaseUrl(DEFAULT_BASE_URL);
  };

  const [exporting, setExporting] = useState(false);

  const handleExport = async (type) => {
    setExporting(true);
    try {
      let csv = '';
      let filename = '';

      if (type === 'sessions') {
        const sessions = await api.getSessions(500);
        csv = 'Datum,Routine,Dauer (min),Volumen (kg),Sätze\n';
        csv += sessions.map(s =>
          [
            s.started_at?.split('T')[0] || '',
            `"${(s.routine_name || 'Workout').replace(/"/g, '""')}"`,
            Math.round((s.duration_seconds || 0) / 60),
            Math.round(s.total_volume_kg || 0),
            s.total_sets || 0,
          ].join(',')
        ).join('\n');
        filename = `keepr_training_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (type === 'calories') {
        const today = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const logs = await api.getDailyLogs(from, today);
        csv = 'Datum,Kalorien,Protein (g),Kohlenhydrate (g),Fett (g)\n';
        csv += (logs || []).map(l =>
          [l.date, l.calories || 0, l.protein || 0, l.carbs || 0, l.fat || 0].join(',')
        ).join('\n');
        filename = `keepr_kalorien_${new Date().toISOString().split('T')[0]}.csv`;
      }

      await Share.share({ message: csv, title: filename });
    } catch (e) {
      Alert.alert('Export fehlgeschlagen', e.message);
    } finally {
      setExporting(false);
    }
  };

  const save = async (updates) => {
    try { await updateProfile({ ...user, ...updates }); } catch(e) {}
  };

  const toggleNotif = async (key, val, setter) => {
    setter(val);
    save({ [key]: val });
    if (val) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setter(false);
        Alert.alert(
          'Benachrichtigungen nicht verfügbar',
          'Benachrichtigungen funktionieren nur in der installierten App (EAS Build), nicht in Expo Go.',
        );
        return;
      }
    }
    if (key === 'notifMeals') scheduleMealReminders(val);
    if (key === 'notifTraining') scheduleTrainingReminder(val);
    if (key === 'notifExpiry') scheduleMHDWarnings(inventory, val);
  };

  const toggle = (val, key, setter) => (
    <Switch
      value={val}
      onValueChange={v => toggleNotif(key, v, setter)}
      trackColor={{ false: C.bgTertiary, true: C.accent }}
      thumbColor={C.bg}
      ios_backgroundColor={C.bgTertiary}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bgSecondary }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingTop: 60, paddingBottom: S.md, backgroundColor: C.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.h3, { color: C.text }]}>Einstellungen</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

        {/* Benachrichtigungen */}
        <SectionLabel title="Benachrichtigungen" />
        <SectionCard>
          <SettingsRow
            icon="coffee"
            label="Mahlzeiten-Erinnerungen"
            chevron={false}
            rightElement={toggle(notifMeals, 'notifMeals', setNotifMeals)}
          />
          <Divider />
          <SettingsRow
            icon="zap"
            label="Training-Erinnerungen"
            chevron={false}
            rightElement={toggle(notifTraining, 'notifTraining', setNotifTraining)}
          />
          <Divider />
          <SettingsRow
            icon="alert-circle"
            label="MHD-Warnungen"
            chevron={false}
            rightElement={toggle(notifExpiry, 'notifExpiry', setNotifExpiry)}
          />
          <Divider />
          <SettingsRow
            icon="star"
            label="Tipps & Neuigkeiten"
            chevron={false}
            rightElement={toggle(notifTips, 'notifTips', setNotifTips)}
          />
        </SectionCard>

        {/* Darstellung */}
        <SectionLabel title="Darstellung" />
        <SectionCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 12, gap: S.sm }}>
            <View style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="sun" size={16} color={C.textSecondary} />
            </View>
            <Text style={[{ flex: 1, fontSize: 15, color: C.text }]}>Erscheinungsbild</Text>
            <View style={{ flexDirection: 'row', backgroundColor: C.bgTertiary, borderRadius: 8, padding: 3, gap: 2 }}>
              {[['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([m, label]) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setThemeMode(m)}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: themeMode === m ? C.surface : 'transparent' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: themeMode === m ? C.text : C.textTertiary }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Divider />
          <SettingsRow
            icon="globe"
            label="Sprache"
            value="Deutsch"
            onPress={() => Alert.alert('Sprache', 'Weitere Sprachoptionen kommen bald.')}
          />
          <Divider />
          <SettingsRow
            icon="bar-chart-2"
            label="Einheiten"
            value="metrisch"
            onPress={() => Alert.alert('Einheiten', 'Metrische Einheiten (kg, cm, km) sind aktiv.')}
          />
        </SectionCard>

        {/* Datenschutz */}
        <SectionLabel title="Datenschutz" />
        <SectionCard>
          <SettingsRow
            icon="shield"
            label="Datenschutzerklärung"
            onPress={() => Alert.alert(
              'Datenschutz',
              'keepr speichert deine Konto-, Ernährungs- und Trainingsdaten auf dem konfigurierten keepr-Server. ' +
              'Sensible Zugangsdaten (Login-Token, API-Schlüssel) werden verschlüsselt im Schlüsselbund deines Geräts abgelegt.\n\n' +
              'Für einzelne Funktionen werden Daten an Drittanbieter übermittelt:\n' +
              '• KI-Funktionen (Rezepte, Plananalyse): Google Gemini\n' +
              '• Trainings-Sync (optional, nur wenn verbunden): Strava, Intervals.icu, Oura\n\n' +
              'Du kannst deine Daten jederzeit über „Alle Daten löschen" entfernen.'
            )}
          />
          <Divider />
          <SettingsRow
            icon="lock"
            label="Datenspeicherung"
            value="Verschlüsselt"
            onPress={() => Alert.alert(
              'Datenspeicherung',
              'App-Daten liegen auf dem keepr-Server. Login-Token und verbundene API-Schlüssel werden zusätzlich verschlüsselt im Geräte-Schlüsselbund (iOS Keychain / Android Keystore) gespeichert.'
            )}
          />
          <Divider />
          <SettingsRow
            icon="trash-2"
            label="Alle Daten löschen"
            destructive
            chevron={false}
            onPress={() =>
              Alert.alert(
                'Alle Daten löschen?',
                'Dies löscht dauerhaft alle deine Einträge, Gewichtsverläufe und Einstellungen. Diese Aktion kann nicht rückgängig gemacht werden.',
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  { text: 'Löschen', style: 'destructive', onPress: async () => {
            await AsyncStorage.clear();
            // Verschlüsselte Werte (Keychain) separat entfernen — AsyncStorage.clear() erfasst sie nicht
            await Promise.all([
              removeSecureItem('auth_token'),
              removeSecureItem('connected_intervals_credentials'),
              removeSecureItem('connected_oura_token'),
            ]);
            await logout();
          }},
                ]
              )
            }
          />
          <Divider />
          <SettingsRow
            icon="user-x"
            label="Konto endgültig löschen"
            destructive
            chevron={false}
            onPress={() =>
              Alert.alert(
                'Konto endgültig löschen?',
                'Dein Account und alle serverseitig gespeicherten Daten (Training, Ernährung, Körperwerte) werden unwiderruflich gelöscht. Fortfahren?',
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  { text: 'Konto löschen', style: 'destructive', onPress: async () => {
                    try {
                      await api.deleteAccount();
                    } catch (e) {
                      Alert.alert('Fehler', e.message || 'Konto konnte nicht gelöscht werden.');
                      return;
                    }
                    await AsyncStorage.clear();
                    await Promise.all([
                      removeSecureItem('auth_token'),
                      removeSecureItem('connected_intervals_credentials'),
                      removeSecureItem('connected_oura_token'),
                    ]);
                    await logout();
                  }},
                ]
              )
            }
          />
        </SectionCard>

        {/* Daten exportieren */}
        <SectionLabel title="Daten exportieren" />
        <SectionCard>
          <SettingsRow
            icon="activity"
            label="Training exportieren"
            value="CSV"
            onPress={() => handleExport('sessions')}
            rightElement={exporting ? <ActivityIndicator size="small" color={C.accent} /> : undefined}
          />
          <Divider />
          <SettingsRow
            icon="pie-chart"
            label="Kalorien exportieren"
            value="CSV · 90 Tage"
            onPress={() => handleExport('calories')}
            rightElement={exporting ? <ActivityIndicator size="small" color={C.accent} /> : undefined}
          />
        </SectionCard>

        {/* Verbindung / Server */}
        <SectionLabel title="Verbindung" />
        <SectionCard>
          <View style={{ paddingHorizontal: S.md, paddingTop: 12, paddingBottom: 4 }}>
            <Text style={{ color: C.textTertiary, fontSize: 11, fontWeight: '600', marginBottom: 6 }}>SERVER-URL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <TextInput
                style={{ flex: 1, backgroundColor: C.bgSecondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: C.text, fontSize: 14, fontFamily: 'Courier' }}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder={DEFAULT_BASE_URL}
                placeholderTextColor={C.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={handleSaveUrl}
              />
              <TouchableOpacity
                onPress={handleSaveUrl}
                style={{ backgroundColor: urlSaved ? '#22C55E' : C.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text style={{ color: C.bg, fontWeight: '700', fontSize: 13 }}>
                  {urlSaved ? '✓' : 'OK'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: C.textTertiary, fontSize: 11, marginTop: 6, marginBottom: 10, lineHeight: 16 }}>
              LAN: http://192.168.x.x:3001 · Extern: https://deine-url.trycloudflare.com
            </Text>
          </View>
          <Divider />
          <SettingsRow
            icon="refresh-cw"
            label="Standard wiederherstellen"
            chevron={false}
            onPress={handleResetUrl}
          />
        </SectionCard>

        {/* Über keepr */}
        <SectionLabel title="Über keepr" />
        <SectionCard>
          <SettingsRow icon="info" label="Version" value="1.0.0" chevron={false} />
          <Divider />
          <SettingsRow
            icon="code"
            label="Technologien"
            onPress={() => Alert.alert('Technologien', 'React Native · Expo · Node.js · PostgreSQL')}
          />
          <Divider />
          <SettingsRow
            icon="heart"
            label="Mit Liebe gebaut"
            value="für deinen Haushalt"
            chevron={false}
          />
        </SectionCard>

      </ScrollView>
    </View>
  );
}
