/**
 * components/ActivityMap.js — Interaktive GPS-Karte (Leaflet in WebView)
 *
 * Vollbild-taugliche Karte wie Strava/Komoot: zoomen, verschieben, echte Kacheln,
 * mehrere Kartenstile (Standard / Satellit / Hybrid), Flyover-Animation der Route.
 *
 * Imperative API via ref:
 *   showAt(fraction)  — Positions-Marker auf der Route (0..1) für den Diagramm-Scrub
 *   hide()            — Marker verstecken
 *   setLayer(name)    — 'standard' | 'satellit' | 'hybrid'
 *   flyover()         — animiert einen Marker die Strecke entlang
 *   recenter()        — auf die Route zoomen
 *
 * Props: { route:[[lat,lng]], color, layer }
 */

// React/RN
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const buildHtml = (route, color, layer, bottomPad) => {
  const pts = JSON.stringify(route);
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;padding:0;background:#0f0e0c}
.leaflet-control-attribution{font-size:8px}
.leaflet-control-zoom{display:none}</style>
</head><body><div id="m"></div><script>
var pts=${pts};
var map=L.map('m',{zoomControl:false,attributionControl:true}).setView(pts[0],13);
var bases={
  standard:L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',{maxZoom:20,subdomains:'abcd',attribution:'© OSM © CARTO'}),
  satellit:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'© Esri'}),
  topo:L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,subdomains:'abc',attribution:'© OpenTopoMap'})
};
var labels=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19});
var overlayDefs={
  relief:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,opacity:0.35}),
  radwege:L.tileLayer('https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© waymarkedtrails.org'})
};
var line=L.polyline(pts,{color:'${color}',weight:5,opacity:0.95});
function applyLayers(base, ovs){
  Object.values(bases).forEach(function(l){map.removeLayer(l);});
  map.removeLayer(labels);
  Object.values(overlayDefs).forEach(function(l){map.removeLayer(l);});
  if(base==='hybrid'){bases.satellit.addTo(map);labels.addTo(map);}
  else {(bases[base]||bases.standard).addTo(map);}
  (ovs||[]).forEach(function(o){if(overlayDefs[o])overlayDefs[o].addTo(map);});
  if(map.hasLayer(line))line.bringToFront();
}
applyLayers('${layer}', []);
line.addTo(map);
var BP=${Math.round(bottomPad || 0)};
function recenter(bp){
  if(bp==null||bp<0)bp=BP;
  map.fitBounds(line.getBounds(),{paddingTopLeft:[26,80],paddingBottomRight:[26,bp+26]});
}
recenter();
L.circleMarker(pts[0],{radius:6,color:'#fff',weight:2,fillColor:'#22C55E',fillOpacity:1}).addTo(map);
L.circleMarker(pts[pts.length-1],{radius:6,color:'#fff',weight:2,fillColor:'#EF4444',fillOpacity:1}).addTo(map);
var cursor=null;
function showAt(f){
  if(f<0||f>1){if(cursor){map.removeLayer(cursor);cursor=null;}return;}
  var i=Math.min(pts.length-1,Math.max(0,Math.round(f*(pts.length-1))));
  var p=pts[i];
  if(!cursor)cursor=L.circleMarker(p,{radius:8,color:'#fff',weight:3,fillColor:'${color}',fillOpacity:1}).addTo(map);
  else cursor.setLatLng(p);
}
function postRN(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(_){}}
var flyTimer=null;
function flyover(){
  if(flyTimer){clearInterval(flyTimer);flyTimer=null;if(cursor){map.removeLayer(cursor);cursor=null;}postRN({t:'flyend'});return;}
  var i=0, step=Math.max(1,Math.round(pts.length/200));
  flyTimer=setInterval(function(){
    if(i>=pts.length){showAt(1);clearInterval(flyTimer);flyTimer=null;setTimeout(function(){if(cursor){map.removeLayer(cursor);cursor=null;}postRN({t:'flyend'});},500);return;}
    showAt(i/(pts.length-1)); i+=step;
  },60);
}
</script></body></html>`;
};

const ActivityMap = forwardRef(({ route, color = '#FC4C02', layer = 'satellit', bottomPad = 0, onFlyEnd }, ref) => {
  const webRef = useRef(null);
  const inject = (js) => { try { webRef.current?.injectJavaScript(js + ';true;'); } catch (e) {} };
  useImperativeHandle(ref, () => ({
    showAt: (f) => inject(`showAt(${f})`),
    hide: () => inject(`showAt(-1)`),
    applyLayers: (base, ovs) => inject(`applyLayers(${JSON.stringify(base)}, ${JSON.stringify(ovs || [])})`),
    flyover: () => inject(`flyover()`),
    recenter: (bp) => inject(`recenter(${bp == null ? 'null' : Math.round(bp)})`),
  }));

  if (!Array.isArray(route) || route.length < 2) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0e0c' }}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: buildHtml(route, color, layer, bottomPad) }}
        style={{ flex: 1, backgroundColor: '#0f0e0c' }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="hardware"
        onMessage={(e) => { try { const d = JSON.parse(e.nativeEvent.data); if (d.t === 'flyend') onFlyEnd?.(); } catch (err) {} }}
      />
    </View>
  );
});

export default ActivityMap;
