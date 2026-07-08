/**
 * store/index.js — Haupt-App-Store (Zustand)
 *
 * Zuständig für: Auth, Inventar, Rezepte, Kalorien, Training, Gewicht, Wasser.
 * Hält den gesamten App-Zustand außer Kraft-Tracking (→ kraftStore.js).
 *
 * Exports:
 *   getCurrentPhaseText(user) — Ermittelt aktuelle Trainingsphase aus Trainingsplan-Blöcken
 *   useStore()                — Zustand-Hook für alle Screens
 *
 * Hinweis: geminiKey wird lokal in AsyncStorage gespeichert (nicht account-bound).
 */

// Third-party
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Internal
import { api, generateTrainingPlanWithGemini } from '../api/client';
import { getSecureItem, setSecureItem, removeSecureItem } from '../utils/secureStorage';

/**
 * Berechnet den aktuellen Trainingsplan-Abschnitt basierend auf dem Startdatum.
 * Unterstützt zwei Formate:
 *   - Strukturiert (Gemini-geparst): user.trainingPlanStructured.blocks mit sessions-Array
 *   - Text: user.trainingPlanBlocks mit lines-Array
 *
 * @param {object} user - User-Objekt mit trainingPlanStartDate und trainingPlanBlocks
 * @returns {{ display, blockName, weekHeader, weekText, weekNumber } | null}
 */
export function getCurrentPhaseText(user) {
  const startDate = user?.trainingPlanStartDate;
  if (!startDate) return null;

  // Strukturierter Plan (bevorzugt — Gemini-geparst)
  const structured = user?.trainingPlanStructured;
  const structuredBlocks = structured?.blocks;

  // Fallback: einfache Text-Blöcke
  const textBlocks = user?.trainingPlanBlocks;
  const blocks = structuredBlocks || textBlocks;
  if (!blocks?.length) return null;

  const weeksElapsed = Math.max(0, Math.floor((Date.now() - new Date(startDate)) / (7 * 24 * 3600 * 1000)));
  const weeksPerBlock = blocks[0]?.weeks?.length || 4;
  const blockIdx = Math.floor(weeksElapsed / weeksPerBlock) % blocks.length;
  const weekIdx = weeksElapsed % weeksPerBlock;
  const block = blocks[blockIdx];
  const week = block?.weeks[Math.min(weekIdx, block.weeks.length - 1)];
  if (!week) return null;

  // Build formatted weekText
  let weekText;
  if (structuredBlocks && week.sessions) {
    // Strukturierter Plan: als explizite Anweisungszeilen formatieren (für Gemini-Prompt)
    const lines = week.sessions.map(s => {
      const detail = s.details?.join(', ') || '';
      const dur = s.totalDuration ? ` (${s.totalDuration})` : '';
      return `- ${s.count}x ${s.sport}${dur}: ${detail}`;
    });
    if (week.notes) lines.push(`- Hinweis: ${week.notes}`);
    weekText = lines.join('\n');
  } else {
    weekText = week.lines?.join('\n') || '';
  }

  const weekName = week.name || week.header || `Woche ${weekIdx + 1}`;
  return {
    display: `${block.name} · ${weekName}`,
    blockName: block.name,
    weekHeader: weekName,
    weekText,
    weekNumber: weeksElapsed + 1,
  };
}

// ── Store-Definition ──────────────────────────────────────────────────────────

export const useStore = create((set, get) => ({
  // ── State ────────────────────────────────────────────────────────────────────
  user: null,
  token: null,
  geminiKey: '',
  inventory: [],
  recipes: [],
  collections: [],
  calorieLog: [],
  calorieTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  selectedDate: new Date().toISOString().split('T')[0],
  trainingPlan: null,
  weightAnalysis: null,
  dailyContext: null, // { sleepHours, stressLevel, energyLevel, trainingType, date }
  externalData: { intervals: null, oura: null }, // Daten von Intervals.icu + Oura
  returnFromBreak: { active: false, setAt: null }, // manueller "Wiedereinstieg nach Pause"-Override
  loading: false,
  error: null,

  setUser: (u) => set({ user: u }),

  /**
   * Initialisiert den Store beim App-Start.
   * Liest Token + User aus AsyncStorage, holt frisches Profil vom Server,
   * fetcht Gemini-Key aus Backend-Config (Fallback: lokaler Key).
   * Bei ungültigem Token: automatischer Logout.
   */
  init: async () => {
    const token = await getSecureItem('auth_token');
    const userStr = await AsyncStorage.getItem('user');
    let localKey = '';
    try { localKey = await AsyncStorage.getItem('gemini_key') || ''; } catch(e) {}
    if (token && userStr) {
      set({ token, user: JSON.parse(userStr), geminiKey: localKey });
      try {
        const profile = await api.getProfile();
        set({ user: { ...JSON.parse(userStr), ...profile } });
        try { const cfg = await api.getGeminiKey(); if (cfg.key) set({ geminiKey: cfg.key }); } catch(e) {}
        await get().fetchAll();
      } catch (e) { if (e.status === 401) await get().logout(); }
    } else if (localKey) {
      set({ geminiKey: localKey });
    }
  },

  setGeminiKey: async (key) => {
    try { await AsyncStorage.setItem('gemini_key', key); } catch(e) {}
    set({ geminiKey: key });
  },

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const data = await api.login({ username, password });
      await setSecureItem('auth_token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      set({ token: data.token, user: data.user });
      await get().fetchAll();
    } finally {
      set({ loading: false });
    }
  },

  register: async (username, password, displayName, householdName) => {
    set({ loading: true, error: null });
    try {
      const data = await api.register({ username, password, displayName, householdName });
      await setSecureItem('auth_token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      set({ token: data.token, user: data.user });
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    // Erst UI-State zurücksetzen (sofortige UI-Reaktion), dann Storage bereinigen
    set({ user: null, token: null, inventory: [], recipes: [], calorieLog: [], trainingPlan: null });
    try { await removeSecureItem('auth_token'); } catch(e) {}
    try { await AsyncStorage.removeItem('user'); } catch(e) {}
    // gemini_key bleibt in AsyncStorage (Geräte-Einstellung, nicht account-gebunden)
  },

  fetchAll: async () => { await Promise.all([get().fetchInventory(), get().fetchRecipes(), get().fetchCalories(), get().fetchTrainingPlan(), get().fetchCollections(), get().loadExternalData(), get().loadReturnFromBreak(), get().fetchMobilityResult()]); },
  fetchInventory: async () => { try { set({ inventory: await api.getInventory() }); } catch(e) {} },
  fetchRecipes: async () => { try { set({ recipes: await api.getRecipes() }); } catch(e) {} },
  fetchCalories: async (date) => {
    const d = date || get().selectedDate;
    try { const data = await api.getCalories(d); set({ calorieLog: data.logs, calorieTotals: data.totals, selectedDate: d }); } catch(e) {}
  },

  addItem: async (item) => { await api.addInventoryItem(item); await get().fetchInventory(); },
  bulkAddItems: async (items) => { await api.bulkAddInventory(items); await get().fetchInventory(); },
  updateItem: async (id, item) => { await api.updateInventoryItem(id, item); await get().fetchInventory(); },
  deleteItem: async (id) => { await api.deleteInventoryItem(id); set(s => ({ inventory: s.inventory.filter(i => i.id !== id) })); },

  fetchCollections: async () => { try { set({ collections: await api.getCollections() }); } catch(e) {} },
  createCollection: async (name) => { const c = await api.createCollection(name); set(s => ({ collections: [c, ...s.collections] })); return c; },
  deleteCollection: async (id) => { await api.deleteCollection(id); set(s => ({ collections: s.collections.filter(c => c.id !== id) })); },
  addToCollection: async (collectionId, recipeId) => { await api.addToCollection(collectionId, recipeId); await get().fetchCollections(); },
  removeFromCollection: async (collectionId, recipeId) => { await api.removeFromCollection(collectionId, recipeId); await get().fetchCollections(); },

  createRecipe: async (r) => { const res = await api.createRecipe(r); await get().fetchRecipes(); return res; },
  updateRecipe: async (id, r) => { await api.updateRecipe(id, r); await get().fetchRecipes(); },
  deleteRecipe: async (id) => { await api.deleteRecipe(id); set(s => ({ recipes: s.recipes.filter(r => r.id !== id) })); },
  /**
   * Kocht ein Rezept und verbraucht die Zutaten aus dem Inventar.
   * Matching via fuzzy String-Vergleich (includes in beide Richtungen).
   * Skaliert Mengen entsprechend Portionen/Gesamtportionen.
   *
   * @returns {{ removed: number }} Anzahl der aus dem Inventar entfernten Artikel
   */
  cookRecipe: async (id, portions, totalServings) => {
    const recipe = get().recipes.find(r => r.id === id);
    const scale = (portions || 1) / (totalServings || 1);
    let removed = 0;
    if (recipe?.ingredients?.length > 0) {
      const inventory = get().inventory;
      for (const ing of recipe.ingredients) {
        if (!ing.amount || ing.amount <= 0) continue;
        const ingLower = ing.name.toLowerCase().trim();
        // Fuzzy-Match: Zutatenname in Inventarname oder umgekehrt
        const match = inventory.find(item => {
          const itemLower = item.name.toLowerCase().trim();
          return itemLower.includes(ingLower) || ingLower.includes(itemLower);
        });
        if (!match) continue;
        try {
          const r = await api.useInventoryItem(match.id, ing.amount * scale);
          if (r?.deleted) removed++;
        } catch(e) {}
      }
    }
    await get().fetchInventory();
    return { removed };
  },

  addCalorieEntry: async (e) => { await api.addCalorieLog(e); await get().fetchCalories(); },
  updateCalorieEntry: async (id, e) => { await api.updateCalorieLog(id, e); await get().fetchCalories(); },
  deleteCalorieEntry: async (id) => { await api.deleteCalorieLog(id); set(s => ({ calorieLog: s.calorieLog.filter(l => l.id !== id) })); },

  updateProfile: async (data) => {
    await api.updateProfile(data);
    const updated = { ...get().user, ...data };
    set({ user: updated });
    await AsyncStorage.setItem('user', JSON.stringify(updated));
  },

  // Weight
  addWeight: async (weight, date, extra = {}) => {
    const today = new Date().toISOString().split('T')[0];
    const d = date || today;
    await api.addWeight({ weight, date: d, bodyFat: extra.bodyFat, muscleMass: extra.muscleMass });
    // Aktuellstes Gewicht ins Profil übernehmen → Coaching (TDEE, Protein-/Carb-g/kg) bleibt live korrekt
    if (d >= today) {
      try { await get().updateProfile({ weight }); } catch (e) {}
    }
    await get().fetchWeightAnalysis();
    try { set({ weightHistory: await api.getWeightHistory() }); } catch (e) {}
  },
  weightHistory: [],
  fetchWeightHistory: async () => { try { set({ weightHistory: await api.getWeightHistory() }); } catch (e) {} },
  fetchWeightAnalysis: async () => {
    try { const data = await api.getWeightAnalysis(); set({ weightAnalysis: data }); return data; } catch(e) { return null; }
  },

  // ── Daily Context (Coaching) ──────────────────────────────────────────────────

  saveDailyContext: async (context) => {
    const today = new Date().toISOString().split('T')[0];
    const ctx = { ...context, date: today };
    set({ dailyContext: ctx });
    try { await AsyncStorage.setItem('daily_context', JSON.stringify(ctx)); } catch(e) {}
    try {
      await api.saveDailyLog({
        sleepHours: context.sleepHours,
        sleepQuality: context.sleepQuality || context.sleepHours >= 7 ? 'gut' : 'schlecht',
        mood: context.energyLevel,
        energy: context.energyLevel,
        soreness: context.soreness ?? null,
      });
    } catch(e) {} // API optional
  },

  // ── Externe App-Daten ─────────────────────────────────────────────────────────

  /** Lädt gespeicherte Sync-Daten von Intervals.icu + Oura aus AsyncStorage in den Store. */
  loadExternalData: async () => {
    try {
      const [intervalsRaw, ouraRaw] = await Promise.all([
        AsyncStorage.getItem('connected_intervals_sync'),
        AsyncStorage.getItem('connected_oura_sync'),
      ]);
      set({
        externalData: {
          intervals: intervalsRaw ? JSON.parse(intervalsRaw) : null,
          oura: ouraRaw ? JSON.parse(ouraRaw) : null,
        },
      });
    } catch(e) {}
  },

  /** Aktualisiert einen einzelnen Anbieter im externalData-State und speichert in AsyncStorage. */
  setExternalData: async (key, data) => {
    const storageKey = key === 'intervals' ? 'connected_intervals_sync' : 'connected_oura_sync';
    try { await AsyncStorage.setItem(storageKey, JSON.stringify(data)); } catch(e) {}
    set(state => ({ externalData: { ...state.externalData, [key]: data } }));
  },

  loadDailyContext: async () => {
    try {
      const raw = await AsyncStorage.getItem('daily_context');
      if (raw) {
        const ctx = JSON.parse(raw);
        const today = new Date().toISOString().split('T')[0];
        if (ctx.date === today) {
          set({ dailyContext: ctx });
          return ctx;
        }
      }
    } catch(e) {}
    set({ dailyContext: null });
    return null;
  },

  // ── Trainingsstatus: manueller "Wiedereinstieg nach Pause"-Override ──────────

  /** Markiert (oder entfernt) den manuellen "Ich starte nach einer Pause neu"-Override. */
  setReturnFromBreak: async (active) => {
    const value = { active, setAt: active ? new Date().toISOString() : null };
    set({ returnFromBreak: value });
    try { await AsyncStorage.setItem('training_return_override', JSON.stringify(value)); } catch(e) {}
  },

  /** Lädt den gespeicherten "Wiedereinstieg nach Pause"-Override aus AsyncStorage. */
  loadReturnFromBreak: async () => {
    try {
      const raw = await AsyncStorage.getItem('training_return_override');
      if (raw) {
        const value = JSON.parse(raw);
        set({ returnFromBreak: value });
        return value;
      }
    } catch(e) {}
    return null;
  },

  // Inventory use
  useInventoryItem: async (id, amount) => {
    const result = await api.useInventoryItem(id, amount);
    await get().fetchInventory();
    return result;
  },

  // ── Training ─────────────────────────────────────────────────────────────────

  /**
   * Lädt den Trainingsplan für eine bestimmte Woche.
   * Strategie: Backend → lokaler AsyncStorage-Cache als Fallback.
   *
   * @param {string} [weekKey] - ISO-Wochenschlüssel; ohne Parameter = aktuelle Woche
   * @returns {Promise<object|null>}
   */
  fetchTrainingPlan: async (weekKey) => {
    try {
      const plan = await api.getTrainingPlan(weekKey);
      if (plan) { set({ trainingPlan: plan }); return plan; }
    } catch(e) {}
    // Lokaler Cache als Offline-Fallback
    try {
      const key = weekKey || new Date().toISOString().split('T')[0];
      const cached = await AsyncStorage.getItem(`training_plan_${key}`);
      if (cached) { const plan = JSON.parse(cached); set({ trainingPlan: plan }); return plan; }
    } catch(e) {}
    return null;
  },

  /**
   * Generiert einen neuen Trainingsplan.
   * Strategie: Backend-API → Gemini-Client-Fallback (wenn Backend nicht erreichbar).
   * Nach erfolgreicher Generierung: lokal cachen + auf Server speichern (für echte DB-IDs).
   * Kontextreihenfolge im Prompt: Sportprofil-Regeln → Zusatzkontext → Verletzungen → Routinen
   *
   * @param {string} trainingType - Sportart
   * @param {string} weekKey - ISO-Wochenschlüssel
   * @param {string} [additionalContext=''] - Zusätzlicher Kontext
   * @param {Array} [routines=[]] - Kraft-Routinen des Users (für Referenz im Plan)
   * @param {object|null} [trainingStatus=null] - analyzeTrainingStatus()-Ergebnis (Wiedereinstieg, Belastung, Ermüdung)
   */
  generateTrainingPlan: async (trainingType, weekKey, additionalContext = '', routines = [], trainingStatus = null) => {
    const { user } = get();
    const phase = getCurrentPhaseText(user);
    const injuryNote = user?.injuries?.trim() ? `\nVerletzungen/Einschränkungen: ${user.injuries.trim()}` : '';
    // trainingContext aus Sportprofil = unveränderliche Regel (höchste Priorität)
    const profileContext = user?.trainingContext?.trim() || '';
    // Trainingsstatus (Wiedereinstieg/Ermüdung/Volumentrend) = höchste Priorität, falls vorhanden
    const statusContext = trainingStatus?.promptContext || '';
    // Kraft-Routinen als Kontext für Kraft-Einheiten im Plan
    let routinesContext = '';
    if (routines && routines.length > 0) {
      const lines = routines.map(r => {
        const exs = Array.isArray(r.exercises) ? r.exercises : (() => { try { return JSON.parse(r.exercises || '[]'); } catch { return []; } })();
        const names = exs.map(e => e.name).filter(Boolean).join(', ');
        const muscles = [...new Set(exs.map(e => e.muscle_group).filter(Boolean))].join(', ');
        const folder = r.folder_name ? ` [${r.folder_name}]` : '';
        return `  - "${r.name}"${folder}: ${names}${muscles ? ` (${muscles})` : ''}`;
      }).join('\n');
      routinesContext = `Kraft-Routinen des Nutzers (bei Kraft-Einheiten bitte referenzieren):\n${lines}`;
    }
    const fullContext = [statusContext, profileContext, additionalContext, injuryNote, routinesContext].filter(Boolean).join('\n');
    // Strukturierter Wochenplan bevorzugt; Fallback: roher Dokumenttext (max. 2500 Zeichen)
    const weekPlanText = phase?.weekText || (() => {
      const raw = user?.trainingContextFile?.content;
      return raw ? `Trainingsplan-Dokument (bitte akkurat folgen):\n${raw.slice(0, 2500)}` : null;
    })();
    try {
      const plan = await api.generateTrainingPlan({ trainingType, weekKey, additionalContext: fullContext, weekPlanText, currentPhase: phase?.display });
      set({ trainingPlan: plan });
      try { await AsyncStorage.setItem(`training_plan_${weekKey}`, JSON.stringify(plan)); } catch(e) {}
      return plan;
    } catch(e) {
      const { geminiKey } = get();
      if (!geminiKey) throw new Error('KI nicht verfügbar — kein API Key konfiguriert');
      const plan = await generateTrainingPlanWithGemini(user, trainingType, weekKey, geminiKey, fullContext, weekPlanText, phase?.display);
      // Save to server to get real DB IDs (so completed workouts can be tracked)
      try {
        const saved = await api.saveTrainingPlan({
          weekKey: plan.week_key, planName: plan.plan_name, description: plan.description,
          trainingType, planData: plan.planData || {}, sessions: plan.sessions,
        });
        set({ trainingPlan: saved });
        try { await AsyncStorage.setItem(`training_plan_${weekKey}`, JSON.stringify(saved)); } catch(e2) {}
        return saved;
      } catch(saveErr) {}
      set({ trainingPlan: plan });
      try { await AsyncStorage.setItem(`training_plan_${weekKey}`, JSON.stringify(plan)); } catch(e2) {}
      return plan;
    }
  },
  completeWorkout: async (data) => {
    const result = await api.completeWorkout(data);
    await get().fetchTrainingPlan();
    // Jede abgeschlossene Einheit fliesst in die KI-Athleten-Analyse (still im Hintergrund)
    get().analyzeAthlete().catch(() => {});
    return result;
  },

  // ── KI-Athleten-Analyse (Profil-Autokorrektur + Belastungs-Check) ──────────
  athleteInsight: null,
  fetchAthleteInsight: async () => { try { set({ athleteInsight: await api.getAthleteInsight() }); } catch (e) {} },
  analyzeAthlete: async () => {
    const result = await api.analyzeAthlete();
    set({ athleteInsight: result });
    // Profil kann serverseitig angepasst worden sein (Fitnesslevel, FTP, Paces) → frisch laden
    if (result?.applied && Object.keys(result.applied).length) {
      try {
        const profile = await api.getProfile();
        const updated = { ...get().user, ...profile };
        set({ user: updated });
        await AsyncStorage.setItem('user', JSON.stringify(updated));
      } catch (e) {}
    }
    return result;
  },

  // ── Mobility ───────────────────────────────────────────────────────────────
  mobilityResult: null,
  fetchMobilityResult: async () => { try { set({ mobilityResult: await api.getMobilityResult() }); } catch (e) {} },
  generateMobilityFlow: async (opts) => await api.generateMobilityFlow(opts || {}),
  saveMobilityResult: async (payload) => {
    const r = await api.saveMobilityResult(payload);
    await get().fetchMobilityResult();
    return r;
  },

  // ── Fortschrittsfotos ────────────────────────────────────────────────────────
  progressPhotos: [],
  fetchProgressPhotos: async () => { try { set({ progressPhotos: await api.getProgressPhotos() }); } catch (e) {} },
  uploadProgressPhoto: async (imageUri, date, pose) => {
    await api.uploadProgressPhoto(imageUri, date, pose);
    await get().fetchProgressPhotos();
  },
  deleteProgressPhoto: async (id) => {
    await api.deleteProgressPhoto(id);
    await get().fetchProgressPhotos();
  },
  progressAnalysis: null,
  fetchProgressAnalysis: async () => { try { set({ progressAnalysis: await api.getProgressAnalysis() }); } catch (e) {} },
  analyzeProgress: async () => { const r = await api.analyzeProgress(); set({ progressAnalysis: r }); return r; },

  /**
   * Aktualisiert eine einzelne Einheit im aktuellen Trainingsplan.
   * Local-first: ändert sofort den Store + AsyncStorage-Cache und ruft das
   * Backend best-effort auf (PATCH). Funktioniert dadurch auch offline / bevor
   * der Backend-Endpoint deployt ist (Persistenz über Reload braucht das Backend).
   *
   * @param {number} index   Index in trainingPlan.sessions
   * @param {object} updates Zu überschreibende Felder (z.B. { focus, duration, day_index, is_rest })
   */
  updateSessionAt: async (index, updates) => {
    const plan = get().trainingPlan;
    if (!plan?.sessions || index < 0 || index >= plan.sessions.length) return null;
    const sessions = plan.sessions.map((s, i) => (i === index ? { ...s, ...updates } : s));
    const updatedPlan = { ...plan, sessions };
    set({ trainingPlan: updatedPlan });
    if (plan.week_key) {
      try { await AsyncStorage.setItem(`training_plan_${plan.week_key}`, JSON.stringify(updatedPlan)); } catch (e) {}
    }
    const sess = sessions[index];
    set({ lastEditedSessionId: sess?.id || null });
    if (sess?.id) { try { await api.updateTrainingSession(sess.id, updates); } catch (e) {} }
    return updatedPlan;
  },

  /** Verschiebt eine Einheit auf einen anderen Wochentag (0 = Montag … 6 = Sonntag). */
  moveSessionAt: async (index, toDayIndex) => get().updateSessionAt(index, { day_index: toDayIndex }),

  /**
   * Lässt die KI die ganze Woche erholungsgerecht neu ausbalancieren.
   * @param {string} weekKey
   * @param {number|null} [lockedSessionId] - Einheit, die fix bleiben soll (z.B. gerade bearbeitet)
   */
  rebalancePlan: async (weekKey, lockedSessionId) => {
    const plan = await api.rebalancePlan(weekKey, lockedSessionId ?? null);
    set({ trainingPlan: plan });
    const wk = plan?.week_key || weekKey;
    if (wk) { try { await AsyncStorage.setItem(`training_plan_${wk}`, JSON.stringify(plan)); } catch (e) {} }
    return plan;
  },

  /**
   * Lässt eine einzelne Einheit per KI (Gemini, serverseitig) neu erstellen.
   * @param {number} index   Index in trainingPlan.sessions
   * @param {string} [instruction] Optionaler Wunsch ("mehr Intervalle", "kürzer", …)
   */
  regenerateSessionAt: async (index, instruction) => {
    const plan = get().trainingPlan;
    if (!plan?.sessions || index < 0 || index >= plan.sessions.length) return null;
    const sess = plan.sessions[index];
    if (!sess?.id) throw new Error('Bitte den Plan zuerst speichern, dann kann die KI die Einheit neu erstellen.');
    const updated = await api.regenerateSession(sess.id, instruction);
    const sessions = plan.sessions.map((s, i) => (i === index ? { ...s, ...updated } : s));
    const updatedPlan = { ...plan, sessions };
    set({ trainingPlan: updatedPlan, lastEditedSessionId: sess.id });
    if (plan.week_key) {
      try { await AsyncStorage.setItem(`training_plan_${plan.week_key}`, JSON.stringify(updatedPlan)); } catch (e) {}
    }
    return updated;
  },
}));
