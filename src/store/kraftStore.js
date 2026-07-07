/**
 * store/kraftStore.js — Kraft-Tracking Store (Zustand)
 *
 * Zuständig für: Routinen, Live-Workout-State-Machine, Sessions, PRs, Pausentimer.
 *
 * Workout-State-Machine:
 *   idle → startWorkout() → active → finishWorkout()/discardWorkout() → idle
 *   active: activeWorkout ist gesetzt und wird in AsyncStorage persistiert
 *
 * Exports:
 *   useKraftStore() — Zustand-Hook für alle Kraft-Screens
 */

// Third-party
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Internal
import { api } from '../api/client';

// ── AsyncStorage-Keys ─────────────────────────────────────────────────────────
const ACTIVE_WORKOUT_KEY = 'kraft_active_workout';
const CUSTOM_EXERCISES_KEY = 'kraft_custom_exercises';
const ROUTINE_ORDER_KEY = 'kraft_routine_order';

// ── Store-Definition ──────────────────────────────────────────────────────────
export const useKraftStore = create((set, get) => ({
  // ── State ────────────────────────────────────────────────────────────────────
  activeWorkout: null,        // Laufendes Workout-Objekt (null = kein Workout aktiv)
  routines: [],
  sessions: [],
  prs: {},                    // { [exerciseId]: pr-Objekt } — Map für O(1)-Zugriff
  lastSessionSets: {},        // { [exerciseId]: sets[] } — Sätze der letzten Session (Vergleich)
  loading: false,
  pendingExercise: null,      // Übung aus ExerciseDatabase, die hinzugefügt werden soll
  customExercises: [],        // [{ name_de, muscle_group }] — vom User / KI hinzugefügt
  routineOrder: [],           // [id, id, …] — lokale Sortierreihenfolge

  // ── Pausentimer ────────────────────────────────────────────────────────────
  restTimer: null,            // { remaining: number, total: number } | null
  restTimerDuration: 90,      // Standarddauer in Sekunden (User-Einstellung)

  /**
   * Initialisiert den Store beim App-Start.
   * Stellt ein laufendes Workout aus AsyncStorage wieder her (Crash-Sicherheit).
   */
  init: async () => {
    try {
      const cached = await AsyncStorage.getItem(ACTIVE_WORKOUT_KEY);
      if (cached) set({ activeWorkout: JSON.parse(cached) });
    } catch (e) {}
    try {
      const custom = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
      if (custom) set({ customExercises: JSON.parse(custom) });
    } catch (e) {}
    try {
      const order = await AsyncStorage.getItem(ROUTINE_ORDER_KEY);
      if (order) set({ routineOrder: JSON.parse(order) });
    } catch (e) {}
  },

  /**
   * Speichert eine neue Custom-Übung lokal (für KI-generierte Übungen ohne DB-Eintrag).
   * Duplikate werden per Namensvergleich (case-insensitive) herausgefiltert.
   */
  addCustomExercise: async (name_de, muscle_group) => {
    const existing = get().customExercises.filter(e => e.name_de.toLowerCase() !== name_de.toLowerCase());
    const updated = [...existing, { name_de, muscle_group }];
    set({ customExercises: updated });
    try { await AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(updated)); } catch (e) {}
  },

  setPendingExercise: (ex) => set({ pendingExercise: ex }),
  clearPendingExercise: () => set({ pendingExercise: null }),

  // ── Routinen ──────────────────────────────────────────────────────────────
  fetchRoutines: async () => {
    try {
      const routines = await api.getRoutines();
      // Neue IDs ans Ende der lokalen Reihenfolge anhängen
      const currentOrder = get().routineOrder;
      const knownIds = new Set(currentOrder);
      const newIds = routines.filter(r => !knownIds.has(r.id)).map(r => r.id);
      const merged = [...currentOrder.filter(id => routines.some(r => r.id === id)), ...newIds];
      if (merged.length !== currentOrder.length || merged.some((id, i) => id !== currentOrder[i])) {
        set({ routineOrder: merged });
        AsyncStorage.setItem(ROUTINE_ORDER_KEY, JSON.stringify(merged)).catch(() => {});
      }
      set({ routines });
    } catch (e) {}
  },

  /** Verschiebt eine Routine in der lokalen Reihenfolge von Index `from` zu `to`. */
  reorderRoutines: (from, to) => {
    const order = [...get().routineOrder];
    const [id] = order.splice(from, 1);
    order.splice(to, 0, id);
    set({ routineOrder: order });
    AsyncStorage.setItem(ROUTINE_ORDER_KEY, JSON.stringify(order)).catch(() => {});
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

  // ── Sessions ──────────────────────────────────────────────────────────────
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

  // ── PRs ───────────────────────────────────────────────────────────────────
  fetchPRs: async () => {
    try {
      const prs = await api.getPRs();
      // Array → Map nach exerciseId für O(1)-Zugriff
      const map = {};
      (prs || []).forEach(pr => { map[pr.exercise_id] = pr; });
      set({ prs: map });
    } catch (e) {}
  },

  /**
   * Prüft, ob ein Set einen neuen PR darstellt.
   * Verwendet die Epley-Formel: estimated 1RM = weight × (1 + reps/30)
   * Vergleicht mit gespeichertem PR — kein PR vorhanden → immer true.
   *
   * @param {number} exerciseId
   * @param {number|string} weight_kg
   * @param {number|string} reps
   * @returns {boolean} true wenn neuer PR
   */
  checkAndNotifyPR: (exerciseId, weight_kg, reps) => {
    if (!exerciseId || !weight_kg || !reps) return false;
    const w = parseFloat(weight_kg);
    const r = parseInt(reps);
    if (!w || !r) return false;
    const estimated1RM = w * (1 + r / 30);
    const existingPR = get().prs[exerciseId];
    if (!existingPR) return true; // Noch kein PR → jedes Set ist ein PR
    const existing1RM = existingPR.weight_kg
      ? parseFloat(existingPR.weight_kg) * (1 + (parseInt(existingPR.reps) || 1) / 30)
      : 0;
    return estimated1RM > existing1RM;
  },

  // ── Aktives Workout ───────────────────────────────────────────────────────

  /**
   * Startet ein neues Workout.
   * Mapped Routine-Übungen auf das aktive Workout-Format.
   * Lädt für jede Übung mit ID die letzte Session aus der API (für Vergleichsanzeige).
   * Setzt Preset-Sätze aus der Routine, falls vorhanden.
   *
   * @param {number|null} routineId
   * @param {string} routineName
   * @param {Array} exercises - Übungsliste aus der Routine
   */
  startWorkout: async (routineId, routineName, exercises) => {
    const list = exercises || [];
    // Letzte Gewichte/Reps pro Übungsname laden → Vorbefüllung als progressive-Overload-Basis
    let lastByName = {};
    const names = [...new Set(list.map(ex => ex.name_de || ex.name).filter(Boolean))];
    if (names.length > 0) {
      try { lastByName = (await api.getLastSets(names)) || {}; } catch (e) { lastByName = {}; }
    }
    const mapped = list.map(ex => {
      const nm = ex.name_de || ex.name;
      const last = lastByName[nm] || null;
      const lw = last?.weight_kg != null ? String(last.weight_kg) : '';
      const lr = last?.reps != null ? String(last.reps) : '';
      // Sätze aus Plan/Routine; Gewicht aus letzter Session vorbefüllen, Reps aus Plan bevorzugt
      const presetSets = Array.isArray(ex.sets) && ex.sets.length > 0
        ? ex.sets.map(s => ({ reps: s.reps ? String(s.reps) : lr, weight_kg: s.weight_kg ? String(s.weight_kg) : lw, completed: false, type: 'normal' }))
        : [{ reps: lr, weight_kg: lw, completed: false, type: 'normal' }];
      return {
        exerciseId: ex.id || ex.exerciseId || null,
        name: nm,
        muscle_group: ex.muscle_group || '',
        sets: presetSets,
        restDuration: 90,
        lastWeight: last?.weight_kg ?? null,
        lastReps: last?.reps ?? null,
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

    // Letzte Session-Sätze für Übungen mit IDs laden (für Vergleichsanzeige)
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

  /**
   * Interne Hilfsfunktion: Speichert das aktive Workout in State + AsyncStorage.
   * Wird von allen Mutations aufgerufen — verhindert Codeduplikation.
   *
   * @param {object} workout - Aktualisiertes Workout-Objekt
   */
  _saveActive: async (workout) => {
    set({ activeWorkout: workout });
    try { await AsyncStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(workout)); } catch (e) {}
  },

  /** Erhöht elapsedSeconds um 1. Wird jede Sekunde vom Timer-Interval aufgerufen. */
  tickTimer: () => {
    const w = get().activeWorkout;
    if (!w || w.isPaused) return;
    const updated = { ...w, elapsedSeconds: (w.elapsedSeconds || 0) + 1 };
    get()._saveActive(updated);
  },

  /** Pausiert/Fortsetzt den Workout-Timer. */
  togglePause: () => {
    const w = get().activeWorkout;
    if (!w) return;
    get()._saveActive({ ...w, isPaused: !w.isPaused });
  },

  /** Aktualisiert ein Feld (weight_kg oder reps) eines einzelnen Satzes. */
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

  /**
   * Aktualisiert ein Feld und kaskadiert den Wert auf alle nachfolgenden,
   * noch nicht abgeschlossenen Sätze (si > setIdx). Nützlich für schnelles
   * Eintippen wenn mehrere Sätze gleiche Werte haben.
   */
  updateSetWithFill: (exIdx, setIdx, field, value) => {
    const w = get().activeWorkout;
    if (!w) return;
    const exercises = w.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      const currentCompleted = ex.sets[setIdx]?.completed;
      const sets = ex.sets.map((s, si) => {
        if (si === setIdx) return { ...s, [field]: value };
        // Nur kaskadieren wenn aktueller Satz noch offen und Folgesatz auch offen
        if (si > setIdx && !currentCompleted && !s.completed) return { ...s, [field]: value };
        return s;
      });
      return { ...ex, sets };
    });
    get()._saveActive({ ...w, exercises });
  },

  /** Ändert den Satz-Typ (normal/warmup/dropset/failure). */
  updateSetType: (exIdx, setIdx, type) => {
    const w = get().activeWorkout;
    if (!w) return;
    const exercises = w.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      const sets = ex.sets.map((s, si) => si === setIdx ? { ...s, type } : s);
      return { ...ex, sets };
    });
    get()._saveActive({ ...w, exercises });
  },

  /** Schaltet den Abgehakt-Status eines Satzes um. */
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

  /** Fügt einen Satz hinzu (kopiert Werte des letzten Satzes). */
  addSet: (exIdx) => {
    const w = get().activeWorkout;
    if (!w) return;
    const exercises = w.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      const lastSet = ex.sets[ex.sets.length - 1] || {};
      return { ...ex, sets: [...ex.sets, { reps: lastSet.reps || '', weight_kg: lastSet.weight_kg || '', completed: false, type: 'normal' }] };
    });
    get()._saveActive({ ...w, exercises });
  },

  /** Löscht einen Satz (mindestens 1 Satz bleibt immer erhalten). */
  deleteSet: (exIdx, setIdx) => {
    const w = get().activeWorkout;
    if (!w) return;
    const exercises = w.exercises.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      if (ex.sets.length <= 1) return ex;
      return { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) };
    });
    get()._saveActive({ ...w, exercises });
  },

  /** Aktualisiert die Notizen einer Übung. */
  updateExerciseNotes: (exIdx, notes) => {
    const w = get().activeWorkout;
    if (!w) return;
    const exercises = w.exercises.map((ex, ei) => ei === exIdx ? { ...ex, notes } : ex);
    get()._saveActive({ ...w, exercises });
  },

  /** Fügt eine Übung zum laufenden Workout hinzu. */
  addExercise: (exercise) => {
    const w = get().activeWorkout;
    if (!w) return;
    const newEx = {
      exerciseId: exercise.id || exercise.exerciseId,
      name: exercise.name_de || exercise.name,
      muscle_group: exercise.muscle_group || '',
      sets: [{ reps: '', weight_kg: '', completed: false, type: 'normal' }],
      restDuration: 90,
    };
    get()._saveActive({ ...w, exercises: [...w.exercises, newEx] });
  },

  /** Entfernt eine Übung aus dem laufenden Workout anhand des Index. */
  removeExercise: (exIdx) => {
    const w = get().activeWorkout;
    if (!w) return;
    get()._saveActive({ ...w, exercises: w.exercises.filter((_, ei) => ei !== exIdx) });
  },

  /** Verschiebt eine Übung im laufenden Workout von Index `from` zu Index `to`. */
  moveExercise: (from, to) => {
    const w = get().activeWorkout;
    if (!w) return;
    const arr = [...w.exercises];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    get()._saveActive({ ...w, exercises: arr });
  },

  /**
   * Beendet das Workout, speichert die Session auf dem Server.
   * Berechnet Gesamtvolumen und flacht alle Sets auf ein Array ab.
   * Bei Server-Fehler: Workout trotzdem beendet (lokale Daten gehen verloren).
   *
   * @param {string} [notes=''] - Optionale Workout-Notizen
   * @returns {Promise<object>} - Gespeicherte Session (oder lokale Daten bei Fehler)
   */
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
        set_type: s.type || 'normal',
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
      // Workout trotzdem beenden auch wenn Speichern fehlschlägt
      set({ activeWorkout: null });
      try { await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY); } catch (e2) {}
      return sessionData;
    }
  },

  /** Verwirft das aktive Workout ohne zu speichern. */
  discardWorkout: async () => {
    set({ activeWorkout: null });
    try { await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY); } catch (e) {}
  },

  // ── Pausentimer ────────────────────────────────────────────────────────────

  /**
   * Startet den Pausentimer.
   * Verwendet per-Übung duration wenn angegeben, sonst globale restTimerDuration.
   *
   * @param {number} [duration] - Optionale Dauer in Sekunden; Fallback: restTimerDuration
   */
  startRestTimer: (duration) => {
    const d = duration || get().restTimerDuration;
    set({ restTimer: { remaining: d, total: d } });
  },

  /**
   * Setzt die Pausendauer für eine einzelne Übung (überschreibt globale Einstellung).
   * Gespeichert direkt im activeWorkout-Objekt.
   *
   * @param {number} exIdx - Übungsindex
   * @param {number} seconds - Pausendauer in Sekunden
   */
  setExerciseRestDuration: (exIdx, seconds) => {
    const w = get().activeWorkout;
    if (!w) return;
    const exercises = w.exercises.map((ex, ei) => ei === exIdx ? { ...ex, restDuration: seconds } : ex);
    get()._saveActive({ ...w, exercises });
  },

  /** Zählt den Pausentimer um 1 herunter. Bei 0: Timer wird auf null gesetzt. */
  tickRestTimer: () => {
    const t = get().restTimer;
    if (!t) return;
    if (t.remaining <= 1) {
      set({ restTimer: null });
    } else {
      set({ restTimer: { ...t, remaining: t.remaining - 1 } });
    }
  },

  /** Blendet den Pausentimer sofort aus. */
  dismissRestTimer: () => {
    set({ restTimer: null });
  },

  /** Ändert die globale Standard-Pausendauer. */
  setRestTimerDuration: (seconds) => {
    set({ restTimerDuration: seconds });
  },
}));
