/**
 * screens/ConnectedAppsScreen.js — Verbundene Apps
 *
 * Unterstützte Integrationen:
 *   OAuth:    Strava (vollständig implementiert)
 *   API Key:  Intervals.icu (Athlete ID + API Key), direkte API-Aufrufe
 *   Token:    Oura Ring (Personal Access Token), direkte API-Aufrufe
 *   Bald:     Garmin (Bewerbung läuft), Apple Health (nach EAS Build),
 *             Renpho (via Apple Health), Polar, Wahoo, TrainingPeaks
 *
 * Credentials werden lokal in AsyncStorage gespeichert (kein Backend nötig).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Linking, ActivityIndicator, RefreshControl, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import Svg, { Path, Circle, Rect, G, Ellipse, Polygon } from 'react-native-svg';

import { api, syncIntervalsIcu, verifyIntervalsCredentials, syncOura, verifyOuraToken } from '../api/client';
import { getSecureItem, setSecureItem, removeSecureItem } from '../utils/secureStorage';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { ScreenHeader } from '../components/ui';

// ── App-Logos (SVG) ───────────────────────────────────────────────────────────

function StravaLogo({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066z" fill="#FC4C02" />
      <Path d="M11.026 9.713L8.963 5.61 4 15.28h3.066z" fill="#FC4C02" opacity="0.7" />
    </Svg>
  );
}

function IntervalsLogo({ size = 28 }) {
  // Bar chart style logo
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="2" y="14" width="4" height="8" rx="1" fill="#5856D6" />
      <Rect x="8" y="9" width="4" height="13" rx="1" fill="#5856D6" />
      <Rect x="14" y="4" width="4" height="18" rx="1" fill="#5856D6" />
      <Path d="M2 12 L10 7 L16 10 L22 3" stroke="#5856D6" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4" />
    </Svg>
  );
}

function OuraLogo({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="8" stroke="#1B998B" strokeWidth="2.5" fill="none" />
      <Circle cx="12" cy="12" r="3.5" fill="#1B998B" />
    </Svg>
  );
}

function GarminLogo({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3.18.57 4.38 1.5L5.5 16.38A6.96 6.96 0 0 1 5 14c0-3.87 3.13-7 7-7zm0 14c-1.66 0-3.18-.57-4.38-1.5l10.88-9.88c.32.88.5 1.82.5 2.88 0 3.87-3.13 7-7 7z" fill="#009CDE" />
    </Svg>
  );
}

function AppleHealthLogo({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" fill="#FF3B30" />
    </Svg>
  );
}

function RenphoLogo({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx="12" cy="15" rx="8" ry="5" stroke="#34C759" strokeWidth="2" fill="none" />
      <Path d="M4 15 Q4 8 12 8 Q20 8 20 15" stroke="#34C759" strokeWidth="2" fill="none" />
      <Path d="M9 11.5 L12 8 L15 11.5" stroke="#34C759" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function PolarLogo({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10" fill="#D10032" />
      <Path d="M7 12 Q9 7 12 12 Q15 17 17 12" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function WahooLogo({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 6 L7 18 L12 9 L17 18 L21 6" stroke="#E63946" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TrainingPeaksLogo({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 18 L7 10 L12 14 L17 4 L22 8" stroke="#2E86AB" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="17" cy="4" r="2.5" fill="#2E86AB" />
    </Svg>
  );
}

function ZwiftLogo({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 6h18l-7 6 7 6H3l7-6z" fill="#F47920" />
    </Svg>
  );
}

function MyWhooshLogo({ size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 17 Q5 7 8 12 Q10 16 12 12 Q14 8 16 12 Q19 17 22 7" stroke="#00A3E0" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const APP_LOGOS = {
  strava:        (s) => <StravaLogo size={s} />,
  intervals:     (s) => <IntervalsLogo size={s} />,
  oura:          (s) => <OuraLogo size={s} />,
  garmin:        (s) => <GarminLogo size={s} />,
  apple_health:  (s) => <AppleHealthLogo size={s} />,
  renpho:        (s) => <RenphoLogo size={s} />,
  polar:         (s) => <PolarLogo size={s} />,
  wahoo:         (s) => <WahooLogo size={s} />,
  trainingpeaks: (s) => <TrainingPeaksLogo size={s} />,
  zwift:         (s) => <ZwiftLogo size={s} />,
  mywhoosh:      (s) => <MyWhooshLogo size={s} />,
};

// ── App-Definitionen ──────────────────────────────────────────────────────────

const APPS = [
  {
    key: 'strava',
    name: 'Strava',
    description: 'Aktivitäten automatisch synchronisieren',
    color: '#FC4C02',
    authType: 'oauth',
    available: true,
  },
  {
    key: 'intervals',
    name: 'Intervals.icu',
    description: 'Trainingsbelastung (CTL/ATL/TSB) + Aktivitäten der letzten 30 Tage',
    color: '#5856D6',
    authType: 'apikey',
    available: true,
    fields: [
      { key: 'athleteId', label: 'Athlete ID', placeholder: 'z.B. i12345 (aus der URL)', secure: false },
      { key: 'apiKey', label: 'API Key', placeholder: 'Intervals.icu → Einstellungen → API', secure: true },
    ],
    hint: 'Athlete ID findest du in der URL nach dem Login: intervals.icu/athlete/i12345/...',
  },
  {
    key: 'oura',
    name: 'Oura Ring',
    description: 'Schlaf, HRV + Readiness Score der letzten 7 Tage',
    color: '#1B998B',
    authType: 'token',
    available: true,
    fields: [
      { key: 'token', label: 'Personal Access Token', placeholder: 'cloud.ouraring.com → Personal Access Tokens', secure: true },
    ],
    hint: 'Token erstellen: cloud.ouraring.com → Profil → Personal Access Tokens',
  },
  {
    key: 'garmin',
    name: 'Garmin Connect',
    description: 'Garmin-Gerätedaten importieren + Trainings auf die Uhr senden',
    color: '#009CDE',
    available: false,
    statusLabel: 'Bewerbung läuft',
    statusColor: '#FF9500',
    note: 'API-Bewerbung wurde gesendet an connect-support@developer.garmin.com — Antwort in wenigen Tagen.',
  },
  {
    key: 'apple_health',
    name: 'Apple Health',
    description: 'Aktivitäten, Schritte, Schlaf + Renpho-Körperdaten',
    color: '#FF3B30',
    available: false,
    statusLabel: 'Nach EAS Build',
    statusColor: '#007AFF',
    note: 'Benötigt nativen Build (EAS). Deckt automatisch Renpho, Garmin und andere Apple Health-Apps ab.',
  },
  {
    key: 'renpho',
    name: 'Renpho',
    description: 'Körperwerte der Waage automatisch importieren',
    color: '#34C759',
    available: false,
    statusLabel: 'Via Apple Health',
    statusColor: '#007AFF',
    note: 'Renpho synchronisiert automatisch mit Apple Health. Keine separate Integration nötig.',
  },
  {
    key: 'polar',
    name: 'Polar Flow',
    description: 'Polar-Gerätedaten importieren',
    color: '#D10032',
    available: false,
    statusLabel: 'Bald',
    statusColor: null,
  },
  {
    key: 'wahoo',
    name: 'Wahoo',
    description: 'Wahoo-Trainingsgeräte synchronisieren',
    color: '#E63946',
    available: false,
    statusLabel: 'Bald',
    statusColor: null,
  },
  {
    key: 'trainingpeaks',
    name: 'TrainingPeaks',
    description: 'Trainingsplan + PMC importieren',
    color: '#2E86AB',
    available: false,
    statusLabel: 'Bald',
    statusColor: null,
  },
  {
    key: 'zwift',
    name: 'Zwift',
    description: 'Indoor-Rides + Läufe automatisch importieren',
    color: '#F47920',
    available: false,
    statusLabel: 'Via Strava',
    statusColor: '#FC4C02',
    note: 'Zwift hat keine öffentliche API. Verbinde Strava — Zwift exportiert alle Aktivitäten automatisch dorthin.',
  },
  {
    key: 'mywhoosh',
    name: 'MyWhoosh',
    description: 'MyWhoosh Indoor-Rides importieren',
    color: '#00A3E0',
    available: false,
    statusLabel: 'Via Strava',
    statusColor: '#FC4C02',
    note: 'MyWhoosh hat keine öffentliche API. Verbinde Strava — MyWhoosh exportiert alle Rides automatisch dorthin.',
  },
];

// AsyncStorage-Keys
const STORAGE = {
  intervals: 'connected_intervals_credentials',
  intervals_sync: 'connected_intervals_sync',
  oura: 'connected_oura_token',
  oura_sync: 'connected_oura_sync',
};

// ── Hilfs-Komponente: Status-Badge ────────────────────────────────────────────

function Badge({ label, color, bgAlpha = '20' }) {
  const { colors: C, type: T, radius: R } = useTheme();
  const bg = color ? `${color}${bgAlpha}` : C.bgTertiary;
  const fg = color || C.textTertiary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.sm, backgroundColor: bg }}>
      {color && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: fg }} />}
      <Text style={[T.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ── Hilfs-Komponente: Sync-Summary ────────────────────────────────────────────

function IntervalsSummary({ data }) {
  const { colors: C, type: T } = useTheme();
  if (!data) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
      <View style={{ alignItems: 'center' }}>
        <Text style={[T.h3, { color: C.text }]}>{data.activityCount}</Text>
        <Text style={[T.caption, { color: C.textSecondary }]}>Aktivitäten</Text>
      </View>
      {data.ctl != null && (
        <View style={{ alignItems: 'center' }}>
          <Text style={[T.h3, { color: '#5856D6' }]}>{Math.round(data.ctl)}</Text>
          <Text style={[T.caption, { color: C.textSecondary }]}>CTL</Text>
        </View>
      )}
      {data.atl != null && (
        <View style={{ alignItems: 'center' }}>
          <Text style={[T.h3, { color: '#FF9500' }]}>{Math.round(data.atl)}</Text>
          <Text style={[T.caption, { color: C.textSecondary }]}>ATL</Text>
        </View>
      )}
      {data.tsb != null && (
        <View style={{ alignItems: 'center' }}>
          <Text style={[T.h3, { color: data.tsb >= 0 ? '#34C759' : '#FF3B30' }]}>{Math.round(data.tsb)}</Text>
          <Text style={[T.caption, { color: C.textSecondary }]}>TSB</Text>
        </View>
      )}
    </View>
  );
}

function OuraSummary({ data }) {
  const { colors: C, type: T } = useTheme();
  if (!data) return null;
  const sleepHours = data.avgSleepHours ? (data.avgSleepHours / 3600).toFixed(1) : null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
      {data.readinessScore != null && (
        <View style={{ alignItems: 'center' }}>
          <Text style={[T.h3, { color: '#1B998B' }]}>{data.readinessScore}</Text>
          <Text style={[T.caption, { color: C.textSecondary }]}>Readiness</Text>
        </View>
      )}
      {data.sleepScore != null && (
        <View style={{ alignItems: 'center' }}>
          <Text style={[T.h3, { color: C.text }]}>{data.sleepScore}</Text>
          <Text style={[T.caption, { color: C.textSecondary }]}>Schlaf-Score</Text>
        </View>
      )}
      {sleepHours && (
        <View style={{ alignItems: 'center' }}>
          <Text style={[T.h3, { color: C.text }]}>{sleepHours}h</Text>
          <Text style={[T.caption, { color: C.textSecondary }]}>Schlafdauer</Text>
        </View>
      )}
    </View>
  );
}

// ── Haupt-Screen ──────────────────────────────────────────────────────────────

export default function ConnectedAppsScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();

  // Backend-verbundene Apps (Strava etc.)
  const [connectedApps, setConnectedApps] = useState([]);
  // Lokale Credentials für direkte APIs
  const [credentials, setCredentials] = useState({ intervals: null, oura: null });
  // Sync-Daten
  const [syncData, setSyncData] = useState({ intervals: null, oura: null });
  // Welche App hat das Input-Formular offen
  const [expandedApp, setExpandedApp] = useState(null);
  // Formular-Eingabefelder
  const [inputValues, setInputValues] = useState({ athleteId: '', apiKey: '', token: '' });
  // Ladezustände
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [connecting, setConnecting] = useState(null);

  useEffect(() => { load(); }, []);

  const load = useCallback(async () => {
    try {
      // Backend-Apps laden
      const data = await api.getConnectedApps();
      setConnectedApps(Array.isArray(data) ? data : data?.apps || []);
    } catch { setConnectedApps([]); }

    // Lokale Credentials laden
    try {
      const [intervalsRaw, intervalsSync, ouraToken, ouraSync] = await Promise.all([
        getSecureItem(STORAGE.intervals),
        AsyncStorage.getItem(STORAGE.intervals_sync),
        getSecureItem(STORAGE.oura),
        AsyncStorage.getItem(STORAGE.oura_sync),
      ]);
      setCredentials({
        intervals: intervalsRaw ? JSON.parse(intervalsRaw) : null,
        oura: ouraToken || null,
      });
      setSyncData({
        intervals: intervalsSync ? JSON.parse(intervalsSync) : null,
        oura: ouraSync ? JSON.parse(ouraSync) : null,
      });
    } catch { /* ignore storage errors */ }

    setLoading(false);
    setRefreshing(false);
  }, []);

  // ── Verbinden ──────────────────────────────────────────────────────────────

  const handleConnectStrava = async () => {
    try {
      setConnecting('strava');
      const { url } = await api.getStravaAuthUrl();
      if (url) { await Linking.openURL(url); setTimeout(load, 3000); }
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('konfiguriert') || msg.includes('CLIENT_ID')) {
        Alert.alert('Strava nicht konfiguriert', 'Füge STRAVA_CLIENT_ID und STRAVA_CLIENT_SECRET zur .env auf dem Server hinzu.');
      } else {
        Alert.alert('Fehler', msg);
      }
    } finally { setConnecting(null); }
  };

  const handleSaveIntervals = async () => {
    const { athleteId, apiKey } = inputValues;
    if (!athleteId.trim() || !apiKey.trim()) {
      Alert.alert('Pflichtfelder', 'Bitte Athlete ID und API Key eingeben.');
      return;
    }
    setSaving('intervals');
    try {
      await verifyIntervalsCredentials(athleteId.trim(), apiKey.trim());
      const creds = { athleteId: athleteId.trim(), apiKey: apiKey.trim() };
      await setSecureItem(STORAGE.intervals, JSON.stringify(creds));
      setCredentials(prev => ({ ...prev, intervals: creds }));
      setExpandedApp(null);
      // Direkt sync starten
      handleSyncIntervals(creds);
    } catch (e) {
      Alert.alert('Verbindung fehlgeschlagen', e.message);
    } finally { setSaving(null); }
  };

  const handleSaveOura = async () => {
    const { token } = inputValues;
    if (!token.trim()) {
      Alert.alert('Pflichtfeld', 'Bitte Personal Access Token eingeben.');
      return;
    }
    setSaving('oura');
    try {
      await verifyOuraToken(token.trim());
      await setSecureItem(STORAGE.oura, token.trim());
      setCredentials(prev => ({ ...prev, oura: token.trim() }));
      setExpandedApp(null);
      handleSyncOura(token.trim());
    } catch (e) {
      Alert.alert('Verbindung fehlgeschlagen', e.message);
    } finally { setSaving(null); }
  };

  // ── Sync ───────────────────────────────────────────────────────────────────

  const handleSyncStrava = async () => {
    setSyncing('strava');
    try {
      const result = await api.syncStrava();
      Alert.alert('Sync abgeschlossen', `${result.synced} neue Aktivität${result.synced !== 1 ? 'en' : ''} importiert.`);
      await load();
    } catch (e) { Alert.alert('Sync Fehler', e.message); }
    finally { setSyncing(null); }
  };

  const handleSyncIntervals = async (creds) => {
    const c = creds || credentials.intervals;
    if (!c) return;
    setSyncing('intervals');
    try {
      const data = await syncIntervalsIcu(c.athleteId, c.apiKey);
      await useStore.getState().setExternalData('intervals', data);
      setSyncData(prev => ({ ...prev, intervals: data }));
      // FTP / maxHF automatisch ins Profil übernehmen (nur wenn höher/leer) → fließt in die KI
      const st = useStore.getState();
      const u = st.user || {};
      const profUpdates = {};
      if (data.estMaxHr && (!u.maxHr || data.estMaxHr > u.maxHr)) profUpdates.maxHr = data.estMaxHr;
      if (data.estFtp && (!u.ftp || data.estFtp > u.ftp)) profUpdates.ftp = data.estFtp;
      if (Object.keys(profUpdates).length) { try { await st.updateProfile(profUpdates); } catch (e) {} }
      const autoNote = Object.keys(profUpdates).length
        ? `\nAuto-aktualisiert: ${[profUpdates.ftp && `FTP ${profUpdates.ftp}W`, profUpdates.maxHr && `maxHF ${profUpdates.maxHr}`].filter(Boolean).join(' · ')}`
        : '';
      Alert.alert('Sync abgeschlossen', `${data.activityCount} Aktivitäten importiert.${data.ctl != null ? `\nCTL: ${Math.round(data.ctl)} | ATL: ${Math.round(data.atl)} | TSB: ${Math.round(data.tsb)}` : ''}${autoNote}`);
    } catch (e) { Alert.alert('Sync Fehler', e.message); }
    finally { setSyncing(null); }
  };

  const handleSyncOura = async (tok) => {
    const t = tok || credentials.oura;
    if (!t) return;
    setSyncing('oura');
    try {
      const data = await syncOura(t);
      await useStore.getState().setExternalData('oura', data);
      setSyncData(prev => ({ ...prev, oura: data }));
      Alert.alert('Sync abgeschlossen', `Readiness: ${data.readinessScore ?? '–'} | Schlaf-Score: ${data.sleepScore ?? '–'}`);
    } catch (e) { Alert.alert('Sync Fehler', e.message); }
    finally { setSyncing(null); }
  };

  // ── Trennen ────────────────────────────────────────────────────────────────

  const handleDisconnect = (appKey) => {
    const appName = APPS.find(a => a.key === appKey)?.name || appKey;
    Alert.alert(`${appName} trennen`, 'Wirklich trennen? Gespeicherte Daten bleiben erhalten.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Trennen', style: 'destructive', onPress: async () => {
        if (appKey === 'strava') {
          try { await api.disconnectApp(appKey); await load(); } catch (e) { Alert.alert('Fehler', e.message); }
        } else if (appKey === 'intervals') {
          await removeSecureItem(STORAGE.intervals);
          await AsyncStorage.removeItem(STORAGE.intervals_sync);
          setCredentials(prev => ({ ...prev, intervals: null }));
          setSyncData(prev => ({ ...prev, intervals: null }));
        } else if (appKey === 'oura') {
          await removeSecureItem(STORAGE.oura);
          await AsyncStorage.removeItem(STORAGE.oura_sync);
          setCredentials(prev => ({ ...prev, oura: null }));
          setSyncData(prev => ({ ...prev, oura: null }));
        }
      }},
    ]);
  };

  // ── Verbindungsstatus ermitteln ────────────────────────────────────────────

  const isConnected = (appKey) => {
    if (appKey === 'strava') return connectedApps.some(c => c.app_name === 'strava' || c.appName === 'strava');
    if (appKey === 'intervals') return !!credentials.intervals;
    if (appKey === 'oura') return !!credentials.oura;
    return false;
  };

  const getLastSync = (appKey) => {
    if (appKey === 'strava') {
      const c = connectedApps.find(c => c.app_name === 'strava' || c.appName === 'strava');
      return c?.last_sync || c?.lastSync || null;
    }
    if (appKey === 'intervals') return syncData.intervals?.syncedAt || null;
    if (appKey === 'oura') return syncData.oura?.syncedAt || null;
    return null;
  };

  // ── Input-Formular öffnen ──────────────────────────────────────────────────

  const openForm = (appKey) => {
    setInputValues({ athleteId: '', apiKey: '', token: '' });
    setExpandedApp(appKey);
  };

  const closeForm = () => setExpandedApp(null);

  // ── Render ─────────────────────────────────────────────────────────────────

  const formatDate = (iso) => iso
    ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.tint} />
      </View>
    );
  }

  const availableApps = APPS.filter(a => a.available);
  const unavailableApps = APPS.filter(a => !a.available);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Verbundene Apps" onBack={() => navigation.goBack()} />
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.tint} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[T.body, { color: C.textSecondary, marginBottom: S.sm }]}>
          Synchronisiere deine Trainingsdaten mit externen Apps.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: R.md, padding: 12, marginBottom: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="refresh-cw" size={14} color={C.success} />
          <Text style={[T.caption, { color: C.textSecondary, flex: 1, lineHeight: 17 }]}>
            Auto-Sync aktiv: Verbundene Apps werden beim Öffnen von keepr automatisch synchronisiert — frisch abgeschlossene Einheiten sind sofort da.
          </Text>
        </View>

        {/* ── Verfügbare Integrationen ── */}
        <View style={{ gap: S.sm }}>
          {availableApps.map(app => {
            const connected = isConnected(app.key);
            const lastSync = getLastSync(app.key);
            const isExpanded = expandedApp === app.key;
            const isSyncing = syncing === app.key;
            const isSaving = saving === app.key;
            const isConnecting = connecting === app.key;

            return (
              <View
                key={app.key}
                style={{
                  backgroundColor: C.surface,
                  borderRadius: R.lg,
                  padding: S.md,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: connected ? `${app.color}40` : C.border,
                }}
              >
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 52, height: 52, borderRadius: R.md, backgroundColor: `${app.color}20`, alignItems: 'center', justifyContent: 'center' }}>
                    {APP_LOGOS[app.key]?.(28)}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: 2 }}>
                      <Text style={[T.bodyMed, { color: C.text }]}>{app.name}</Text>
                      {connected && <Badge label="Verbunden" color={C.success} />}
                    </View>
                    <Text style={[T.caption, { color: C.textSecondary }]}>{app.description}</Text>
                    {lastSync && (
                      <Text style={[T.caption, { color: C.textTertiary, marginTop: 3 }]}>
                        Sync: {formatDate(lastSync)}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Sync-Zusammenfassung */}
                {connected && app.key === 'intervals' && syncData.intervals && (
                  <IntervalsSummary data={syncData.intervals} />
                )}
                {connected && app.key === 'oura' && syncData.oura && (
                  <OuraSummary data={syncData.oura} />
                )}

                {/* Aktions-Buttons */}
                <View style={{ marginTop: S.sm, flexDirection: 'row', justifyContent: 'flex-end', gap: S.sm }}>
                  {connected && (
                    <>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(33,150,243,0.4)' }}
                        onPress={() => {
                          if (app.key === 'strava') handleSyncStrava();
                          else if (app.key === 'intervals') handleSyncIntervals();
                          else if (app.key === 'oura') handleSyncOura();
                        }}
                        disabled={isSyncing}
                      >
                        {isSyncing ? <ActivityIndicator size="small" color="#2196F3" /> : <Feather name="refresh-cw" size={13} color="#2196F3" />}
                        <Text style={[T.label, { color: '#2196F3' }]}>Sync</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(220,38,38,0.3)' }}
                        onPress={() => handleDisconnect(app.key)}
                      >
                        <Feather name="scissors" size={13} color={C.danger} />
                        <Text style={[T.label, { color: C.danger }]}>Trennen</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {!connected && !isExpanded && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderStrong }}
                      onPress={() => {
                        if (app.key === 'strava') handleConnectStrava();
                        else openForm(app.key);
                      }}
                      disabled={isConnecting}
                    >
                      {isConnecting
                        ? <ActivityIndicator size="small" color={C.text} />
                        : <Feather name="link" size={13} color={C.text} />
                      }
                      <Text style={[T.label, { color: C.text }]}>Verbinden</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Inline-Formular für API Key / Token */}
                {isExpanded && !connected && (
                  <View style={{ marginTop: S.md, gap: S.sm }}>
                    {app.hint && (
                      <View style={{ flexDirection: 'row', gap: 8, backgroundColor: C.bgTertiary, borderRadius: R.sm, padding: 10 }}>
                        <Feather name="info" size={13} color={C.textTertiary} style={{ marginTop: 1 }} />
                        <Text style={[T.caption, { color: C.textTertiary, flex: 1, lineHeight: 18 }]}>{app.hint}</Text>
                      </View>
                    )}
                    {app.fields.map(field => (
                      <View key={field.key}>
                        <Text style={[T.label, { color: C.textSecondary, marginBottom: 6 }]}>{field.label}</Text>
                        <TextInput
                          style={{
                            backgroundColor: C.bg,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: C.border,
                            borderRadius: R.sm,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            color: C.text,
                            fontSize: 14,
                          }}
                          placeholder={field.placeholder}
                          placeholderTextColor={C.textTertiary}
                          value={inputValues[field.key] || ''}
                          onChangeText={v => setInputValues(prev => ({ ...prev, [field.key]: v }))}
                          secureTextEntry={field.secure}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: S.sm, marginTop: 4 }}>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                        onPress={closeForm}
                      >
                        <Text style={[T.label, { color: C.textSecondary }]}>Abbrechen</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.sm, backgroundColor: app.color + '20', borderWidth: StyleSheet.hairlineWidth, borderColor: app.color + '60' }}
                        onPress={app.key === 'intervals' ? handleSaveIntervals : handleSaveOura}
                        disabled={isSaving}
                      >
                        {isSaving
                          ? <ActivityIndicator size="small" color={app.color} />
                          : <Feather name="check" size={13} color={app.color} />
                        }
                        <Text style={[T.label, { color: app.color }]}>
                          {isSaving ? 'Verbinde...' : 'Speichern & verbinden'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Bald & Ausstehend ── */}
        <Text style={[T.bodyMed, { color: C.textSecondary, marginTop: S.xl, marginBottom: S.sm }]}>
          In Kürze & Geplant
        </Text>
        <View style={{ gap: S.sm }}>
          {unavailableApps.map(app => (
            <View
              key={app.key}
              style={{
                backgroundColor: C.surface,
                borderRadius: R.lg,
                padding: S.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: C.border,
                opacity: 0.85,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                <View style={{ width: 52, height: 52, borderRadius: R.md, backgroundColor: `${app.color}15`, alignItems: 'center', justifyContent: 'center' }}>
                  {APP_LOGOS[app.key]?.(28)}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: 2, flexWrap: 'wrap' }}>
                    <Text style={[T.bodyMed, { color: C.text }]}>{app.name}</Text>
                    <Badge
                      label={app.statusLabel || 'Bald'}
                      color={app.statusColor || null}
                    />
                  </View>
                  <Text style={[T.caption, { color: C.textSecondary }]}>{app.description}</Text>
                  {app.note && (
                    <Text style={[T.caption, { color: C.textTertiary, marginTop: 4, lineHeight: 17 }]}>{app.note}</Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Info-Box */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, backgroundColor: C.surface, borderRadius: R.md, padding: 14, marginTop: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="info" size={15} color={C.textTertiary} />
          <Text style={[T.caption, { color: C.textTertiary, flex: 1, lineHeight: 18 }]}>
            Intervals.icu und Oura übertragen Daten direkt — kein Server nötig. Strava läuft über den keepr-Server. Apple Health und Garmin werden nach dem EAS Build freigeschaltet.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
