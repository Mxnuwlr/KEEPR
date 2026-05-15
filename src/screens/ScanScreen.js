import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { analyzeReceiptWithGemini, lookupBarcode } from '../api/client';

export default function ScanScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { geminiKey, bulkAddItems, addItem } = useStore();
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [products, setProducts] = useState(null);
  const [tab, setTab] = useState('receipt');
  const [editingIdx, setEditingIdx] = useState(null);

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
    const b64 = asset.base64 || await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    const mimeType = asset.mimeType ||
      (asset.uri.match(/\.png$/i) ? 'image/png' :
       asset.uri.match(/\.heic$/i) ? 'image/heic' : 'image/jpeg');
    await runAnalysis(b64, mimeType, key);
  };

  const updateProductQty = (idx, newQty) => {
    setProducts(p => p.map((item, i) => i === idx ? { ...item, qty: newQty, unsicher: false } : item));
  };

  const addAll = async () => {
    try {
      const itemsToAdd = products.map(p => ({
        ...p,
        qty: totalQtyStr(p.qty, p.count),
      }));
      await bulkAddItems(itemsToAdd);
      setPreview(null);
      setProducts(null);
      setEditingIdx(null);
      navigation.goBack();
    } catch(e) {}
  };

  const openBarcodeScanner = () => {
    navigation.navigate('BarcodeScanner', {
      onScanned: async (product) => {
        try {
          await addItem(product);
          navigation.goBack();
        } catch(e) {}
      }
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: S.md, paddingTop: 60, paddingBottom: S.md }}>
        <Text style={[T.h1, { color: C.text }]}>Scanner</Text>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', marginHorizontal: S.md, marginBottom: S.lg, backgroundColor: C.surface, borderRadius: R.md, padding: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
        {[['receipt', 'Kassenzettel', 'file-text'], ['barcode', 'Barcode', 'maximize']].map(([t, label, icon]) => (
          <TouchableOpacity
            key={t}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: R.sm, backgroundColor: tab === t ? C.tint : 'transparent' }}
            onPress={() => { setTab(t); setPreview(null); setProducts(null); }}
          >
            <Feather name={icon} size={15} color={tab === t ? C.tintText : C.textSecondary} />
            <Text style={[T.label, { color: tab === t ? C.tintText : C.textSecondary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* Kassenzettel */}
        {tab === 'receipt' && <>
          {!preview && !scanning && !products && (
            <View style={{ backgroundColor: C.surface, borderRadius: R.xl, padding: 28, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.md }}>
              <View style={{ width: 88, height: 88, borderRadius: R.xl, backgroundColor: C.tint + '14', alignItems: 'center', justifyContent: 'center', marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '30' }}>
                <Feather name="file-text" size={40} color={C.tint} />
              </View>
              <Text style={[T.h3, { color: C.text, marginBottom: S.sm, textAlign: 'center' }]}>Kassenzettel scannen</Text>
              <Text style={[T.body, { color: C.textSecondary, textAlign: 'center', lineHeight: 22 }]}>
                KI erkennt alle Produkte und schätzt das MHD automatisch. Getränke werden herausgefiltert.
              </Text>
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.tint, borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 14 }}
                  onPress={() => pickImage(true)}
                >
                  <Feather name="camera" size={18} color={C.tintText} />
                  <Text style={[T.bodyMed, { color: C.tintText }]}>Kamera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                  onPress={() => pickImage(false)}
                >
                  <Feather name="image" size={18} color={C.text} />
                  <Text style={[T.bodyMed, { color: C.text }]}>Galerie</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {preview && (
            <View style={{ backgroundColor: C.surface, borderRadius: R.lg, overflow: 'hidden', marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              <Image source={{ uri: preview }} style={{ width: '100%', height: 200, resizeMode: 'cover' }} />
              {scanning && (
                <View style={{ padding: S.lg, alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color={C.tint} size="large" />
                  <Text style={[T.bodyMed, { color: C.text }]}>KI analysiert…</Text>
                </View>
              )}
            </View>
          )}

          {products && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Feather name="check-circle" size={22} color={C.success} />
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
                <View key={i} style={{ backgroundColor: C.surface, borderRadius: R.md, marginBottom: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: p.unsicher ? C.warning + '60' : C.border, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                    <Text style={{ fontSize: 22, marginRight: 10 }}>{p.emoji || '📦'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[T.bodyMed, { color: C.text }]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[T.caption, { color: C.textTertiary, marginTop: 1 }]}>
                        {p.caloriesPer100g ? `${p.caloriesPer100g} kcal/100g` : 'Kalorien unbekannt'} · MHD {p.mhd ? new Date(p.mhd).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '?'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setEditingIdx(editingIdx === i ? null : i)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: p.unsicher ? C.warning + '20' : C.bgSecondary, borderRadius: R.sm, paddingHorizontal: 8, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: p.unsicher ? C.warning + '50' : C.border }}
                    >
                      {p.unsicher && <Feather name="alert-circle" size={12} color={C.warning} />}
                      {p.count > 1 && (
                        <Text style={[T.caption, { color: C.tint, fontWeight: '700' }]}>{p.count}×</Text>
                      )}
                      <Text style={[T.caption, { color: p.unsicher ? C.warning : C.textSecondary, fontWeight: '600' }]}>
                        {p.qty}{p.count > 1 ? ` = ${totalQtyStr(p.qty, p.count)}` : ''}
                      </Text>
                      <Feather name="edit-2" size={11} color={p.unsicher ? C.warning : C.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {editingIdx === i && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: 12, paddingBottom: 130 }}>
                      <TextInput
                        style={{ flex: 1, backgroundColor: C.bg, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.accent, paddingHorizontal: 10, paddingVertical: 7, color: C.text, fontSize: 14 }}
                        value={p.qty}
                        onChangeText={v => updateProductQty(i, v)}
                        placeholder="z.B. 500 g oder 6 Stück"
                        placeholderTextColor={C.textTertiary}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={() => setEditingIdx(null)}
                      />
                      <TouchableOpacity onPress={() => setEditingIdx(null)} style={{ backgroundColor: C.accent, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 7 }}>
                        <Text style={{ color: C.accentText, fontWeight: '700', fontSize: 13 }}>OK</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.tint, borderRadius: R.md, padding: 14, marginTop: S.md }}
                onPress={addAll}
              >
                <Feather name="plus-circle" size={18} color={C.tintText} />
                <Text style={[T.bodyMed, { color: C.tintText }]}>Alle ins Inventar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.bgSecondary, borderRadius: R.md, padding: 14, marginTop: S.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                onPress={() => { setPreview(null); setProducts(null); }}
              >
                <Feather name="refresh-cw" size={16} color={C.text} />
                <Text style={[T.bodyMed, { color: C.text }]}>Neuer Scan</Text>
              </TouchableOpacity>
            </View>
          )}
        </>}

        {/* Barcode */}
        {tab === 'barcode' && (
          <View>
            <TouchableOpacity
              style={{ backgroundColor: C.surface, borderRadius: R.xl, padding: 28, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.md }}
              onPress={openBarcodeScanner}
              activeOpacity={0.8}
            >
              <View style={{ width: 88, height: 88, borderRadius: R.xl, backgroundColor: C.tint + '14', alignItems: 'center', justifyContent: 'center', marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '30' }}>
                <Feather name="maximize" size={40} color={C.tint} />
              </View>
              <Text style={[T.h3, { color: C.text, marginBottom: S.sm, textAlign: 'center' }]}>Barcode scannen</Text>
              <Text style={[T.body, { color: C.textSecondary, textAlign: 'center', lineHeight: 22 }]}>Kamera öffnen und Barcode einscannen. Nährwerte werden automatisch aus der Datenbank geladen.</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.tint, borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: 14, marginTop: S.lg }}>
                <Feather name="camera" size={18} color={C.tintText} />
                <Text style={[T.bodyMed, { color: C.tintText }]}>Kamera öffnen</Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: S.sm, backgroundColor: C.surface, borderRadius: R.md, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              <Feather name="info" size={15} color={C.textSecondary} />
              <Text style={[T.caption, { color: C.textSecondary, flex: 1, lineHeight: 18 }]}>Datenbank: Open Food Facts · 3+ Millionen Produkte · Bei unbekannten Produkten fragt die KI nach</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
