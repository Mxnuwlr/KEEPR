import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Linking, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { useTheme } from '../theme';

const APPS = [
  { key: 'strava',       name: 'Strava',         description: 'Aktivitäten automatisch synchronisieren', icon: '🚴', color: '#FC4C02', available: true },
  { key: 'garmin',       name: 'Garmin Connect', description: 'Garmin-Gerätedaten importieren',          icon: '⌚', color: '#009CDE', available: false },
  { key: 'apple_health', name: 'Apple Health',   description: 'Gesundheitsdaten synchronisieren',        icon: '❤️', color: '#FF3B30', available: false },
  { key: 'polar',        name: 'Polar Flow',     description: 'Polar-Gerätedaten importieren',           icon: '🔴', color: '#D10032', available: false },
];

function StravaConnectButton({ connected, onConnect, onDisconnect, loading }) {
  const { colors: C, type: T, radius: R } = useTheme();
  if (connected) {
    return (
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(220,38,38,0.3)' }}
        onPress={onDisconnect}
      >
        <Feather name="scissors" size={13} color={C.danger} />
        <Text style={[T.label, { color: C.danger }]}>Trennen</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '60' }}
      onPress={onConnect}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={C.tint} />
      ) : (
        <>
          <Feather name="link" size={13} color={C.tint} />
          <Text style={[T.label, { color: C.tint }]}>Verbinden</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function AppCard({ app, connectedApps, onConnect, onDisconnect, onSync, connecting, syncing }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const conn = connectedApps.find(c => c.app_name === app.key || c.appName === app.key);
  const isConnected = !!conn;
  const lastSync = conn?.last_sync || conn?.lastSync;

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: isConnected ? `${app.color}40` : C.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: R.md, backgroundColor: `${app.color}20`, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 24 }}>{app.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: 2 }}>
            <Text style={[T.bodyMed, { color: C.text }]}>{app.name}</Text>
            {isConnected && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.sm, backgroundColor: C.success + '20' }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.success }} />
                <Text style={[T.label, { color: C.success }]}>Verbunden</Text>
              </View>
            )}
            {!app.available && !isConnected && (
              <View style={{ backgroundColor: C.bgTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.sm }}>
                <Text style={[T.label, { color: C.textTertiary }]}>Bald</Text>
              </View>
            )}
          </View>
          <Text style={[T.caption, { color: C.textSecondary }]}>{app.description}</Text>
          {lastSync && (
            <Text style={[T.caption, { color: C.textTertiary, marginTop: 3 }]}>
              Letzte Sync: {new Date(lastSync).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
      </View>
      {app.available && (
        <View style={{ marginTop: S.sm, flexDirection: 'row', justifyContent: 'flex-end', gap: S.sm }}>
          {isConnected && app.key === 'strava' && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(33,150,243,0.4)' }}
              onPress={() => onSync(app.key)}
              disabled={syncing === app.key}
            >
              {syncing === app.key
                ? <ActivityIndicator size="small" color="#2196F3" />
                : <Feather name="refresh-cw" size={13} color="#2196F3" />
              }
              <Text style={[T.label, { color: '#2196F3' }]}>Sync</Text>
            </TouchableOpacity>
          )}
          {app.key === 'strava' ? (
            <StravaConnectButton
              connected={isConnected}
              loading={connecting === app.key}
              onConnect={() => onConnect(app.key)}
              onDisconnect={() => onDisconnect(app.key)}
            />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, opacity: 0.5 }}>
              <Text style={[T.label, { color: C.textTertiary }]}>Nicht verfügbar</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function ConnectedAppsScreen() {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const [connectedApps, setConnectedApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(null);
  const [syncing, setSyncing] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await api.getConnectedApps();
      setConnectedApps(Array.isArray(data) ? data : data?.apps || []);
    } catch(e) { setConnectedApps([]); }
    setLoading(false);
    setRefreshing(false);
  };

  const handleConnect = async (appKey) => {
    if (appKey === 'strava') {
      try {
        setConnecting('strava');
        const { url } = await api.getStravaAuthUrl();
        if (url) { await Linking.openURL(url); setTimeout(load, 3000); }
      } catch(e) {
        const msg = e.message || '';
        if (msg.includes('konfiguriert') || msg.includes('CLIENT_ID')) {
          Alert.alert('Strava nicht konfiguriert', 'Füge STRAVA_CLIENT_ID und STRAVA_CLIENT_SECRET zur .env Datei auf dem Server hinzu.\n\nRegistriere eine App unter strava.com/settings/api');
        } else {
          Alert.alert('Fehler', msg);
        }
      } finally { setConnecting(null); }
    }
  };

  const handleSync = async (appKey) => {
    setSyncing(appKey);
    try {
      if (appKey === 'strava') {
        const result = await api.syncStrava();
        Alert.alert('Sync abgeschlossen', `${result.synced} neue Aktivität${result.synced !== 1 ? 'en' : ''} importiert (${result.total} gesamt in den letzten 30 Tagen).`);
        await load();
      }
    } catch(e) { Alert.alert('Sync Fehler', e.message); }
    finally { setSyncing(null); }
  };

  const handleDisconnect = (appKey) => {
    const appName = APPS.find(a => a.key === appKey)?.name || appKey;
    Alert.alert(`${appName} trennen`, `${appName} wirklich trennen? Deine bisherigen Daten bleiben erhalten.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Trennen', style: 'destructive', onPress: async () => {
        try { await api.disconnectApp(appKey); await load(); } catch(e) { Alert.alert('Fehler', e.message); }
      }},
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: S.md, paddingTop: 60, paddingBottom: 130 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.tint} />}
    >
      <Text style={[T.h1, { color: C.text, marginBottom: 6 }]}>Apps verbinden</Text>
      <Text style={[T.body, { color: C.textSecondary, marginBottom: S.lg }]}>
        Synchronisiere deine Daten mit externen Fitness-Apps.
      </Text>

      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <ActivityIndicator color={C.tint} />
        </View>
      ) : (
        <View style={{ gap: S.sm }}>
          {APPS.map(app => (
            <AppCard
              key={app.key}
              app={app}
              connectedApps={connectedApps}
              connecting={connecting}
              syncing={syncing}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onSync={handleSync}
            />
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, backgroundColor: C.surface, borderRadius: R.md, padding: 14, marginTop: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
        <Feather name="info" size={15} color={C.textTertiary} />
        <Text style={[T.caption, { color: C.textTertiary, flex: 1, lineHeight: 18 }]}>
          Beim Verbinden von Strava wirst du zur Strava-Website weitergeleitet. Nach der Autorisierung werden deine Aktivitäten automatisch importiert.
        </Text>
      </View>
    </ScrollView>
  );
}
