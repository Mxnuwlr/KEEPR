/**
 * utils/autoSync.js — Automatischer Sync aller verbundenen Apps
 *
 * Läuft beim App-Start und jedes Mal, wenn die App in den Vordergrund kommt
 * (AppState → 'active', verdrahtet in App.js). So sind z.B. frisch auf Strava
 * abgeschlossene Einheiten sofort da, wenn man keepr öffnet — ohne manuellen Sync.
 *
 * - Drosselung: höchstens alle MIN_GAP_MS (Ausnahme: force=true)
 * - Läuft still im Hintergrund: Fehler einzelner Dienste werden geschluckt,
 *   die übrigen Dienste syncen trotzdem.
 * - Nur verbundene Dienste werden angefragt (Strava-Aufruf wirft serverseitig,
 *   wenn nicht verbunden → zählt als "nicht verbunden").
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSecureItem } from './secureStorage';
import { api, syncIntervalsIcu, syncOura } from '../api/client';
import { useStore } from '../store';
import { notifyNow } from '../notifications';

const LAST_KEY = 'auto_sync_last';
const MIN_GAP_MS = 10 * 60 * 1000; // 10 Minuten

let running = false;

export async function autoSyncConnectedApps({ force = false } = {}) {
  const st = useStore.getState();
  if (!st.user || running) return null;

  if (!force) {
    try {
      const last = parseInt((await AsyncStorage.getItem(LAST_KEY)) || '0', 10);
      if (Date.now() - last < MIN_GAP_MS) return null;
    } catch (e) {}
  }
  running = true;
  try {
    await AsyncStorage.setItem(LAST_KEY, String(Date.now())).catch(() => {});
    const results = { strava: 0, intervals: false, oura: false };

    // Strava — Server holt neue Aktivitäten direkt von der Strava-API
    // (inkl. Detaildaten: Splits, Runden, Watt, Kalorien)
    let stravaActivities = [];
    try {
      const r = await api.syncStrava();
      results.strava = r?.synced || 0;
      stravaActivities = r?.activities || [];
    } catch (e) {}

    // Intervals.icu — direkt vom Client (Key liegt im Keychain);
    // importiert Aktivitäten (z.B. von Garmin) auch als Einheiten nach keepr
    try {
      const raw = await getSecureItem('connected_intervals_credentials');
      if (raw) {
        const c = JSON.parse(raw);
        const data = await syncIntervalsIcu(c.athleteId, c.apiKey);
        await st.setExternalData('intervals', data);
        if (data.imported > 0) {
          results.intervalsImported = data.imported;
          stravaActivities = stravaActivities.concat(data.importedActivities || []);
        }
        // FTP / maxHF automatisch übernehmen (gleiche Logik wie manueller Sync)
        const u = useStore.getState().user || {};
        const upd = {};
        if (data.estMaxHr && (!u.maxHr || data.estMaxHr > u.maxHr)) upd.maxHr = data.estMaxHr;
        if (data.estFtp && (!u.ftp || data.estFtp > u.ftp)) upd.ftp = data.estFtp;
        if (Object.keys(upd).length) { try { await useStore.getState().updateProfile(upd); } catch (e) {} }
        results.intervals = true;
      }
    } catch (e) {}

    // Oura — direkt vom Client
    try {
      const token = await getSecureItem('connected_oura_token');
      if (token) {
        const data = await syncOura(token);
        await st.setExternalData('oura', data);
        results.oura = true;
      }
    } catch (e) {}

    // Neue Einheiten importiert → Benachrichtigung + KI-Coach analysiert sofort
    const newCount = (results.strava || 0) + (results.intervalsImported || 0);
    if (newCount > 0) {
      const names = stravaActivities.slice(0, 3)
        .map(a => `${a.name}${a.distanceKm ? ` (${a.distanceKm} km)` : ''}`)
        .join(', ');
      notifyNow(
        newCount === 1 ? 'Neue Einheit importiert' : `${newCount} neue Einheiten importiert`,
        `${names}${stravaActivities.length > 3 ? ' …' : ''} — dein KI-Coach analysiert die Leistung.`
      );
      try {
        const insight = await useStore.getState().analyzeAthlete();
        const hasChanges = insight?.applied && Object.keys(insight.applied).length > 0;
        if (insight?.nachricht && (hasChanges || insight.belastung === 'zu_hoch' || insight.belastung === 'zu_niedrig')) {
          notifyNow('Dein KI-Coach', insight.nachricht);
        }
      } catch (e) {}
    }

    return results;
  } finally {
    running = false;
  }
}
