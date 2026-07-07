/**
 * utils/trainingStatus.js — Trainingsstatus-Analyse
 *
 * Bewertet die jüngste Trainingshistorie (Kraft-Sessions + Intervals.icu),
 * um Pausen, Belastungstrends und Ermüdung zu erkennen. Das Ergebnis fließt
 * in die Coaching-Engine (Kalorienziele) und in die KI-Trainingsplan-Generierung
 * (höchste Priorität im Prompt) ein.
 *
 * Exports:
 *   analyzeTrainingStatus() — { ...status, summaryDe, promptContext }
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const BREAK_THRESHOLD_DAYS = 14;
const OVERRIDE_EXPIRY_DAYS = 21;

/**
 * @param {object} opts
 * @param {Array} [opts.kraftSessions] - useKraftStore().sessions
 * @param {object|null} [opts.externalData] - useStore().externalData ({ intervals, oura })
 * @param {{active: boolean, setAt: string|null}|null} [opts.manualOverride] - manueller "Pause beendet"-Override
 * @returns {object} Trainingsstatus inkl. summaryDe + promptContext
 */
export function analyzeTrainingStatus({ kraftSessions = [], externalData = null, manualOverride = null } = {}) {
  const now = Date.now();
  const intervals = externalData?.intervals || null;
  const oura = externalData?.oura || null;
  const readinessScore = oura?.readinessScore ?? null;
  let readinessStatus = null;
  if (readinessScore != null) {
    if (readinessScore < 65) readinessStatus = 'niedrig';
    else if (readinessScore >= 85) readinessStatus = 'hoch';
    else readinessStatus = 'normal';
  }

  // ── Letztes Training (Kraft + Intervals.icu) ──────────────────────────
  const sorted = [...(kraftSessions || [])]
    .filter(s => s?.started_at)
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

  const lastKraftDate = sorted[0]?.started_at ? new Date(sorted[0].started_at) : null;
  const lastIntervalsDate = intervals?.activities?.[0]?.start_date_local
    ? new Date(intervals.activities[0].start_date_local)
    : null;

  const candidateDates = [lastKraftDate, lastIntervalsDate].filter(Boolean);
  const lastWorkoutDate = candidateDates.length
    ? new Date(Math.max(...candidateDates.map(d => d.getTime())))
    : null;
  const daysSinceLastWorkout = lastWorkoutDate
    ? Math.floor((now - lastWorkoutDate.getTime()) / DAY_MS)
    : null;

  const hasHistory = sorted.length >= 3 || (intervals?.activityCount || 0) >= 3;

  // ── Trainingsvolumen-Trend (Kraft, 14-Tage-Fenster) ───────────────────
  const sumVolumeBetween = (fromDays, toDays) => sorted
    .filter(s => {
      const ageDays = (now - new Date(s.started_at).getTime()) / DAY_MS;
      return ageDays >= fromDays && ageDays < toDays;
    })
    .reduce((sum, s) => sum + (s.total_volume_kg || 0), 0);

  const recentVolumeKg14d = sumVolumeBetween(0, 14);
  const previousVolumeKg14d = sumVolumeBetween(14, 28);
  const recentSessionsCount14d = sorted.filter(s => (now - new Date(s.started_at).getTime()) / DAY_MS < 14).length;

  let volumeTrendPct = null;
  if (previousVolumeKg14d > 0) {
    volumeTrendPct = Math.round(((recentVolumeKg14d - previousVolumeKg14d) / previousVolumeKg14d) * 100);
  } else if (recentVolumeKg14d > 0) {
    volumeTrendPct = 100;
  }

  // ── Manueller Override (mit Ablauf nach 21 Tagen) ─────────────────────
  let overrideActive = false;
  if (manualOverride?.active) {
    if (manualOverride.setAt) {
      const ageDays = (now - new Date(manualOverride.setAt).getTime()) / DAY_MS;
      overrideActive = ageDays <= OVERRIDE_EXPIRY_DAYS;
    } else {
      overrideActive = true;
    }
  }

  // ── Pausenerkennung ────────────────────────────────────────────────────
  const isReturningFromBreak = overrideActive
    || (hasHistory && daysSinceLastWorkout != null && daysSinceLastWorkout >= BREAK_THRESHOLD_DAYS);
  const breakWeeks = daysSinceLastWorkout != null
    ? Math.max(1, Math.round(daysSinceLastWorkout / 7))
    : (overrideActive ? 4 : 0);

  // ── Intervals.icu CTL/ATL/TSB ──────────────────────────────────────────
  const ctl = intervals?.ctl ?? null;
  const atl = intervals?.atl ?? null;
  const tsb = intervals?.tsb ?? null;
  let tsbStatus = null;
  if (tsb != null) {
    if (tsb < -10) tsbStatus = 'ermuedet';
    else if (tsb > 5) tsbStatus = 'erholt';
    else tsbStatus = 'ausgeglichen';
  }

  // ── Belastungslevel (für Kalorien-Anpassung) ──────────────────────────
  let loadLevel = 'normal';
  if (!hasHistory) {
    loadLevel = 'unbekannt';
  } else if (isReturningFromBreak) {
    loadLevel = 'sehr_niedrig';
  } else if (recentSessionsCount14d <= 2) {
    loadLevel = 'niedrig';
  } else if (recentSessionsCount14d >= 8) {
    loadLevel = 'hoch';
  }

  // ── Zusammenfassung (UI) + Prompt-Kontext (KI) ────────────────────────
  let summaryDe;
  let promptContext = null;

  if (isReturningFromBreak) {
    summaryDe = `Wiedereinstieg nach ${breakWeeks} ${breakWeeks === 1 ? 'Woche' : 'Wochen'} Pause`;
    const reasonText = overrideActive && (daysSinceLastWorkout == null || daysSinceLastWorkout < BREAK_THRESHOLD_DAYS)
      ? 'vom Nutzer als Wiedereinstieg markiert'
      : `letztes Training vor ${daysSinceLastWorkout} Tagen`;
    promptContext = `WICHTIG – TRAININGSZUSTAND: Der Nutzer kommt nach ca. ${breakWeeks} ${breakWeeks === 1 ? 'Woche' : 'Wochen'} Trainingspause zurück (${reasonText}). Reduziere Volumen und Intensität in dieser Woche deutlich (ca. 50-60% des sonst üblichen Niveaus), unabhängig vom unten stehenden Wochenplan-Inhalt. Fokus auf Wiedergewöhnung, Technik und moderate Belastung. Steigere über die nächsten 2-3 Wochen schrittweise wieder Richtung Normalniveau.`;
  } else if (!hasHistory) {
    summaryDe = 'Noch keine Trainingsdaten';
  } else if (tsbStatus === 'ermuedet') {
    summaryDe = `Erhöhte Ermüdung (TSB ${Math.round(tsb)}) – Erholung empfohlen`;
    promptContext = `TRAININGSZUSTAND: Der Nutzer zeigt erhöhte Ermüdung (Training Stress Balance: ${Math.round(tsb)}). Baue eine etwas leichtere/regenerativere Woche ein als sonst üblich.`;
  } else if (volumeTrendPct != null && volumeTrendPct <= -40) {
    summaryDe = `Trainingsumfang gesunken (${volumeTrendPct}%)`;
    promptContext = `TRAININGSZUSTAND: Das Trainingsvolumen des Nutzers ist in den letzten 2 Wochen um ${Math.abs(volumeTrendPct)}% gesunken. Nicht abrupt wieder auf hohes Niveau springen, sondern moderat steigernd planen.`;
  } else if (volumeTrendPct != null && volumeTrendPct >= 20) {
    summaryDe = `Aufbauphase – Volumen +${volumeTrendPct}%`;
    promptContext = `TRAININGSZUSTAND: Der Nutzer steigert sein Trainingsvolumen aktuell (+${volumeTrendPct}% ggü. Vorwoche)${tsbStatus === 'erholt' ? ', ist gut erholt' : ''}. Eine weitere moderate Progression ist plausibel, sofern Erholung es zulässt.`;
  } else {
    summaryDe = `Stabiles Training${recentSessionsCount14d ? ` · ${recentSessionsCount14d} Einheiten/2 Wochen` : ''}`;
  }

  // Oura-Readiness als zusätzlicher Erholungs-Hinweis an die KI (überschreibt nicht,
  // sondern ergänzt den bestehenden promptContext).
  if (readinessStatus === 'niedrig') {
    const note = `ERHOLUNG: Oura-Readiness niedrig (${Math.round(readinessScore)}/100) — heute eher regenerativ/leichter trainieren.`;
    promptContext = promptContext ? `${promptContext} ${note}` : note;
  }

  return {
    readinessScore,
    readinessStatus,
    daysSinceLastWorkout,
    lastWorkoutDate,
    hasHistory,
    recentSessionsCount14d,
    recentVolumeKg14d,
    previousVolumeKg14d,
    volumeTrendPct,
    isReturningFromBreak,
    breakWeeks,
    ctl,
    atl,
    tsb,
    tsbStatus,
    loadLevel,
    summaryDe,
    promptContext,
  };
}

/** Feather-Icon für den Trainingsstatus (für Status-Badges in der UI). */
export function getTrainingStatusIcon(status) {
  if (!status) return 'activity';
  if (status.isReturningFromBreak) return 'rotate-ccw';
  if (!status.hasHistory) return 'info';
  if (status.tsbStatus === 'ermuedet') return 'battery-charging';
  if (status.volumeTrendPct != null && status.volumeTrendPct <= -40) return 'trending-down';
  if (status.volumeTrendPct != null && status.volumeTrendPct >= 20) return 'trending-up';
  return 'check-circle';
}

/** Theme-Farbe für den Trainingsstatus (für Status-Badges in der UI). */
export function getTrainingStatusColor(status, C) {
  if (!status) return C.textTertiary;
  if (status.isReturningFromBreak) return C.warning;
  if (!status.hasHistory) return C.textTertiary;
  if (status.tsbStatus === 'ermuedet') return C.warning;
  if (status.volumeTrendPct != null && status.volumeTrendPct <= -40) return C.warning;
  if (status.volumeTrendPct != null && status.volumeTrendPct >= 20) return C.success;
  return C.textTertiary;
}
