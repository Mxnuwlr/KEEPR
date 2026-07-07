/**
 * screens/FridgeScanScreen.js — Kühlschrank-Scan mit geführtem Review
 *
 * Flow:
 *   1. Foto vom Kühlschrank/Vorratsschrank (Kamera oder Galerie)
 *   2. analyzeFridgePhoto() → Produkte mit Bounding-Boxen (0–1000 normalisiert)
 *   3. Übersicht: alle Funde nummeriert umrandet auf dem Foto
 *   4. Schritt-für-Schritt-Review: App zoomt animiert auf jedes Produkt,
 *      Name/Menge editierbar → Übernehmen oder Überspringen
 *   5. Zusammenfassung → bulkAddItems() in die Speisekammer
 *
 * Zoom: Animated translateX/translateY/scale auf einem Wrapper um Bild + Boxen.
 * Transform-Reihenfolge [translate, scale] ⇒ Punkt p (rel. Bildmitte) → p·s + t,
 * also t = -boxCenter·s, damit die Box in der Containermitte landet.
 */

// React/RN
import React, { useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Animated, Easing, TextInput, Alert } from 'react-native';

// Third-party
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Feather } from '@expo/vector-icons';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';
import { analyzeFridgePhoto } from '../api/client';
import { ScreenHeader, Surface, PrimaryButton, GhostButton } from '../components/ui';

const ZOOM_PADDING = 1.7;   // Box füllt ~60% des sichtbaren Ausschnitts
const MAX_ZOOM = 6;
const ZOOM_MS = 550;

/** "500 g" → { amount: 500, unit: 'g' } (für count-Multiplikation) */
function parseQty(qty) {
  const m = (qty || '').match(/([\d.,]+)\s*(g|ml|kg|l|L|Stück|Dose|Packung|Flasche|Beutel|Tüte|Glas)/i);
  if (!m) return null;
  return { amount: parseFloat(m[1].replace(',', '.')), unit: m[2] };
}

function totalQtyStr(qty, count) {
  if (!count || count <= 1) return qty;
  const parsed = parseQty(qty);
  if (!parsed) return `${count}× ${qty}`;
  const total = parsed.amount * count;
  const u = parsed.unit.toLowerCase();
  if (u === 'g' && total >= 1000) return `${+(total / 1000).toFixed(2)} kg`;
  if (u === 'ml' && total >= 1000) return `${+(total / 1000).toFixed(2)} L`;
  return `${total} ${parsed.unit}`;
}

function formatDateDe(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return null;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function FridgeScanScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { bulkAddItems } = useStore();

  // 'start' | 'analyzing' | 'review' | 'summary'
  const [phase, setPhase] = useState('start');
  const [photo, setPhoto] = useState(null);          // { uri, width, height }
  const [items, setItems] = useState([]);            // erkannte Produkte (editierbar)
  const [decisions, setDecisions] = useState({});    // index → 'added' | 'skipped'
  const [index, setIndex] = useState(-1);            // -1 = Übersicht, sonst Artikel-Index
  const [container, setContainer] = useState(null);  // { w, h } des Bild-Bereichs
  const [saving, setSaving] = useState(false);

  // Animierte Zoom-Werte
  const anim = useRef({
    tx: new Animated.Value(0),
    ty: new Animated.Value(0),
    scale: new Animated.Value(1),
  }).current;

  // ── Bild ins Containermaß einpassen (contain) ──────────────────
  const fitted = useMemo(() => {
    if (!photo || !container) return null;
    const s = Math.min(container.w / photo.width, container.h / photo.height);
    return { w: photo.width * s, h: photo.height * s };
  }, [photo, container]);

  /** Box (0–1000) → Pixel-Rect im eingepassten Bild */
  const boxRect = useCallback((box) => {
    const [y1, x1, y2, x2] = box;
    return {
      x: (x1 / 1000) * fitted.w,
      y: (y1 / 1000) * fitted.h,
      w: ((x2 - x1) / 1000) * fitted.w,
      h: ((y2 - y1) / 1000) * fitted.h,
    };
  }, [fitted]);

  /** Ziel-Transform für einen Artikel (oder Übersicht bei i === -1) */
  const targetTransform = useCallback((i) => {
    if (i < 0 || !fitted || !items[i]) return { tx: 0, ty: 0, scale: 1 };
    const r = boxRect(items[i].box);
    let scale = Math.min(container.w / (r.w * ZOOM_PADDING), container.h / (r.h * ZOOM_PADDING));
    scale = Math.max(1, Math.min(MAX_ZOOM, scale));
    // Box-Mitte relativ zur Bildmitte → in die Containermitte schieben
    let tx = -(r.x + r.w / 2 - fitted.w / 2) * scale;
    let ty = -(r.y + r.h / 2 - fitted.h / 2) * scale;
    // Nicht über die Bildränder hinaus schieben
    const maxTx = Math.max(0, (fitted.w * scale - container.w) / 2);
    const maxTy = Math.max(0, (fitted.h * scale - container.h) / 2);
    tx = Math.max(-maxTx, Math.min(maxTx, tx));
    ty = Math.max(-maxTy, Math.min(maxTy, ty));
    return { tx, ty, scale };
  }, [fitted, container, items, boxRect]);

  const goTo = useCallback((i) => {
    setIndex(i);
    const t = targetTransform(i);
    Animated.parallel([
      Animated.timing(anim.tx, { toValue: t.tx, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(anim.ty, { toValue: t.ty, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(anim.scale, { toValue: t.scale, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [targetTransform, anim]);

  // ── Foto aufnehmen / wählen + analysieren ──────────────────────
  const pickImage = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.4, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.4, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, width: asset.width || 1000, height: asset.height || 1000 });
    setPhase('analyzing');
    try {
      const b64 = asset.base64 || await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const mimeType = asset.mimeType ||
        (asset.uri.match(/\.png$/i) ? 'image/png' :
         asset.uri.match(/\.heic$/i) ? 'image/heic' : 'image/jpeg');
      const found = await analyzeFridgePhoto(b64, mimeType);
      if (!found.length) {
        Alert.alert('Nichts erkannt', 'Auf dem Foto wurden keine Lebensmittel erkannt. Versuche es mit mehr Licht oder aus geringerer Entfernung.');
        setPhase('start');
        setPhoto(null);
        return;
      }
      setItems(found);
      setDecisions({});
      setIndex(-1);
      anim.tx.setValue(0); anim.ty.setValue(0); anim.scale.setValue(1);
      setPhase('review');
    } catch (e) {
      Alert.alert('Fehler', 'Die Analyse ist fehlgeschlagen. Bitte erneut versuchen.');
      setPhase('start');
      setPhoto(null);
    }
  };

  // ── Review-Aktionen ────────────────────────────────────────────
  const zoomOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(anim.tx, { toValue: 0, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(anim.ty, { toValue: 0, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(anim.scale, { toValue: 1, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [anim]);

  const decide = (verdict) => {
    setDecisions(prev => ({ ...prev, [index]: verdict }));
    if (index + 1 < items.length) goTo(index + 1);
    else { setPhase('summary'); zoomOut(); }
  };

  const updateItem = (patch) => {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const acceptedItems = items.filter((_, i) => decisions[i] === 'added');

  const saveAll = async (list) => {
    if (!list.length) { navigation.goBack(); return; }
    setSaving(true);
    try {
      await bulkAddItems(list.map(p => ({
        name: p.name,
        qty: totalQtyStr(p.qty, p.count),
        mhd: p.mhd,
        category: p.category,
        caloriesPer100g: p.caloriesPer100g,
        proteinPer100g: p.proteinPer100g,
        carbsPer100g: p.carbsPer100g,
        fatPer100g: p.fatPer100g,
      })));
      navigation.goBack();
    } catch (e) {
      Alert.alert('Fehler', 'Speichern fehlgeschlagen. Bitte erneut versuchen.');
    }
    setSaving(false);
  };

  const reset = () => {
    setPhase('start'); setPhoto(null); setItems([]); setDecisions({}); setIndex(-1);
    anim.tx.setValue(0); anim.ty.setValue(0); anim.scale.setValue(1);
  };

  const current = index >= 0 ? items[index] : null;
  const currentScale = index >= 0 ? targetTransform(index).scale : 1;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header (App-Standard) */}
      <ScreenHeader
        title="Kühlschrank-Scan"
        onBack={() => navigation.goBack()}
        rightLabel={phase === 'review' && index >= 0 ? `${index + 1}/${items.length}` : undefined}
      />

      {/* Start */}
      {phase === 'start' && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: 40 }}>
          <Surface style={{ alignItems: 'center', padding: S.lg, marginTop: S.md }}>
            <View style={{ width: 56, height: 56, borderRadius: R.md, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: S.md }}>
              <Feather name="camera" size={26} color={C.textSecondary} />
            </View>
            <Text style={[T.h3, { color: C.text, marginBottom: 6, textAlign: 'center' }]}>Kühlschrank fotografieren</Text>
            <Text style={[T.body, { color: C.textSecondary, textAlign: 'center', lineHeight: 22 }]}>
              Die KI erkennt alle Lebensmittel auf dem Foto. Danach gehst du sie Schritt für Schritt durch — die App zoomt auf jedes Produkt, du bestätigst Name und Menge.
            </Text>
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg, alignSelf: 'stretch' }}>
              <PrimaryButton label="Kamera" icon="camera" onPress={() => pickImage(true)} style={{ flex: 1 }} />
              <GhostButton label="Galerie" icon="image" onPress={() => pickImage(false)} style={{ flex: 1 }} />
            </View>
          </Surface>
          <View style={{ flexDirection: 'row', gap: S.sm, backgroundColor: C.surface, borderRadius: R.md, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginTop: S.md }}>
            <Feather name="info" size={15} color={C.textSecondary} />
            <Text style={[T.caption, { color: C.textSecondary, flex: 1, lineHeight: 18 }]}>
              Tipp: Fotografiere frontal mit offener Tür und gutem Licht. Mehrere Fächer? Einfach mehrere Scans machen.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Analysiert */}
      {phase === 'analyzing' && (
        <View style={{ flex: 1, paddingHorizontal: S.md }}>
          {photo && (
            <View style={{ borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginTop: S.sm }}>
              <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 320, resizeMode: 'cover' }} />
            </View>
          )}
          <View style={{ alignItems: 'center', gap: 10, marginTop: S.xl }}>
            <ActivityIndicator color={C.text} size="large" />
            <Text style={[T.bodyMed, { color: C.text }]}>KI erkennt Lebensmittel…</Text>
            <Text style={[T.caption, { color: C.textTertiary }]}>Das kann einen Moment dauern</Text>
          </View>
        </View>
      )}

      {/* Review: Foto mit Zoom + Boxen */}
      {(phase === 'review' || phase === 'summary') && photo && (
        <View style={{ flex: 1 }}>
          <View
            style={{ flex: 1, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}
            onLayout={e => setContainer({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          >
            {fitted && (
              <Animated.View
                style={{
                  width: fitted.w, height: fitted.h,
                  transform: [{ translateX: anim.tx }, { translateY: anim.ty }, { scale: anim.scale }],
                }}
              >
                <Image source={{ uri: photo.uri }} style={{ width: fitted.w, height: fitted.h }} />
                {items.map((it, i) => {
                  const r = boxRect(it.box);
                  const isCurrent = phase === 'review' && i === index;
                  const isOverview = index === -1 || phase === 'summary';
                  if (!isCurrent && !isOverview) return null;
                  const verdict = decisions[i];
                  const color = isCurrent ? C.tint : verdict === 'added' ? C.success : verdict === 'skipped' ? C.textTertiary : '#FFFFFF';
                  const bw = Math.max(0.5, (isCurrent ? 2.5 : 1.5) / (isCurrent ? currentScale : 1));
                  return (
                    <View key={i} pointerEvents="none" style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, borderWidth: bw, borderColor: color, borderRadius: 6 }}>
                      {isOverview && (
                        <View style={{ position: 'absolute', top: -9, left: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: verdict === 'added' ? C.success : verdict === 'skipped' ? C.textTertiary : C.tint, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{i + 1}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </Animated.View>
            )}
          </View>

          {/* Übersicht (Startpunkt des Durchgangs) */}
          {phase === 'review' && index === -1 && (
            <View style={{ padding: S.md, paddingBottom: 34 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: S.sm }}>
                <Feather name="check-circle" size={20} color={C.success} />
                <Text style={[T.h3, { color: C.text }]}>{items.length} Produkte erkannt</Text>
              </View>
              <PrimaryButton label="Schritt für Schritt durchgehen" icon="play" onPress={() => goTo(0)} />
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
                <GhostButton
                  label={saving ? 'Speichert…' : 'Alle direkt übernehmen'}
                  icon={saving ? undefined : 'zap'}
                  onPress={() => !saving && saveAll(items)}
                  style={{ flex: 1 }}
                />
                <GhostButton label="" icon="refresh-cw" onPress={reset} style={{ paddingHorizontal: 14 }} />
              </View>
            </View>
          )}

          {/* Artikel-Karte (aktueller Schritt) */}
          {phase === 'review' && current && (
            <View style={{ padding: S.md, paddingBottom: 34 }}>
              <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                  <TouchableOpacity
                    onPress={() => goTo(index - 1 >= 0 ? index - 1 : -1)}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Feather name="chevron-left" size={18} color={C.text} />
                  </TouchableOpacity>
                  <TextInput
                    value={current.name}
                    onChangeText={t => updateItem({ name: t })}
                    style={[T.h3, { color: C.text, flex: 1, padding: 0 }]}
                    placeholder="Name"
                    placeholderTextColor={C.textTertiary}
                  />
                  {current.unsicher && <Feather name="alert-circle" size={16} color={C.warning} />}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.sm }}>
                  <TextInput
                    value={String(current.qty || '')}
                    onChangeText={t => updateItem({ qty: t })}
                    style={[T.body, { color: C.text, backgroundColor: C.bgSecondary, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 7, flex: 1 }]}
                    placeholder="Menge (z.B. 500 g)"
                    placeholderTextColor={C.textTertiary}
                  />
                  {/* Anzahl-Stepper */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgSecondary, borderRadius: R.sm }}>
                    <TouchableOpacity onPress={() => updateItem({ count: Math.max(1, (current.count || 1) - 1) })} style={{ padding: 8 }}>
                      <Feather name="minus" size={15} color={C.text} />
                    </TouchableOpacity>
                    <Text style={[T.bodyMed, { color: C.text, minWidth: 24, textAlign: 'center' }]}>{current.count || 1}×</Text>
                    <TouchableOpacity onPress={() => updateItem({ count: (current.count || 1) + 1 })} style={{ padding: 8 }}>
                      <Feather name="plus" size={15} color={C.text} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[T.caption, { color: C.textTertiary, marginTop: 8 }]}>
                  {current.category || 'Sonstiges'}
                  {formatDateDe(current.mhd) ? ` · MHD ca. ${formatDateDe(current.mhd)}` : ''}
                  {current.caloriesPer100g ? ` · ${current.caloriesPer100g} kcal/100g` : ''}
                </Text>

                <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.md }}>
                  <GhostButton label="Überspringen" icon="x" onPress={() => decide('skipped')} style={{ flex: 1 }} />
                  <PrimaryButton label="Übernehmen" icon="check" onPress={() => decide('added')} style={{ flex: 1.4 }} />
                </View>
              </View>
            </View>
          )}

          {/* Zusammenfassung */}
          {phase === 'summary' && (
            <View style={{ padding: S.md, paddingBottom: 34 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: S.sm }}>
                <Feather name="check-circle" size={20} color={C.success} />
                <Text style={[T.h3, { color: C.text }]}>
                  {acceptedItems.length} von {items.length} übernommen
                </Text>
              </View>
              {acceptedItems.length > 0 && (
                <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.sm }]} numberOfLines={2}>
                  {acceptedItems.map(p => p.name).join(', ')}
                </Text>
              )}
              <PrimaryButton
                label={saving ? 'Speichert…' : (acceptedItems.length > 0 ? `${acceptedItems.length} in die Speisekammer` : 'Fertig')}
                icon={saving ? undefined : 'plus-circle'}
                disabled={saving}
                onPress={() => saveAll(acceptedItems)}
              />
              <GhostButton
                label="Nochmal durchgehen"
                icon="rotate-ccw"
                onPress={() => { setPhase('review'); goTo(0); }}
                style={{ marginTop: S.sm }}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
