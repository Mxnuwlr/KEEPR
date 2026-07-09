/**
 * client.js — API-Client und KI-Funktionen
 *
 * Exports:
 *   BASE_URL                        — Aktuelle API-Basisadresse (ggf. anpassen)
 *   api                             — REST-Client-Objekt für alle Backend-Endpunkte
 *   analyzeReceiptWithGemini        — Kassenzettel per Gemini auslesen
 *   analyzeFoodPhoto                — Essensfoto analysieren
 *   getAiRecipeSuggestions          — KI-Rezeptvorschläge aus Inventar
 *   normalizeShoppingList           — Einkaufsliste kategorisieren + Mengen normalisieren
 *   calculateNutrition              — Nährwerte per Name schätzen
 *   lookupBarcode                   — Barcode → Produktinfos (OpenFoodFacts + Gemini Fallback)
 *   generateSingleMealWithGemini    — Einzelne Mahlzeit generieren
 *   generateMealPlanWithGemini      — 7-Tage-Ernährungsplan generieren
 *   swapIngredientWithGemini        — Zutat in Rezept ersetzen
 *   generateDetailedStepsWithGemini — Ausführliche Kochanleitung generieren
 *   generateTrainingPlanWithGemini  — 7-Tage-Trainingsplan generieren
 *   analyzeWorkoutWithGemini        — Einzelnes Workout analysieren und Feedback geben
 *   secondsToPace                   — Pace-Formatierung (Sekunden → "m:ss")
 *   paceToSeconds                   — Pace-Parsing ("m:ss" → Sekunden)
 *   getSportIcon                    — Ionicons-Name für Sportart
 *   getSportColor                   — Farbe für Sportart
 */

// React Native
import AsyncStorage from '@react-native-async-storage/async-storage';

// Internal
import { getSecureItem } from '../utils/secureStorage';
import { getSport } from '../data/sports';

// ── Konfiguration ─────────────────────────────────────────────────────────────
export const DEFAULT_BASE_URL = 'https://api.keepr-app.de';
export const BASE_URL_STORAGE_KEY = 'api_base_url';

// Mutable runtime URL — wird beim App-Start via loadBaseUrl() aus AsyncStorage geladen.
let _baseUrl = DEFAULT_BASE_URL;

/** Liest gespeicherte Server-URL aus AsyncStorage und setzt sie. */
export async function loadBaseUrl() {
  const stored = await AsyncStorage.getItem(BASE_URL_STORAGE_KEY);
  if (stored) _baseUrl = stored;
}

/** Setzt die Server-URL und speichert sie dauerhaft. */
export function setBaseUrl(url) {
  _baseUrl = url.trim().replace(/\/$/, ''); // trailing slash entfernen
  AsyncStorage.setItem(BASE_URL_STORAGE_KEY, _baseUrl);
}

/** Gibt die aktuelle Server-URL zurück. */
export function getBaseUrl() { return _baseUrl; }

// Legacy-Export für Stellen die BASE_URL direkt importieren
export const BASE_URL = DEFAULT_BASE_URL;

// ── HTTP-Hilfsfunktionen ──────────────────────────────────────────────────────

/** Liest das Auth-Token aus dem verschlüsselten Keychain (Fallback: AsyncStorage). */
async function getToken() { return await getSecureItem('auth_token'); }

/**
 * Generische HTTP-Anfrage an das Backend.
 * Setzt automatisch Authorization-Header und wirft bei HTTP-Fehler.
 *
 * @param {'GET'|'POST'|'PUT'|'DELETE'} method
 * @param {string} path - API-Pfad (z.B. '/api/inventory')
 * @param {object|FormData|null} body
 * @param {boolean} isFormData - wenn true, wird kein Content-Type gesetzt (für multipart)
 */
async function request(method, path, body = null, isFormData = false) {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${_baseUrl}${path}`, { method, headers, body: body ? (isFormData ? body : JSON.stringify(body)) : undefined });
  const data = await res.json();
  if (!res.ok) { const err = new Error(data.error || 'Serverfehler'); err.status = res.status; throw err; }
  return data;
}

// ── API-Objekt: alle Backend-Endpunkte ───────────────────────────────────────
export const api = {
  // Auth
  register: (b) => request('POST', '/api/register', b),
  login: (b) => request('POST', '/api/login', b),
  joinHousehold: (code) => request('POST', '/api/join-household', { inviteCode: code }),

  // Profile
  getProfile: () => request('GET', '/api/profile'),
  updateProfile: (b) => request('PUT', '/api/profile', b),
  deleteAccount: () => request('DELETE', '/api/account'),
  changePassword: (currentPassword, newPassword) => request('POST', '/api/account/password', { currentPassword, newPassword }),

  // Inventory
  getInventory: () => request('GET', '/api/inventory'),
  addInventoryItem: (i) => request('POST', '/api/inventory', i),
  bulkAddInventory: (items) => request('POST', '/api/inventory/bulk', { items }),
  updateInventoryItem: (id, i) => request('PUT', `/api/inventory/${id}`, i),
  deleteInventoryItem: (id) => request('DELETE', `/api/inventory/${id}`),

  // Ingredients DB
  searchIngredients: (q = '') => request('GET', `/api/ingredients/search?q=${encodeURIComponent(q)}`),

  // Collections
  getCollections: () => request('GET', '/api/collections'),
  createCollection: (name) => request('POST', '/api/collections', { name }),
  deleteCollection: (id) => request('DELETE', `/api/collections/${id}`),
  getCollectionRecipes: (id) => request('GET', `/api/collections/${id}/recipes`),
  addToCollection: (collectionId, recipeId) => request('POST', `/api/collections/${collectionId}/recipes`, { recipeId }),
  removeFromCollection: (collectionId, recipeId) => request('DELETE', `/api/collections/${collectionId}/recipes/${recipeId}`),

  // Recipes
  getRecipes: () => request('GET', '/api/recipes'),
  getUnsortedRecipes: () => request('GET', '/api/recipes/unsorted'),
  createRecipe: (r) => request('POST', '/api/recipes', r),
  updateRecipe: (id, r) => request('PUT', `/api/recipes/${id}`, r),
  deleteRecipe: (id) => request('DELETE', `/api/recipes/${id}`),
  cookRecipe: (id, portions, totalServings) => request('POST', `/api/recipes/${id}/cook`, { portions: portions || 1, totalServings: totalServings || 1 }),
  uploadRecipeImage: async (recipeId, imageUri) => {
    const form = new FormData();
    form.append('image', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' });
    return request('POST', `/api/recipes/${recipeId}/image`, form, true);
  },

  // Calories
  getCalories: (date) => request('GET', `/api/calories?date=${date}`),
  addCalorieLog: (e) => request('POST', '/api/calories', e),
  updateCalorieLog: (id, e) => request('PUT', `/api/calories/${id}`, e),
  deleteCalorieLog: (id) => request('DELETE', `/api/calories/${id}`),
  getWeeklyCalories: () => request('GET', '/api/calories/week'),
  getCalendarCalories: (year, month) => request('GET', `/api/calories/calendar?year=${year}&month=${month}`),
  getStreak: () => request('GET', '/api/calories/streak'),

  // Weight
  addWeight: (b) => request('POST', '/api/weight', b),
  logWeight: (b) => request('POST', '/api/weight', b),
  getWeight: () => request('GET', '/api/weight'),
  getWeightHistory: () => request('GET', '/api/weight'),

  // Food
  searchFood: (q) => request('GET', `/api/food/search?q=${encodeURIComponent(q)}`),
  getFoodByBarcode: (code) => request('GET', `/api/food/barcode/${code}`),

  // Config
  getGeminiKey: () => request('GET', '/api/config/gemini'),

  // Training
  getTrainingPlan: (weekKey) => request('GET', `/api/training/plan${weekKey ? `?week=${weekKey}` : ''}`),
  generateTrainingPlan: (b) => request('POST', '/api/training/generate', b),
  saveTrainingPlan: (b) => request('POST', '/api/training/plan/save', b),
  completeWorkout: (b) => request('POST', '/api/training/complete', b),
  deleteCompletedWorkout: (id) => request('DELETE', `/api/training/complete/${id}`),
  updateTrainingSession: (id, b) => request('PATCH', `/api/training/session/${id}`, b),
  regenerateSession: (id, instruction) => request('POST', `/api/training/session/${id}/regenerate`, { instruction: instruction || '' }),
  rebalancePlan: (weekKey, lockedSessionId) => request('POST', '/api/training/plan/rebalance', { weekKey, lockedSessionId }),
  getTrainingHistory: (from, to) => request('GET', `/api/training/history${from ? `?from=${from}` : ''}${to ? `&to=${to}` : ''}`),
  chatWithCoach: (message, context) => request('POST', '/api/training/chat', { message, context }),

  // Daily Log
  getDailyLog: (date) => request('GET', `/api/daily-log?date=${date}`),
  getDailyLogs: (from, to) => request('GET', `/api/daily-log${from ? `?from=${from}` : ''}${to ? `&to=${to}` : ''}`),
  saveDailyLog: (b) => request('POST', '/api/daily-log', b),

  // Calendar (combined)
  getCalendarDay: (date) => request('GET', `/api/calendar/day?date=${date}`),
  getCalendarMonth: (year, month) => request('GET', `/api/calendar/month?year=${year}&month=${month}`),

  // Water
  getWater: (date) => request('GET', `/api/water?date=${date}`),
  addWater: (ml, date) => request('POST', '/api/water', { ml, date }),
  deleteWater: (id) => request('DELETE', `/api/water/${id}`),

  // Weight analysis
  getWeightAnalysis: () => request('GET', '/api/weight/analysis'),

  // Home daily review
  getDailyReview: () => request('GET', '/api/home/daily-review'),

  // AI meal plan
  getAIMealPlan: () => request('POST', '/api/calories/ai-plan', {}),

  // Inventory use
  useInventoryItem: (id, amount) => request('POST', `/api/inventory/${id}/use`, { amount }),

  // Household
  getHousehold: () => request('GET', '/api/household'),
  getHouseholdMembers: () => request('GET', '/api/household/members'),
  getShoppingList: () => request('GET', '/api/shopping-list'),
  addShoppingItem: (item) => request('POST', '/api/shopping-list', item),
  toggleShoppingItem: (id, checked) => request('PUT', `/api/shopping-list/${id}`, { checked }),
  deleteShoppingItem: (id) => request('DELETE', `/api/shopping-list/${id}`),
  clearCheckedItems: () => request('DELETE', '/api/shopping-list/checked'),
  batchUpdateShoppingItems: (items) => request('PUT', '/api/shopping-list/batch', { items }),
  importRecipeFromUrl: (url) => request('POST', '/api/recipes/import-url', { url }),
  setRecipeImagePath: (id, imagePath) => request('PUT', `/api/recipes/${id}/image-path`, { imagePath }),
  generateRecipeImage: (recipeId, name, ingredients) => request('POST', '/api/recipes/generate-image', { recipeId, name, ingredients }),

  // Connected Apps
  getConnectedApps: () => request('GET', '/api/connected-apps'),
  disconnectApp: (appName) => request('DELETE', `/api/connected-apps/${appName}`),
  getStravaAuthUrl: () => request('GET', '/api/strava/auth-url'),
  syncStrava: () => request('POST', '/api/strava/sync'),
  // KI-Athleten-Analyse: prueft Profil gegen echte Leistung, passt es serverseitig an
  analyzeAthlete: () => request('POST', '/api/athlete/analyze', {}),
  getAthleteInsight: () => request('GET', '/api/athlete/insight'),
  // Aktivitaeten-Import (z.B. intervals.icu — Garmin-Daten ohne Strava-Abo)
  importWorkouts: (source, workouts) => request('POST', '/api/workouts/import', { source, workouts }),
  // Key serverseitig registrieren → Pi-Worker synct alle 10 Min, auch ohne App
  connectIntervalsServer: (apiKey) => request('POST', '/api/intervals/connect', { apiKey }),
  disconnectIntervalsServer: () => request('DELETE', '/api/intervals/connect'),

  // Avatar
  uploadAvatar: async (imageUri) => {
    const form = new FormData();
    form.append('avatar', { uri: imageUri, name: 'avatar.jpg', type: 'image/jpeg' });
    return request('POST', '/api/profile/avatar', form, true);
  },

  // Dokument-Text extrahieren
  parseDocument: (base64, mimeType, filename) => request('POST', '/api/training/parse-document', { base64, mimeType, filename }),
  // Trainingsplan-Text → strukturiertes JSON
  parsePlanStructure: (text) => request('POST', '/api/training/parse-plan-structure', { text }),

  // Kraft-Tracking
  getExercises: (q, muscle, equipment) => request('GET', `/api/kraft/exercises?q=${q||''}&muscle=${encodeURIComponent(muscle||'')}&equipment=${encodeURIComponent(equipment||'')}`),
  createCustomExercise: (b) => request('POST', '/api/kraft/exercises', b),
  getRoutines: () => request('GET', '/api/kraft/routines'),
  createRoutine: (b) => request('POST', '/api/kraft/routines', b),
  updateRoutine: (id, b) => request('PUT', `/api/kraft/routines/${id}`, b),
  deleteRoutine: (id) => request('DELETE', `/api/kraft/routines/${id}`),
  getSessions: (limit, offset) => request('GET', `/api/kraft/sessions?limit=${limit||20}&offset=${offset||0}`),
  saveSession: (b) => request('POST', '/api/kraft/sessions', b),
  deleteSession: (id) => request('DELETE', `/api/kraft/sessions/${id}`),
  getPRs: () => request('GET', '/api/kraft/prs'),
  getExerciseHistory: (id) => request('GET', `/api/kraft/exercise/${id}/history`),
  getLastSets: (names) => request('POST', '/api/kraft/last-sets', { names }),
  getVolumeStats: () => request('GET', '/api/kraft/stats/volume'),

  // Mobility
  getMobilityResult: () => request('GET', '/api/mobility/result'),
  saveMobilityResult: (b) => request('POST', '/api/mobility/result', b),
  getMobilityHistory: () => request('GET', '/api/mobility/history'),
  getMobilityMedia: () => request('GET', '/api/mobility/media'),
  generateMobilityFlow: (b) => request('POST', '/api/mobility/flow', b),

  // Fortschrittsfotos
  getProgressPhotos: () => request('GET', '/api/progress/photos'),
  uploadProgressPhoto: async (imageUri, date, pose) => {
    const form = new FormData();
    form.append('date', date);
    form.append('pose', pose);
    form.append('image', { uri: imageUri, name: 'progress.jpg', type: 'image/jpeg' });
    return request('POST', '/api/progress/photo', form, true);
  },
  deleteProgressPhoto: (id) => request('DELETE', `/api/progress/photo/${id}`),
  analyzeProgress: () => request('POST', '/api/progress/analyze', {}),
  getProgressAnalysis: () => request('GET', '/api/progress/analysis'),
};

// ── Intervals.icu — Direkte API (kein Backend nötig) ─────────────────────────

/**
 * Testet Intervals.icu Zugangsdaten und gibt Athleten-Info zurück.
 * Basic Auth: username="API_KEY", password=<apiKey>
 */
export async function verifyIntervalsCredentials(athleteId, apiKey) {
  const auth = btoa(`API_KEY:${apiKey}`);
  const res = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (res.status === 401 || res.status === 403) throw new Error('API-Key ungültig — bitte neu kopieren (intervals.icu → Settings → Developer Settings)');
  if (!res.ok) throw new Error(`Intervals.icu Fehler: ${res.status}`);
  return res.json();
}

/**
 * Lädt Aktivitäten + Wellness (CTL/ATL/TSB) der letzten 30 Tage von Intervals.icu.
 */
export async function syncIntervalsIcu(athleteId, apiKey) {
  const auth = btoa(`API_KEY:${apiKey}`);
  const base = `https://intervals.icu/api/v1/athlete/${athleteId}`;
  const today = new Date().toISOString().slice(0, 10);
  // newest = morgen, sonst fehlen die Einheiten von HEUTE (newest wird als 00:00 interpretiert)
  const newest = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const oldest = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const headers = { Authorization: `Basic ${auth}` };

  const [actRes, wellRes] = await Promise.all([
    fetch(`${base}/activities?oldest=${oldest}&newest=${newest}`, { headers }),
    fetch(`${base}/wellness?oldest=${oldest}&newest=${today}`, { headers }),
  ]);

  if (actRes.status === 401) throw new Error('Ungültige Anmeldedaten');
  if (!actRes.ok) throw new Error(`Intervals.icu Fehler: ${actRes.status}`);

  const activities = await actRes.json();
  const wellness = wellRes.ok ? await wellRes.json() : [];
  // Letzter Wellness-Eintrag für CTL/ATL/TSB
  const latestWellness = Array.isArray(wellness) && wellness.length > 0 ? wellness[wellness.length - 1] : null;

  // Auto-Schätzung FTP + maxHF aus den Aktivitäten (best-effort, falls Felder vorhanden)
  const acts = Array.isArray(activities) ? activities : [];
  // Strava-Quelle: intervals.icu darf diese Aktivitäten NICHT über die API weitergeben
  // (Strava-Sperre) — zählen, damit die App den Nutzer auf Garmin-Direktverbindung hinweist.
  const stravaLocked = acts.filter(a => a.source === 'STRAVA' && !a.moving_time).length;
  const hrVals = acts.map(a => a.max_heartrate).filter(v => typeof v === 'number' && v > 120 && v < 230);
  const estMaxHr = hrVals.length ? Math.max(...hrVals) : null;
  const ftpVals = acts.map(a => a.icu_eftp ?? a.icu_ftp).filter(v => typeof v === 'number' && v > 50 && v < 600);
  const estFtp = ftpVals.length ? Math.max(...ftpVals) : null;

  // ── Voll-Import: Aktivitäten als Einheiten nach keepr übernehmen ──
  // (Garmin → intervals.icu → keepr; ersetzt den Strava-Import ohne Abo-Zwang)
  const sorted = acts.slice().sort((a, b) => String(b.start_date_local || '').localeCompare(String(a.start_date_local || '')));
  // Intervalle/Runden für die neuesten Einheiten (letzte 7 Tage, max. 8 Abrufe)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const lapsMap = {};
  const streamMap = {};
  const dsClient = (arr, n = 200) => {
    if (!Array.isArray(arr) || !arr.length) return null;
    const c = arr.map(v => (typeof v === 'number' && !isNaN(v)) ? v : null);
    const step = Math.max(1, Math.ceil(c.length / n));
    const o = []; for (let i = 0; i < c.length; i += step) o.push(c[i]);
    return o.some(v => v != null) ? o : null;
  };
  await Promise.all(
    sorted.filter(a => String(a.start_date_local || '').slice(0, 10) >= weekAgo).slice(0, 8).map(async (a) => {
      try {
        const r = await fetch(`https://intervals.icu/api/v1/activity/${a.id}/intervals`, { headers });
        if (r.ok) {
          const d = await r.json();
          const ivs = Array.isArray(d?.icu_intervals) ? d.icu_intervals : (Array.isArray(d) ? d : null);
          if (ivs && ivs.length > 1) lapsMap[a.id] = ivs;
        }
      } catch (e) {}
      // Alle Mess-Streams: GPS-Route + Puls/Höhe/Tempo-Verlauf für die Detailansicht
      try {
        const r = await fetch(`https://intervals.icu/api/v1/activity/${a.id}/streams`, { headers });
        if (r.ok) {
          const streams = await r.json();
          const by = {}; for (const s of (Array.isArray(streams) ? streams : [])) by[s.type] = s;
          const ll = by.latlng;
          let pts = [];
          if (Array.isArray(ll?.data) && Array.isArray(ll?.data2)) {
            for (let pi = 0; pi < ll.data.length; pi++) if (ll.data[pi] != null && ll.data2[pi] != null) pts.push([ll.data[pi], ll.data2[pi]]);
          } else if (Array.isArray(ll?.data)) {
            pts = ll.data.filter(p => Array.isArray(p) && p.length === 2 && p[0] != null);
          }
          const out = {};
          if (pts.length > 10) { const st = Math.max(1, Math.ceil(pts.length / 200)); out.route = pts.filter((_, i) => i % st === 0).map(p => [+p[0].toFixed(5), +p[1].toFixed(5)]); }
          const hr = dsClient(by.heartrate?.data); if (hr) out.hr = hr.map(v => v == null ? null : Math.round(v));
          const alt = dsClient(by.altitude?.data); if (alt) out.alt = alt.map(v => v == null ? null : Math.round(v));
          const spd = dsClient(by.velocity_smooth?.data); if (spd) out.speed = spd.map(v => v == null ? null : +(v * 3.6).toFixed(1));
          const dist = dsClient(by.distance?.data); if (dist) out.dist = dist.map(v => v == null ? null : +(v / 1000).toFixed(2));
          streamMap[a.id] = out;
        }
      } catch (e) {}
    })
  );
  const TYPE_MAP = { Ride: 'bike', VirtualRide: 'bike', Run: 'run', VirtualRun: 'run', Swim: 'swim', OpenWaterSwim: 'swim', WeightTraining: 'strength', Workout: 'strength', Walk: 'mobility', Hike: 'hike', Rowing: 'row', Yoga: 'mobility' };
  const workouts = sorted.map(a => ({
    externalId: String(a.id),
    date: String(a.start_date_local || '').slice(0, 10),
    startTime: a.start_date_local || null,
    name: a.name || a.type || 'Aktivität',
    sportType: TYPE_MAP[a.type] || 'other',
    durationMin: Math.round((a.moving_time || a.elapsed_time || 0) / 60),
    summary: {
      focus: a.name || a.type,
      distance: a.distance || null,
      moving_time_s: a.moving_time || null,
      avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
      max_hr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
      avg_speed_kmh: a.average_speed ? +(a.average_speed * 3.6).toFixed(1) : null,
      max_speed_kmh: a.max_speed ? +(a.max_speed * 3.6).toFixed(1) : null,
      elapsed_time_s: a.elapsed_time || null,
      avg_watts: a.icu_average_watts || a.average_watts ? Math.round(a.icu_average_watts || a.average_watts) : null,
      weighted_watts: a.icu_weighted_avg_watts ? Math.round(a.icu_weighted_avg_watts) : null,
      elevation_gain_m: a.total_elevation_gain ? Math.round(a.total_elevation_gain) : null,
      calories: a.calories ? Math.round(a.calories) : null,
      training_load: a.icu_training_load || null,
      avg_cadence: a.average_cadence ? Math.round(a.average_cadence) : null,
      device: a.device_name || null,
      location: a.location_name || null,
      laps: lapsMap[a.id] ? lapsMap[a.id].slice(0, 40).map(iv => ({
        typ: iv.type || null,
        zeit_s: iv.moving_time || iv.elapsed_time || null,
        distanz_m: iv.distance ? Math.round(iv.distance) : null,
        avg_hr: iv.average_heartrate ? Math.round(iv.average_heartrate) : null,
        avg_watts: iv.average_watts ? Math.round(iv.average_watts) : null,
      })) : null,
      route: streamMap[a.id]?.route || null,
      hr_stream: streamMap[a.id]?.hr || null,
      alt_stream: streamMap[a.id]?.alt || null,
      speed_stream: streamMap[a.id]?.speed || null,
      dist_stream: streamMap[a.id]?.dist || null,
    },
  })).filter(w => w.date && w.durationMin > 0);

  let imported = 0, importedActivities = [];
  if (workouts.length) {
    try {
      const importRes = await api.importWorkouts('intervals', workouts);
      imported = importRes?.imported || 0;
      importedActivities = importRes?.activities || [];
    } catch (e) {}
  }

  return {
    activityCount: Array.isArray(activities) ? activities.length : 0,
    activities: acts.slice(0, 10),
    estMaxHr,
    estFtp,
    ctl: latestWellness?.ctl ?? null,
    atl: latestWellness?.atl ?? null,
    tsb: latestWellness?.tsb ?? null,
    imported,
    importedActivities,
    stravaLocked,
    syncedAt: new Date().toISOString(),
  };
}

// ── Oura Ring — Direkte API (kein Backend nötig) ──────────────────────────────

/**
 * Testet Oura Personal Access Token.
 */
export async function verifyOuraToken(token) {
  const res = await fetch('https://api.ouraring.com/v2/usercollection/personal_info', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error('Ungültiger Token — bitte prüfen');
  if (!res.ok) throw new Error(`Oura Fehler: ${res.status}`);
  return res.json();
}

/**
 * Lädt Schlaf + Readiness-Daten der letzten 7 Tage von Oura.
 */
export async function syncOura(token) {
  const base = 'https://api.ouraring.com/v2/usercollection';
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const headers = { Authorization: `Bearer ${token}` };

  const [readRes, sleepRes] = await Promise.all([
    fetch(`${base}/daily_readiness?start_date=${start}&end_date=${today}`, { headers }),
    fetch(`${base}/daily_sleep?start_date=${start}&end_date=${today}`, { headers }),
  ]);

  if (readRes.status === 401) throw new Error('Ungültiger Token');
  if (!readRes.ok) throw new Error(`Oura Fehler: ${readRes.status}`);

  const readiness = await readRes.json();
  const sleep = sleepRes.ok ? await sleepRes.json() : { data: [] };

  const readData = readiness.data || [];
  const sleepData = sleep.data || [];
  const latest = readData.length > 0 ? readData[readData.length - 1] : null;
  const latestSleep = sleepData.length > 0 ? sleepData[sleepData.length - 1] : null;

  return {
    readinessScore: latest?.score ?? null,
    sleepScore: latestSleep?.score ?? null,
    avgSleepHours: latestSleep ? (latestSleep.contributors?.total_sleep ?? null) : null,
    readiness: readData,
    sleep: sleepData,
    syncedAt: new Date().toISOString(),
  };
}

// ── Gemini KI-Funktionen ─────────────────────────────────────────────────────

/** Endpunkt-URL für das Gemini-Flash-Lite-Modell. */
const GEMINI_URL = (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${key}`;

// Alle Gemini-Aufrufe laufen ueber den Backend-Proxy /api/ai/gemini (Key bleibt serverseitig).
async function geminiFetch(opts = {}) {
  const token = await getToken();
  return fetch(`${_baseUrl}/api/ai/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: opts.body,
    signal: opts.signal,
  });
}

/**
 * Generische Gemini-Anfrage mit Retry-Logik und Timeout.
 * Bei 503/Überlast wird exponentiell gewartet und erneut versucht.
 *
 * @param {string} key - Gemini API-Key
 * @param {object} body - Request-Body (contents, generationConfig …)
 * @param {{ timeoutMs?: number, retries?: number }} options
 * @returns {Promise<string>} - Rohtext aus der Gemini-Antwort
 */
async function geminiRequest(key, body, { timeoutMs = 30000, retries = 5 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, Math.min(3000 * i, 15000)));
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await geminiFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const data = await res.json();
      if (!res.ok) { lastErr = new Error(data.error?.message || 'Fehler'); continue; }
      return extractGeminiText(data);
    } catch(e) { lastErr = e; }
  }
  throw lastErr;
}

/**
 * Extrahiert den Antwort-Text aus der Gemini-API-Antwort.
 * Filtert "thought"-Parts heraus (Chain-of-Thought-Felder).
 */
function extractGeminiText(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.filter(p => !p.thought).map(p => p.text || '').join('');
}

/**
 * Parst JSON aus dem Gemini-Antwort-Text.
 * Bereinigt Markdown-Codeblöcke und abschließende Kommas (häufige Fehlerquellen).
 * Versucht als Fallback, das erste { oder [ zu finden und ab dort zu parsen.
 *
 * @param {string} text - Rohtext aus Gemini
 * @returns {object|Array} - Geparste JSON-Daten
 * @throws {Error} wenn kein valides JSON gefunden wird
 */
function parseGeminiJson(text) {
  let s = text.replace(/```json\n?|```\n?/g, '').trim();
  // Abschließende Kommas vor } oder ] entfernen (häufig bei KI-Ausgaben)
  s = s.replace(/,(\s*[}\]])/g, '$1');
  // Direkter Parse-Versuch
  try { return JSON.parse(s); } catch(e) {}
  // Fallback: JSON-Start anhand von { oder [ suchen
  const oi = s.indexOf('{'), ai = s.indexOf('[');
  const start = oi !== -1 && (ai === -1 || oi < ai) ? oi : ai;
  if (start !== -1) {
    const extracted = s.slice(start).replace(/,(\s*[}\]])/g, '$1');
    try { return JSON.parse(extracted); } catch(e) {}
  }
  throw new Error('KI-Antwort konnte nicht gelesen werden');
}

/**
 * Analysiert einen deutschen Kassenzettel (Base64-Bild) mit Gemini.
 * Extrahiert alle Lebensmittelprodukte mit Mengen, MHD-Schätzungen und Nährwerten.
 * Getränke werden bewusst ausgeschlossen.
 * Bricht bei unvollständigem JSON den Array am letzten vollständigen Objekt ab.
 *
 * @param {string} base64 - Base64-kodiertes Bild
 * @param {string} mimeType - MIME-Typ (z.B. 'image/jpeg')
 * @param {string} geminiKey - Gemini API-Key
 * @returns {Promise<Array>} - Array mit Produktobjekten
 */
export async function analyzeReceiptWithGemini(base64, mimeType, geminiKey) {
  const today = new Date().toISOString().split('T')[0];
  const prompt = `Analysiere diesen deutschen Kassenzettel. Extrahiere alle Lebensmittelprodukte AUSSER Getränken (keine Säfte, Wasser, Softdrinks, Bier, Wein, Kaffee, Tee, Energy Drinks).

MENGEN-REGELN (sehr wichtig!):
1. Steht auf dem Kassenzettel ein Gewicht oder eine Menge direkt beim Artikel (z.B. "0,456 kg", "500 g", "6 St")? → Diese exakt übernehmen und umrechnen (z.B. "0,456 kg" → "456 g").
2. Kein Gewicht auf Zettel? → Schätze nach Standardverpackung:
   - Mehl, Zucker, Reis, Nudeln, Haferflocken, Linsen: "1 kg"
   - Butter: "250 g"
   - Käse am Stück: "400 g" | Scheibenkäse: "200 g"
   - Joghurt, Quark: "500 g" | Griechischer Joghurt: "400 g"
   - Schmand, Sauerrahm, Creme fraiche: "200 g"
   - Frischkäse: "200 g"
   - Sahne: "200 ml"
   - Eier: erkenne Packungsgröße (S/M/L/XL → 6/10/12 Stück), Standard: "10 Stück"
   - Brot (Laib): "500 g" | Brötchen: "6 Stück"
   - Frisches Fleisch/Geflügel/Fisch (Theke): Gewicht vom Zettel, sonst "300 g"
   - Wurst aufschnitt: "100 g"
   - Konserven/Dosen: "1 Dose 400 g"
   - Tomaten (Dose): "1 Dose 400 g"
   - Tiefkühlgemüse: "750 g" | Tiefkühlpizza: "1 Stück"
   - Müsli/Cerealien: "500 g"
   - Marmelade, Honig, Aufstrich: "1 Glas 350 g"
   - Schokolade, Riegel: "100 g"
   - Chips, Snacks: "175 g"
   - Nüsse: "200 g"
   - Meerefrüchte aus Dose: "1 Dose 185 g"
   - Sonstiges Einzelprodukt: "1 Stück"
3. Wenn nach obigen Regeln trotzdem unklar: setze "unsicher": true (sonst false)
4. Erscheint dasselbe Produkt mehrmals auf dem Zettel? → NUR EINMAL ausgeben, "count" auf die Anzahl setzen (z.B. 3x Joghurt → count:3, qty:"500 g"). Bei Theken-Artikeln mit unterschiedlichem Gewicht: count:1, qty = Summe aller Gewichte.

Heute: ${today}
MHD-Richtwerte: Frische Milch 10 Tage, Joghurt 21 Tage, Hartkäse 90 Tage, Weichkäse 14 Tage, Eier 28 Tage, Frisches Fleisch 3 Tage, Geflügel 2 Tage, Brot 5 Tage, Aufschnitt 5 Tage, Konserven 730 Tage, Nudeln/Reis/Mehl 730 Tage, Tiefkühl 180 Tage, Butter 60 Tage.

WICHTIG: Antworte AUSSCHLIESSLICH mit JSON-Array, kein Markdown:
[{"name":"Name auf Deutsch","emoji":"passendes Emoji","mhd":"YYYY-MM-DD","qty":"Menge pro Stück","count":1,"category":"Kategorie","caloriesPer100g":100,"proteinPer100g":5,"carbsPer100g":15,"fatPer100g":3,"unsicher":false}]`;
  let text = '';
  try {
    const res = await geminiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 8192 } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Fehler');
    text = extractGeminiText(data);
  } catch(e) {
    throw e;
  }
  text = text.replace(/```json\n?|```\n?/g, '').trim();
  if (!text) throw new Error('Keine Antwort von Gemini');
  // Robustes Parsing: Array extrahieren, bei unvollständigem JSON Abschneiden
  const startIdx = text.indexOf('[');
  if (startIdx === -1) throw new Error('Kein JSON-Array in Antwort gefunden');
  text = text.slice(startIdx);
  // Falls JSON abgeschnitten: letztes vollständiges Objekt finden
  try {
    return JSON.parse(text);
  } catch(e) {
    const lastComma = text.lastIndexOf(',\n  {');
    if (lastComma > 0) {
      try { return JSON.parse(text.slice(0, lastComma) + ']'); } catch(e2) {}
    }
    const lastBrace = text.lastIndexOf('},');
    if (lastBrace > 0) {
      try { return JSON.parse(text.slice(0, lastBrace + 1) + ']'); } catch(e3) {}
    }
    throw new Error('JSON konnte nicht geparst werden (möglicherweise zu viele Produkte)');
  }
}

/**
 * Analysiert ein Kühlschrank-/Vorratsfoto mit Gemini.
 * Erkennt alle sichtbaren Lebensmittel MIT Bounding-Box (normalisiert 0–1000),
 * damit die App im Review Schritt für Schritt auf jedes Produkt zoomen kann.
 *
 * @param {string} base64 - Base64-kodiertes Bild
 * @param {string} mimeType - MIME-Typ (z.B. 'image/jpeg')
 * @returns {Promise<Array>} - [{name, qty, count, category, mhd, box:[ymin,xmin,ymax,xmax], ...}]
 */
export async function analyzeFridgePhoto(base64, mimeType) {
  const today = new Date().toISOString().split('T')[0];
  const prompt = `Analysiere dieses Foto eines Kühlschranks bzw. Vorratsschranks. Erkenne ALLE klar identifizierbaren Lebensmittel und Getränke.

REGELN:
1. Für JEDES erkannte Produkt eine Bounding-Box angeben: "box":[ymin,xmin,ymax,xmax], Koordinaten normalisiert auf 0–1000 relativ zum Bild. Die Box soll das Produkt eng umschließen.
2. Ist dasselbe Produkt mehrfach sichtbar (z.B. 3 gleiche Joghurts) → EIN Eintrag mit "count" = Anzahl und einer Box um die Gruppe.
3. "qty" = geschätzte Menge PRO Stück nach Standardverpackung (z.B. Milch "1 L", Butter "250 g", Joghurt "500 g", Eier "10 Stück", Marmelade "1 Glas 350 g", Gemüse/Obst nach sichtbarer Menge z.B. "3 Stück" oder "500 g").
4. Angebrochene/teilweise leere Packungen: Menge entsprechend reduzieren und "unsicher": true.
5. Nur echte Lebensmittel/Getränke — keine Behälter, Boxen, Geschirr, unleserliche Objekte. Im Zweifel weglassen statt raten.
6. "mhd": realistisches Mindesthaltbarkeitsdatum ab heute schätzen (Frische Milch 7 Tage, Joghurt 14 Tage, Hartkäse 60 Tage, Eier 21 Tage, frisches Fleisch 2 Tage, Gemüse 7 Tage, Obst 7 Tage, Konserven/Gläser 365 Tage, Saft angebrochen 5 Tage). Konservativ schätzen, da Lagerdauer unbekannt.
7. "category" MUSS eine dieser sein: Milchprodukte, Fleisch, Fisch, Gemüse, Obst, Brot, Getreide, Konserven, Tiefkühl, Gewürze, Süßes, Sonstiges.

Heute: ${today}

WICHTIG: Antworte AUSSCHLIESSLICH mit einem JSON-Array, kein Markdown:
[{"name":"Name auf Deutsch","box":[ymin,xmin,ymax,xmax],"qty":"Menge pro Stück","count":1,"category":"Kategorie","mhd":"YYYY-MM-DD","caloriesPer100g":100,"proteinPer100g":5,"carbsPer100g":15,"fatPer100g":3,"unsicher":false}]`;
  const text = await geminiRequest(null, {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  }, { timeoutMs: 60000, retries: 3 });
  const parsed = parseGeminiJson(text);
  if (!Array.isArray(parsed)) throw new Error('Keine Produkte erkannt');
  // Nur Einträge mit gültiger Box behalten und Koordinaten absichern
  return parsed
    .filter(p => p && p.name && Array.isArray(p.box) && p.box.length === 4)
    .map(p => {
      const [y1, x1, y2, x2] = p.box.map(v => Math.max(0, Math.min(1000, Number(v) || 0)));
      return { ...p, count: p.count || 1, box: [Math.min(y1, y2), Math.min(x1, x2), Math.max(y1, y2), Math.max(x1, x2)] };
    })
    .filter(p => (p.box[2] - p.box[0]) > 5 && (p.box[3] - p.box[1]) > 5);
}

/**
 * Analysiert ein Essensfoto mit Gemini und liefert eine Komponentenaufschlüsselung.
 *
 * @param {string} base64 - Base64-kodiertes Bild
 * @param {string} mimeType - MIME-Typ
 * @param {string} geminiKey - Gemini API-Key
 * @param {string} [hint=''] - Optionaler Nutzerhinweis (z.B. Gerichtsname)
 * @returns {Promise<{name: string, components: Array, total: object}>}
 */
export async function analyzeFoodPhoto(base64, mimeType, geminiKey, hint = '') {
  const hintText = hint ? `\nHinweis vom Nutzer: "${hint}"` : '';
  const prompt = `Analysiere dieses Essensfoto. Erkenne alle sichtbaren Zutaten/Komponenten einzeln.${hintText}
Antworte NUR mit JSON, kein Markdown:
{"name":"Gerichtname","components":[{"name":"Komponente","calories":200,"protein":10,"carbs":30,"fat":5,"amountG":150}],"total":{"calories":500,"protein":30,"carbs":60,"fat":15,"amountG":350}}`;
  const text = await geminiRequest(geminiKey, { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4000 } });
  return parseGeminiJson(text);
}

/**
 * Generiert 4 Rezeptvorschläge basierend auf dem aktuellen Inventar.
 * Enthält ausführliche Zubereitungsschritte (8–12 Schritte pro Rezept).
 *
 * @param {Array} inventory - Inventarliste mit {name, qty, mhd}
 * @param {string} geminiKey - Gemini API-Key
 * @returns {Promise<Array>} - Array mit Rezeptobjekten
 */
export async function getAiRecipeSuggestions(inventory, geminiKey, wish = '', count = 4, onlyInventory = false) {
  const itemList = inventory.map(i => `${i.name} (${i.qty})`).join('\n');
  const wishLine = wish.trim()
    ? `\nPFLICHT-VORGABE für ALLE ${count} Rezepte: "${wish.trim()}" — jedes einzelne Rezept MUSS diese Vorgabe erfüllen. Kein Rezept darf davon abweichen.`
    : '';
  const inventoryRule = onlyInventory
    ? `- Verwende AUSSCHLIESSLICH die verfügbaren Zutaten. Keine zusätzlichen Einkäufe. "ingredients_needed" muss immer ein leeres Array [] sein.`
    : `- Nutze hauptsächlich die verfügbaren Zutaten, ergänze fehlende Grundzutaten wenn nötig\n- "ingredients_needed" enthält nur Zutaten die wirklich fehlen`;
  const prompt = `Du bist Profi-Küchenchef. Erstelle ${count} kreative Rezepte auf Deutsch.${wishLine}

Verfügbare Zutaten:
${itemList}

Regeln:
${inventoryRule}
- Nicht alle Zutaten müssen in jedem Rezept vorkommen
- Abwechslungsreiche Gerichte (kein zweimal dasselbe)
- Ausführliche Zubereitung mit 8-12 nummerierten Schritten
- WICHTIG: "steps" ist ein einziger String, jeden Schritt mit \\n trennen, Format: "1. Schritt\\n2. Schritt\\n3. Schritt"

Antworte NUR mit JSON-Array mit exakt ${count} Rezepten:
[{"name":"Name","time":"30 Min","difficulty":"Einfach","servings":2,"totalCalories":500,"totalProtein":30,"totalCarbs":60,"totalFat":15,"ingredients_used":[{"name":"Zutat aus Inventar","amount":200,"unit":"g"}],"ingredients_needed":[{"name":"fehlende Zutat","amount":1,"unit":"Stück"}],"steps":"1. Schritt eins\\n2. Schritt zwei\\n3. Schritt drei"}]`;
  const text = await geminiRequest(geminiKey, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 8000 } }, { retries: 5, timeoutMs: 60000 });
  return parseGeminiJson(text);
}

/**
 * Normalisiert Einkaufsliste per Gemini: Kategorien + praktische Kaufmengen.
 * Gibt Array mit { id, name, amount, unit, category } zurück.
 */
export async function normalizeShoppingList(items, geminiKey) {
  const CATEGORIES = 'Obst & Gemüse|Milch & Eier|Fleisch & Fisch|Brot & Backwaren|Tiefkühl|Getränke|Konserven & Trockenware|Gewürze & Öle|Sonstiges';
  const prompt = `Du bist ein Einkaufsassistent. Bearbeite diese Einkaufsliste auf Deutsch.

Aufgaben pro Artikel:
1. Weise eine Kategorie zu (NUR eine aus: ${CATEGORIES})
2. Normalisiere die Menge auf praxisübliche Kaufgrößen (z.B. 92g Himbeeren → 250, Einheit: g; oder 1 Stück; oder 1 Packung)
3. Trenne Menge (Zahl oder null) und Einheit (g, kg, ml, L, Stück, Packung, Bund, Dose, Flasche, Becher, Tube)

Antworte NUR mit einem JSON-Array, kein Text davor/danach:
[{"id":<zahl>,"name":"...","amount":<zahl oder null>,"unit":"...","category":"..."}]

Einkaufsliste:
${JSON.stringify(items.map(i => ({ id: i.id, name: i.name, amount: i.amount, unit: i.unit })))}`;

  const text = await geminiRequest(geminiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
  });
  return parseGeminiJson(text);
}

/**
 * Schätzt Nährwerte pro 100g für eine Zutat anhand ihres Namens.
 *
 * @param {string} name - Zutatname auf Deutsch
 * @param {string} geminiKey - Gemini API-Key
 * @returns {Promise<{calories: number, protein: number, carbs: number, fat: number}>}
 */
export async function calculateNutrition(name, geminiKey) {
  const prompt = `Nährwerte pro 100g für "${name}". NUR JSON: {"calories":100,"protein":5,"carbs":15,"fat":3}`;
  const text = await geminiRequest(geminiKey, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 200 } });
  return parseGeminiJson(text);
}

/**
 * Sucht Produktinfos zu einem Barcode.
 * Strategie: OpenFoodFacts (2 Versuche) → Gemini-Fallback wenn Key vorhanden.
 * Liefert name, emoji, qty, category, Nährwerte pro 100g und serving-Optionen.
 *
 * @param {string} barcode - EAN/UPC Barcode
 * @param {string|null} geminiKey - Gemini API-Key (optional, für Fallback)
 * @returns {Promise<object>} - Produktdaten
 * @throws {Error} wenn Produkt nicht gefunden
 */
export async function lookupBarcode(barcode, geminiKey) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
        headers: { 'User-Agent': 'KEEPR/1.0 (keepr-app.de; support@keepr-app.de)' }
      });
      const data = await res.json();
      if (data.status === 1) {
        const p = data.product;
        const n = p.nutriments || {};
        const servings = [];
        if (p.serving_size) {
          const match = p.serving_size.match(/([\d.,]+)\s*(g|ml|kg|l)/i);
          if (match) {
            const servingG = parseFloat(match[1].replace(',','.'));
            servings.push({ label: p.serving_size, grams: servingG });
          }
        }
        servings.push({ label: '100g', grams: 100 });
        return {
          name: p.product_name_de || p.product_name || 'Unbekannt',
          emoji: null,
          qty: p.quantity || '1 Stück',
          category: p.categories_tags?.[0]?.replace('en:', '') || 'Sonstiges',
          caloriesPer100g: n['energy-kcal_100g'] || null,
          proteinPer100g: n['proteins_100g'] || null,
          carbsPer100g: n['carbohydrates_100g'] || null,
          fatPer100g: n['fat_100g'] || null,
          servings,
        };
      }
    } catch(e) { if (attempt === 0) await new Promise(r => setTimeout(r, 1000)); }
  }

  if (geminiKey) {
    try {
      const prompt = `Produkt mit Barcode ${barcode}. Antworte NUR mit diesem JSON: {"name":"Name","qty":"1 Stück","category":"Lebensmittel","caloriesPer100g":0,"proteinPer100g":0,"carbsPer100g":0,"fatPer100g":0}`;
      const res = await geminiFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 1000 } })
      });
      const data = await res.json();
      let text = extractGeminiText(data);
      text = text.replace(/```json|```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch(e) {}
  }

  throw new Error('Produkt nicht gefunden');
}

/**
 * Generiert eine einzelne Mahlzeit passend zu Kalorienzielen und Ernährungsweise des Users.
 *
 * @param {object} user - User-Objekt (calorieGoal, dietType, goals)
 * @param {string} geminiKey - Gemini API-Key
 * @param {'Frühstück'|'Mittagessen'|'Abendessen'|'Snack'} mealType
 * @param {number} servings - Anzahl Portionen
 * @param {string} [preference=''] - Freitextvorliebe des Nutzers
 * @returns {Promise<object>} - Mahlzeitobjekt
 */
export async function generateSingleMealWithGemini(user, geminiKey, mealType, servings, preference = '') {
  const calorieGoal = user?.calorieGoal || 2000;
  const mealShare = mealType === 'Snack' ? 0.1 : mealType === 'Frühstück' ? 0.25 : 0.325;
  const targetCal = Math.round(calorieGoal * mealShare);
  const targetP = Math.round(targetCal * 0.3 / 4);
  const diet = user?.dietType || 'omnivor';
  const prefText = preference.trim() ? `\nVorgabe des Nutzers: ${preference.trim()}` : '';
  const prompt = `Erstelle eine einzelne Mahlzeit auf Deutsch (${mealType}) für ${servings} Person(en).
Ernährungsweise: ${diet}. Ziel: ~${targetCal} kcal, ~${targetP}g Protein.${prefText}
Antworte NUR mit einem JSON-Objekt:
{"type":"${mealType}","name":"...","prepTime":"...","calories":${targetCal},"protein":${targetP},"carbs":0,"fat":0,"servings":${servings},"ingredients":["..."],"stepsShort":["..."],"steps":["..."]}
Passe calories/protein/carbs/fat an das tatsächliche Gericht an. Mindestens 3 Zutaten, 2 kurze und 4 detaillierte Schritte.`;
  const res = await geminiFetch({
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 2000 } })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler');
  const text = extractGeminiText(data);
  return parseGeminiJson(text);
}

/**
 * Generiert einen vollständigen 7-Tage-Ernährungsplan (4 Mahlzeiten/Tag).
 * Berücksichtigt Kalorienziel, Ernährungsweise, Wunschgerichte und Küchengeräte.
 * Versucht zweimal (1× Retry nach 3s) falls Gemini Fehler zurückgibt.
 *
 * @param {object} user - User-Objekt (calorieGoal, dietType, goals)
 * @param {string} geminiKey - Gemini API-Key
 * @param {number} [servings=1] - Portionen
 * @param {string} [wishDishes=''] - Wunschgerichte (Freitext)
 * @param {string[]} [kitchenEquipment=[]] - Verfügbare Geräte
 * @returns {Promise<{days: Array}>}
 */
export async function generateMealPlanWithGemini(user, geminiKey, servings = 1, wishDishes = '', kitchenEquipment = [], coachingContext = '') {
  const calorieGoal = user?.calorieGoal || 2000;
  const protein = Math.round((calorieGoal * 0.3) / 4);
  const carbs = Math.round((calorieGoal * 0.4) / 4);
  const fat = Math.round((calorieGoal * 0.3) / 9);
  const diet = user?.dietType || 'omnivor';
  const goals = user?.goals || [];
  const calorieStrategy = goals.includes('lose')
    ? `Ziel: Gewichtsreduktion — Kalorien pro Tag leicht UNTER dem Ziel (${calorieGoal - 200}–${calorieGoal} kcal). Protein hoch halten.`
    : goals.includes('gain')
    ? `Ziel: Muskelaufbau — Kalorien pro Tag leicht ÜBER dem Ziel (${calorieGoal}–${calorieGoal + 200} kcal). Protein hoch halten.`
    : `Ziel: Gewicht halten — Kalorien nahe am Ziel (±150 kcal). Makros ausgewogen.`;
  const equipmentText = kitchenEquipment.length > 0
    ? `\nVerfügbare Küchengeräte: ${kitchenEquipment.join(', ')}. Nutze diese Geräte gezielt in den Rezepten und pass die Zubereitungsschritte entsprechend an.`
    : '';
  const coachingText = coachingContext
    ? `\nPersonalisierter Tageskontext: ${coachingContext}`
    : '';
  const prompt = `Erstelle einen 7-Tage-Ernährungsplan auf Deutsch für ${servings} Person(en).
Ernährungsweise: ${diet}. ${calorieStrategy}
Makroziele pro Person: ~${protein}g P, ~${carbs}g K, ~${fat}g F.${equipmentText}${coachingText}
${wishDishes.trim() ? `\nWunschgerichte (vereinzelt einbauen, nicht die ganze Woche): ${wishDishes.trim()}` : ''}

Abwechslungsreich, max. 2× gleiche Mahlzeit/Woche. Antworte NUR mit JSON:
{"days":[{"dayName":"Montag","totalCalories":0,"totalProtein":0,"meals":[{"type":"Frühstück","name":"...","prepTime":"10 Min","calories":0,"protein":0,"carbs":0,"fat":0,"servings":${servings},"ingredients":["200g ..."],"stepsShort":["Kurzer Schritt 1","Kurzer Schritt 2","Kurzer Schritt 3"]},{"type":"Mittagessen",...},{"type":"Abendessen",...},{"type":"Snack",...}]},...]}
Genau 7 Tage, genau 4 Mahlzeiten pro Tag. stepsShort: 2–3 kurze Übersichtsschritte (kein steps-Feld nötig).`;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 3000));
      const res = await geminiFetch({
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 12000 } })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler');
      const text = extractGeminiText(data);
      if (!text) throw new Error('Leere Antwort von Gemini');
      return parseGeminiJson(text);
    } catch(e) { lastErr = e; }
  }
  throw lastErr;
}

/**
 * Ersetzt eine Zutat in einem Rezept und berechnet die neuen Gesamtmakros.
 *
 * @param {object} meal - Rezeptobjekt (name, ingredients, servings)
 * @param {string} ingredientText - Zu ersetzende Zutat (exakter String aus ingredients)
 * @param {string} swapNote - Womit ersetzen (Freitext)
 * @param {string} geminiKey - Gemini API-Key
 * @returns {Promise<{ingredients: string[], calories: number, protein: number, carbs: number, fat: number}>}
 */
export async function swapIngredientWithGemini(meal, ingredientText, swapNote, geminiKey) {
  const otherIngredients = (meal.ingredients || []).filter(i => i !== ingredientText).join(', ');
  const prompt = `Rezept: "${meal.name}" für ${meal.servings || 1} Person(en).
Aktuelle Zutaten: ${(meal.ingredients || []).join(', ')}.
Ersetze "${ingredientText}" durch: "${swapNote}".
Berechne danach die neuen Gesamtmakros des ganzen Gerichts.
Antworte NUR mit JSON:
{"ingredients":["neue Zutat 1","neue Zutat 2"],"calories":0,"protein":0,"carbs":0,"fat":0}
ingredients = nur die Ersatzzutaten (nicht die anderen). calories/protein/carbs/fat = neue Gesamtwerte des Gerichts.`;
  const res = await geminiFetch({
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 250 } })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler');
  const text = extractGeminiText(data);
  const result = parseGeminiJson(text);
  if (!result?.ingredients) throw new Error('Ungültige Antwort');
  return result; // { ingredients: [...], calories, protein, carbs, fat }
}

/**
 * Generiert eine ausführliche Kochanleitung (8–14 Schritte) für Kochanfänger.
 * Jeder Schritt enthält exakte Mengen, Temperaturen, Zeiten und häufige Fehler.
 *
 * @param {object} meal - Mahlzeitobjekt (name, ingredients, servings)
 * @param {string} geminiKey - Gemini API-Key
 * @returns {Promise<string[]>} - Array mit Schritt-Strings
 */
export async function generateDetailedStepsWithGemini(meal, geminiKey) {
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients.join(', ') : '';
  const prompt = `Du bist Profikoch und erklärst einem absoluten Kochanfänger das folgende Rezept Schritt für Schritt.

Gericht: ${meal.name}
Zutaten: ${ingredients}
Portionen: ${meal.servings || 1}

Erstelle eine WIRKLICH ausführliche Kochanleitung auf Deutsch — so detailliert, dass jemand der noch NIE gekocht hat keinen Fehler machen kann.

Regeln für jeden Schritt:
- Beginne mit einer klaren Aktionsbezeichnung (z.B. "Zwiebeln schneiden:", "Pfanne erhitzen:")
- Nenne EXAKTE Mengen mit Einheit (z.B. "1 EL Olivenöl", "200ml Wasser")
- Nenne EXAKTE Temperaturen in °C (z.B. "bei 180°C Ober-/Unterhitze", "mittlere Hitze ca. 160°C")
- Nenne EXAKTE Zeiten in Minuten ("3–4 Minuten", "ca. 12 Minuten")
- Beschreibe das visuelle Ergebnis ("goldbraune Farbe", "leicht glasig", "Blasen bilden sich")
- Beschreibe das Geräusch oder den Geruch wenn hilfreich ("brutzelt kräftig", "riecht nussig")
- Erkläre WARUM dieser Schritt wichtig ist wenn nicht offensichtlich
- Nenne häufige Fehler und wie man sie vermeidet
- Gib Anfänger-Tipps wo nötig (z.B. "Wenn die Pfanne raucht, ist sie zu heiß")

Antworte NUR mit einem JSON-Array aus 8–14 Strings (die Schritte). Kein Markdown, kein Text davor/danach:
["Schritt 1 sehr ausführlich...","Schritt 2 sehr ausführlich...",...]`;

  const res = await geminiFetch({
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 4000 } })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler');
  const text = extractGeminiText(data);
  const result = parseGeminiJson(text);
  if (!Array.isArray(result)) throw new Error('Ungültige Antwort');
  return result;
}

/**
 * Generiert einen 7-Tage-Trainingsplan mit Gemini.
 * Prioritäten im Prompt (höchste zuerst):
 *   [1] additionalContext — unveränderliche Regeln (Verletzungen, Vorgaben)
 *   [2] weekPlanText      — exakter Wochenplan aus Trainingsdokument
 * Versucht bis zu 3× bei Überlast (503 / "high demand").
 *
 * @param {object} user - User-Profil (sportTypes, ftp, maxHr, weight)
 * @param {string} trainingType - Sportart-Fallback
 * @param {string} weekKey - ISO-Wochenschlüssel (z.B. '2025-05-19')
 * @param {string} geminiKey - Gemini API-Key
 * @param {string} [additionalContext=''] - Zusätzliche Regeln/Kontext
 * @param {string|null} [weekPlanText=null] - Wochenplan-Text aus Trainingsdatei
 * @param {string|null} [currentPhase=null] - Aktuelle Trainingsphase (Label)
 * @returns {Promise<object>} - Plan mit sessions, week_key, id
 */
export async function generateTrainingPlanWithGemini(user, trainingType, weekKey, geminiKey, additionalContext = '', weekPlanText = null, currentPhase = null) {
  const sports = user?.sportTypes?.length ? user.sportTypes.join(', ') : (trainingType || 'Ausdauer');
  const extras = [user?.ftp && `FTP ${user.ftp}W`, user?.maxHr && `HFmax ${user.maxHr}`, user?.weight && `${user.weight}kg`].filter(Boolean).join(', ');

  // [1] Unveränderliche Regeln — kommen zuerst im Prompt (höchste Priorität)
  const rulesSection = additionalContext?.trim()
    ? `[1] UNVERÄNDERLICHE REGELN – IMMER BEFOLGEN, HÖCHSTE PRIORITÄT, NIEMALS IGNORIEREN:\n${additionalContext.trim()}\n\n`
    : '';

  // [2] Wochenplan — muss exakt umgesetzt werden
  const weekSection = weekPlanText
    ? `[2] WOCHENPLAN – EXAKT UMSETZEN${currentPhase ? ` (${currentPhase})` : ''}:\n${weekPlanText}\n\nSetze JEDEN Trainingsinhalt 1:1 um: gleiche Sportart, gleiche Anzahl, gleiche Dauer. Keine Abweichungen.\n\n`
    : `Sportarten: ${sports}.\n\n`;

  const prompt = `Du bist Trainer. Erstelle einen 7-Tage-Trainingsplan (Montag bis Sonntag) auf Deutsch.

${rulesSection}${weekSection}Athletenwerte: ${extras || 'keine Angabe'}.

Gib NUR ein JSON-Objekt zurück mit: plan_name (String), description (String), planData ({weeklyLoad: String}), sessions (Array).
sessions enthält ALLE 7 Tage (day_index 0=Mo bis 6=So) — mehrere Sessions pro Tag möglich, Ruhetage is_rest:true.
Jede Session: day_index, sport_type (run/bike/swim/strength/yoga/mobility), is_rest (boolean), focus (String), duration (Minuten), intensity (Z1-Z5 oder leer), steps (Array), exercises (Array).
steps = strukturiertes Trainingsprofil (intervals.icu-Stil) für Ausdauer-Einheiten. Jeder Step: phase ('warmup'|'load'|'interval'|'recovery'|'cooldown'|'steady'), minutes (Zahl), zone ('Z1'-'Z5'), label (kurzer String). Die Summe der step-minutes MUSS der duration entsprechen. Beispiel Intervalle: warmup Z1, dann mehrfach interval Z4 + recovery Z1, dann cooldown Z1. Bei ruhigem Dauertraining: warmup Z1, steady Z2, cooldown Z1.
Jede Übung (nur Kraft/Mobility): name, emoji, zone, sets (Zahl), reps (Zahl), duration (Minuten).
Ruhetage: leeres steps- und exercises-Array, is_rest true. Alle 7 Tage müssen vorhanden sein.`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 4000));
    try {
      const res = await geminiFetch({
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 8000 } })
      });
      const data = await res.json();
      if (!res.ok) {
        lastError = new Error(data.error?.message || 'Gemini Fehler');
        const isOverloaded = res.status === 503 || (data.error?.message || '').includes('high demand') || (data.error?.message || '').includes('overloaded');
        if (!isOverloaded) throw lastError;
        continue;
      }
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.filter(p => !p.thought).map(p => p.text || '').join('');
      const plan = parseGeminiJson(text);
      const sessions = (plan.sessions || []).map((s, i) => ({ ...s, id: Date.now() + i }));
      return { ...plan, sessions, week_key: weekKey, id: Date.now(), completedWorkouts: [] };
    } catch(e) {
      lastError = e;
      if (!e.message?.includes('high demand') && !e.message?.includes('overloaded')) throw e;
    }
  }
  throw lastError;
}

/**
 * Analysiert ein abgeschlossenes Workout mit Gemini und gibt kurzes Feedback (4–5 Sätze).
 * Vergleicht Soll (Trainingsplan) mit Ist (tatsächliche Werte).
 *
 * @param {object} session - Geplante Trainingseinheit aus dem Plan
 * @param {object} workoutData - Tatsächliche Messwerte (Dauer, Distanz, HR, Power, RPE …)
 * @param {object} user - User-Profil (ftp, maxHr, fitnessLevel)
 * @param {string} geminiKey - Gemini API-Key
 * @returns {Promise<string>} - Feedback-Text (kein JSON)
 */
export async function analyzeWorkoutWithGemini(session, workoutData, user, geminiKey) {
  const sportLabels = { run: 'Laufen', bike: 'Radfahren', swim: 'Schwimmen', strength: 'Kraft', yoga: 'Yoga', triathlon: 'Triathlon', mobility: 'Mobility' };
  const sport = sportLabels[session?.sport_type] || session?.sport_type || 'Training';
  const planned = `Geplant: ${session?.focus || 'Einheit'}, ${session?.duration || '?'} Min, Intensität: ${session?.intensity || '–'}`;
  const actual = [
    workoutData.durationMinutes && `Dauer: ${workoutData.durationMinutes} Min`,
    workoutData.distance && `Distanz: ${workoutData.distance} km`,
    workoutData.avgHr && `Ø HR: ${workoutData.avgHr} bpm`,
    workoutData.maxHr && `Max HR: ${workoutData.maxHr} bpm`,
    workoutData.avgPower && `Ø Power: ${workoutData.avgPower} W`,
    workoutData.calories && `Kalorien: ${workoutData.calories} kcal`,
    workoutData.perceivedEffort && `RPE: ${workoutData.perceivedEffort}/10`,
    workoutData.rating && `Bewertung: ${workoutData.rating}/5`,
    workoutData.notes && `Notizen: ${workoutData.notes}`,
  ].filter(Boolean).join(', ');
  const profile = [user?.ftp && `FTP ${user.ftp}W`, user?.maxHr && `HFmax ${user.maxHr}`, user?.fitnessLevel].filter(Boolean).join(', ');
  const prompt = `Analysiere dieses ${sport}-Training kurz auf Deutsch (max. 4–5 Sätze). Sei konkret, hilfreich und ermutigend. Gib praktische Hinweise für die nächste Einheit.
${planned}
Tatsächlich: ${actual || 'keine Daten'}
Athletenprofil: ${profile || 'unbekannt'}
Antworte NUR mit dem Feedback-Text, kein JSON, keine Formatierung.`;
  const res = await geminiFetch({
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 500 } })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler');
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.filter(p => !p.thought).map(p => p.text || '').join('').trim();
}

// ── Pace- und Sport-Hilfsfunktionen ──────────────────────────────────────────

/**
 * Beantwortet eine Frage zur Zubereitung eines Rezepts mit Gemini.
 * Gibt eine kurze, präzise Antwort (max. 3 Sätze) zurück.
 *
 * @param {object} recipe - Rezept-Objekt (name, ingredients, steps)
 * @param {string} question - Nutzerfrage
 * @param {string} geminiKey - Gemini API-Key
 * @returns {Promise<string>} - Antworttext
 */
export async function askRecipeQuestion(recipe, question, geminiKey) {
  const ingList = (recipe.ingredients || [])
    .map(i => [i.amount > 0 ? `${i.amount} ${i.unit}` : '', i.name].filter(Boolean).join(' '))
    .join(', ');
  const stepsText = (() => {
    try {
      const arr = JSON.parse(recipe.steps || '');
      if (Array.isArray(arr)) return arr.map((s, idx) => `${idx + 1}. ${s.text}`).join('\n');
    } catch {}
    return recipe.steps || '';
  })();
  const prompt = `Du bist ein erfahrener Koch-Assistent. Der Nutzer kocht gerade dieses Rezept und hat eine Frage.

Rezept: ${recipe.name}
Zutaten: ${ingList}
Zubereitung:
${stepsText}

Frage: "${question}"

Antworte KURZ (1–3 Sätze), PRÄZISE und auf Deutsch. Keine Einleitung, kein "Natürlich!" — direkt zur Sache. Wenn nötig, gib praktische Tipps oder Mengenangaben.`;
  return await geminiRequest(geminiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 250 },
  }, { timeoutMs: 12000, retries: 2 });
}

/**
 * Analysiert ein KI-Antwort-Gespräch und extrahiert konkrete Rezept-Änderungen.
 * Gibt strukturiertes JSON zurück: Zutaten hinzufügen/entfernen/anpassen, Schritte ändern.
 */
export async function parseRecipeChanges(recipe, question, answer, geminiKey) {
  const ingList = (recipe.ingredients || []).map((i, idx) =>
    `${idx}. ${i.name}${i.amount > 0 ? ` (${i.amount} ${i.unit})` : ''}`
  ).join('\n');
  let stepsArr = [];
  try {
    const parsed = JSON.parse(recipe.steps || '');
    if (Array.isArray(parsed)) stepsArr = parsed;
  } catch {}
  const stepsList = stepsArr.map((s, i) => `${i}. ${s.text || s}`).join('\n');

  const prompt = `Du bist ein Rezept-Editor. Deine Aufgabe: Extrahiere IMMER konkrete Änderungen aus dem Gespräch — auch wenn die Antwort ausführlich ist oder mehrere Optionen nennt.

Rezept: "${recipe.name}"
Zutaten:
${ingList}
Schritte:
${stepsList}

Nutzerfrage: "${question}"
KI-Antwort: "${answer}"

PFLICHT-REGELN:
1. Wenn die Frage nach einem Ersatz/Alternative für eine Zutat fragt ("welches X kann ich nehmen", "was statt X", "andere X", "kann ich X ersetzen") → IMMER "alternativen" befüllen. Suche in der KI-Antwort nach allen genannten Lebensmitteln/Zutaten und liste sie als Optionen. Die Original-Zutat kommt in "fuerZutat".
2. Wenn die Frage nach einer Technik/Schritt fragt ("wie erkenne ich", "wie lange", "bei welcher Temperatur") und die Antwort eine Verbesserung eines Schritts impliziert → "schritteAnpassen" befüllen.
3. Wenn die Frage nach Zugabe fragt ("soll ich X hinzufügen", "kann ich X dazu") → "zutatenHinzufuegen".
4. NIEMALS leere Ergebnis-Arrays zurückgeben wenn die KI-Antwort Lebensmittel oder Mengen erwähnt. Zwinge dich, etwas zu extrahieren.
5. "zutatenEntfernen" NUR wenn explizit gesagt wird eine Zutat weglassen.

Antworte NUR mit einem JSON-Objekt:
{
  "zutatenHinzufuegen": [{"name":"...","amount":0,"unit":""}],
  "zutatenEntfernen": ["name"],
  "zutatenAnpassen": [{"index":0,"neueMenge":0,"neueEinheit":"..."}],
  "alternativen": [{"fuerZutat":"exakter Name aus Zutatenliste oben","optionen":["Option1","Option2","Option3"]}],
  "schritteAnpassen": [{"index":0,"neuerText":"..."}],
  "schritteHinzufuegen": [{"nachIndex":-1,"text":"..."}],
  "zusammenfassung": "Kurze deutsche Beschreibung"
}`;
  const text = await geminiRequest(geminiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
  }, { retries: 2, timeoutMs: 20000 });
  return parseGeminiJson(text);
}

/**
 * Konvertiert Sekunden in einen Pace-String "m:ss" (für Laufen/Schwimmen).
 * @param {number} totalSeconds
 * @returns {string} z.B. "4:32"
 */
export function secondsToPace(totalSeconds) {
  if (!totalSeconds) return '';
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/**
 * Parst einen Pace-String "m:ss" in Sekunden.
 * @param {string} paceStr
 * @returns {number|null}
 */
export function paceToSeconds(paceStr) {
  if (!paceStr) return null;
  const parts = paceStr.split(':');
  if (parts.length !== 2) return null;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

/**
 * Gibt den Ionicons-Namen für eine Sportart zurück.
 * @param {string} sportType - 'run'|'bike'|'swim'|'strength'|…
 * @returns {string} Ionicons-Iconname
 */
export function getSportIcon(sportType) {
  const icons = {
    swim: 'water-outline',
    bike: 'bicycle-outline',
    run: 'footsteps-outline',
    strength: 'barbell-outline',
    rest: 'moon-outline',
    yoga: 'body-outline',
    mobility: 'walk-outline',
    mixed: 'medal-outline',
    triathlon: 'trophy-outline',
  };
  return icons[sportType] || 'fitness-outline';
}

/**
 * Gibt die Farbe für eine Sportart zurück.
 * @param {string} sportType
 * @returns {string} Hex-Farbe
 */
export function getSportColor(sportType) {
  // Legacy-Keys, die nicht im Sport-Katalog stehen
  const legacy = { rest: '#555555', mixed: '#e8c547' };
  if (legacy[sportType]) return legacy[sportType];
  // Katalog ist die zentrale Quelle für alle Sportarten-Farben
  const sport = getSport(sportType);
  // getSport fällt auf 'other' (#9e9e9e) zurück — für unbekannte Keys lieber Akzent
  return sport.key === 'other' && sportType !== 'other' ? '#e8c547' : sport.color;
}
