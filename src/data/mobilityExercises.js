/**
 * data/mobilityExercises.js — Fester Mobility-Übungs-Katalog
 *
 * Einzige Wahrheitsquelle: src/data/mobilityCatalog.json (wird auch vom Backend
 * für die Flow-Generierung und vom Generator-Skript scripts/genmobility.js gelesen).
 *
 * Jede Übung hat eine feste `slug` → Medien liegen auf dem Pi unter
 * /uploads/mobility/<slug>.mp4 (Loop-Clip) bzw. <slug>.png (Standbild/Poster).
 * So kann die KI Flows NUR aus diesem Katalog zusammenstellen (keine erfundenen
 * Übungen ohne passendes Video).
 *
 * Felder je Übung:
 *   slug       — Datei-/Referenz-Name (kebab-case)
 *   name       — deutscher Anzeigename
 *   zone       — Mobility-Zone (siehe data/mobility.js MOBILITY_ZONES)
 *   sides      — 'uni' (je Seite einzeln) | 'bi' (beidseitig in einem)
 *   defaultSec — Standard-Dauer pro Seite/Durchgang
 *   equipment  — [] (Körpergewicht) | ['band'|'foam_roller'|'massage_gun']
 *   cues       — kurzer deutscher Ausführungshinweis
 *   prompt     — englische Bewegungsbeschreibung (für den Video-Generator)
 */

import catalog from './mobilityCatalog.json';

export const MOBILITY_EXERCISES = catalog;

const BY_SLUG = catalog.reduce((m, e) => { m[e.slug] = e; return m; }, {});
export const getExercise = (slug) => BY_SLUG[slug] || null;

/** Alle Übungen einer Zone. */
export const exercisesForZone = (zone) => catalog.filter((e) => e.zone === zone);

/** Übungen, die mit dem vorhandenen Equipment machbar sind (Token-Liste, [] = nur Körpergewicht). */
export function exercisesForEquipment(available = []) {
  const have = new Set(available);
  return catalog.filter((e) => (e.equipment || []).every((eq) => have.has(eq)));
}
