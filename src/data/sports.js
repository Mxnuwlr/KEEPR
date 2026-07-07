/**
 * data/sports.js — Zentraler Sportarten-Katalog
 *
 * Eine einzige Quelle der Wahrheit für alle Sportarten in keepr:
 *   - Anzeige (Label DE, Icon, Farbe)
 *   - Kategorisierung (für Wochen-Review-Aufschlüsselung)
 *   - Kalorienschätzung (MET-Wert, wenn keine Geräte-Daten vorliegen)
 *   - Distanz-/Pace-Tracking-Flags (für Eingabe-Formulare)
 *
 * Icons sind MaterialCommunityIcons-Namen (wie in TrainingScreen verwendet).
 *
 * Exports:
 *   SPORTS              — Array aller Sportarten-Definitionen
 *   SPORT_CATEGORIES    — Kategorie-Metadaten (Label DE + Reihenfolge)
 *   getSport(key)       — Definition zu einem Key (Fallback: 'other')
 *   getSportLabel(key)  — Deutsches Label
 *   getSportMci(key)    — MaterialCommunityIcons-Name
 *   getSportCatalogColor(key) — Farbe
 *   listSports()        — Alle Sportarten (sortiert nach Kategorie)
 *   searchSports(query) — Freitext-Suche über Label + Synonyme
 *   estimateActivityCalories(key, minutes, weightKg) — grobe kcal-Schätzung
 */

// ── Kategorien ────────────────────────────────────────────────────────────────
export const SPORT_CATEGORIES = {
  ausdauer:   { label: 'Ausdauer',     order: 1 },
  kraft:      { label: 'Kraft',        order: 2 },
  ballsport:  { label: 'Ballsport',    order: 3 },
  kampfsport: { label: 'Kampfsport',   order: 4 },
  wasser:     { label: 'Wassersport',  order: 5 },
  winter:     { label: 'Wintersport',  order: 6 },
  mobility:   { label: 'Mobility & Wellness', order: 7 },
  sonstige:   { label: 'Sonstige',     order: 8 },
};

/**
 * @typedef {Object} Sport
 * @property {string} key            Eindeutiger Schlüssel (stabil, nicht ändern)
 * @property {string} label          Deutsches Anzeige-Label
 * @property {string} mci            MaterialCommunityIcons-Name
 * @property {string} color          Hex-Farbe
 * @property {string} category       Schlüssel aus SPORT_CATEGORIES
 * @property {number} met            Metabolisches Äquivalent (kcal-Schätzung)
 * @property {boolean} [distance]    Distanz erfassen (km)
 * @property {boolean} [pace]        Pace relevant
 * @property {string[]} [aliases]    Synonyme für die Suche
 */

// ── Katalog ─────────────────────────────────────────────────────────────────
/** @type {Sport[]} */
export const SPORTS = [
  // ── Ausdauer ──
  { key: 'run',           label: 'Laufen',            mci: 'run',               color: '#4caf50', category: 'ausdauer', met: 9.8,  distance: true, pace: true, aliases: ['joggen', 'jogging', 'lauf'] },
  { key: 'trail_run',     label: 'Trailrunning',      mci: 'run-fast',          color: '#43a047', category: 'ausdauer', met: 10.5, distance: true, pace: true, aliases: ['trail', 'berglauf'] },
  { key: 'treadmill',     label: 'Laufband',          mci: 'run',               color: '#66bb6a', category: 'ausdauer', met: 9.0,  distance: true, pace: true, aliases: ['laufband', 'indoor lauf'] },
  { key: 'walk',          label: 'Gehen / Walking',   mci: 'walk',              color: '#8bc34a', category: 'ausdauer', met: 3.8,  distance: true, aliases: ['spaziergang', 'walking', 'nordic walking'] },
  { key: 'hike',          label: 'Wandern',           mci: 'hiking',            color: '#689f38', category: 'ausdauer', met: 6.0,  distance: true, aliases: ['wandern', 'bergwandern', 'hiking'] },
  { key: 'bike',          label: 'Radfahren',         mci: 'bike',              color: '#ff9800', category: 'ausdauer', met: 8.0,  distance: true, pace: true, aliases: ['rad', 'fahrrad', 'cycling', 'rennrad'] },
  { key: 'mtb',           label: 'Mountainbike',      mci: 'bike',              color: '#fb8c00', category: 'ausdauer', met: 8.5,  distance: true, pace: true, aliases: ['mtb', 'mountainbike', 'gelände'] },
  { key: 'gravel',        label: 'Gravel',            mci: 'bike',              color: '#f57c00', category: 'ausdauer', met: 8.0,  distance: true, pace: true, aliases: ['gravel', 'schotter'] },
  { key: 'indoor_bike',   label: 'Indoor Cycling',    mci: 'bike',              color: '#ffa726', category: 'ausdauer', met: 7.0,  aliases: ['rolle', 'zwift', 'spinning', 'ergometer'] },
  { key: 'swim',          label: 'Schwimmen',         mci: 'swim',              color: '#2196f3', category: 'ausdauer', met: 8.3,  distance: true, pace: true, aliases: ['schwimmen', 'bahnen'] },
  { key: 'row',           label: 'Rudern',            mci: 'rowing',            color: '#26c6da', category: 'ausdauer', met: 7.0,  distance: true, aliases: ['rudern', 'ergo', 'concept2'] },
  { key: 'skating',       label: 'Inline / Skating',  mci: 'roller-skate',      color: '#29b6f6', category: 'ausdauer', met: 7.5,  distance: true, aliases: ['inliner', 'skaten', 'rollschuh'] },
  { key: 'triathlon',     label: 'Triathlon',         mci: 'run-fast',          color: '#ff5722', category: 'ausdauer', met: 9.0,  distance: true, aliases: ['triathlon', 'tri'] },

  // ── Kraft ──
  { key: 'strength',      label: 'Krafttraining',     mci: 'weight-lifter',     color: '#e8c547', category: 'kraft', met: 5.0, aliases: ['kraft', 'gym', 'gewichte', 'hanteln'] },
  { key: 'crossfit',      label: 'CrossFit',          mci: 'weight-lifter',     color: '#fdd835', category: 'kraft', met: 8.0, aliases: ['crossfit', 'wod', 'functional'] },
  { key: 'hyrox',         label: 'Hyrox',             mci: 'weight-lifter',     color: '#fbc02d', category: 'kraft', met: 9.0, aliases: ['hyrox'] },
  { key: 'calisthenics',  label: 'Calisthenics',      mci: 'human-handsup',     color: '#f9a825', category: 'kraft', met: 6.0, aliases: ['calisthenics', 'eigengewicht', 'bodyweight', 'street workout'] },
  { key: 'powerlifting',  label: 'Powerlifting',      mci: 'weight-lifter',     color: '#f9a825', category: 'kraft', met: 6.0, aliases: ['powerlifting', 'kraftdreikampf'] },

  // ── Ballsport ──
  { key: 'soccer',        label: 'Fußball',           mci: 'soccer',            color: '#43a047', category: 'ballsport', met: 7.0, aliases: ['fußball', 'fussball', 'kicken'] },
  { key: 'basketball',    label: 'Basketball',        mci: 'basketball',        color: '#ef6c00', category: 'ballsport', met: 6.5, aliases: ['basketball', 'korbball'] },
  { key: 'volleyball',    label: 'Volleyball',        mci: 'volleyball',        color: '#fb8c00', category: 'ballsport', met: 4.0, aliases: ['volleyball'] },
  { key: 'beachvolley',   label: 'Beachvolleyball',   mci: 'volleyball',        color: '#ffb300', category: 'ballsport', met: 8.0, aliases: ['beachvolleyball', 'beach', 'beachvolley'] },
  { key: 'handball',      label: 'Handball',          mci: 'handball',          color: '#1e88e5', category: 'ballsport', met: 8.0, aliases: ['handball'] },
  { key: 'tennis',        label: 'Tennis',            mci: 'tennis',            color: '#cddc39', category: 'ballsport', met: 7.3, aliases: ['tennis'] },
  { key: 'table_tennis',  label: 'Tischtennis',       mci: 'table-tennis',      color: '#9ccc65', category: 'ballsport', met: 4.0, aliases: ['tischtennis', 'ping pong'] },
  { key: 'badminton',     label: 'Badminton',         mci: 'badminton',         color: '#aed581', category: 'ballsport', met: 5.5, aliases: ['badminton', 'federball'] },
  { key: 'squash',        label: 'Squash',            mci: 'racquetball',       color: '#7cb342', category: 'ballsport', met: 10.0, aliases: ['squash'] },
  { key: 'padel',         label: 'Padel',             mci: 'tennis',            color: '#9ccc65', category: 'ballsport', met: 6.0, aliases: ['padel', 'paddle tennis'] },
  { key: 'hockey',        label: 'Hockey',            mci: 'hockey-sticks',     color: '#26a69a', category: 'ballsport', met: 7.8, aliases: ['hockey', 'feldhockey'] },
  { key: 'golf',          label: 'Golf',              mci: 'golf',              color: '#66bb6a', category: 'ballsport', met: 4.8, aliases: ['golf'] },
  { key: 'baseball',      label: 'Baseball',          mci: 'baseball-bat',      color: '#8d6e63', category: 'ballsport', met: 5.0, aliases: ['baseball', 'softball'] },
  { key: 'football_us',   label: 'American Football',  mci: 'football',         color: '#6d4c41', category: 'ballsport', met: 8.0, aliases: ['american football', 'football'] },
  { key: 'rugby',         label: 'Rugby',             mci: 'rugby',             color: '#5d4037', category: 'ballsport', met: 8.3, aliases: ['rugby'] },
  { key: 'frisbee',       label: 'Ultimate Frisbee',  mci: 'disc',             color: '#26c6da', category: 'ballsport', met: 8.0, aliases: ['frisbee', 'ultimate', 'discgolf'] },

  // ── Kampfsport ──
  { key: 'boxing',        label: 'Boxen',             mci: 'boxing-glove',      color: '#e53935', category: 'kampfsport', met: 9.0, aliases: ['boxen', 'boxing'] },
  { key: 'kickboxing',    label: 'Kickboxen',         mci: 'boxing-glove',      color: '#d81b60', category: 'kampfsport', met: 10.0, aliases: ['kickboxen', 'muay thai', 'thaiboxen'] },
  { key: 'mma',           label: 'MMA',               mci: 'mixed-martial-arts', color: '#c62828', category: 'kampfsport', met: 10.0, aliases: ['mma', 'käfig'] },
  { key: 'bjj',           label: 'BJJ / Grappling',   mci: 'karate',            color: '#ad1457', category: 'kampfsport', met: 8.0, aliases: ['bjj', 'jiu jitsu', 'grappling', 'ringen', 'judo'] },
  { key: 'martial_arts',  label: 'Kampfsport',        mci: 'karate',            color: '#b71c1c', category: 'kampfsport', met: 8.0, aliases: ['karate', 'taekwondo', 'kung fu', 'kampfsport'] },
  { key: 'fencing',       label: 'Fechten',           mci: 'fencing',           color: '#8e24aa', category: 'kampfsport', met: 6.0, aliases: ['fechten'] },

  // ── Wassersport ──
  { key: 'surf',          label: 'Surfen',            mci: 'surfing',           color: '#00acc1', category: 'wasser', met: 5.0, aliases: ['surfen', 'wellenreiten'] },
  { key: 'sup',           label: 'Stand-Up Paddling', mci: 'kayaking',          color: '#00bcd4', category: 'wasser', met: 6.0, aliases: ['sup', 'stand up paddle'] },
  { key: 'kayak',         label: 'Kajak / Kanu',      mci: 'kayaking',          color: '#0097a7', category: 'wasser', met: 5.0, distance: true, aliases: ['kajak', 'kanu', 'paddeln'] },
  { key: 'sailing',       label: 'Segeln',            mci: 'sail-boat',         color: '#0288d1', category: 'wasser', met: 3.0, aliases: ['segeln'] },
  { key: 'waterpolo',     label: 'Wasserball',        mci: 'water-polo',        color: '#039be5', category: 'wasser', met: 10.0, aliases: ['wasserball', 'waterpolo'] },
  { key: 'diving',        label: 'Tauchen',           mci: 'diving-scuba',      color: '#0277bd', category: 'wasser', met: 7.0, aliases: ['tauchen', 'diving'] },

  // ── Wintersport ──
  { key: 'ski_alpine',    label: 'Ski Alpin',         mci: 'ski',               color: '#90caf9', category: 'winter', met: 6.0, distance: true, aliases: ['ski', 'skifahren', 'abfahrt'] },
  { key: 'ski_nordic',    label: 'Langlauf',          mci: 'ski-cross-country', color: '#64b5f6', category: 'winter', met: 9.0, distance: true, aliases: ['langlauf', 'skating', 'klassisch'] },
  { key: 'skitour',       label: 'Skitour',           mci: 'ski',               color: '#42a5f5', category: 'winter', met: 10.0, distance: true, aliases: ['skitour', 'tourengehen'] },
  { key: 'snowboard',     label: 'Snowboard',         mci: 'snowboard',         color: '#5c6bc0', category: 'winter', met: 5.3, distance: true, aliases: ['snowboard', 'boarden'] },
  { key: 'ice_skating',   label: 'Schlittschuh',      mci: 'skate',             color: '#7986cb', category: 'winter', met: 7.0, aliases: ['schlittschuh', 'eislaufen'] },
  { key: 'ice_hockey',    label: 'Eishockey',         mci: 'hockey-puck',       color: '#3949ab', category: 'winter', met: 8.0, aliases: ['eishockey'] },

  // ── Mobility & Wellness ──
  { key: 'yoga',          label: 'Yoga',              mci: 'yoga',              color: '#9c27b0', category: 'mobility', met: 3.0, aliases: ['yoga'] },
  { key: 'pilates',       label: 'Pilates',           mci: 'yoga',              color: '#ab47bc', category: 'mobility', met: 3.5, aliases: ['pilates'] },
  { key: 'mobility',      label: 'Mobility',          mci: 'human',             color: '#ce93d8', category: 'mobility', met: 2.5, aliases: ['mobility', 'beweglichkeit', 'faszien'] },
  { key: 'stretching',    label: 'Dehnen',            mci: 'human-handsup',     color: '#ba68c8', category: 'mobility', met: 2.3, aliases: ['dehnen', 'stretching'] },
  { key: 'meditation',    label: 'Meditation',        mci: 'meditation',        color: '#7e57c2', category: 'mobility', met: 1.3, aliases: ['meditation', 'atemübung', 'breathwork'] },

  // ── Sonstige ──
  { key: 'climbing',      label: 'Klettern',          mci: 'image-filter-hdr',  color: '#795548', category: 'sonstige', met: 8.0, aliases: ['klettern', 'bouldern', 'climbing'] },
  { key: 'dance',         label: 'Tanzen',            mci: 'dance-ballroom',    color: '#ec407a', category: 'sonstige', met: 5.0, aliases: ['tanzen', 'dance', 'zumba'] },
  { key: 'gymnastics',    label: 'Turnen',            mci: 'gymnastics',        color: '#f06292', category: 'sonstige', met: 4.0, aliases: ['turnen', 'gymnastik', 'gerätturnen'] },
  { key: 'horse_riding',  label: 'Reiten',            mci: 'horse',             color: '#a1887f', category: 'sonstige', met: 5.5, aliases: ['reiten', 'pferd'] },
  { key: 'skateboard',    label: 'Skateboard',        mci: 'skateboard',        color: '#78909c', category: 'sonstige', met: 5.0, aliases: ['skateboard', 'skaten'] },
  { key: 'parkour',       label: 'Parkour',           mci: 'run-fast',          color: '#607d8b', category: 'sonstige', met: 8.0, aliases: ['parkour', 'freerunning'] },
  { key: 'other',         label: 'Andere Aktivität',  mci: 'star',              color: '#9e9e9e', category: 'sonstige', met: 5.0, aliases: ['sonstige', 'andere', 'aktivität'] },
];

// ── Schnellzugriff-Maps ───────────────────────────────────────────────────────
const BY_KEY = SPORTS.reduce((m, s) => { m[s.key] = s; return m; }, {});

/** Definition zu einem Key (Fallback: 'other'). */
export function getSport(key) {
  return BY_KEY[key] || BY_KEY.other;
}

export function getSportLabel(key) { return getSport(key).label; }
export function getSportMci(key)   { return getSport(key).mci; }
export function getSportCatalogColor(key) { return getSport(key).color; }

/** Alle Sportarten, gruppiert/sortiert nach Kategorie-Reihenfolge. */
export function listSports() {
  return [...SPORTS].sort((a, b) => {
    const ca = SPORT_CATEGORIES[a.category]?.order || 99;
    const cb = SPORT_CATEGORIES[b.category]?.order || 99;
    if (ca !== cb) return ca - cb;
    return a.label.localeCompare(b.label, 'de');
  });
}

/** Freitext-Suche über Label + Synonyme (case-insensitive). */
export function searchSports(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return listSports();
  return listSports().filter(s =>
    s.label.toLowerCase().includes(q) ||
    s.key.includes(q) ||
    (s.aliases || []).some(a => a.includes(q))
  );
}

/**
 * Grobe Kalorienschätzung über MET-Formel, falls keine Geräte-Daten vorliegen.
 * kcal ≈ MET × Gewicht(kg) × Stunden
 * @param {string} key      Sportart-Key
 * @param {number} minutes  Dauer in Minuten
 * @param {number} weightKg Körpergewicht (Fallback 75 kg)
 * @returns {number|null} geschätzte kcal (gerundet) oder null
 */
export function estimateActivityCalories(key, minutes, weightKg) {
  const met = getSport(key).met;
  const w = weightKg || 75;
  const h = (minutes || 0) / 60;
  if (!met || h <= 0) return null;
  return Math.round(met * w * h);
}

// ── Mobilitäts-/Stabilitätsbedarf je Sportart ─────────────────────────────────
// Zonen-Keys passend zu src/data/mobility.js (ankle, hips, posterior, tspine,
// shoulders, wrist, neck, balance). Kategorie-Defaults + gezielte Overrides
// decken ALLE Katalog-Sportarten + Kombinationen ab.
const CATEGORY_MOBILITY = {
  ausdauer:   ['ankle', 'hips', 'posterior', 'balance'],
  kraft:      ['hips', 'tspine', 'shoulders', 'ankle', 'wrist', 'balance'],
  ballsport:  ['ankle', 'hips', 'shoulders', 'tspine', 'balance'],
  kampfsport: ['hips', 'tspine', 'shoulders', 'ankle', 'balance'],
  wasser:     ['shoulders', 'tspine', 'hips'],
  winter:     ['ankle', 'hips', 'tspine', 'balance'],
  mobility:   ['hips', 'tspine', 'shoulders', 'posterior'],
  sonstige:   ['hips', 'tspine', 'shoulders', 'ankle'],
};
const SPORT_MOBILITY = {
  swim: ['shoulders', 'tspine', 'hips'],
  bike: ['hips', 'tspine', 'ankle'], gravel: ['hips', 'tspine', 'ankle'], indoor_bike: ['hips', 'tspine', 'ankle'],
  mtb: ['hips', 'tspine', 'ankle', 'shoulders'],
  run: ['ankle', 'hips', 'posterior', 'balance'], trail_run: ['ankle', 'hips', 'posterior', 'balance'], treadmill: ['ankle', 'hips', 'posterior', 'balance'],
  row: ['posterior', 'tspine', 'shoulders', 'hips'],
  hyrox: ['hips', 'tspine', 'shoulders', 'ankle', 'posterior', 'balance'],
  calisthenics: ['shoulders', 'wrist', 'hips', 'tspine', 'balance'],
  climbing: ['shoulders', 'wrist', 'hips', 'tspine'],
  golf: ['tspine', 'hips', 'shoulders', 'wrist'],
  tennis: ['shoulders', 'tspine', 'hips', 'ankle'], padel: ['shoulders', 'tspine', 'hips', 'ankle'],
  table_tennis: ['shoulders', 'tspine', 'wrist'], badminton: ['shoulders', 'ankle', 'hips', 'tspine'],
  squash: ['ankle', 'hips', 'shoulders', 'tspine', 'balance'],
  volleyball: ['shoulders', 'ankle', 'hips', 'tspine', 'balance'], beachvolley: ['shoulders', 'ankle', 'hips', 'tspine', 'balance'],
  basketball: ['ankle', 'hips', 'shoulders', 'balance'], handball: ['ankle', 'hips', 'shoulders', 'balance'],
  boxing: ['shoulders', 'tspine', 'hips', 'wrist'], kickboxing: ['shoulders', 'tspine', 'hips', 'ankle', 'balance'],
  mma: ['hips', 'tspine', 'shoulders', 'ankle', 'balance'], martial_arts: ['hips', 'tspine', 'shoulders', 'ankle', 'balance'], bjj: ['hips', 'tspine', 'shoulders', 'neck'],
  rowing: ['posterior', 'tspine', 'shoulders', 'hips'],
  ski_alpine: ['ankle', 'hips', 'tspine', 'balance'], snowboard: ['ankle', 'hips', 'tspine', 'balance'], ski_nordic: ['ankle', 'hips', 'shoulders', 'balance'], skitour: ['ankle', 'hips', 'posterior', 'balance'],
  ice_skating: ['ankle', 'hips', 'balance'], skating: ['ankle', 'hips', 'balance'],
  horse_riding: ['hips', 'tspine', 'posterior'],
  dance: ['hips', 'tspine', 'ankle', 'balance'], gymnastics: ['hips', 'tspine', 'shoulders', 'wrist', 'balance'],
  yoga: ['hips', 'tspine', 'shoulders', 'posterior'], pilates: ['hips', 'tspine', 'posterior'], stretching: ['hips', 'posterior', 'shoulders'],
  surf: ['shoulders', 'tspine', 'hips', 'balance'], sup: ['shoulders', 'tspine', 'balance'], kayak: ['shoulders', 'tspine', 'wrist'],
};

/** Mobilitäts-/Stabilitätszonen, die für eine Sportart wichtig sind. */
export function mobilityZonesForSport(key) {
  if (SPORT_MOBILITY[key]) return SPORT_MOBILITY[key];
  const s = getSport(key);
  return CATEGORY_MOBILITY[s.category] || ['ankle', 'hips', 'tspine', 'shoulders'];
}
