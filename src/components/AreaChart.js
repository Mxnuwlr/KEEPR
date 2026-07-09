/**
 * components/AreaChart.js — Gefülltes Flächendiagramm mit Scrubber (Strava-Stil)
 *
 * Für Herzfrequenz-, Höhen- und Geschwindigkeitsverlauf. Reines SVG.
 * Touch/Ziehen auf dem Diagramm → vertikale Linie + Wert-Tooltip an der
 * Stelle; onScrub(fraction, value) meldet die Position (für den Karten-Cursor).
 *
 * Props: { data:[num], color, width, height, unit, xMaxKm, fmt, onScrub }
 */

// React/RN
import React, { useState, useRef } from 'react';
import { View, Text, PanResponder } from 'react-native';

// Third-party
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';

// Internal
import { useTheme } from '../theme';

export default function AreaChart({ data, color, width, height = 140, unit = '', xMaxKm = null, fmt = (v) => Math.round(v), onScrub }) {
  const { colors: C, type: T } = useTheme();
  const [scrub, setScrub] = useState(null); // { i, x, y, v }

  const vals = (data || []).map(v => (typeof v === 'number' && !isNaN(v)) ? v : null);
  const clean = vals.filter(v => v != null);
  if (clean.length < 2 || !width) return null;

  const padL = 36, padB = xMaxKm ? 18 : 6, padT = 8, padR = 8;
  const W = width, H = height;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const min = Math.min(...clean), max = Math.max(...clean);
  const range = max - min || 1;
  const N = vals.length;
  const x = (i) => padL + (i / (N - 1)) * plotW;
  const y = (v) => padT + plotH - ((v - min) / range) * plotH;

  // Pfad (Lücken bei null überspringen)
  let d = '', started = false;
  for (let i = 0; i < N; i++) {
    if (vals[i] == null) { started = false; continue; }
    d += `${started ? ' L' : ' M'} ${x(i)} ${y(vals[i])}`;
    started = true;
  }
  const firstI = vals.findIndex(v => v != null);
  let lastI = N - 1; while (lastI > 0 && vals[lastI] == null) lastI--;
  const area = `${d} L ${x(lastI)} ${padT + plotH} L ${x(firstI)} ${padT + plotH} Z`;

  const yTicks = [min, min + range / 2, max];
  const xTicks = xMaxKm ? [0.25, 0.5, 0.75].map(f => ({ frac: f, km: Math.round(xMaxKm * f) })) : [];

  const setFromX = (px) => {
    const frac = Math.max(0, Math.min(1, (px - padL) / plotW));
    let i = Math.round(frac * (N - 1));
    if (vals[i] == null) { // nächsten gültigen Wert suchen
      let j = i; while (j < N && vals[j] == null) j++;
      let k = i; while (k >= 0 && vals[k] == null) k--;
      i = (j < N && (k < 0 || j - i <= i - k)) ? j : k;
    }
    if (i < 0 || i >= N || vals[i] == null) return;
    setScrub({ i, x: x(i), y: y(vals[i]), v: vals[i] });
    onScrub?.(i / (N - 1), vals[i]);
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
    onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    onPanResponderRelease: () => { setScrub(null); onScrub?.(null); },
    onPanResponderTerminate: () => { setScrub(null); onScrub?.(null); },
  })).current;

  return (
    <View {...pan.panHandlers}>
      <Svg width={W} height={H}>
        {yTicks.map((v, i) => (
          <React.Fragment key={i}>
            <Line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke={C.border} strokeWidth={0.5} />
            <SvgText x={padL - 5} y={y(v) + 3} fontSize={9} fill={C.textTertiary} textAnchor="end">{fmt(v)}</SvgText>
          </React.Fragment>
        ))}
        <Path d={area} fill={color} fillOpacity={0.32} />
        <Path d={d} fill="none" stroke={color} strokeWidth={1.5} />
        {xTicks.map((t, i) => (
          <SvgText key={i} x={padL + t.frac * plotW} y={H - 4} fontSize={9} fill={C.textTertiary} textAnchor="middle">{t.km} km</SvgText>
        ))}
        {scrub && (
          <>
            <Line x1={scrub.x} y1={padT} x2={scrub.x} y2={padT + plotH} stroke={C.text} strokeWidth={1} strokeOpacity={0.5} />
            <Circle cx={scrub.x} cy={scrub.y} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
          </>
        )}
      </Svg>
      {scrub && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: Math.max(0, Math.min(W - 80, scrub.x - 40)), backgroundColor: C.text, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: C.bg, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{fmt(scrub.v)} {unit}</Text>
        </View>
      )}
    </View>
  );
}
