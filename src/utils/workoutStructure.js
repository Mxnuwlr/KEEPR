/**
 * utils/workoutStructure.js — Strukturierte Workouts (intervals.icu-Stil)
 *
 * Wandelt eine Trainingseinheit in eine Phasen-Liste um, die als Profil-Balken
 * dargestellt werden kann (Aufwärmen → Load/Intervalle → Cooldown, mit Zonen).
 *
 * Datenquelle:
 *   1. session.steps  — von Gemini geliefert (bevorzugt)
 *   2. Fallback        — synthetisiert aus duration + intensity + sport_type,
 *                        damit das Profil IMMER sinnvoll aussieht.
 *
 * Step-Format:
 *   { phase: 'warmup'|'load'|'interval'|'recovery'|'cooldown'|'steady',
 *     minutes: number, zone: 'Z1'|'Z2'|'Z3'|'Z4'|'Z5', label?: string }
 *
 * Exports:
 *   ZONES                 — Zonen-Metadaten (Farbe, Höhe, Label)
 *   getZone(zone)         — Zonen-Definition (Fallback Z2)
 *   getSessionSteps(s)    — normalisierte Steps (geliefert oder synthetisiert)
 *   stepsTotalMinutes(steps)
 *   hasStructuredProfile(session) — true, wenn ein Profil anzeigbar ist
 */

// ── Zonen ───────────────────────────────────────────────────────────────────
export const ZONES = {
  Z1: { key: 'Z1', label: 'Z1 · Regeneration', short: 'Z1', color: '#22C55E', height: 0.28 },
  Z2: { key: 'Z2', label: 'Z2 · Grundlage',    short: 'Z2', color: '#86EFAC', height: 0.44 },
  Z3: { key: 'Z3', label: 'Z3 · Tempo',        short: 'Z3', color: '#F59E0B', height: 0.62 },
  Z4: { key: 'Z4', label: 'Z4 · Schwelle',     short: 'Z4', color: '#F97316', height: 0.82 },
  Z5: { key: 'Z5', label: 'Z5 · VO2max',       short: 'Z5', color: '#EF4444', height: 1.0 },
};

export function getZone(zone) {
  return ZONES[zone] || ZONES.Z2;
}

// Phase → Standard-Zone (falls keine Zone am Step gesetzt)
const PHASE_DEFAULT_ZONE = {
  warmup: 'Z1', cooldown: 'Z1', recovery: 'Z1',
  steady: 'Z2', load: 'Z3', interval: 'Z4',
};

const ENDURANCE = new Set(['run', 'trail_run', 'treadmill', 'bike', 'mtb', 'gravel', 'indoor_bike', 'swim', 'row', 'triathlon', 'walk', 'hike', 'skating', 'ski_nordic']);

/** Normalisiert einen Step (Zone ableiten, Minuten runden). */
function normalizeStep(s) {
  const phase = s.phase || s.type || 'steady';
  const zone = s.zone && ZONES[s.zone] ? s.zone : (PHASE_DEFAULT_ZONE[phase] || 'Z2');
  const minutes = Math.max(0, Math.round(s.minutes ?? s.duration ?? 0));
  return { phase, zone, minutes, label: s.label || null };
}

/**
 * Synthetisiert ein Profil aus Dauer + Intensität, wenn keine Steps vorliegen.
 * @param {object} session
 * @returns {Array} steps
 */
function synthesizeSteps(session) {
  const total = Math.round(session?.duration || 0);
  if (total <= 0) return [];

  const sport = session?.sport_type;
  const intensity = ZONES[session?.intensity] ? session.intensity : null;

  // Kraft / Yoga / Mobility: einfaches Aufwärmen → Hauptteil → Cooldown
  if (!ENDURANCE.has(sport)) {
    if (total < 20) return [{ phase: 'steady', zone: 'Z2', minutes: total, label: 'Einheit' }];
    const warm = Math.max(5, Math.round(total * 0.12));
    const cool = Math.max(3, Math.round(total * 0.10));
    const main = Math.max(1, total - warm - cool);
    return [
      { phase: 'warmup', zone: 'Z1', minutes: warm, label: 'Aufwärmen' },
      { phase: 'load', zone: 'Z3', minutes: main, label: 'Hauptteil' },
      { phase: 'cooldown', zone: 'Z1', minutes: cool, label: 'Cooldown' },
    ];
  }

  // Ausdauer ohne klare Intensität → ruhiger Dauerlauf (Z2)
  const targetZone = intensity || 'Z2';

  // Intervall-Einheit (Z4/Z5): Warmup → N×(Load/Recovery) → Cooldown
  if (targetZone === 'Z4' || targetZone === 'Z5') {
    const warm = Math.max(8, Math.round(total * 0.2));
    const cool = Math.max(5, Math.round(total * 0.12));
    let mainPool = total - warm - cool;
    if (mainPool < 6) {
      return [
        { phase: 'warmup', zone: 'Z1', minutes: warm, label: 'Einrollen' },
        { phase: 'interval', zone: targetZone, minutes: Math.max(1, total - warm - cool), label: 'Belastung' },
        { phase: 'cooldown', zone: 'Z1', minutes: cool, label: 'Ausrollen' },
      ];
    }
    // Intervall-Block: Belastung ~3 Min, Pause ~2 Min, so viele wie reinpassen
    const workMin = targetZone === 'Z5' ? 2 : 3;
    const restMin = 2;
    const perRep = workMin + restMin;
    const reps = Math.max(3, Math.min(8, Math.floor(mainPool / perRep)));
    const steps = [{ phase: 'warmup', zone: 'Z1', minutes: warm, label: 'Einrollen' }];
    for (let i = 0; i < reps; i++) {
      steps.push({ phase: 'interval', zone: targetZone, minutes: workMin, label: `Intervall ${i + 1}` });
      if (i < reps - 1) steps.push({ phase: 'recovery', zone: 'Z1', minutes: restMin, label: 'Pause' });
    }
    steps.push({ phase: 'cooldown', zone: 'Z1', minutes: cool, label: 'Ausrollen' });
    return steps;
  }

  // Tempo/Schwellen-Dauereinheit (Z3) oder ruhig (Z1/Z2): Warmup → steady → Cooldown
  const warm = Math.max(5, Math.round(total * 0.13));
  const cool = Math.max(5, Math.round(total * 0.12));
  const main = Math.max(1, total - warm - cool);
  return [
    { phase: 'warmup', zone: 'Z1', minutes: warm, label: 'Aufwärmen' },
    { phase: targetZone === 'Z3' ? 'load' : 'steady', zone: targetZone, minutes: main, label: targetZone === 'Z3' ? 'Tempo' : 'Dauerleistung' },
    { phase: 'cooldown', zone: 'Z1', minutes: cool, label: 'Cooldown' },
  ];
}

/**
 * Liefert die anzeigbaren Steps einer Einheit (geliefert oder synthetisiert).
 * @param {object} session
 * @returns {Array} normalisierte Steps
 */
export function getSessionSteps(session) {
  if (!session || session.is_rest) return [];
  const raw = session.steps;
  if (Array.isArray(raw) && raw.length > 0) {
    const norm = raw.map(normalizeStep).filter(s => s.minutes > 0);
    if (norm.length > 0) return norm;
  }
  return synthesizeSteps(session);
}

export function stepsTotalMinutes(steps) {
  return (steps || []).reduce((a, s) => a + (s.minutes || 0), 0);
}

/** true, wenn für die Einheit ein sinnvolles Profil dargestellt werden kann. */
export function hasStructuredProfile(session) {
  return getSessionSteps(session).length > 0;
}
