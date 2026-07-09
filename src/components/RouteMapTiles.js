/**
 * components/RouteMapTiles.js — Statische GPS-Karte mit Kacheln (Vorschau/Banner)
 *
 * Echte Kartenkacheln (raster tiles) als <Image>-Raster + Route als SVG-Polyline —
 * ohne WebView, daher listen-tauglich. Zeigt IMMER die komplette Route.
 *
 * variant: 'voyager' (hell) | 'hybrid' (Satellit + Beschriftung)
 * markerFrac: 0..1 → animierter Punkt auf der Route (für Flyover im Banner)
 *
 * Props: { route, width, height, color, variant, markerFrac, showAttribution }
 */

// React/RN
import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

// Third-party
import Svg, { Polyline, Circle } from 'react-native-svg';

// Internal
import { useTheme } from '../theme';

const TILE = 256;
const lngToTileX = (lng, z) => ((lng + 180) / 360) * Math.pow(2, z);
const latToTileY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
};

// Kachel-URLs je Variante (Esri = z/y/x, CARTO = z/x/y). Für Hybrid werden Sat+Labels gestapelt.
const TILE_LAYERS = {
  voyager: [(z, x, y) => `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`],
  satellit: [(z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`],
  hybrid: [
    (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`,
  ],
};

export default function RouteMapTiles({ route, width, height = 180, color = '#FC4C02', variant = 'voyager', markerFrac = null, showAttribution = true }) {
  const { colors: C, radius: R } = useTheme();
  if (!Array.isArray(route) || route.length < 2 || !width) return null;

  const lats = route.map(p => p[0]), lngs = route.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  // Höchsten Zoom wählen, bei dem die GANZE Route (mit Rand) reinpasst
  let zoom = 15;
  for (let z = 16; z >= 3; z--) {
    const spanX = Math.abs(lngToTileX(maxLng, z) - lngToTileX(minLng, z));
    const spanY = Math.abs(latToTileY(minLat, z) - latToTileY(maxLat, z));
    if (spanX <= 3.2 && spanY <= 3.2) { zoom = z; break; }
  }

  const n = Math.pow(2, zoom);
  // Route-Bounding-Box in Welt-Pixeln bei diesem Zoom
  const pxMin = lngToTileX(minLng, zoom) * TILE, pxMax = lngToTileX(maxLng, zoom) * TILE;
  const pyMin = latToTileY(maxLat, zoom) * TILE, pyMax = latToTileY(minLat, zoom) * TILE;
  const pcx = (pxMin + pxMax) / 2, pcy = (pyMin + pyMax) / 2;
  const routeW = Math.max(pxMax - pxMin, 1), routeH = Math.max(pyMax - pyMin, 1);
  // Contain: ganze Route passt rein (mit Rand). Der Rest der Fläche wird mit
  // Kacheln gefüllt (nicht grau) → volle Breite/Höhe, Strecke zentriert.
  const PADF = 1.2;
  const s = Math.min(width / (routeW * PADF), height / (routeH * PADF));
  const X = (px) => (px - pcx) * s + width / 2;
  const Y = (py) => (py - pcy) * s + height / 2;

  const pts = route.map(([lat, lng]) => [X(lngToTileX(lng, zoom) * TILE), Y(latToTileY(lat, zoom) * TILE)]);
  const ptsStr = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];

  // Kachel-Bereich, der die ganze Fläche [0,width]×[0,height] abdeckt
  const txL = Math.floor((pcx + (0 - width / 2) / s) / TILE);
  const txR = Math.ceil((pcx + (width - width / 2) / s) / TILE);
  const tyL = Math.floor((pcy + (0 - height / 2) / s) / TILE);
  const tyR = Math.ceil((pcy + (height - height / 2) / s) / TILE);

  const layers = TILE_LAYERS[variant] || TILE_LAYERS.voyager;
  const tiles = [];
  for (let li = 0; li < layers.length; li++) {
    const url = layers[li];
    for (let tx = txL; tx < txR; tx++) {
      for (let ty = tyL; ty < tyR; ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        tiles.push(
          <Image
            key={`${li}_${tx}_${ty}`}
            source={{ uri: url(zoom, wx, ty) }}
            style={{ position: 'absolute', left: X(tx * TILE), top: Y(ty * TILE), width: TILE * s, height: TILE * s }}
          />
        );
      }
    }
  }
  const dispH = height;

  // Animierter Flyover-Marker
  let mk = null;
  if (markerFrac != null && markerFrac >= 0 && markerFrac <= 1) {
    const i = Math.min(pts.length - 1, Math.max(0, Math.round(markerFrac * (pts.length - 1))));
    mk = pts[i];
  }

  return (
    <View style={{ width, height: dispH, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.bgSecondary }}>
      {tiles}
      <Svg width={width} height={dispH} style={StyleSheet.absoluteFill}>
        <Polyline points={ptsStr} fill="none" stroke={color} strokeWidth={variant === 'voyager' ? 3 : 4} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={sx} cy={sy} r={5} fill="#22C55E" stroke="#fff" strokeWidth={1.5} />
        <Circle cx={ex} cy={ey} r={5} fill="#EF4444" stroke="#fff" strokeWidth={1.5} />
        {mk && <Circle cx={mk[0]} cy={mk[1]} r={7} fill={color} stroke="#fff" strokeWidth={2.5} />}
      </Svg>
      {showAttribution && (
        <Text style={{ position: 'absolute', right: 4, bottom: 2, fontSize: 8, color: '#fff', opacity: 0.7 }}>
          {variant === 'voyager' ? '© CARTO © OSM' : '© Esri'}
        </Text>
      )}
    </View>
  );
}
