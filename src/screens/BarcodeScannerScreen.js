/**
 * screens/BarcodeScannerScreen.js — Barcode-Scanner für Inventar
 *
 * Öffnet Kamera (expo-camera CameraView) und scannt EAN/QR-Barcodes.
 * Bei Scan: lookupBarcode() → Produkt-Vorschlag → navigation.navigate('InventoryAdd', { item })
 *
 * Verhindert Doppel-Scans mit scannedRef (ref statt state, kein Re-Render nötig).
 * Fordert Kamera-Permission via useCameraPermissions() an.
 */

// React/RN
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';

// Third-party
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

// Internal
import { lookupBarcode } from '../api/client';
import { useStore } from '../store';
import { useTheme } from '../theme';

export default function BarcodeScannerScreen({ route, navigation }) {
  const { colors: C, type: T, radius: R } = useTheme();
  const insets = useSafeAreaInsets();
  const { geminiKey } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [torch, setTorch] = useState(false);
  const isProcessing = useRef(false);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    setLoading(true);
    try {
      const product = await lookupBarcode(data, geminiKey);
      navigation.replace('InventoryAdd', {
        item: {
          name: product.name,
          qty: product.qty || '1 Stück',
          category: product.category || 'Sonstiges',
          caloriesPer100g: product.caloriesPer100g,
          proteinPer100g: product.proteinPer100g,
          carbsPer100g: product.carbsPer100g,
          fatPer100g: product.fatPer100g,
        }
      });
    } catch(e) {
      isProcessing.current = false;
      setLoading(false);
      Alert.alert(
        'Nicht gefunden',
        'Produkt nicht in Datenbank.',
        [
          { text: 'Nochmal', style: 'cancel' },
          { text: 'Manuell', onPress: () => navigation.replace('InventoryAdd', {}) },
        ]
      );
    }
  };

  if (!permission) return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={C.tint} />
    </View>
  );

  if (!permission.granted) return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={[T.body, { color: C.text, marginBottom: 20, textAlign: 'center' }]}>Kamera Berechtigung fehlt</Text>
      <TouchableOpacity
        style={{ backgroundColor: C.tint, borderRadius: R.md, padding: 14, alignItems: 'center', width: '100%', marginBottom: 10 }}
        onPress={requestPermission}
      >
        <Text style={[T.bodyMed, { color: C.tintText }]}>Berechtigung erteilen</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ backgroundColor: C.surface, borderRadius: R.md, padding: 14, alignItems: 'center', width: '100%', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
        onPress={() => navigation.goBack()}
      >
        <Text style={[T.bodyMed, { color: C.text }]}>Zurück</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
        onBarcodeScanned={loading ? undefined : handleBarCodeScanned}
        enableTorch={torch}
      />
      <View style={{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity
          style={{ position: 'absolute', top: 60, right: 20, backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, borderRadius: 24 }}
          onPress={() => setTorch(t => !t)}
        >
          <Feather name={torch ? 'zap' : 'zap-off'} size={22} color={torch ? C.tint : '#fff'} />
        </TouchableOpacity>
        <View style={{ width: 260, height: 160, borderWidth: 2, borderColor: C.tint, borderRadius: R.lg, backgroundColor: 'transparent' }} />
        {loading && (
          <View style={{ position: 'absolute', backgroundColor: 'rgba(10,10,10,0.95)', padding: 24, borderRadius: R.xl, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <ActivityIndicator color={C.tint} size="large" />
            <Text style={[T.body, { color: '#fff', marginTop: 10 }]}>Produkt wird gesucht…</Text>
          </View>
        )}
        {!loading && (
          <Text style={{ color: '#fff', marginTop: 20, fontSize: 14, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: R.sm }}>
            Barcode in den Rahmen halten
          </Text>
        )}
        <TouchableOpacity
          style={{ position: 'absolute', bottom: insets.bottom + 110, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 14, borderRadius: 30, paddingHorizontal: 24 }}
          onPress={() => navigation.goBack()}
        >
          <Feather name="x" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, marginLeft: 6 }}>Schließen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
