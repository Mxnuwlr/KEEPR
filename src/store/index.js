import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, generateTrainingPlanWithGemini } from '../api/client';

export function getCurrentPhaseText(user) {
  const startDate = user?.trainingPlanStartDate;
  if (!startDate) return null;

  // Structured plan (preferred — Gemini-parsed)
  const structured = user?.trainingPlanStructured;
  const structuredBlocks = structured?.blocks;

  // Fallback: simple text blocks
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
    // Structured: format as explicit instructions
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

export const useStore = create((set, get) => ({
  user: null, token: null, geminiKey: '',
  inventory: [], recipes: [], calorieLog: [], calorieTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  selectedDate: new Date().toISOString().split('T')[0],
  trainingPlan: null, weightAnalysis: null,
  loading: false, error: null,

  setUser: (u) => set({ user: u }),

  init: async () => {
    const token = await AsyncStorage.getItem('auth_token');
    const userStr = await AsyncStorage.getItem('user');
    const localKey = await AsyncStorage.getItem('gemini_key') || '';
    if (token && userStr) {
      set({ token, user: JSON.parse(userStr), geminiKey: localKey });
      try {
        const profile = await api.getProfile();
        set({ user: { ...JSON.parse(userStr), ...profile } });
        try { const cfg = await api.getGeminiKey(); if (cfg.key) set({ geminiKey: cfg.key }); } catch(e) {}
        await get().fetchAll();
      } catch (e) { await get().logout(); }
    } else if (localKey) {
      set({ geminiKey: localKey });
    }
  },

  setGeminiKey: async (key) => { await AsyncStorage.setItem('gemini_key', key); set({ geminiKey: key }); },

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const data = await api.login({ username, password });
      await AsyncStorage.setItem('auth_token', data.token);
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
      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      set({ token: data.token, user: data.user });
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    // Set null first so UI updates immediately, then clean up storage
    set({ user: null, token: null, inventory: [], recipes: [], calorieLog: [], trainingPlan: null });
    try { await AsyncStorage.multiRemove(['auth_token', 'user']); } catch(e) {}
    // gemini_key is kept in AsyncStorage (device setting, not account-bound)
  },

  fetchAll: async () => { await Promise.all([get().fetchInventory(), get().fetchRecipes(), get().fetchCalories(), get().fetchTrainingPlan()]); },
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

  createRecipe: async (r) => { const res = await api.createRecipe(r); await get().fetchRecipes(); return res; },
  updateRecipe: async (id, r) => { await api.updateRecipe(id, r); await get().fetchRecipes(); },
  deleteRecipe: async (id) => { await api.deleteRecipe(id); set(s => ({ recipes: s.recipes.filter(r => r.id !== id) })); },
  cookRecipe: async (id, portions, totalServings) => {
    const recipe = get().recipes.find(r => r.id === id);
    const scale = (portions || 1) / (totalServings || 1);
    let removed = 0;
    if (recipe?.ingredients?.length > 0) {
      const inventory = get().inventory;
      for (const ing of recipe.ingredients) {
        if (!ing.amount || ing.amount <= 0) continue;
        const ingLower = ing.name.toLowerCase().trim();
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
  addWeight: async (weight, date) => {
    await api.addWeight({ weight, date: date || new Date().toISOString().split('T')[0] });
    await get().fetchWeightAnalysis();
  },
  fetchWeightAnalysis: async () => {
    try { const data = await api.getWeightAnalysis(); set({ weightAnalysis: data }); return data; } catch(e) { return null; }
  },

  // Inventory use
  useInventoryItem: async (id, amount) => {
    const result = await api.useInventoryItem(id, amount);
    await get().fetchInventory();
    return result;
  },

  // Training
  fetchTrainingPlan: async (weekKey) => {
    try {
      const plan = await api.getTrainingPlan(weekKey);
      if (plan) { set({ trainingPlan: plan }); return plan; }
    } catch(e) {}
    // Lokaler Cache als Fallback
    try {
      const key = weekKey || new Date().toISOString().split('T')[0];
      const cached = await AsyncStorage.getItem(`training_plan_${key}`);
      if (cached) { const plan = JSON.parse(cached); set({ trainingPlan: plan }); return plan; }
    } catch(e) {}
    return null;
  },
  generateTrainingPlan: async (trainingType, weekKey, additionalContext = '') => {
    // Backend versuchen, dann client-side Fallback
    const { user } = get();
    const phase = getCurrentPhaseText(user);
    const injuryNote = user?.injuries?.trim() ? `\nVerletzungen/Einschränkungen: ${user.injuries.trim()}` : '';
    // trainingContext aus Sportprofil immer als unveränderliche Regel übergeben
    const profileContext = user?.trainingContext?.trim() || '';
    const fullContext = [profileContext, additionalContext, injuryNote].filter(Boolean).join('\n');
    // Strukturierter Wochenplan aus Datei; Fallback: roher Dokumenttext (max. 2500 Zeichen)
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
    return result;
  },
}));
