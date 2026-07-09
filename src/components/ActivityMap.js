/**
 * components/ActivityMap.js — Interaktive GPS-Karte (Leaflet in WebView)
 *
 * Echte Karte wie Strava: zoomen, verschieben, echte OSM-Kacheln, füllt die
 * volle Breite (keine schwarzen Ränder). Route als Polyline, Start-/Zielmarker.
 *
 * Imperative API via ref:
 *   ref.showAt(fraction)  — bewegt einen Positions-Marker auf die Route (0..1)
 *   ref.hide()            — versteckt ihn
 * → wird vom Diagramm-Scrubber genutzt (Punkt auf der Strecke).
 *
 * Props: { route:[[lat,lng]], color, height }
 */

// React/RN
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const buildHtml = (route, color) => {
  const pts = JSON.stringify(route);
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;padding:0;background:#0f0e0c}.leaflet-control-attribution{font-size:8px}</style>
</head><body><div id="m"></div><script>
var pts=${pts};
var map=L.map('m',{zoomControl:true,attributionControl:true}).setView(pts[0],13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var line=L.polyline(pts,{color:'${color}',weight:4,opacity:0.9}).addTo(map);
map.fitBounds(line.getBounds(),{padding:[24,24]});
L.circleMarker(pts[0],{radius:6,color:'#fff',weight:2,fillColor:'#22C55E',fillOpacity:1}).addTo(map);
L.circleMarker(pts[pts.length-1],{radius:6,color:'#fff',weight:2,fillColor:'#EF4444',fillOpacity:1}).addTo(map);
var cursor=null;
function showAt(f){
  if(f<0||f>1){if(cursor){map.removeLayer(cursor);cursor=null;}return;}
  var i=Math.min(pts.length-1,Math.max(0,Math.round(f*(pts.length-1))));
  var p=pts[i];
  if(!cursor){cursor=L.circleMarker(p,{radius:8,color:'#fff',weight:3,fillColor:'${color}',fillOpacity:1}).addTo(map);}
  else cursor.setLatLng(p);
}
document.addEventListener('message',function(e){try{var d=JSON.parse(e.data);if(d.t==='cursor')showAt(d.f);}catch(_){}});
window.addEventListener('message',function(e){try{var d=JSON.parse(e.data);if(d.t==='cursor')showAt(d.f);}catch(_){}});
</script></body></html>`;
};

const ActivityMap = forwardRef(({ route, color = '#FC4C02', height = 300 }, ref) => {
  const webRef = useRef(null);
  useImperativeHandle(ref, () => ({
    showAt: (f) => { try { webRef.current?.injectJavaScript(`showAt(${f});true;`); } catch (e) {} },
    hide: () => { try { webRef.current?.injectJavaScript(`showAt(-1);true;`); } catch (e) {} },
  }));

  if (!Array.isArray(route) || route.length < 2) return null;

  return (
    <View style={{ height, width: '100%', backgroundColor: '#0f0e0c' }}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: buildHtml(route, color) }}
        style={{ flex: 1, backgroundColor: '#0f0e0c' }}
        scrollEnabled={false}
        nestedScrollEnabled
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="hardware"
      />
    </View>
  );
});

export default ActivityMap;
