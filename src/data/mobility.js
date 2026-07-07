/**
 * data/mobility.js — Mobility-Modul: Zonen, Assessment-Tests, Scoring
 *
 * Inspiriert von GOWOD: Self-Assessment der Beweglichkeit per Handy-Sensor
 * (Winkelmessung über DeviceMotion), daraus ein Mobility-Score je Körperzone
 * und gesamt. Der Score steuert später die personalisierten KI-Flows.
 *
 * Exports:
 *   MOBILITY_ZONES      — Körperzonen (id, label, MuscleMap-Key)
 *   MOBILITY_TESTS      — Test-Definitionen (Sensor-Winkel, Referenzwerte)
 *   scoreTest(testId, measuredDeg)        — 0..100 pro Messung
 *   computeMobilityScore(results)         — { overall, byZone, byTest }
 *   getZone(id) / getTest(id)
 *   testsForProfile(sports)               — sportartspezifische Test-Auswahl
 */

import { mobilityZonesForSport } from './sports';

// ── Körperzonen ───────────────────────────────────────────────────────────────
export const MOBILITY_ZONES = {
  ankle:      { id: 'ankle',      label: 'Sprunggelenk', muscle: 'calves' },
  hips:       { id: 'hips',       label: 'Hüfte',        muscle: 'hip_flexors' },
  posterior:  { id: 'posterior',  label: 'Beinrückseite', muscle: 'hamstrings' },
  tspine:     { id: 'tspine',     label: 'Brustwirbelsäule', muscle: 'back' },
  shoulders:  { id: 'shoulders',  label: 'Schultern',    muscle: 'shoulders' },
  wrist:      { id: 'wrist',      label: 'Handgelenke',  muscle: 'forearms' },
  balance:    { id: 'balance',    label: 'Stabilität & Balance', muscle: 'calves' },
};

/**
 * Assessment-Tests. Jeder Test wird per Sensor gemessen (max. erreichter Winkel
 * während der Bewegung). `refDeg` = Referenz-Winkel für 100% (gute Mobilität).
 * `sides`: 'both' → links + rechts einzeln, 'single' → eine Messung.
 *
 * placement = wo das Handy angelegt wird; movement = was gemessen wird.
 */
// type: 'angle' (Goniometer, refDeg) | 'time' (Stoppuhr-Halt, refSec)
// core: immer testen; sports: zusätzlich für diese Sportart-Keys (triathlon ⇒ run+bike+swim)
export const MOBILITY_TESTS = [
  {
    id: 'ankle_dorsiflexion', name: 'Knöchel-Beweglichkeit', zone: 'ankle', type: 'angle',
    sides: 'both', refDeg: 40, core: true,
    placement: 'Handy längs vorne aufs Schienbein legen/halten.',
    movement: 'Knie über die Zehen nach vorne schieben (Ferse bleibt am Boden), so weit wie möglich.',
  },
  {
    id: 'hip_flexion', name: 'Hüftbeugung', zone: 'hips', type: 'angle',
    sides: 'both', refDeg: 120, core: true,
    placement: 'Rücklage, Handy längs auf den Oberschenkel.',
    movement: 'Knie zur Brust ziehen, anderes Bein bleibt gestreckt am Boden.',
  },
  {
    id: 'hip_extension', name: 'Hüftstreckung', zone: 'hips', type: 'range',
    sides: 'both', videoSlug: 'test-hip-extension', sports: ['run', 'bike', 'strength', 'triathlon'],
    placement: 'Ausfallschritt/Couch-Stretch, hinteres Knie am Boden, Becken aufrecht.',
    movement: 'Schieb den Regler bis dorthin, wo du die Hüfte des hinteren Beins maximal nach vorn strecken kannst.',
  },
  {
    id: 'hip_internal_rotation', name: 'Hüft-Innenrotation', zone: 'hips', type: 'range',
    sides: 'both', videoSlug: 'test-hip-internal-rotation', sports: ['strength', 'bike', 'run'],
    placement: 'Im Sitzen, Oberschenkel fix.',
    movement: 'Schieb den Regler bis zu deiner maximalen Innenrotation (Unterschenkel nach außen drehen).',
  },
  {
    id: 'forward_bend', name: 'Vorbeuge (hintere Kette)', zone: 'posterior', type: 'angle',
    sides: 'single', refDeg: 90, core: true,
    placement: 'Handy flach auf den unteren Rücken legen/halten.',
    movement: 'Mit gestreckten Beinen nach vorne beugen, so weit wie möglich.',
  },
  {
    id: 'tspine_rotation', name: 'BWS-Rotation', zone: 'tspine', type: 'angle',
    sides: 'both', refDeg: 50, core: true,
    placement: 'Vierfüßler, Hand am Hinterkopf, Handy am Ellbogen/Oberarm.',
    movement: 'Ellbogen nach oben/außen rotieren (Brustwirbelsäule dreht).',
  },
  {
    id: 'shoulder_external_rotation', name: 'Schulter-Außenrotation', zone: 'shoulders', type: 'range',
    sides: 'both', videoSlug: 'test-shoulder-external-rotation', sports: ['strength', 'swim'],
    placement: 'Oberarm am Körper, Ellbogen 90°.',
    movement: 'Schieb den Regler bis zu deiner maximalen Außenrotation (Unterarm nach außen, Ellbogen bleibt am Körper).',
  },
  {
    id: 'overhead_wall', name: 'Overhead an der Wand', zone: 'shoulders', type: 'range',
    sides: 'both', videoSlug: 'test-overhead', sports: ['strength', 'swim'],
    placement: 'Rücken an der Wand, unterer Rücken bleibt an der Wand.',
    movement: 'Schieb den Regler bis dorthin, wo du die gestreckten Arme maximal über den Kopf führen kannst.',
  },
  {
    id: 'wrist_extension', name: 'Handgelenk-Streckung', zone: 'wrist', type: 'range',
    sides: 'both', videoSlug: 'test-wrist-extension', sports: ['strength'],
    placement: 'Unterarm waagerecht aufgestützt.',
    movement: 'Schieb den Regler bis zu deiner maximalen Handgelenk-Streckung (Hand nach oben).',
  },
  {
    id: 'single_leg_balance', name: 'Einbeinstand (Balance)', zone: 'balance', type: 'time',
    sides: 'both', refSec: 45, core: true,
    placement: 'Handy in die Hand/Hosentasche (läuft nur als Stoppuhr).',
    movement: 'Auf einem Bein stehen, Augen offen. Stoppe, sobald du das Gleichgewicht verlierst.',
  },
  {
    id: 'single_leg_squat', name: 'Einbein-Kniebeuge (Kontrolle)', zone: 'balance', type: 'range',
    sides: 'both', videoSlug: 'test-single-leg-squat', core: true,
    placement: 'Auf einem Bein, frei stehend.',
    movement: 'Schieb den Regler bis zu der Tiefe, die du einbeinig kontrolliert schaffst (Knie über dem Fuß, kein Einknicken).',
  },
];

// Zusatz-Zonen NUR für Katalog-Inhalte/Labels (Stretching/Recovery/Warmup/Nacken) —
// werden NICHT bewertet (kein Test, keine Score-Bar). Nur für getZone()-Labels im Player.
export const EXTRA_ZONES = {
  neck:     { id: 'neck',     label: 'Nacken' },
  fullbody: { id: 'fullbody', label: 'Ganzkörper' },
  recovery: { id: 'recovery', label: 'Regeneration' },
  breath:   { id: 'breath',   label: 'Atmung & Entspannung' },
};

const TEST_BY_ID = MOBILITY_TESTS.reduce((m, t) => { m[t.id] = t; return m; }, {});
export const getTest = (id) => TEST_BY_ID[id] || null;
export const getZone = (id) => MOBILITY_ZONES[id] || EXTRA_ZONES[id] || null;

/** 0..100 für eine Einzelmessung (Winkel vs. refDeg ODER Haltezeit vs. refSec). */
export function scoreTest(testId, measured) {
  const t = getTest(testId);
  if (!t || !(measured > 0)) return 0;
  const ref = t.type === 'time' ? (t.refSec || 30) : t.type === 'range' ? 100 : t.type === 'rating' ? (t.refRating || 5) : (t.refDeg || 90);
  return Math.max(0, Math.min(100, Math.round((measured / ref) * 100)));
}

/**
 * Sportartspezifische Test-Auswahl: Core-Tests immer + Tests, die zu den
 * Sportarten des Athleten passen (triathlon ⇒ run+bike+swim). Ohne Sportarten:
 * alle Tests.
 * @param {string[]} sports - user.sportTypes
 */
export function testsForProfile(sports) {
  const norm = new Set(Array.isArray(sports) ? sports : []);
  if (norm.has('triathlon')) { norm.add('run'); norm.add('bike'); norm.add('swim'); }
  if (norm.size === 0) return MOBILITY_TESTS;
  // Union der für die Sportarten relevanten Zonen → deckt alle Sportarten + Kombis ab
  const zones = new Set();
  norm.forEach(sp => mobilityZonesForSport(sp).forEach(z => zones.add(z)));
  return MOBILITY_TESTS.filter(t => t.core || zones.has(t.zone));
}

// Schnell-Check (wöchentlich): Kern-Stabilität + Verletzungs-Indikatoren (Knie/Knöchel/
// hintere Kette/Balance). Voll-Check (testsForProfile) seltener, alle 4–6 Wochen.
export const QUICK_TEST_IDS = ['ankle_dorsiflexion', 'forward_bend', 'single_leg_balance', 'single_leg_squat'];

/**
 * Schnell-Check-Tests: feste Kern-Tests + optional EIN Test der schwächsten Zone aus
 * dem letzten Voll-Check (falls nicht ohnehin abgedeckt und zur Sportart passend).
 * @param {string[]} sports - user.sportTypes
 * @param {Object|null} byZone - byZone des letzten Ergebnisses (für gezielten Zusatz-Test)
 */
export function quickTestsForProfile(sports, byZone = null) {
  const base = MOBILITY_TESTS.filter(t => QUICK_TEST_IDS.includes(t.id));
  if (byZone && Object.keys(byZone).length) {
    const covered = new Set(base.map(t => t.zone));
    const profileTests = testsForProfile(sports);
    for (const weak of weakestZones(byZone, 2)) {
      if (covered.has(weak)) continue;
      const extra = profileTests.find(t => t.zone === weak && !QUICK_TEST_IDS.includes(t.id));
      if (extra) { base.push(extra); break; } // max. eine Zusatz-Zone
    }
  }
  return base;
}

/**
 * Aggregiert Roh-Ergebnisse zu Score gesamt + je Zone + je Test.
 * @param {Object} results - { [testId]: { left?, right?, value? } }  (Grad)
 * @returns {{ overall:number, byZone:Object, byTest:Object }}
 */
export function computeMobilityScore(results) {
  const byTest = {};
  for (const t of MOBILITY_TESTS) {
    const r = results?.[t.id];
    if (!r) continue;
    let scores = [];
    if (t.sides === 'both') {
      if (r.left != null) scores.push(scoreTest(t.id, r.left));
      if (r.right != null) scores.push(scoreTest(t.id, r.right));
    } else if (r.value != null) {
      scores.push(scoreTest(t.id, r.value));
    }
    if (scores.length) byTest[t.id] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  // Zonen-Mittel
  const zoneAcc = {};
  for (const t of MOBILITY_TESTS) {
    if (byTest[t.id] == null) continue;
    (zoneAcc[t.zone] = zoneAcc[t.zone] || []).push(byTest[t.id]);
  }
  const byZone = {};
  Object.entries(zoneAcc).forEach(([z, arr]) => { byZone[z] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length); });
  const zoneVals = Object.values(byZone);
  const overall = zoneVals.length ? Math.round(zoneVals.reduce((a, b) => a + b, 0) / zoneVals.length) : 0;
  return { overall, byZone, byTest };
}

/** Schwächste Zonen (für KI-Flow-Fokus), aufsteigend nach Score. */
export function weakestZones(byZone, n = 2) {
  return Object.entries(byZone || {})
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
    .map(([z]) => z);
}
