import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

const ACTIVE_WORKOUT_KEY = 'kraft_active_workout';

export const useKraftStore = create((set, get) => ({
  activeWorkout: null, // { routineId, routineName, startedAt, exercises:[{exerciseId,name,sets:[{reps,weight_kg,completed}]}], elapsedSeconds }
  routines: [],
  sessions: [],
  prs: {}, // { exerciseId: { weight_kg, reps, estimated1rm } }
  lastSessionSets: {}, // { exerciseId: [{set_number, weight_kg, reps}] }
  loading: false,
  pendingExercise: null, // temp store for exercise-picker return value

  init: async () => {
    try {
      const cached = await AsyncStorage.getItem(ACTIVE_WORKOUT_KEY);
      if (cached) set({ activeWorkout: JSON.parse(cached) });
    } catch (e) {}
  },

  setPendingExercise: (ex) => set({ pendingExercise: ex }),
  clearPendingExercise: () => set({ pendingExercise: null }),

  // ── Routines ──────────────────────────────────────────────────────
  fetchRoutines: async () => {
    try {
      const routines = await api.getRoutines();
      set({ routines });
    } catch (e) {}
  },

  createRoutine: async (data) => {
    const r = await api.createRoutine(data);
    await get().fetchRoutines();
    return r;
  },

  updateRoutine: async (id, data) => {
    await api.updateRoutine(id, data);
    await get().fetchRoutines();
  },

  deleteRoutine: async (id) => {
    await api.deleteRoutine(id);
    set(s => ({ routines: s.routines.filter(r => r.id !== id) }));
  },

  // ── Sessions ──────────────────────────────────────────────────────
  fetchSessions: async (limit = 20, offset = 0) => {
    try {
      const sessions = await api.getSessions(limit, offset);
      set({ sessions });
    } catch (e) {}
  },

  deleteSession: async (id) => {
    await api.deleteSession(id);
    set(s => ({ sessions: s.sessions.filter(ses => ses.id !== id) }));
  },

  // ── PRs ───────────────────────────────────────────────────────────
  fetchPRs: async () => {
    try {
      const prs = await api.getPRs();
      // Convert array to map by exerciseId
      const map = {};
      (prs || []).forEach(pr => { map[pr.exercise_id] = pr; });
      set({ prs: map });
    } catch (e) {}
  },

  // ── Active Workout ────────────────────────────────────────────────
  startWorkout: async (routineId, routineName, exercises) => {
    const mapped = (exercises || []).map(ex => {
      // Use preset sets from routine if available, else one empty set
      const presetSets = Array.isArray(ex.sets) && ex.sets.length > 0
        ? ex.sets.map(s => ({ reps: s.reps ? String(s.reps) : '', weight_kg: s.weight_kg ? String(s.weight_kg) : '', completed: false }))
        : [{ reps: '', weight_kg: '', completed: false }];
      return {
        exerciseId: ex.id || ex.exerciseId || null,
        name: ex.name_de || ex.name,
        muscle_group: ex.muscle_group || '',
        sets: presetSets,
      };
    });
    const workout = {
      routineId: routineId || null,
      routineName: routineName || 'Leeres Workout',
      startedAt: new Date().toISOString(),
      exercises: mapped,
      elapsedSeconds: 0,
    };
    set({ activeWorkout: workout });
    try { await AsyncStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(workout)); } catch (e) {}

    // Fetch last session sets for exercises with IDs
    const idsToFetch = mapped.filter(ex => ex.exerciseId).map(ex => ex.exerciseId);
    if (idsToFetch.length > 0) {
      const lastSets = {};
      await Promise.all(idsToFetch.map(async (id) => {
        try {
          const history = await api.getExerciseHistory(id);
          if (history && history.length > 0) lastSets[id] = history[0].sets || [];
        } catch (e) {}
      }));
      set({ lastSessionSets: lastSets });
    }
  },

  _saveActive: async (workout) => {
    set({ activeWorkout: workout });
    try { await AsyncStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(workout)); } catch (e) {}
  },

  tickTimer: () => {
    const w = get().activeWorkout;
    if (!w) return;
    const updated = { ...w, elapsedSeconds: (w.elapsedSeconds || 0) + 1 };
    get()._saveActive(updated);
  },

  updateSet: (exIdx, setIdx, field, value) => {
    const w = get().activeWorkout;
    if (!w) return;
    const exercises = w.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      const sets = ex.sets.map((s, si) => si === setIdx ? { ...s, [field]: value } : s);
      return { ...ex, sets };
    });
    get()._saveActive({ ...w, exercises });
  },

  // updateSet + cascade to all subsequent sets (si > setIdx), leave previous untouched
  updateSetWithFill: (exIdx, setIdx, field, value) => {
    const w = get().activeWorkout;
    if (!w) return;
    const exercises = w.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      const currentCompleted = ex.sets[setIdx]?.completed;
      const sets = ex.sets.map((s, si) => {
        if (si === setIdx) return { ...s, [field]: value };
        // cascade to subsequent sets only if current set is not completed and subsequent set is also not completed
        if (si > setIdx && !currentCompleted && !s.completed) return { ...s, [field]: value };
        return s;
      });
      return { ...ex, sets };
    });
    get()._saveActive({ ...w, exercises });
  },

  toggleSetComplete: (exIdx, setIdx) => {
    const w = get().activeWorkout;
    if (!w) return;
    const exercises = w.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      const sets = ex.sets.map((s, si) => si === setIdx ? { ...s, completed: !s.completed } : s);
      return { ...ex, sets };
    });
    get()._saveActive({ ...w, exercises });
  },

  addSet: (exIdx) => {
    const w = get().activeWorkout;
    if (!w) return;
    const exercises = w.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      const lastSet = ex.sets[ex.sets.length - 1] || {};
      return { ...ex, sets: [...ex.sets, { reps: lastSet.reps || '', weight_kg: lastSet.weight_kg || '', completed: false }] };
    });
    get()._saveActive({ ...w, exercises });
  },

  deleteSet: (exIdx, setIdx) => {
    const w = get().activeWorkout;
    if (!w) return;
    const exercises = w.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      if (ex.sets.length <= 1) return ex; // keep at least 1
      return { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) };
    });
    get()._saveActive({ ...w, exercises });
  },

  addExercise: (exercise) => {
    const w = get().activeWorkout;
    if (!w) return;
    const newEx = {
      exerciseId: exercise.id || exercise.exerciseId,
      name: exercise.name_de || exercise.name,
      muscle_group: exercise.muscle_group || '',
      sets: [{ reps: '', weight_kg: '', completed: false }],
    };
    get()._saveActive({ ...w, exercises: [...w.exercises, newEx] });
  },

  removeExercise: (exIdx) => {
    const w = get().activeWorkout;
    if (!w) return;
    get()._saveActive({ ...w, exercises: w.exercises.filter((_, ei) => ei !== exIdx) });
  },

  finishWorkout: async (notes = '') => {
    const w = get().activeWorkout;
    if (!w) return null;

    const totalSets = w.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0);
    const totalVolume = w.exercises.reduce((acc, ex) =>
      acc + ex.sets.filter(s => s.completed).reduce((a, s) => a + (parseFloat(s.weight_kg) || 0) * (parseInt(s.reps) || 0), 0), 0);

    const flatSets = w.exercises.flatMap(ex =>
      ex.sets.filter(s => s.completed).map((s, i) => ({
        exercise_id: ex.exerciseId || 0,
        exercise_name: ex.name,
        set_number: i + 1,
        weight_kg: parseFloat(s.weight_kg) || 0,
        reps: parseInt(s.reps) || 0,
        completed: 1,
      }))
    );

    const sessionData = {
      routine_id: w.routineId,
      routine_name: w.routineName,
      started_at: w.startedAt,
      finished_at: new Date().toISOString(),
      duration_seconds: w.elapsedSeconds,
      total_volume_kg: Math.round(totalVolume * 10) / 10,
      total_sets: totalSets,
      notes,
      sets: flatSets,
    };

    try {
      const saved = await api.saveSession(sessionData);
      set({ activeWorkout: null });
      try { await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY); } catch (e) {}
      await get().fetchSessions();
      await get().fetchPRs();
      return saved;
    } catch (e) {
      // Still clear active workout even if save fails
      set({ activeWorkout: null });
      try { await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY); } catch (e2) {}
      return sessionData;
    }
  },

  discardWorkout: async () => {
    set({ activeWorkout: null });
    try { await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY); } catch (e) {}
  },
}));
