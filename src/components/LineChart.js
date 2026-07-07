/**
 * LineChart.js — Einfaches Liniendiagramm ohne native Abhängigkeiten
 *
 * Implementierung ohne SVG und ohne Canvas — funktioniert in Expo Go.
 * Linien-Segmente = rotierte View-Rechtecke.
 * Winkelberechnung: Math.atan2(dy, dx) für jedes Segment.
 * Punkte = runde View-Elemente (borderRadius: 4).
 *
 * Props:
 *   data    {Array<{ value: number, label?: string }>} — mind. 2 Datenpunkte
 *   width   {number} — Gesamtbreite
 *   height  {number} — Höhe (ohne X-Achsen-Beschriftung)
 *   color   {string} — Linien- und Punktfarbe (Hex)
 *   colors  {object} — Theme-Colors für Gitternetz und Labels
 */

// React/RN
import React from 'react';
import { View, Text } from 'react-native';

// ── Interne Abstände ──────────────────────────────────────────────────────────
const PAD_LEFT   = 34;  // Platz für Y-Achsen-Labels
const PAD_RIGHT  = 8;
const PAD_TOP    = 8;
const PAD_BOTTOM = 20;  // Platz für X-Achsen-Labels

/**
 * Liniendiagramm aus reinen React Native Views.
 *
 * @param {Array} data - Datenpunkte { value: number, label?: string }
 * @param {number} width - Gesamtbreite in Pixeln
 * @param {number} height - Diagrammhöhe (ohne X-Achse) in Pixeln
 * @param {string} color - Linienfarbe
 * @param {object} colors - Theme-Colors (textTertiary, border)
 */
export default function LineChart({ data = [], width = 280, height = 120, color = '#6366F1', colors = {} }) {
  if (!data || data.length < 2) return null;

  const W = width  - PAD_LEFT - PAD_RIGHT;
  const H = height - PAD_TOP;

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range  = maxVal - minVal || 1;

  /** X-Position für Datenpunkt i (gleichmäßig verteilt). */
  const xPos = i => PAD_LEFT + (i / (data.length - 1)) * W;
  /** Y-Position für Wert v (0 = unten, H = oben). */
  const yPos = v  => PAD_TOP  + H - ((v - minVal) / range) * H;

  const yTicks     = [minVal, minVal + range / 2, maxVal].map(v => Math.round(v));
  const labelColor = colors.textTertiary || '#9CA3AF';
  const gridColor  = colors.border       || '#374151';
  const totalH     = height + PAD_BOTTOM;

  return (
    <View style={{ width, height: totalH }}>

      {/* Y-axis labels */}
      {yTicks.map((tick, ti) => (
        <Text key={ti} style={{
          position: 'absolute', left: 0, top: yPos(tick) - 6,
          width: PAD_LEFT - 4, textAlign: 'right',
          fontSize: 9, color: labelColor,
        }}>
          {tick}
        </Text>
      ))}

      {/* Horizontal grid lines */}
      {yTicks.map((tick, ti) => (
        <View key={ti} style={{
          position: 'absolute',
          left: PAD_LEFT, top: yPos(tick),
          width: W, height: 0.5,
          backgroundColor: gridColor,
        }} />
      ))}

      {/* Liniensegmente — rotierte View-Rechtecke */}
      {/* Technik: Mittelpunkt des Segments berechnen, Länge = Distanz, Winkel = atan2 */}
      {data.slice(0, -1).map((d, i) => {
        const x1 = xPos(i),          y1 = yPos(d.value);
        const x2 = xPos(i + 1),      y2 = yPos(data[i + 1].value);
        const dx = x2 - x1,          dy = y2 - y1;
        const len   = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI); // Bogenmass → Grad
        return (
          <View key={i} style={{
            position: 'absolute',
            left:  (x1 + x2) / 2 - len / 2,
            top:   (y1 + y2) / 2 - 1,
            width: len, height: 2,
            backgroundColor: color,
            borderRadius: 1,
            transform: [{ rotate: `${angle}deg` }],
          }} />
        );
      })}

      {/* Dots */}
      {data.map((d, i) => (
        <View key={i} style={{
          position: 'absolute',
          left: xPos(i) - 4, top: yPos(d.value) - 4,
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: color,
        }} />
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => d.label ? (
        <Text key={i} style={{
          position: 'absolute',
          left: xPos(i) - 18, top: height + PAD_TOP + 2,
          width: 36, textAlign: 'center',
          fontSize: 9, color: labelColor,
        }}>
          {d.label}
        </Text>
      ) : null)}
    </View>
  );
}
