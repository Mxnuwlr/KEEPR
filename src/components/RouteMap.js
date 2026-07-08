/**
 * components/RouteMap.js — GPS-Strecken-Karte einer Einheit (Strava-Stil)
 *
 * Zeichnet die Route als SVG-Polyline (react-native-svg, kein natives Map-Modul
 * nötig). Punkte: [[lat, lng], ...] — werden auf die Fläche projiziert
 * (Mercator-Näherung: Longitude mit cos(lat) skaliert, damit die Form stimmt).
 * Start = grüner Punkt, Ziel = roter Punkt.
 */

// React/RN
import React from 'react';
import { View } from 'react-native';

// Third-party
import Svg, { Polyline, Circle } from 'react-native-svg';

// Internal
import { useTheme } from '../theme';

export default function RouteMap({ route, height = 180, color, style }) {
  const { colors: C, radius: R } = useTheme();
  if (!Array.isArray(route) || route.length < 2) return null;

  const W = 1000, H = 600, PAD = 60;
  const lats = route.map(p => p[0]);
  const lngs = route.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);

  // Ausdehnung in "Metern-Äquivalent" → Form bleibt korrekt, Route mittig
  const spanX = Math.max((maxLng - minLng) * lngScale, 1e-5);
  const spanY = Math.max(maxLat - minLat, 1e-5);
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;

  const pts = route.map(([lat, lng]) => {
    const x = offX + ((lng - minLng) * lngScale) * scale;
    const y = H - (offY + (lat - minLat) * scale); // Norden oben
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [sx, sy] = pts[0].split(',');
  const [ex, ey] = pts[pts.length - 1].split(',');

  return (
    <View style={[{ backgroundColor: C.bgSecondary, borderRadius: R.md, overflow: 'hidden' }, style]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <Polyline
          points={pts.join(' ')}
          fill="none"
          stroke={color || C.tint}
          strokeWidth={9}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={sx} cy={sy} r={14} fill="#22C55E" stroke="#fff" strokeWidth={4} />
        <Circle cx={ex} cy={ey} r={14} fill="#EF4444" stroke="#fff" strokeWidth={4} />
      </Svg>
    </View>
  );
}
