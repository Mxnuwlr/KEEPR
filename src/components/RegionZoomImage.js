/**
 * components/RegionZoomImage.js — Bild mit Bounding-Boxen und animiertem Region-Zoom
 *
 * Zeigt ein (auch remotes) Bild contain-gefittet in seinem Container und zoomt
 * animiert auf eine fokussierte Box (focus = Index, -1 = Übersicht mit allen Boxen).
 * Gleiche Transform-Mathe wie FridgeScanScreen: Wrapper-Animated.View mit
 * [translate, scale] ⇒ Punkt p (rel. Bildmitte) → p·s + t, also t = -boxCenter·s.
 *
 * Props:
 *   uri     — Bild-URL/URI
 *   boxes   — [{ box:[ymin,xmin,ymax,xmax] (0–1000), color, label? }]
 *   focus   — Index der fokussierten Box, -1 = herausgezoomte Übersicht
 *   style   — Style des Containers (braucht feste/flexe Größe)
 */

// React/RN
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Image, Animated, Easing } from 'react-native';

const ZOOM_PADDING = 1.9;   // Box füllt ~50% des Ausschnitts (Kontext bleibt sichtbar)
const MAX_ZOOM = 5;
const ZOOM_MS = 550;

export default function RegionZoomImage({ uri, boxes = [], focus = -1, style }) {
  const [container, setContainer] = useState(null);   // { w, h }
  const [imgDims, setImgDims] = useState(null);       // { w, h } Originalbild

  const anim = useRef({
    tx: new Animated.Value(0),
    ty: new Animated.Value(0),
    scale: new Animated.Value(1),
  }).current;

  // Bildmaße laden (remote)
  useEffect(() => {
    let alive = true;
    setImgDims(null);
    if (uri) Image.getSize(uri, (w, h) => { if (alive) setImgDims({ w, h }); }, () => {});
    return () => { alive = false; };
  }, [uri]);

  const fitted = useMemo(() => {
    if (!container || !imgDims) return null;
    const s = Math.min(container.w / imgDims.w, container.h / imgDims.h);
    return { w: imgDims.w * s, h: imgDims.h * s };
  }, [container, imgDims]);

  const boxRect = useCallback((box) => {
    const [y1, x1, y2, x2] = box;
    return {
      x: (x1 / 1000) * fitted.w,
      y: (y1 / 1000) * fitted.h,
      w: ((x2 - x1) / 1000) * fitted.w,
      h: ((y2 - y1) / 1000) * fitted.h,
    };
  }, [fitted]);

  const targetTransform = useCallback((i) => {
    if (i < 0 || !fitted || !boxes[i]?.box) return { tx: 0, ty: 0, scale: 1 };
    const r = boxRect(boxes[i].box);
    let scale = Math.min(container.w / (r.w * ZOOM_PADDING), container.h / (r.h * ZOOM_PADDING));
    scale = Math.max(1, Math.min(MAX_ZOOM, scale));
    let tx = -(r.x + r.w / 2 - fitted.w / 2) * scale;
    let ty = -(r.y + r.h / 2 - fitted.h / 2) * scale;
    const maxTx = Math.max(0, (fitted.w * scale - container.w) / 2);
    const maxTy = Math.max(0, (fitted.h * scale - container.h) / 2);
    tx = Math.max(-maxTx, Math.min(maxTx, tx));
    ty = Math.max(-maxTy, Math.min(maxTy, ty));
    return { tx, ty, scale };
  }, [fitted, container, boxes, boxRect]);

  // Bei Fokus-/Layoutwechsel zur Ziel-Transformation animieren
  useEffect(() => {
    if (!fitted) return;
    const t = targetTransform(focus);
    Animated.parallel([
      Animated.timing(anim.tx, { toValue: t.tx, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(anim.ty, { toValue: t.ty, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(anim.scale, { toValue: t.scale, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [focus, fitted, targetTransform]);

  const currentScale = targetTransform(focus).scale;

  return (
    <View
      style={[{ overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }, style]}
      onLayout={e => setContainer({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {fitted && (
        <Animated.View
          style={{
            width: fitted.w, height: fitted.h,
            transform: [{ translateX: anim.tx }, { translateY: anim.ty }, { scale: anim.scale }],
          }}
        >
          <Image source={{ uri }} style={{ width: fitted.w, height: fitted.h }} />
          {boxes.map((b, i) => {
            if (!b?.box) return null;
            const isCurrent = i === focus;
            const isOverview = focus === -1;
            if (!isCurrent && !isOverview) return null;
            const r = boxRect(b.box);
            const bw = Math.max(0.5, (isCurrent ? 2.5 : 1.5) / (isCurrent ? currentScale : 1));
            return (
              <View key={i} pointerEvents="none" style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, borderWidth: bw, borderColor: b.color || '#fff', borderRadius: 6 }}>
                {isOverview && b.label != null && (
                  <View style={{ position: 'absolute', top: -9, left: -9, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: b.color || '#fff', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{b.label}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}
