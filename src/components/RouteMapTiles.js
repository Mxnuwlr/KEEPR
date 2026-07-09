/**
 * components/RouteMapTiles.js — Echte GPS-Karte mit OpenStreetMap-Kacheln (Strava-Stil)
 *
 * Rendert echte Kartenkacheln (raster tiles von OSM) als <Image>-Raster und legt
 * die GPS-Route als SVG-Polyline darüber — ohne natives Map-Modul.
 *
 * Web-Mercator-Projektion: Route-Bounding-Box → passender Zoom (höchster, bei dem
 * die Strecke in ~4×4 Kacheln passt) → Kachel-Raster + pixelgenaue Route-Overlay.
 * Alles um Faktor s skaliert, damit es in die Kartenbreite passt.
 *
 * Props: { route: [[lat,lng],...], width, height, color }
 */

// React/RN
import React from 'react';
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

const TILE_URL = (z, x, y) => `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;

export default function RouteMapTiles({ route, width, height = 220, color = '#FC4C02', showAttribution = true }) {
  const { colors: C, radius: R } = useTheme();
  if (!Array.isArray(route) || route.length < 2 || !width) return null;

  const lats = route.map(p => p[0]);
  const lngs = route.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  // Höchsten Zoom wählen, bei dem die Route in ~4 Kacheln (mit Rand) passt
  let zoom = 15;
  for (let z = 15; z >= 3; z--) {
    const spanX = Math.abs(lngToTileX(maxLng, z) - lngToTileX(minLng, z));
    const spanY = Math.abs(latToTileY(minLat, z) - latToTileY(maxLat, z));
    if (spanX <= 3.4 && spanY <= 3.4) { zoom = z; break; }
  }

  const n = Math.pow(2, zoom);
  const txMin = lngToTileX(minLng, zoom), txMax = lngToTileX(maxLng, zoom);
  const tyMin = latToTileY(maxLat, zoom), tyMax = latToTileY(minLat, zoom); // Norden = kleineres y

  const pad = 0.25;
  const startTX = Math.floor(txMin - pad), endTX = Math.ceil(txMax + pad);
  const startTY = Math.floor(tyMin - pad), endTY = Math.ceil(tyMax + pad);
  const tilesW = endTX - startTX, tilesH = endTY - startTY;

  // Skalierung: gesamtes Kachel-Raster auf Kartenbreite bringen; Höhe max = height
  const sFit = width / (tilesW * TILE);
  const s = Math.min(sFit, height / (tilesH * TILE));
  const dispW = tilesW * TILE * s;
  const dispH = tilesH * TILE * s;
  // zentrieren
  const offX = (width - dispW) / 2;

  const originX = startTX * TILE, originY = startTY * TILE;
  const pts = route.map(([lat, lng]) => {
    const px = (lngToTileX(lng, zoom) * TILE - originX) * s + offX;
    const py = (latToTileY(lat, zoom) * TILE - originY) * s;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  });
  const [sx, sy] = pts[0].split(',').map(Number);
  const [ex, ey] = pts[pts.length - 1].split(',').map(Number);

  const tiles = [];
  for (let tx = startTX; tx < endTX; tx++) {
    for (let ty = startTY; ty < endTY; ty++) {
      const wx = ((tx % n) + n) % n; // horizontal umbrechen
      tiles.push(
        <Image
          key={`${tx}_${ty}`}
          source={{ uri: TILE_URL(zoom, wx, ty) }}
          style={{ position: 'absolute', left: (tx * TILE - originX) * s + offX, top: (ty * TILE - originY) * s, width: TILE * s, height: TILE * s }}
        />
      );
    }
  }

  return (
    <View style={{ width, height: dispH, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.bgSecondary }}>
      {tiles}
      <Svg width={width} height={dispH} style={StyleSheet.absoluteFill}>
        <Polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={sx} cy={sy} r={6} fill="#22C55E" stroke="#fff" strokeWidth={2} />
        <Circle cx={ex} cy={ey} r={6} fill="#EF4444" stroke="#fff" strokeWidth={2} />
      </Svg>
      {showAttribution && (
        <Text style={{ position: 'absolute', right: 4, bottom: 2, fontSize: 8, color: '#000', opacity: 0.45, backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 3, borderRadius: 2 }}>
          © CARTO © OSM
        </Text>
      )}
    </View>
  );
}
