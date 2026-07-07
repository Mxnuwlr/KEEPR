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
  const r = {
    sleepHours: null, sleepSource: null,
    stressLevel: null, stressSource: null,
    readiness: null, readinessSource: null,
    restingHr: null, restingHrSource: null,
  };

  // Schlaf (Stunden) — Garmin zuerst, sonst Oura
  if (garmin?.sleepHours != null) { r.sleepHours = round1(garmin.sleepHours); r.sleepSource = 'Garmin'; }
  else if (oura?.avgSleepHours) { r.sleepHours = round1(oura.avgSleepHours / 3600); r.sleepSource = 'Oura'; }
  else if (oura?.sleepHours != null) { r.sleepHours = round1(oura.sleepHours); r.sleepSource = 'Oura'; }

  // Stress (1–5) — nur Garmin misst das
  if (garmin?.stress != null) { r.stressLevel = stressTo5(garmin.stress); r.stressSource = 'Garmin'; }

  // Erholung/Readiness (Info) — Garmin Body Battery, sonst Oura Readiness
  if (garmin?.bodyBattery != null) { r.readiness = Math.round(garmin.bodyBattery); r.readinessSource = 'Garmin'; }
  else if (oura?.readinessScore != null) { r.readiness = Math.round(oura.readinessScore); r.readinessSource = 'Oura'; }

  // Ruhepuls
  if (garmin?.restingHr != null) { r.restingHr = Math.round(garmin.restingHr); r.restingHrSource = 'Garmin'; }
  else if (oura?.restingHr != null) { r.restingHr = Math.round(oura.restingHr); r.restingHrSource = 'Oura'; }

  return r;
}
