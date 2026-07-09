/**
 * connectedData.js — Geräte-Fakten haben Vorrang vor manueller Eingabe.
 *
 * Ermittelt aus den verbundenen Quellen (Garmin > Oura), welche Tageswerte
 * automatisch kommen. Wo eine Quelle den Wert liefert, soll die UI das manuelle
 * Feld sperren/verstecken und den echten Wert verwenden.
 *
 * Garmin-Felder sind vorbereitet (Sync folgt nach Garmin-API-Freigabe); aktuell
 * liefert nur Oura. Erwartete Garmin-Form (später im Sync zu befüllen):
 *   { sleepHours, stress (0-100), bodyBattery (0-100), restingHr }
 */

const round1 = (n) => Math.round(n * 10) / 10;

// Garmin-Stress 0–100 → Check-in-Skala 1–5
function stressTo5(s) {
  if (s == null) return null;
  if (s <= 25) return 1;
  if (s <= 40) return 2;
  if (s <= 60) return 3;
  if (s <= 75) return 4;
  return 5;
}

export function resolveConnectedMetrics(externalData) {
  const oura = externalData?.oura || null;
  const garmin = externalData?.garmin || null;
  // intervals.icu liefert (via Garmin-Sync) Ruhepuls, HRV, Schlaf, VO2max, Schritte
  const iv = externalData?.intervals || null;
  const r = {
    sleepHours: null, sleepSource: null,
    stressLevel: null, stressSource: null,
    readiness: null, readinessSource: null,
    restingHr: null, restingHrSource: null,
    hrv: null, hrvSource: null,
  };

  // Schlaf (Stunden) — Garmin zuerst, sonst intervals.icu, sonst Oura
  if (garmin?.sleepHours != null) { r.sleepHours = round1(garmin.sleepHours); r.sleepSource = 'Garmin'; }
  else if (iv?.sleepHours != null) { r.sleepHours = round1(iv.sleepHours); r.sleepSource = 'intervals.icu'; }
  else if (oura?.avgSleepHours) { r.sleepHours = round1(oura.avgSleepHours / 3600); r.sleepSource = 'Oura'; }
  else if (oura?.sleepHours != null) { r.sleepHours = round1(oura.sleepHours); r.sleepSource = 'Oura'; }

  // Stress (1–5) — nur Garmin misst das
  if (garmin?.stress != null) { r.stressLevel = stressTo5(garmin.stress); r.stressSource = 'Garmin'; }

  // Erholung/Readiness — Garmin Body Battery, sonst Oura, sonst intervals Schlaf-Score
  if (garmin?.bodyBattery != null) { r.readiness = Math.round(garmin.bodyBattery); r.readinessSource = 'Garmin'; }
  else if (oura?.readinessScore != null) { r.readiness = Math.round(oura.readinessScore); r.readinessSource = 'Oura'; }
  else if (iv?.sleepScore != null) { r.readiness = Math.round(iv.sleepScore); r.readinessSource = 'intervals.icu'; }

  // Ruhepuls — Garmin, intervals.icu, dann Oura
  if (garmin?.restingHr != null) { r.restingHr = Math.round(garmin.restingHr); r.restingHrSource = 'Garmin'; }
  else if (iv?.restingHr != null) { r.restingHr = Math.round(iv.restingHr); r.restingHrSource = 'intervals.icu'; }
  else if (oura?.restingHr != null) { r.restingHr = Math.round(oura.restingHr); r.restingHrSource = 'Oura'; }

  // HRV
  if (iv?.hrv != null) { r.hrv = Math.round(iv.hrv); r.hrvSource = 'intervals.icu'; }
  else if (oura?.hrv != null) { r.hrv = Math.round(oura.hrv); r.hrvSource = 'Oura'; }

  return r;
}
