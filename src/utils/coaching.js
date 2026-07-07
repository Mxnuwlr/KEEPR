/**
 * utils/coaching.js — Personalisierte Coaching-Engine
 *
 * Berechnet täglich angepasste Kalorien- und Makroziele basierend auf:
 *   - Schlaf & Erholung (sleepHours, sleepQuality)
 *   - Stresslevel (Cortisol → weniger Defizit)
 *   - Trainingsintensität (Ruhetag vs. Trainingstag, Carb Loading)
 *   - Gewichts-Trend vs. Ziel (zu schnelles / zu langsames Abnehmen)
 *
 * Exports:
 *   calculateDailyTargets()     — Kalorien + Makros für heute
 *   buildMealPlanContext()      — Kontext-String für Gemini
 *   classifyTrainingIntensity() — Session → 'easy'|'medium'|'hard'
 *   getTrainingDayLabel()       — Lesbares Label
 *   getTrainingDayColor()       — Theme-Farbe
 */

/**
 * Berechnet personalisierte Tagesziele.
 *
 * @param {object} user            - Nutzerprofil (calorieGoal, goal, weight, dietType)
 * @param {object|null} dailyCtx   - Tages-Check-in { sleepHours, stressLevel, energyLevel }
 * @param {number|null} weightTrend - Gewicht kg/Woche (negativ = Abnehmen)
 * @param {'rest'|'easy'|'medium'|'hard'|'race'} trainingType
 * @param {object|null} [trainingStatus] - analyzeTrainingStatus()-Ergebnis (Wiedereinstieg, Belastungslevel, Ermüdung)
 * @returns {CoachingTargets}
 */
// ── Live-Kalorienbedarf aus dem Profil (Harris-Benedict + Ziel) ───────────────
const ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, extreme: 1.9 };
const GOAL_ADJUSTMENTS = { lose: -500, gain: 300, muscle: -200, maintain: 0, triathlon: 200, race: 150, fitness: 0 };

function _bmr(weight, height, age, gender) {
  if (!weight || !height || !age) return null;
  if (gender === 'female') return 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
  return 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
}

/**
 * Berechnet das Basis-Kalorienziel LIVE aus dem aktuellen Profil
 * (Gewicht, Größe, Alter, Geschlecht, Aktivität, Ziel). Gibt null zurück,
 * wenn Pflichtangaben (Gewicht/Größe/Alter) fehlen.
 * Liest sowohl camelCase- als auch snake_case-Felder.
 */
export function calcCalorieGoalFromProfile(user) {
  if (!user) return null;
  const weight = Number(user.weight);
  const height = Number(user.height);
  const age = Number(user.age);
  const gender = user.gender;
  const activity = user.activityLevel || user.activity_level || 'moderate';
  const bmr = _bmr(weight, height, age, gender);
  if (!bmr) return null;
  const tdee = bmr * (ACTIVITY_FACTORS[activity] || 1.55);
  const goals = typeof user.goal === 'string'
    ? user.goal.split(',').map(g => g.trim()).filter(Boolean)
    : (Array.isArray(user.goal) ? user.goal : []);
  const adj = goals.length
    ? goals.reduce((s, g) => s + (GOAL_ADJUSTMENTS[g] || 0), 0) / goals.length
    : 0;
  return Math.round(Math.max(1200, tdee + adj));
}

/**
 * Geglättetes Körpergewicht (EWMA vom Server) für stabile Berechnungen.
 * Verhindert, dass einzelne Tagesschwankungen TDEE/Makros/Wasser verfälschen.
 * Fallback: letzte Messung → Profilgewicht.
 */
export function getSmoothedWeight(weightAnalysis, user) {
  return Number(weightAnalysis?.ewmaCurrent)
    || Number(weightAnalysis?.currentWeight)
    || Number(user?.weight)
    || null;
}

/**
 * Wettkampf-Kontext aus den competitionGoals des Nutzers.
 * Robust gegen doppelt-JSON-kodierte Felder.
 * @returns {{ isRaceToday:boolean, daysUntilNextRace:number|null, nextRace:object|null }}
 */
export function getRaceContext(user, dateStr) {
  let arr = [];
  try {
    let raw = user?.competitionGoals ?? user?.competition_goals;
    if (typeof raw === 'string') { raw = JSON.parse(raw); if (typeof raw === 'string') raw = JSON.parse(raw); }
    if (Array.isArray(raw)) arr = raw.filter(c => c && c.date);
  } catch (e) { arr = []; }
  const today = dateStr || new Date().toISOString().split('T')[0];
  const t0 = new Date(today + 'T00:00:00').getTime();
  let isRaceToday = false, daysUntilNextRace = null, nextRace = null;
  for (const c of arr) {
    const t = new Date(c.date + 'T00:00:00').getTime();
    if (isNaN(t)) continue;
    const days = Math.round((t - t0) / 86400000);
    if (days === 0) isRaceToday = true;
    if (days >= 0 && (daysUntilNextRace === null || days < daysUntilNextRace)) { daysUntilNextRace = days; nextRace = c; }
  }
  return { isRaceToday, daysUntilNextRace, nextRace };
}

export function calculateDailyTargets(user, dailyCtx, weightTrend, trainingType = 'rest', trainingStatus = null, activityCalories = null, carbLoadingActive = false) {
  // Basis-Kalorienziel LIVE aus aktuellem Profil (passt sich an Gewichtsänderungen an);
  // Fallback: gespeichertes Ziel, sonst 2000.
  const baseCalories = calcCalorieGoalFromProfile(user) || user?.calorieGoal || 2000;
  const goal        = user?.goal || 'maintain';
  const dietType    = user?.dietType || 'omnivore';
  const weight      = user?.weight || 75;

  // ── Trainings-Bonus ──────────────────────────────────────────────────
  const bonusByType = { rest: 0, easy: 100, medium: 260, hard: 460, race: 660 };
  // Gemessen = tatsächlich an diesem Tag verbrannte Trainings-kcal (aus geloggten
  // Aktivitäten/Einheiten). Hat Vorrang vor der groben Schätzung pro Trainingstyp.
  const measured = (typeof activityCalories === 'number' && activityCalories > 0) ? Math.round(activityCalories) : null;
  let trainingBonus = measured != null ? measured : (bonusByType[trainingType] ?? 0);
  const isTrainingDay  = trainingType !== 'rest' || (measured != null && measured > 0);
  const isCarboLoading = trainingType === 'hard' || trainingType === 'race' || carbLoadingActive;
  const usingMeasured  = measured != null;

  // ── Trainingsstatus-Anpassung (Wiedereinstieg, Belastung, Ermüdung) ───
  let statusNote = null;
  if (usingMeasured) {
    // Bonus basiert bereits auf realem Verbrauch → keine groben Korrekturen,
    // nur bei Ermüdung etwas mehr für die Erholung.
    if (trainingStatus?.tsbStatus === 'ermuedet') {
      trainingBonus += 80;
      statusNote = 'Erhöhte Ermüdung – etwas mehr Kalorien zur Erholung';
    } else {
      statusNote = 'Kalorien an tatsächlich verbranntes Trainingsvolumen angepasst';
    }
  } else if (trainingStatus?.isReturningFromBreak && trainingType !== 'rest') {
    // Körper ist nach einer Pause noch nicht an hohe Last adaptiert: Bonus deckeln,
    // dafür Zuschlag für Regeneration/Muskelreparatur beim Wiedereinstieg.
    trainingBonus = Math.min(trainingBonus, bonusByType.easy) + 100;
    statusNote = 'Wiedereinstieg nach Pause – Trainingsbonus angepasst, zusätzliche Kalorien für Regeneration';
  } else if (trainingStatus?.loadLevel === 'niedrig' && (trainingType === 'medium' || trainingType === 'hard')) {
    trainingBonus = Math.round(trainingBonus * 0.8);
    statusNote = 'Geringes Trainingsvolumen zuletzt – Bonus leicht reduziert';
  } else if (trainingStatus?.tsbStatus === 'ermuedet') {
    trainingBonus += 80;
    statusNote = 'Erhöhte Ermüdung – etwas mehr Kalorien zur Erholung';
  }

  // ── Schlaf-Faktor ────────────────────────────────────────────────────
  const sleep = dailyCtx?.sleepHours ?? 7;
  let sleepMultiplier = 1.0;
  let sleepNote = null;
  if (sleep <= 5) {
    sleepMultiplier = 0.97;
    sleepNote = `Wenig Schlaf (${sleep}h) – leicht reduziertes Ziel`;
  } else if (sleep >= 9) {
    sleepMultiplier = 1.01;
    sleepNote = `Top erholt (${sleep}h) – leicht erhöhtes Ziel`;
  }

  // ── Stress-Anpassung ─────────────────────────────────────────────────
  // Hoher Cortisol → weniger Defizit verhindert Muskelabbau
  const stress = dailyCtx?.stressLevel ?? 3;
  let stressBonus = 0;
  let stressNote  = null;
  if (stress >= 4) {
    stressBonus = 160;
    stressNote  = 'Hoher Stress – Kalorienziel angehoben (Cortisol)';
  } else if (stress === 3) {
    stressBonus = 50;
  }

  // ── Gewichts-Trend-Anpassung ─────────────────────────────────────────
  let trendBonus = 0;
  let trendNote  = null;
  if (weightTrend !== null && weightTrend !== undefined) {
    if (goal === 'lose') {
      if (weightTrend < -1.0) {
        trendBonus = 300;
        trendNote  = 'Abnehmen zu schnell (>' + Math.abs(weightTrend).toFixed(1) + 'kg/W) – mehr Kalorien';
      } else if (weightTrend < -0.8) {
        trendBonus = 150;
        trendNote  = 'Leicht zu schnell abnehmend – Kalorien leicht erhöht';
      } else if (weightTrend > 0.15) {
        trendBonus = -150;
        trendNote  = 'Kein Fortschritt sichtbar – Kalorien leicht reduziert';
      }
    } else if (goal === 'gain' || goal === 'muscle') {
      if (weightTrend < 0.15) {
        trendBonus = 250;
        trendNote  = 'Zu langsamer Aufbau – Kalorien erhöht';
      }
    }
  }

  // ── Readiness / Energie (Oura-Readiness + Check-in-Energie) ──────────────
  // Niedrige Erholung → etwas mehr Kalorien für Regeneration (Training wird separat leichter).
  const readiness = dailyCtx?.readiness ?? null;
  const energy    = dailyCtx?.energyLevel ?? null;
  let recoveryBonus = 0;
  let recoveryNote  = null;
  if (readiness != null && readiness < 70) {
    recoveryBonus = readiness < 55 ? 150 : 80;
    recoveryNote  = `Niedrige Readiness (${Math.round(readiness)}) – mehr Kalorien zur Erholung`;
  } else if (energy != null && energy <= 2) {
    recoveryBonus = 80;
    recoveryNote  = 'Niedrige Energie – etwas mehr Kalorien zur Erholung';
  }

  const rawCalories    = baseCalories + trainingBonus + stressBonus + trendBonus + recoveryBonus;
  const totalCalories  = Math.max(1200, Math.round(rawCalories * sleepMultiplier));

  // ── Makro-Split ──────────────────────────────────────────────────────
  let carbRatio, proteinRatio, fatRatio;
  if (dietType === 'keto') {
    carbRatio = 0.05; proteinRatio = 0.25; fatRatio = 0.70;
  } else if (trainingType === 'hard' || trainingType === 'race' || carbLoadingActive) {
    carbRatio = 0.45; proteinRatio = 0.28; fatRatio = 0.27; // Carb Loading
  } else if (trainingType === 'medium') {
    carbRatio = 0.40; proteinRatio = 0.30; fatRatio = 0.30;
  } else if (trainingType === 'easy') {
    carbRatio = 0.37; proteinRatio = 0.32; fatRatio = 0.31;
  } else {
    // Ruhetag: weniger Carbs, mehr Protein + Fett
    carbRatio = 0.30; proteinRatio = 0.35; fatRatio = 0.35;
  }

  // Mindest-Protein: 1.9g/kg Körpergewicht
  const minProtein  = Math.round(weight * 1.9);
  const calcProtein = Math.round((totalCalories * proteinRatio) / 4);
  const protein     = Math.max(minProtein, calcProtein);
  let   carbs       = Math.round((totalCalories * carbRatio) / 4);
  const fat         = Math.round((totalCalories * fatRatio) / 9);
  let   calories    = totalCalories;

  // ── Carb-Loading: Kohlenhydrat-Untergrenze ~6 g/kg (Glykogenspeicher füllen) ──
  // Echtes Loading bemisst sich an g/kg, nicht an Prozenten. Der Mehrbedarf kommt
  // ausschließlich aus Kohlenhydraten — die Kalorien steigen genau entsprechend mit.
  if (isCarboLoading && dietType !== 'keto') {
    const carbFloor = Math.round(weight * 6);
    if (carbs < carbFloor) {
      calories += (carbFloor - carbs) * 4;
      carbs = carbFloor;
    }
  }

  const carbNote = (carbLoadingActive && trainingType !== 'hard' && trainingType !== 'race')
    ? 'Carb-Loading aktiv – Kohlenhydrate erhöht zur Vorbereitung'
    : null;
  const adjustmentReasons = [sleepNote, stressNote, trendNote, statusNote, recoveryNote, carbNote].filter(Boolean);

  return {
    calories,
    protein,
    carbs,
    fat,
    trainingBonus,
    stressBonus,
    trendBonus,
    sleepMultiplier,
    isTrainingDay,
    isCarboLoading,
    trainingType,
    adjustmentReasons,
    baseCalories,
    loadLevel: trainingStatus?.loadLevel ?? null,
  };
}

/**
 * Kontext-String für den Gemini Meal Plan Prompt.
 * Beschreibt den Nutzertag so, dass die KI passende Mahlzeiten erstellt.
 *
 * @param {object|null} dailyCtx
 * @param {CoachingTargets} targets
 * @param {'rest'|'easy'|'medium'|'hard'|'race'} trainingType
 * @returns {string}
 */
export function buildMealPlanContext(dailyCtx, targets, trainingType) {
  const parts = [];

  if (trainingType === 'hard' || trainingType === 'race') {
    parts.push('WICHTIG: Heute ist ein intensiver Trainings-/Wettkampftag — Carb Loading notwendig. Kohlenhydrat-reiche Mahlzeiten bevorzugen (Pasta, Reis, Kartoffeln, Haferflocken, Bananen). Fettarme Mahlzeiten vor dem Training.');
  } else if (trainingType === 'medium') {
    parts.push('Heute ist ein moderater Trainingstag. Ausgewogene Mahlzeiten mit gutem Kohlenhydratanteil und ausreichend Protein für Muskelregeneration.');
  } else if (trainingType === 'easy') {
    parts.push('Heute ist ein leichter Trainingstag. Leichte, gut verträgliche Mahlzeiten. Proteinreich für Regeneration.');
  } else {
    parts.push('Heute ist ein Ruhetag. Weniger Kohlenhydrate, mehr Protein und gesunde Fette (Fisch, Avocado, Nüsse). Leichtere Abendmahlzeit.');
  }

  const sleep = dailyCtx?.sleepHours;
  if (sleep && sleep <= 6) {
    parts.push('Wenig Schlaf — magnesiumreiche und entzündungshemmende Zutaten einbauen (Blattgemüse, Walnüsse, Lachs, Kurkuma).');
  }

  const stress = dailyCtx?.stressLevel;
  if (stress && stress >= 4) {
    parts.push('Hoher Stressday — beruhigende, nährstoffreiche Lebensmittel (Haferflocken, dunkle Schokolade, Kamillentee, Omega-3-Quellen).');
  }

  parts.push(`Angepasstes Kalorienziel: ${targets.calories} kcal. Makroziele: ${targets.protein}g Protein, ${targets.carbs}g Kohlenhydrate, ${targets.fat}g Fett.`);

  if (targets.isCarboLoading) {
    parts.push('Größere Kohlenhydrat-Portionen sind ausdrücklich erwünscht — kein Kaloriensparen bei Pasta/Reis/Brot.');
  }

  return parts.join(' ');
}

/**
 * Klassifiziert eine Kraft-Session nach Intensität.
 *
 * @param {object} session - KraftStore Session (total_volume_kg, total_sets, duration_seconds)
 * @returns {'easy'|'medium'|'hard'}
 */
export function classifyTrainingIntensity(session) {
  if (!session) return 'rest';
  const volume   = session.total_volume_kg || 0;
  const duration = (session.duration_seconds || 0) / 60;
  const sets     = session.total_sets || 0;

  if (volume > 5000 || sets > 25 || duration > 75) return 'hard';
  if (volume > 1800 || sets > 14 || duration > 38) return 'medium';
  return 'easy';
}

// ── Überlastungs-/Konflikt-Erkennung (muskel-/systembasiert) ──────────────────
const _LEG_KEYWORDS = ['bein', 'leg', 'squat', 'kniebeug', 'kreuzheb', 'deadlift', 'unterkörper', 'unterkoerper', 'wade', 'lunge', 'ausfallschritt', 'hüfte', 'hamstring', 'quad'];
const _HARD_ZONES = ['Z3', 'Z4', 'Z5', 'GA2', 'EB', 'SB', 'hoch', 'intensiv'];

/** Bewertet die Belastung einer Einheit: belastet sie die Beine/Stoß-System hart? */
function _sessionLegLoad(s) {
  if (!s || s.is_rest) return false;
  const sport = s.sport_type;
  const focus = (s.focus || '').toLowerCase();
  const z = s.intensity;
  const dur = s.duration || 0;
  const hardZone = z && _HARD_ZONES.includes(z);
  const isRun = ['run', 'trail_run', 'treadmill', 'triathlon'].includes(sport);
  const isLegStrength = (sport === 'strength' || sport === 'crossfit' || sport === 'hyrox') && _LEG_KEYWORDS.some(k => focus.includes(k));
  const isBikeHard = ['bike', 'mtb', 'gravel', 'indoor_bike'].includes(sport) && hardZone;
  // Lauf zählt als Bein-/Stoßbelastung, wenn hart ODER lang (>=75 Min)
  const isHardRun = isRun && (hardZone || dur >= 75);
  return isHardRun || isLegStrength || isBikeHard;
}

/**
 * Findet Überlastungs-Konflikte in einer Wochen-Sessionliste:
 * zwei aufeinanderfolgende Tage, die beide die Beine/das Stoß-System hart belasten.
 * @param {Array} sessions - trainingPlan.sessions
 * @returns {Array<{dayA:number, dayB:number, message:string}>}
 */
export function detectTrainingConflicts(sessions) {
  const DAY = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const byDay = {};
  (sessions || []).forEach(s => { const d = s.day_index; (byDay[d] = byDay[d] || []).push(s); });
  const legDay = (d) => (byDay[d] || []).some(_sessionLegLoad);
  const conflicts = [];
  for (let d = 0; d < 6; d++) {
    if (legDay(d) && legDay(d + 1)) {
      conflicts.push({ dayA: d, dayB: d + 1, message: `${DAY[d]} und ${DAY[d + 1]} belasten beide die Beine hart — zu wenig Erholung dazwischen.` });
    }
  }
  return conflicts;
}

/**
 * Dynamisches Wasserziel: ~35 ml/kg Basis + Trainingszuschlag (Schweißverlust).
 * @param {object} user
 * @param {'rest'|'easy'|'medium'|'hard'|'race'} trainingType
 * @returns {number} ml (auf 50 ml gerundet)
 */
export function calcWaterGoal(user, trainingType = 'rest') {
  const w = user?.weight || 75;
  const add = { rest: 0, easy: 400, medium: 700, hard: 1000, race: 1200 }[trainingType] ?? 0;
  return Math.round((w * 35 + add) / 50) * 50;
}

/** Lesbares Label für Trainingstyp */
export function getTrainingDayLabel(trainingType) {
  return { rest: 'Ruhetag', easy: 'Leichtes Training', medium: 'Moderates Training', hard: 'Intensives Training', race: 'Wettkampf' }[trainingType] || 'Ruhetag';
}

/** Theme-Farbe für Trainingstyp */
export function getTrainingDayColor(trainingType, C) {
  return { rest: C.textTertiary, easy: C.success, medium: C.warning, hard: C.danger, race: C.tint }[trainingType] || C.textTertiary;
}

/**
 * Leitet den Trainingstyp eines Plan-Tages ab (höchste Intensität/Belastung des Tages).
 * @param {object|null} trainingPlan - store.trainingPlan (mit sessions[])
 * @param {number} dayIndex - 0=Mo … 6=So
 * @returns {'rest'|'easy'|'medium'|'hard'}
 */
export function planDayType(trainingPlan, dayIndex) {
  const sessions = (trainingPlan?.sessions || []).filter(s => s.day_index === dayIndex && !s.is_rest);
  if (sessions.length === 0) return 'rest';
  const rank = { easy: 1, medium: 2, hard: 3 };
  let best = 'easy';
  for (const s of sessions) {
    let t;
    const z = s.intensity;
    if (z === 'Z5' || z === 'Z4' || z === 'SB' || z === 'EB' || z === 'hoch') t = 'hard';
    else if (z === 'Z3' || z === 'GA2' || z === 'mittel') t = 'medium';
    else if (z === 'Z1' || z === 'Z2' || z === 'GA1' || z === 'leicht') t = 'easy';
    else t = (s.duration || 0) >= 90 ? 'medium' : 'easy';
    if (rank[t] > rank[best]) best = t;
  }
  return best;
}

/**
 * Ermittelt, ob Carb-Loading sinnvoll ist — heute (intensive Einheit) oder
 * vorbereitend (morgen intensive Einheit / Wettkampf).
 *
 * @param {'rest'|'easy'|'medium'|'hard'|'race'} todayType
 * @param {'rest'|'easy'|'medium'|'hard'|'race'} [nextDayType]
 * @returns {{active:boolean, scope:'today'|'tomorrow', title:string, message:string}|null}
 */
export function getCarbLoadingStatus(todayType, nextDayType) {
  const intense = (t) => t === 'hard' || t === 'race';
  if (intense(todayType)) {
    return {
      active: true,
      scope: 'today',
      title: 'Carb-Loading heute',
      message: 'Intensive Einheit heute — Kohlenhydratspeicher hoch halten: Pasta, Reis, Kartoffeln, Haferflocken, Bananen. Vor der Einheit eher fettarm essen.',
    };
  }
  if (intense(nextDayType)) {
    return {
      active: true,
      scope: 'tomorrow',
      title: 'Carb-Loading für morgen',
      message: 'Morgen steht eine intensive Einheit/ein Wettkampf an — heute die Kohlenhydratspeicher auffüllen und ausreichend trinken.',
    };
  }
  return null;
}
