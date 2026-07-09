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
  const txMin = lngToTileX(minLng, zoom), txMax = lngToTileX(maxLng, zoom);
  const tyMin = latToTileY(maxLat, zoom), tyMax = latToTileY(minLat, zoom);
  const pad = 0.28;
  const startTX = Math.floor(txMin - pad), endTX = Math.ceil(txMax + pad);
  const startTY = Math.floor(tyMin - pad), endTY = Math.ceil(tyMax + pad);
  const tilesW = endTX - startTX, tilesH = endTY - startTY;

  const s = Math.min(width / (tilesW * TILE), height / (tilesH * TILE));
  const dispH = Math.min(height, tilesH * TILE * s);
  const dispW = tilesW * TILE * s;
  const offX = (width - dispW) / 2;
  const offY = (dispH - tilesH * TILE * s) / 2;

  const originX = startTX * TILE, originY = startTY * TILE;
  const toPx = ([lat, lng]) => [
    (lngToTileX(lng, zoom) * TILE - originX) * s + offX,
    (latToTileY(lat, zoom) * TILE - originY) * s + offY,
  ];
  const pts = route.map(toPx);
  const ptsStr = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];

  const layers = TILE_LAYERS[variant] || TILE_LAYERS.voyager;
  const tiles = [];
  for (let li = 0; li < layers.length; li++) {
    const url = layers[li];
    for (let tx = startTX; tx < endTX; tx++) {
      for (let ty = startTY; ty < endTY; ty++) {
        const wx = ((tx % n) + n) % n;
        tiles.push(
          <Image
            key={`${li}_${tx}_${ty}`}
            source={{ uri: url(zoom, wx, ty) }}
            style={{ position: 'absolute', left: (tx * TILE - originX) * s + offX, top: (ty * TILE - originY) * s + offY, width: TILE * s, height: TILE * s }}
          />
        );
      }
    }
  }

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
