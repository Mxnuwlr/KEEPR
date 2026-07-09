/**
 * components/AreaChart.js — Gefülltes Flächendiagramm (Strava-Stil)
 *
 * Für Herzfrequenz-, Höhen- und Geschwindigkeitsverlauf einer Einheit.
 * Reines SVG (react-native-svg), x-Achse optional mit Distanz-Labels (km).
 *
 * Props: { data:[num], color, width, height, unit, xMaxKm, fmt }
 */

// React/RN
import React from 'react';
import { View, Text } from 'react-native';

// Third-party
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';

// Internal
import { useTheme } from '../theme';

export default function AreaChart({ data, color, width, height = 130, unit = '', xMaxKm = null, fmt = (v) => Math.round(v) }) {
  const { colors: C, type: T } = useTheme();
  const vals = (data || []).filter(v => typeof v === 'number' && !isNaN(v));
  if (vals.length < 2 || !width) return null;

  const padL = 34, padB = xMaxKm ? 18 : 6, padT = 6, padR = 6;
  const W = width, H = height;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const x = (i) => padL + (i / (vals.length - 1)) * plotW;
  const y = (v) => padT + plotH - ((v - min) / range) * plotH;

  let d = `M ${x(0)} ${y(vals[0])}`;
  for (let i = 1; i < vals.length; i++) d += ` L ${x(i)} ${y(vals[i])}`;
  const area = `${d} L ${x(vals.length - 1)} ${padT + plotH} L ${x(0)} ${padT + plotH} Z`;

  // Y-Gitterlinien (3 Werte)
  const yTicks = [min, min + range / 2, max];
  // X-Labels (Distanz)
  const xTicks = xMaxKm ? [0.25, 0.5, 0.75].map(f => ({ frac: f, km: Math.round(xMaxKm * f) })) : [];

  return (
    <View>
      <Svg width={W} height={H}>
        {yTicks.map((v, i) => (
          <React.Fragment key={i}>
            <Line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke={C.border} strokeWidth={0.5} />
            <SvgText x={padL - 5} y={y(v) + 3} fontSize={9} fill={C.textTertiary} textAnchor="end">{fmt(v)}</SvgText>
          </React.Fragment>
        ))}
        <Path d={area} fill={color} fillOpacity={0.35} />
        <Path d={d} fill="none" stroke={color} strokeWidth={1.5} />
        {xTicks.map((t, i) => (
          <SvgText key={i} x={padL + t.frac * plotW} y={H - 4} fontSize={9} fill={C.textTertiary} textAnchor="middle">{t.km} km</SvgText>
        ))}
      </Svg>
    </View>
  );
}
