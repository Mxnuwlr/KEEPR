/**
 * MuscleMap.js — Körper-Diagramm mit farbigen Muskel-Overlays und Legende
 *
 * Zeigt eine Front- und Rückansicht des menschlichen Körpers mit eingefärbten
 * Muskeln basierend auf dem Trainingsvolumen. Kollabierbare Legende mit hierarchischem
 * Balkendiagramm (Elterngruppe → Unter-Muskeln).
 *
 * Farb-System: jede Muskelgruppe hat eine eigene Farbe (GROUP_PALETTE).
 *   active  = volle Farbe → primär trainierter Muskel
 *   passive = helle Variante → sekundär trainierter Muskel
 *
 * Tier-System (nach effectiveSets):
 *   stark  ≥ 4 effective sets  → volle Farbe, opacity 1.0
 *   mittel ≥ 2 effective sets  → volle Farbe, opacity 0.82
 *   leicht ≥ 0.5 effective sets → passive Farbe, opacity 0.5
 *   minimal < 0.5              → ausgeblendet
 *
 * effectiveSets = primarySets × 1.0 + secondarySets × 0.33
 * (Sekundär-Sätze zählen nur 33%, da deutlich weniger Reiz als primär)
 *
 * Props:
 *   muscleGroup   {string}  — Einfache Anzeige (ohne Counts), z.B. für ExerciseDetailScreen
 *   workedMuscles {object}  — { [muscleName]: 'primary'|'secondary' }
 *   muscleCounts  {object}  — { [muscleName]: { primary: n, secondary: m } } oder { [muscleName]: n }
 *                             Wenn vorhanden: Tier-basierte Intensitäts-Overlays + Balken
 *                             Wenn nicht vorhanden: einfache primary/secondary-Darstellung
 *   colors        {object}  — Theme-Colors (C) für Legende
 *
 * Exports:
 *   default MuscleMap         — Haupt-Komponente
 *   OVERLAYS                  — Overlay-Assets nach Seite + Muskelname
 *   MUSCLE_CONFIG             — Konfiguration welche Overlays für welche Muskeln
 *   resolveOverlays()         — Hilfsfunktion für ExerciseDetailScreen
 */

// React/RN
import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, Dimensions } from 'react-native';

// Third-party
import { Feather } from '@expo/vector-icons';

// Internal
import { useTheme } from '../theme';

const SCREEN_W = Dimensions.get('window').width;

// ── Body-Diagram Assets ───────────────────────────────────────────────────────

const BODY_LIGHT = {
  front: require('../../assets/muscles/body_front.png'),
  back:  require('../../assets/muscles/body_back.png'),
};
const BODY_DARK = {
  front: require('../../assets/muscles/body_front_dark.png'),
  back:  require('../../assets/muscles/body_back_dark.png'),
};

export const OVERLAYS = {
  front: {
    Brust:      require('../../assets/muscles/front/chest.png'),
    BrustOben:  require('../../assets/muscles/front/chest_upper.png'),
    BrustMitte: require('../../assets/muscles/front/chest_middle.png'),
    BrustUnten: require('../../assets/muscles/front/chest_lower.png'),
    Schultern:  require('../../assets/muscles/front/shoulders_front.png'),
    Bizeps:     require('../../assets/muscles/front/biceps.png'),
    BizepsLang: require('../../assets/muscles/front/biceps_long.png'),
    BizepsKurz: require('../../assets/muscles/front/biceps_short.png'),
    Brachialis: require('../../assets/muscles/front/brachialis.png'),
    Bauch:      require('../../assets/muscles/front/abs.png'),
    Obliques:   require('../../assets/muscles/front/obliques.png'),
    Beine:      require('../../assets/muscles/front/quads.png'),
    Unterarme:  require('../../assets/muscles/front/forearms.png'),
    Hüftbeuger: require('../../assets/muscles/front/hip_flexors.png'),
    Schienbein: require('../../assets/muscles/front/calves_front.png'),
    Nacken:     require('../../assets/muscles/front/neck_front.png'),
    Adduktoren: require('../../assets/muscles/front/adductors.png'),
    Abduktoren: require('../../assets/muscles/front/abductors.png'),
  },
  back: {
    Trapez:         require('../../assets/muscles/back/traps.png'),
    TrapezOben:     require('../../assets/muscles/back/upper_traps.png'),
    Rücken:         require('../../assets/muscles/back/lats.png'),
    Schultern:      require('../../assets/muscles/back/shoulders_rear.png'),
    Trizeps:        require('../../assets/muscles/back/triceps.png'),
    TrizepsLang:    require('../../assets/muscles/back/triceps_long.png'),
    TrizepsLateral: require('../../assets/muscles/back/triceps_lateral.png'),
    Rhomboiden:     require('../../assets/muscles/back/rhomboids.png'),
    LowerBack:      require('../../assets/muscles/back/lower_back.png'),
    Gesäß:          require('../../assets/muscles/back/glutes.png'),
    GesäßMed:       require('../../assets/muscles/back/glutes_med.png'),
    Hamstrings:     require('../../assets/muscles/back/hamstrings.png'),
    Waden:          require('../../assets/muscles/back/calves.png'),
    TeresMajor:     require('../../assets/muscles/back/teres_major.png'),
  },
};

/**
 * MUSCLE_CONFIG — Definiert welche Overlay-Assets für jeden Muskel auf welcher Seite
 * gerendert werden. primary = Hauptoverlay, secondary = Hilfsüberlagerungen.
 * Beide Seiten (front/back) werden separat konfiguriert.
 */
export const MUSCLE_CONFIG = {
  Brust:         { front: { primary: 'Brust',         secondary: ['BrustOben','BrustUnten','Schultern'] }, back: { primary: null,             secondary: ['Trizeps'] } },
  BrustOben:     { front: { primary: 'BrustOben',     secondary: ['Schultern'] },                          back: { primary: null,             secondary: ['TrizepsLang'] } },
  BrustMitte:    { front: { primary: 'BrustMitte',    secondary: [] },                                     back: { primary: null,             secondary: ['Trizeps'] } },
  BrustUnten:    { front: { primary: 'BrustUnten',    secondary: [] },                                     back: { primary: null,             secondary: [] } },
  Rücken:        { front: { primary: null,             secondary: ['Bizeps'] },                             back: { primary: 'Rücken',         secondary: ['Trapez','Rhomboiden','TeresMajor'] } },
  Schultern:     { front: { primary: 'Schultern',     secondary: ['Brust'] },                              back: { primary: 'Schultern',      secondary: ['Trapez'] } },
  Bizeps:        { front: { primary: 'Bizeps',        secondary: ['BizepsLang','BizepsKurz','Brachialis','Unterarme'] }, back: { primary: null, secondary: [] } },
  BizepsLang:    { front: { primary: 'BizepsLang',    secondary: ['BizepsKurz','Brachialis'] },             back: { primary: null,             secondary: [] } },
  BizepsKurz:    { front: { primary: 'BizepsKurz',    secondary: ['BizepsLang','Brachialis'] },             back: { primary: null,             secondary: [] } },
  Brachialis:    { front: { primary: 'Brachialis',    secondary: ['BizepsLang'] },                          back: { primary: null,             secondary: [] } },
  Trizeps:       { front: { primary: null,             secondary: [] },                                     back: { primary: 'Trizeps',        secondary: ['TrizepsLang','TrizepsLateral','Schultern'] } },
  TrizepsLang:   { front: { primary: null,             secondary: [] },                                     back: { primary: 'TrizepsLang',    secondary: ['TrizepsLateral'] } },
  TrizepsLateral:{ front: { primary: null,             secondary: [] },                                     back: { primary: 'TrizepsLateral', secondary: ['TrizepsLang'] } },
  Bauch:         { front: { primary: 'Bauch',         secondary: ['Obliques'] },                            back: { primary: null,             secondary: [] } },
  Beine:         { front: { primary: 'Beine',         secondary: ['Hüftbeuger','Adduktoren'] },             back: { primary: 'Hamstrings',     secondary: ['Waden','Gesäß'] } },
  Gesäß:         { front: { primary: null,             secondary: ['Hüftbeuger'] },                         back: { primary: 'Gesäß',          secondary: ['GesäßMed','Hamstrings'] } },
  Waden:         { front: { primary: 'Schienbein',    secondary: [] },                                     back: { primary: 'Waden',          secondary: [] } },
  Nacken:        { front: { primary: 'Nacken',        secondary: [] },                                     back: { primary: null,             secondary: ['Trapez'] } },
  Adduktoren:    { front: { primary: 'Adduktoren',    secondary: ['Beine'] },                               back: { primary: null,             secondary: [] } },
  Abduktoren:    { front: { primary: 'Abduktoren',    secondary: [] },                                     back: { primary: 'GesäßMed',       secondary: [] } },
  Trapez:        { front: { primary: null,             secondary: ['Schultern'] },                          back: { primary: 'Trapez',         secondary: ['TrapezOben','Rhomboiden'] } },
  TrapezOben:    { front: { primary: null,             secondary: [] },                                     back: { primary: 'TrapezOben',     secondary: ['Trapez'] } },
  TeresMajor:    { front: { primary: null,             secondary: [] },                                     back: { primary: 'TeresMajor',     secondary: ['Rücken'] } },
  LowerBack:     { front: { primary: null,             secondary: [] },                                     back: { primary: 'LowerBack',      secondary: ['Rücken'] } },
  Hamstrings:    { front: { primary: null,             secondary: ['Beine'] },                               back: { primary: 'Hamstrings',     secondary: ['Gesäß'] } },
  Unterarme:     { front: { primary: 'Unterarme',     secondary: [] },                                     back: { primary: null,             secondary: [] } },
  Ganzkörper:    { front: { primary: 'Brust',         secondary: ['Beine','Bauch'] },                       back: { primary: 'Rücken',         secondary: ['Gesäß','Hamstrings'] } },
};

// ── Farb-System ───────────────────────────────────────────────────────────────
// 12 klar unterscheidbare Farben — eine pro Elterngruppe.
// Sub-Muskeln teilen die Farbe ihrer Elterngruppe.
// active = volle Farbe (primär trainiert) · passive = deutlich heller (sekundär)
const GROUP_PALETTE = {
  Brust:      { active: '#EF4444', passive: '#FCA5A5' }, // Rot
  Rücken:     { active: '#3B82F6', passive: '#93C5FD' }, // Blau
  Schultern:  { active: '#F97316', passive: '#FDBA74' }, // Orange
  Trapez:     { active: '#0891B2', passive: '#67E8F9' }, // Cyan/Teal
  Bizeps:     { active: '#7C3AED', passive: '#C4B5FD' }, // Violett
  Trizeps:    { active: '#EAB308', passive: '#FDE047' }, // Gelb
  Bauch:      { active: '#84CC16', passive: '#BEF264' }, // Limette
  Beine:      { active: '#16A34A', passive: '#86EFAC' }, // Grün
  Hamstrings: { active: '#059669', passive: '#6EE7B7' }, // Smaragd (Beine-Familie)
  Gesäß:      { active: '#EC4899', passive: '#F9A8D4' }, // Pink
  Waden:      { active: '#4F46E5', passive: '#A5B4FC' }, // Indigo
  Unterarme:  { active: '#B45309', passive: '#FCD34D' }, // Kupfer/Amber
  Nacken:     { active: '#64748B', passive: '#CBD5E1' }, // Slate
  Ganzkörper: { active: '#94A3B8', passive: '#E2E8F0' },
};

/**
 * MUSCLE_PARENT — Mapping Sub-Muskel → Elterngruppe.
 * Wird in buildHierarchy() und getTier() verwendet um Sätze zu aggregieren.
 */
const MUSCLE_PARENT = {
  BrustOben: 'Brust', BrustMitte: 'Brust', BrustUnten: 'Brust', Brust: 'Brust',
  Rhomboiden: 'Rücken', TeresMajor: 'Rücken', LowerBack: 'Rücken', Rücken: 'Rücken',
  Schultern: 'Schultern',
  TrapezOben: 'Trapez', Trapez: 'Trapez',
  BizepsLang: 'Bizeps', BizepsKurz: 'Bizeps', Brachialis: 'Bizeps', Bizeps: 'Bizeps',
  TrizepsLang: 'Trizeps', TrizepsLateral: 'Trizeps', Trizeps: 'Trizeps',
  Obliques: 'Bauch', Bauch: 'Bauch',
  Adduktoren: 'Beine', Abduktoren: 'Beine', Hüftbeuger: 'Beine', Beine: 'Beine',
  Hamstrings: 'Hamstrings',
  GesäßMed: 'Gesäß', Gesäß: 'Gesäß',
  Schienbein: 'Waden', Waden: 'Waden',
  Unterarme: 'Unterarme',
  Nacken: 'Nacken',
  Ganzkörper: 'Ganzkörper',
};

/** Anzeigebezeichnungen für Sub-Muskeln (kürzer als technische Namen). */
const MUSCLE_LABELS = {
  BrustOben: 'Obere Brust', BrustMitte: 'Mittlere Brust', BrustUnten: 'Untere Brust',
  BizepsLang: 'Langer Kopf', BizepsKurz: 'Kurzer Kopf', Brachialis: 'Brachialis',
  TrizepsLang: 'Langer Kopf', TrizepsLateral: 'Seitl. Kopf',
  LowerBack: 'Unt. Rücken', TrapezOben: 'Ob. Trapez', Rhomboiden: 'Rhomboiden', TeresMajor: 'Teres Major',
  Adduktoren: 'Adduktoren', Abduktoren: 'Abduktoren', GesäßMed: 'Gl. Medius',
  Hamstrings: 'Hamstrings', Obliques: 'Obliques', Hüftbeuger: 'Hüftbeuger', Schienbein: 'Schienbein',
};

/** Gibt die Farbpalette für einen Muskel zurück (via Elterngruppe). */
const getPalette = (muscle) => {
  const parent = MUSCLE_PARENT[muscle] || muscle;
  return GROUP_PALETTE[parent] || GROUP_PALETTE[muscle] || { active: '#94A3B8', passive: '#CBD5E1' };
};

// ── Tier-System ────────────────────────────────────────────────────────────────

/** Sekundär-Gewichtung: 1 sekundärer Satz = 0.33 effektive Sätze. */
const SECONDARY_WEIGHT = 0.33;

// Tier-Schwellwerte (effectiveSets = primarySets + secondarySets × 0.33)
const TIER_STRONG = 4;    // ≥ 4 effective sets → stark
const TIER_MEDIUM = 2;    // ≥ 2 effective sets → mittel
const TIER_LIGHT  = 0.5;  // ≥ 0.5 effective sets → leicht
// < 0.5 → minimal → ausgeblendet (kein Overlay, nicht in Legende)

/**
 * Klassifiziert eine Muskelgruppe anhand der effektiven Sätze.
 * @param {number} effectiveSets
 * @returns {'stark'|'mittel'|'leicht'|'minimal'}
 */
function getTier(effectiveSets) {
  if (effectiveSets >= TIER_STRONG) return 'stark';
  if (effectiveSets >= TIER_MEDIUM) return 'mittel';
  if (effectiveSets >= TIER_LIGHT)  return 'leicht';
  return 'minimal';
}

const TIER_LABELS = { stark: 'stark', mittel: 'mittel', leicht: 'leicht' };

// ── Hierarchy Builder ─────────────────────────────────────────────────────────

/**
 * Aggregiert workedMuscles nach Elterngruppe und berechnet effectiveSets.
 * Gibt eine sortierte Liste von Gruppen zurück (höchste effectiveSets zuerst).
 *
 * muscleCounts-Format: { [muscle]: { primary: n, secondary: m } } — bevorzugt
 *                   oder { [muscle]: n } — Legacy-Format (zählt alles als primary/secondary)
 *
 * Ohne muscleCounts (hasCounts=false): primary = 2 (mittel), secondary = TIER_LIGHT
 * → alle Muskeln werden angezeigt (keine Intensitätsabstufung)
 *
 * @param {object} workedMuscles - { [muscleName]: 'primary'|'secondary' }
 * @param {object|null} muscleCounts - Satz-Zählungen pro Muskel
 * @returns {Array} - Sortierte Gruppen mit palette, tier, subs
 */
function buildHierarchy(workedMuscles, muscleCounts) {
  if (!workedMuscles) return [];
  const parentMap = {};

  const hasCounts = !!muscleCounts && Object.keys(muscleCounts).length > 0;

  Object.entries(workedMuscles).forEach(([muscle, level]) => {
    const parent    = MUSCLE_PARENT[muscle] || muscle;
    const isPrimary = level === 'primary';
    const raw       = muscleCounts?.[muscle];
    // Unterstützt beide Count-Formate: Objekt mit primary/secondary oder einfache Zahl
    const primSets  = typeof raw === 'object' ? (raw.primary  || 0) : (isPrimary  ? (raw || 0) : 0);
    const secSets   = typeof raw === 'object' ? (raw.secondary|| 0) : (!isPrimary ? (raw || 0) : 0);
    const sets      = primSets + secSets;
    // Ohne Counts: Fallback-Werte so dass alle Muskeln sichtbar sind
    const effectiveSets = hasCounts
      ? primSets + secSets * SECONDARY_WEIGHT
      : isPrimary ? 2 : TIER_LIGHT;

    if (!parentMap[parent]) {
      parentMap[parent] = { isPrimary: false, totalSets: 0, effectiveSets: 0, subs: [] };
    }
    if (isPrimary) parentMap[parent].isPrimary = true;
    parentMap[parent].totalSets    += sets;
    parentMap[parent].effectiveSets += effectiveSets;

    if (muscle !== parent) {
      parentMap[parent].subs.push({
        name: muscle, label: MUSCLE_LABELS[muscle] || muscle,
        sets, isPrimary, effectiveSets,
      });
    }
  });

  return Object.entries(parentMap)
    .map(([group, data]) => {
      const tier = getTier(data.effectiveSets);
      return {
        group,
        label: MUSCLE_LABELS[group] || group,
        palette: getPalette(group),
        ...data,
        tier,
        subs: data.subs
          .map(s => ({ ...s, tier: getTier(s.effectiveSets) }))
          .filter(s => s.tier !== 'minimal')
          .sort((a, b) => b.effectiveSets - a.effectiveSets),
      };
    })
    .filter(g => g.tier !== 'minimal')
    .sort((a, b) => b.effectiveSets - a.effectiveSets);
}

// ── Intensity Overlays ────────────────────────────────────────────────────────

/**
 * Berechnet farbige PNG-Overlays für das Körperdiagramm — intensity-basiert.
 * Jedes betroffene Overlay-Bild bekommt eine Farbe und Opazität basierend auf dem Tier.
 *
 * Bei mehreren Muskeln die dasselbe Overlay-Bild betreffen: das mit höchster Opazität gewinnt.
 * Sekundäre Overlays werden zuerst gerendert (dahinter), primäre zuletzt (vorne).
 *
 * @param {'front'|'back'} side - Körperseite
 * @param {object} workedMuscles - { [muscle]: 'primary'|'secondary' }
 * @param {object} muscleCounts - { [muscle]: { primary: n, secondary: m } }
 * @param {number} maxCount - Maximale Satzanzahl (für Normalisierung, aktuell ungenutzt)
 * @returns {Array<{ src, color, opacity, isPrimary }>}
 */
function buildIntensityOverlays(side, workedMuscles, muscleCounts, maxCount) {
  const overlayMap = new Map();

  Object.entries(workedMuscles).forEach(([muscle, level]) => {
    const cfg = MUSCLE_CONFIG[muscle]?.[side];
    if (!cfg?.primary || !OVERLAYS[side]?.[cfg.primary]) return;

    const overlayKey = cfg.primary;
    const src        = OVERLAYS[side][overlayKey];
    const isPrimary  = level === 'primary';
    const raw        = muscleCounts?.[muscle];
    const primSets   = typeof raw === 'object' ? (raw.primary  || 0) : (isPrimary  ? (raw || 0) : 0);
    const secSets    = typeof raw === 'object' ? (raw.secondary|| 0) : (!isPrimary ? (raw || 0) : 0);
    const effectiveSets = primSets + secSets * SECONDARY_WEIGHT;
    const tier          = getTier(effectiveSets);
    if (tier === 'minimal') return;

    const { active, passive } = getPalette(muscle);
    const color   = tier === 'leicht' ? passive : active;
    const opacity = tier === 'stark' ? 1.0 : tier === 'mittel' ? 0.82 : 0.50;

    // Bei Konflikt: Overlay mit höchster Opazität gewinnt
    const existing = overlayMap.get(overlayKey);
    if (!existing || opacity > existing.opacity) {
      overlayMap.set(overlayKey, { src, color, opacity, isPrimary });
    }
  });

  // Sekundäre zuerst rendern (dahinter), primäre zuletzt (vorne)
  const entries = [...overlayMap.values()];
  return [...entries.filter(e => !e.isPrimary), ...entries.filter(e => e.isPrimary)];
}

/**
 * resolveOverlays — Hilfsfunktion für ExerciseDetailScreen.
 * Gibt primäre und sekundäre Overlay-Assets für eine Seite zurück
 * ohne Intensitätsinformation (einfaches primary/secondary-Rendering).
 *
 * @param {'front'|'back'} side
 * @param {object|null} workedMuscles
 * @param {string|null} muscleGroup - Fallback wenn workedMuscles nicht vorhanden
 * @returns {{ primaryOverlays, secondaryOverlays, primaryLabel, secondaryLabels }}
 */
export function resolveOverlays(side, workedMuscles, muscleGroup) {
  let primaryOverlays = [], secondaryOverlays = [], primaryLabel = null, secondaryLabels = [];

  if (workedMuscles) {
    const primaries   = Object.entries(workedMuscles).filter(([,l]) => l === 'primary').map(([g]) => g);
    const secondaries = Object.entries(workedMuscles).filter(([,l]) => l === 'secondary').map(([g]) => g);
    primaryLabel = primaries[0] || null;
    secondaryLabels = secondaries;
    for (const g of primaries) {
      const cfg = MUSCLE_CONFIG[g]?.[side];
      if (cfg?.primary && OVERLAYS[side]?.[cfg.primary]) primaryOverlays.push(OVERLAYS[side][cfg.primary]);
    }
    for (const g of secondaries) {
      const cfg = MUSCLE_CONFIG[g]?.[side];
      if (cfg?.primary && OVERLAYS[side]?.[cfg.primary]) secondaryOverlays.push(OVERLAYS[side][cfg.primary]);
    }
  } else if (muscleGroup) {
    primaryLabel = muscleGroup;
    const cfg = MUSCLE_CONFIG[muscleGroup]?.[side];
    if (cfg?.primary && OVERLAYS[side]?.[cfg.primary]) primaryOverlays.push(OVERLAYS[side][cfg.primary]);
    for (const key of cfg?.secondary || []) {
      const src = OVERLAYS[side]?.[key];
      if (src) secondaryOverlays.push(src);
    }
    secondaryLabels = cfg?.secondary || [];
  }

  primaryOverlays   = [...new Set(primaryOverlays)];
  secondaryOverlays = [...new Set(secondaryOverlays)].filter(s => !primaryOverlays.includes(s));
  return { primaryOverlays, secondaryOverlays, primaryLabel, secondaryLabels };
}

// ── Dimensions ────────────────────────────────────────────────────────────────
const TOTAL_W = SCREEN_W - 48;    // Gesamtbreite des Diagramms (Padding je 24px)
const IMG_W   = Math.floor(TOTAL_W / 2);
const IMG_H   = Math.round(IMG_W * 1.45); // Aspect Ratio der Body-PNGs ≈ 1:1.45

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

/**
 * MuscleMap — Zeigt Body-Diagram mit eingefärbten Muskeln.
 *
 * @param {string} [muscleGroup] - Einfache Muskelgruppe (für ExerciseDetail ohne Counts)
 * @param {object} [workedMuscles] - { [muscle]: 'primary'|'secondary' }
 * @param {object} [muscleCounts] - { [muscle]: { primary: n, secondary: m } }
 *                                  hasCounts=true → Tier-basierte Darstellung + Balken
 *                                  hasCounts=false → Einfaches primary/secondary
 * @param {object} [colors] - Theme-Colors für Legende (textSecondary, border)
 */
export default function MuscleMap({ muscleGroup, workedMuscles, muscleCounts, colors }) {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const BODY     = isDark ? BODY_DARK : BODY_LIGHT;
  const cardBg   = isDark ? '#1A1917' : '#F0EEE8';
  const bodyTint = isDark ? '#A8A4A0' : undefined;
  const bgColor  = isDark ? '#111110' : '#F5F4F0';
  const textSec  = colors?.textSecondary || '#9CA3AF';
  const border   = colors?.border || '#2A2927';
  const oStyle   = { width: IMG_W, height: IMG_H, position: 'absolute', top: 0, left: 0 };

  const maxCount   = muscleCounts && Object.keys(muscleCounts).length > 0
    ? Math.max(...Object.values(muscleCounts).map(v => typeof v === 'object' ? (v.primary||0)+(v.secondary||0) : v), 1) : 1;
  // hasCounts steuert ob Balken und Tier-Labels angezeigt werden
  const hasCounts  = !!muscleCounts && Object.keys(muscleCounts).length > 0;

  const hierarchy  = buildHierarchy(workedMuscles, muscleCounts);
  const maxBarSets = hierarchy.reduce((m, g) => Math.max(m, g.effectiveSets), 1);
  const hasContent = hierarchy.length > 0 || !!muscleGroup;

  // Overlays per side
  const getOverlays = (side) => {
    if (workedMuscles && muscleCounts) return buildIntensityOverlays(side, workedMuscles, muscleCounts, maxCount);
    if (workedMuscles) {
      const { primaryOverlays, secondaryOverlays } = resolveOverlays(side, workedMuscles, muscleGroup);
      const prim = Object.entries(workedMuscles).filter(([,l]) => l === 'primary').map(([g]) => g);
      const sec  = Object.entries(workedMuscles).filter(([,l]) => l === 'secondary').map(([g]) => g);
      return [
        ...secondaryOverlays.map((src, i) => ({ src, color: getPalette(sec[i] || '').passive, opacity: 0.90 })),
        ...primaryOverlays.map((src, i)   => ({ src, color: getPalette(prim[i] || '').active,  opacity: 1.00 })),
      ];
    }
    const { primaryOverlays, secondaryOverlays } = resolveOverlays(side, workedMuscles, muscleGroup);
    const p = getPalette(muscleGroup || '');
    return [
      ...secondaryOverlays.map(src => ({ src, color: p.passive, opacity: 0.90 })),
      ...primaryOverlays.map(src   => ({ src, color: p.active,  opacity: 1.00 })),
    ];
  };

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Body diagram */}
      <View style={{ width: TOTAL_W, height: IMG_H, borderRadius: 12, overflow: 'hidden', backgroundColor: cardBg, flexDirection: 'row' }}>
        {(['front', 'back']).map(side => (
          <View key={side} style={{ width: IMG_W, height: IMG_H }}>
            <Image source={BODY[side]} style={[oStyle, bodyTint ? { tintColor: bodyTint } : null]} resizeMode="cover" />
            {getOverlays(side).map(({ src, color, opacity }, i) => (
              <Image key={i} source={src} style={[oStyle, { tintColor: color, opacity }]} resizeMode="cover" />
            ))}
          </View>
        ))}
      </View>

      {/* Legend toggle button */}
      {hasContent && (
        <TouchableOpacity
          onPress={() => setExpanded(v => !v)}
          style={{
            marginTop: 10, width: TOTAL_W,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: bgColor,
            borderRadius: expanded ? 12 : 99,
            borderBottomLeftRadius: expanded ? 0 : 99,
            borderBottomRightRadius: expanded ? 0 : 99,
            paddingHorizontal: 12, paddingVertical: 8,
          }}
        >
          {/* Collapsed: dots + label */}
          {!expanded && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Text style={{ color: textSec, fontSize: 12, fontWeight: '600' }}>Muskeln</Text>
              <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                {hierarchy.map(({ group, palette, tier }) => (
                  <View key={group} style={{ width: 9, height: 9, borderRadius: 4.5,
                    backgroundColor: tier === 'leicht' ? palette.passive : palette.active }} />
                ))}
              </View>
            </View>
          )}
          {expanded && (
            <Text style={{ flex: 1, color: textSec, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 }}>
              MUSKELÜBERSICHT
            </Text>
          )}
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={textSec} />
        </TouchableOpacity>
      )}

      {/* Expanded legend: hierarchical bar chart */}
      {expanded && hasContent && (
        <View style={{
          width: TOTAL_W,
          backgroundColor: bgColor,
          borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
          paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12,
        }}>
          {/* Divider */}
          <View style={{ height: 1, backgroundColor: border, marginBottom: 10 }} />

          {(() => {
            const primary   = hierarchy.filter(g => g.isPrimary);
            const secondary = hierarchy.filter(g => !g.isPrimary);

            const renderGroup = (g, gi, arr) => {
              const isSecondary = !g.isPrimary;
              const dotColor    = g.tier === 'leicht' || isSecondary ? g.palette.passive : g.palette.active;
              const nameColor   = isSecondary ? textSec : g.palette.active;
              const barH        = isSecondary ? 5 : g.tier === 'stark' ? 8 : 7;
              const barPct      = isSecondary
                ? Math.min(g.effectiveSets / maxBarSets, 0.4)
                : g.effectiveSets / maxBarSets;
              return (
                <View key={g.group} style={{ marginBottom: gi < arr.length - 1 ? 10 : 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor, opacity: isSecondary ? 0.8 : 1 }} />
                    <View style={{ width: 90 }}>
                      <Text style={{ color: nameColor, fontWeight: isSecondary ? '500' : '700', fontSize: 13 }} numberOfLines={1}>
                        {g.label}
                      </Text>
                      {!isSecondary && hasCounts && (
                        <Text style={{ color: textSec, fontSize: 10 }}>{TIER_LABELS[g.tier]}</Text>
                      )}
                    </View>
                    {hasCounts && (
                      <View style={{ flex: 1, height: barH, backgroundColor: border, borderRadius: 4, overflow: 'hidden' }}>
                        <View style={{ width: `${barPct * 100}%`, height: '100%', backgroundColor: dotColor, borderRadius: 4 }} />
                      </View>
                    )}
                    {hasCounts && (
                      <Text style={{ color: nameColor, fontSize: 11, fontWeight: '600', width: 30, textAlign: 'right' }}>
                        {g.totalSets > 0 ? `${g.totalSets}×` : '—'}
                      </Text>
                    )}
                  </View>
                  {g.subs.map(sub => (
                    <View key={sub.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 18, marginBottom: 3 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: g.palette.active, opacity: 0.4 }} />
                      <Text style={{ color: textSec, fontSize: 11, width: hasCounts ? 82 : undefined, flex: hasCounts ? undefined : 1 }} numberOfLines={1}>{sub.label}</Text>
                      {hasCounts && (
                        <View style={{ flex: 1, height: 4, backgroundColor: border, borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{
                            width: `${Math.min(sub.effectiveSets / maxBarSets, isSecondary ? 0.4 : 1) * 100}%`,
                            height: '100%',
                            backgroundColor: sub.tier === 'leicht' ? g.palette.passive + 'BB' : g.palette.active + 'BB',
                            borderRadius: 3,
                          }} />
                        </View>
                      )}
                      {hasCounts && (
                        <Text style={{ color: textSec, fontSize: 10, width: 30, textAlign: 'right' }}>
                          {sub.sets > 0 ? `${sub.sets}×` : '—'}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              );
            };

            return (
              <>
                {primary.map((g, gi) => renderGroup(g, gi, primary))}
                {secondary.length > 0 && (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
                      <View style={{ flex: 1, height: 0.5, backgroundColor: border }} />
                      <Text style={{ color: textSec, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>{hasCounts ? 'ASSISTIEREND' : 'UNTERSTÜTZEND'}</Text>
                      <View style={{ flex: 1, height: 0.5, backgroundColor: border }} />
                    </View>
                    {secondary.map((g, gi) => renderGroup(g, gi, secondary))}
                  </>
                )}
              </>
            );
          })()}
        </View>
      )}
    </View>
  );
}
