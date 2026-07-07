/**
 * recovery.js — Einheitliche Erholungs-Bewertung ("Recovery-Coaching")
 *
 * Bündelt alle vorhandenen Erholungs-Signale (Schlaf, Oura-Readiness, Energie aus
 * dem Check-in, Muskelkater, Stress, TSB-Ermüdung) zu EINEM Status. Daraus steuern
 * sich:
 *   - Training: heutige Einheit leichter machen (easeFactor + EASE_INSTRUCTION → KI-Regenerate)
 *   - Mobility: Recovery-Flow vorschlagen (suggestRecoveryFlow)
 *   - UI: Banner auf Home / Training / Mobility (summaryDe + reasons)
 *
 * Kalorien werden bereits in coaching.js (Readiness/Energie/Ermüdung) angepasst —
 * hier geht es um Trainings-Last + Empfehlung, nicht um kcal.
 *
 * assessRecovery({ dailyContext, externalData, trainingStatus }) → {
 *   level: 'good' | 'moderate' | 'poor',
 *   easeFactor: 1.0 | 0.8 | 0.6,        // Faktor zum Herunterskalieren der Last
 *   reasons: string[],                   // kurze Gründe fürs UI
 *   summaryDe: string,
 *   suggestRecoveryFlow: bool,
 *   poor / moderate: bool,
 *   hasData: bool,
 * }
 */

const fmtH = (h) => {
  const r = Math.round(h * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ',');
};

export function assessRecovery({ dailyContext = null, externalData = null, trainingStatus = null } = {}) {
  const oura = externalData?.oura || null;
  const readiness = dailyContext?.readiness ?? oura?.readinessScore ?? null;     // 0-100
  const sleepH    = dailyContext?.sleepHours ?? oura?.sleepHours ?? null;        // Stunden
  const energy    = dailyContext?.energyLevel ?? null;                           // 1-5
  const soreness  = dailyContext?.soreness ?? null;                             // 1-5
  const stress    = dailyContext?.stressLevel ?? null;                          // 1-5
  const tsbStatus = trainingStatus?.tsbStatus ?? null;                          // 'ermuedet' | ...

  let penalty = 0;
  const reasons = [];

  if (sleepH != null) {
    if (sleepH < 5)        { penalty += 3; reasons.push(`Nur ${fmtH(sleepH)} h Schlaf`); }
    else if (sleepH < 6.5) { penalty += 2; reasons.push(`Wenig Schlaf (${fmtH(sleepH)} h)`); }
  }
  if (readiness != null) {
    if (readiness < 55)      { penalty += 3; reasons.push(`Readiness niedrig (${Math.round(readiness)})`); }
    else if (readiness < 70) { penalty += 2; reasons.push(`Readiness mäßig (${Math.round(readiness)})`); }
  }
  if (soreness != null) {
    if (soreness >= 4)      { penalty += 2; reasons.push('Starker Muskelkater'); }
    else if (soreness === 3) { penalty += 1; reasons.push('Muskelkater'); }
  }
  if (energy != null && energy <= 2) { penalty += 2; reasons.push('Niedrige Energie'); }
  if (stress != null && stress >= 4) { penalty += 1; reasons.push('Hoher Stress'); }
  if (tsbStatus === 'ermuedet')      { penalty += 2; reasons.push('Ermüdung (TSB negativ)'); }

  let level, easeFactor, summaryDe;
  if (penalty >= 5)      { level = 'poor';     easeFactor = 0.6; summaryDe = 'Schlecht erholt – heute deutlich lockerer'; }
  else if (penalty >= 3) { level = 'moderate'; easeFactor = 0.8; summaryDe = 'Mäßig erholt – heute etwas zurücknehmen'; }
  else                   { level = 'good';     easeFactor = 1.0; summaryDe = 'Gut erholt'; }

  return {
    level, easeFactor, reasons, summaryDe,
    suggestRecoveryFlow: level === 'poor',
    poor: level === 'poor',
    moderate: level === 'moderate',
    hasData: sleepH != null || readiness != null || energy != null || soreness != null,
  };
}

/** Anweisung an die KI, eine geplante Einheit regenerativ/leichter zu gestalten. */
export const EASE_INSTRUCTION =
  'Der Athlet ist heute schlecht erholt (z.B. wenig Schlaf, niedrige Readiness, Muskelkater oder Ermüdung). ' +
  'Mache diese Einheit deutlich LEICHTER und regenerativ: Sportart und Fokus beibehalten, aber Intensität klar ' +
  'reduzieren (überwiegend Z1–Z2, keine harten Intervalle/keine Maximalkraft), Umfang etwas kürzen, mehr Pausen. ' +
  'Die Einheit soll die Erholung unterstützen, nicht zusätzlich belasten.';
