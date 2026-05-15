import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, useThemeMode } from '../theme';
import { useStore } from '../store';

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
  const { user, updateProfile } = useStore();

  const [notifMeals, setNotifMeals] = useState(user?.notifMeals ?? true);
  const [notifTraining, setNotifTraining] = useState(user?.notifTraining ?? true);
  const [notifExpiry, setNotifExpiry] = useState(user?.notifExpiry ?? true);
  const [notifTips, setNotifTips] = useState(user?.notifTips ?? false);

  const save = async (updates) => {
    try { await updateProfile({ ...user, ...updates }); } catch(e) {}
  };

  const toggleNotif = (key, val, setter) => {
    setter(val);
    save({ [key]: val });
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
            onPress={() => Alert.alert('Datenschutz', 'Deine Daten werden ausschließlich auf deinem eigenen Server gespeichert und nicht an Dritte weitergegeben.')}
          />
          <Divider />
          <SettingsRow
            icon="lock"
            label="Lokale Datenspeicherung"
            value="Aktiviert"
            onPress={() => Alert.alert('Datenspeicherung', 'Alle App-Daten werden lokal auf deinem Gerät und deinem eigenen Server gespeichert.')}
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
                  { text: 'Löschen', style: 'destructive', onPress: () => Alert.alert('Nicht verfügbar', 'Diese Funktion ist noch nicht implementiert.') },
                ]
              )
            }
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
