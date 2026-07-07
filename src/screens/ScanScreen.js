/**
 * screens/ScanScreen.js — Scanner: Kassenzettel, Kühlschrank & Barcode
 *
 * Drei Modi:
 *   - Kassenbon-Foto: analyzeReceiptWithGemini() → Produkt-Liste → bulkAddItems()
 *   - Kühlschrank: Einstieg in den geführten FridgeScan (eigener Screen)
 *   - Barcode-Scan: lookupBarcode() → InventoryAdd
 *
 * Foto-Auswahl via ImagePicker (Kamera oder Galerie).
 * Base64-Kodierung via expo-file-system für Gemini-Upload.
 * Layout nutzt das UI-Kit (ScreenHeader, Surface, PrimaryButton, GhostButton).
 */

// React/RN
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';

// Third-party
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Feather } from '@expo/vector-icons';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';
import { analyzeReceiptWithGemini, lookupBarcode } from '../api/client';
import { ScreenHeader, Surface, PrimaryButton, GhostButton } from '../components/ui';

/** Großes Icon-Feld im MenuRow-Stil (bgSecondary-Quadrat, dezentes Icon) */
function ModeIcon({ name }) {
  const { colors: C, radius: R, spacing: S } = useTheme();
  return (
    <View style={{ width: 56, height: 56, borderRadius: R.md, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: S.md }}>
      <Feather name={name} size={26} color={C.textSecondary} />
    </View>
  );
}

export default function ScanScreen({ navigation, route }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { geminiKey, bulkAddItems } = useStore();
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [products, setProducts] = useState(null);
  const [tab, setTab] = useState(route?.params?.tab || 'receipt');
  const [addedIndices, setAddedIndices] = useState(new Set());

  const runAnalysis = async (b64, mimeType, key) => {
    setScanning(true);
    try {
      const raw = await analyzeReceiptWithGemini(b64, mimeType, key);
      // Merge duplicates by name
      const merged = [];
      for (const item of raw) {
        const existing = merged.find(p => p.name.toLowerCase() === item.name.toLowerCase());
        if (existing) {
          existing.count = (existing.count || 1) + (item.count || 1);
        } else {
          merged.push({ ...item, count: item.count || 1 });
        }
      }
      setProducts(merged);
    } catch (e) {
      setPreview(null);
    }
    setScanning(false);
  };

  // Parse qty string → { amount, unit } e.g. "500 g" → { amount: 500, unit: 'g' }
  const parseQty = (qty) => {
    const m = (qty || '').match(/([\d.,]+)\s*(g|ml|kg|l|L|Stück|Dose|Packung|Flasche|Beutel|Tüte|Glas)/i);
    if (!m) return null;
    return { amount: parseFloat(m[1].replace(',', '.')), unit: m[2] };
  };

  const totalQtyStr = (qty, count) => {
    if (!count || count <= 1) return qty;
    const parsed = parseQty(qty);
    if (!parsed) return `${count}× ${qty}`;
    const total = parsed.amount * count;
    const u = parsed.unit.toLowerCase();
    if (u === 'g' && total >= 1000) return `${+(total / 1000).toFixed(2)} kg`;
    if (u === 'ml' && total >= 1000) return `${+(total / 1000).toFixed(2)} L`;
    return `${total} ${parsed.unit}`;
  };

  const pickImage = async (fromCamera) => {
    const key = geminiKey;
    if (!key) return;
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.08, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.08, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPreview(asset.uri);
    setProducts(null);
    setAddedIndices(new Set());
    const b64 = asset.base64 || await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    const mimeType = asset.mimeType ||
      (asset.uri.match(/\.png$/i) ? 'image/png' :
       asset.uri.match(/\.heic$/i) ? 'image/heic' : 'image/jpeg');
    await runAnalysis(b64, mimeType, key);
  };

  const addAll = async () => {
    try {
      const itemsToAdd = products
        .filter((_, i) => !addedIndices.has(i))
        .map(p => ({ ...p, qty: totalQtyStr(p.qty, p.count) }));
      if (itemsToAdd.length > 0) await bulkAddItems(itemsToAdd);
      setPreview(null);
      setProducts(null);
      setAddedIndices(new Set());
      navigation.goBack();
    } catch(e) {}
  };

  const openBarcodeScanner = () => navigation.navigate('BarcodeScanner');

  const TABS = [['receipt', 'Kassenzettel'], ['fridge', 'Kühlschrank'], ['barcode', 'Barcode']];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Scanner" onBack={() => navigation.goBack()} />

      {/* Modus-Wahl als Untertab-Leiste (wie Training/Tracken) */}
      <View style={{ flexDirection: 'row', backgroundColor: C.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        {TABS.map(([t, label]) => {
          const active = tab === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => { setTab(t); setPreview(null); setProducts(null); }}
              style={{ flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: active ? C.accent : 'transparent' }}
            >
              <Text style={{ color: active ? C.text : C.textTertiary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* Kassenzettel */}
        {tab === 'receipt' && <>
          {!preview && !scanning && !products && (
            <Surface style={{ alignItems: 'center', padding: S.lg }}>
              <ModeIcon name="file-text" />
              <Text style={[T.h3, { color: C.text, marginBottom: 6, textAlign: 'center' }]}>Kassenzettel scannen</Text>
              <Text style={[T.body, { color: C.textSecondary, textAlign: 'center', lineHeight: 22 }]}>
                Die KI erkennt alle Produkte und schätzt das Haltbarkeitsdatum. Getränke werden herausgefiltert.
              </Text>
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg, alignSelf: 'stretch' }}>
                <PrimaryButton label="Kamera" icon="camera" onPress={() => pickImage(true)} style={{ flex: 1 }} />
                <GhostButton label="Galerie" icon="image" onPress={() => pickImage(false)} style={{ flex: 1 }} />
              </View>
            </Surface>
          )}

          {preview && (
            <Surface style={{ padding: 0, overflow: 'hidden' }}>
              <Image source={{ uri: preview }} style={{ width: '100%', height: 200, resizeMode: 'cover' }} />
              {scanning && (
                <View style={{ padding: S.lg, alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color={C.text} size="large" />
                  <Text style={[T.bodyMed, { color: C.text }]}>KI analysiert…</Text>
                </View>
              )}
            </Surface>
          )}

          {products && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: S.md, marginBottom: 6 }}>
                <Feather name="check-circle" size={20} color={C.success} />
                <Text style={[T.h3, { color: C.text }]}>{products.length} Produkte erkannt</Text>
              </View>
              {products.some(p => p.unsicher) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.warning + '18', borderRadius: R.md, padding: 10, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.warning + '40' }}>
                  <Feather name="alert-triangle" size={15} color={C.warning} />
                  <Text style={[T.caption, { color: C.warning, flex: 1 }]}>
                    {products.filter(p => p.unsicher).length} Mengenangabe{products.filter(p => p.unsicher).length !== 1 ? 'n' : ''} unsicher — tippe zum Korrigieren
                  </Text>
                </View>
              )}
              {products.map((p, i) => (
                <View key={i} style={{ backgroundColor: C.surface, borderRadius: R.md, marginBottom: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: p.unsicher && !addedIndices.has(i) ? C.warning + '60' : C.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
                    <Feather name="package" size={20} color={C.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[T.bodyMed, { color: addedIndices.has(i) ? C.textTertiary : C.text }]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[T.caption, { color: C.textTertiary, marginTop: 1 }]}>
                        {totalQtyStr(p.qty, p.count)} · {p.caloriesPer100g ? `${p.caloriesPer100g} kcal/100g` : 'kcal unbekannt'}
                      </Text>
                    </View>
                    {addedIndices.has(i) ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.success + '20', borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Feather name="check" size={13} color={C.success} />
                        <Text style={[T.caption, { color: C.success, fontWeight: '600' }]}>Hinzugefügt</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => navigation.navigate('InventoryAdd', {
                          item: {
                            name: p.name,
                            qty: totalQtyStr(p.qty, p.count),
                            mhd: p.mhd,
                            category: p.category,
                            caloriesPer100g: p.caloriesPer100g,
                            proteinPer100g: p.proteinPer100g,
                            carbsPer100g: p.carbsPer100g,
                            fatPer100g: p.fatPer100g,
                          },
                          onSaved: () => setAddedIndices(prev => new Set([...prev, i])),
                        })}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.accent, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 5 }}
                      >
                        {p.unsicher && <Feather name="alert-circle" size={12} color={C.accentText + 'cc'} />}
                        <Feather name="plus" size={13} color={C.accentText} />
                        <Text style={[T.caption, { color: C.accentText, fontWeight: '600' }]}>Übernehmen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              {products.filter((_, i) => !addedIndices.has(i)).length > 0 && (
                <PrimaryButton
                  label={addedIndices.size > 0
                    ? `${products.filter((_, i) => !addedIndices.has(i)).length} verbleibende ins Inventar`
                    : 'Alle ins Inventar'}
                  icon="plus-circle"
                  onPress={addAll}
                  style={{ marginTop: S.md }}
                />
              )}
              <GhostButton
                label="Neuer Scan"
                icon="refresh-cw"
                onPress={() => { setPreview(null); setProducts(null); setAddedIndices(new Set()); }}
                style={{ marginTop: S.sm }}
              />
            </View>
          )}
        </>}

        {/* Kühlschrank */}
        {tab === 'fridge' && (
          <View>
            <Surface style={{ alignItems: 'center', padding: S.lg }}>
              <ModeIcon name="camera" />
              <Text style={[T.h3, { color: C.text, marginBottom: 6, textAlign: 'center' }]}>Kühlschrank scannen</Text>
              <Text style={[T.body, { color: C.textSecondary, textAlign: 'center', lineHeight: 22 }]}>
                Foto vom offenen Kühlschrank oder Vorratsschrank machen — die KI erkennt alle Lebensmittel und du gehst sie Schritt für Schritt durch.
              </Text>
              <PrimaryButton label="Scan starten" icon="camera" onPress={() => navigation.navigate('FridgeScan')} style={{ marginTop: S.lg, alignSelf: 'stretch' }} />
            </Surface>
            <View style={{ flexDirection: 'row', gap: S.sm, backgroundColor: C.surface, borderRadius: R.md, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginTop: S.md }}>
              <Feather name="info" size={15} color={C.textSecondary} />
              <Text style={[T.caption, { color: C.textSecondary, flex: 1, lineHeight: 18 }]}>Jedes erkannte Produkt wird auf dem Foto markiert und herangezoomt — Name, Menge und MHD kannst du vor dem Übernehmen anpassen.</Text>
            </View>
          </View>
        )}

        {/* Barcode */}
        {tab === 'barcode' && (
          <View>
            <Surface style={{ alignItems: 'center', padding: S.lg }}>
              <ModeIcon name="maximize" />
              <Text style={[T.h3, { color: C.text, marginBottom: 6, textAlign: 'center' }]}>Barcode scannen</Text>
              <Text style={[T.body, { color: C.textSecondary, textAlign: 'center', lineHeight: 22 }]}>Kamera öffnen und Barcode einscannen. Nährwerte werden automatisch aus der Datenbank geladen.</Text>
              <PrimaryButton label="Kamera öffnen" icon="camera" onPress={openBarcodeScanner} style={{ marginTop: S.lg, alignSelf: 'stretch' }} />
            </Surface>
            <View style={{ flexDirection: 'row', gap: S.sm, backgroundColor: C.surface, borderRadius: R.md, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginTop: S.md }}>
              <Feather name="info" size={15} color={C.textSecondary} />
              <Text style={[T.caption, { color: C.textSecondary, flex: 1, lineHeight: 18 }]}>Datenbank: Open Food Facts · 3+ Millionen Produkte · Bei unbekannten Produkten fragt die KI nach</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
