/**
 * utils/secureStorage.js — Verschlüsselte Speicherung für sensible Daten
 *
 * Nutzt expo-secure-store (iOS Keychain / Android Keystore) statt AsyncStorage
 * für sicherheitskritische Werte (Auth-Token, Drittanbieter-API-Keys).
 *
 * - Funktioniert nur im nativen Build (EAS / run:ios). In Expo Go (kein natives
 *   Modul) wird transparent auf AsyncStorage zurückgefallen, damit die Dev-
 *   Erfahrung nicht bricht.
 * - Migriert vorhandene Klartext-Werte aus AsyncStorage einmalig in den Keychain
 *   und löscht sie dort anschließend.
 *
 * Exports:
 *   getSecureItem(key)        — Wert lesen (mit Auto-Migration aus AsyncStorage)
 *   setSecureItem(key, value) — Wert verschlüsselt speichern
 *   removeSecureItem(key)     — Wert aus Keychain + AsyncStorage entfernen
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

let SecureStore = null;
try {
  SecureStore = require('expo-secure-store');
} catch (e) {
  // Natives Modul nicht verfügbar (Expo Go) → AsyncStorage-Fallback
}

const available = !!SecureStore && typeof SecureStore.getItemAsync === 'function';

/**
 * Liest einen sicheren Wert. Migriert dabei automatisch einen ggf. noch in
 * AsyncStorage liegenden Klartext-Wert in den Keychain.
 */
export async function getSecureItem(key) {
  if (!available) {
    return AsyncStorage.getItem(key);
  }
  try {
    const secure = await SecureStore.getItemAsync(key);
    if (secure != null) return secure;

    // Migration: alter Klartext-Wert aus AsyncStorage?
    const legacy = await AsyncStorage.getItem(key);
    if (legacy != null) {
      await SecureStore.setItemAsync(key, legacy);
      await AsyncStorage.removeItem(key);
      return legacy;
    }
    return null;
  } catch (e) {
    // Keychain-Fehler → defensiver Fallback
    return AsyncStorage.getItem(key);
  }
}

/** Speichert einen Wert verschlüsselt (Keychain). Fallback: AsyncStorage. */
export async function setSecureItem(key, value) {
  if (value == null) return removeSecureItem(key);
  if (!available) {
    return AsyncStorage.setItem(key, value);
  }
  try {
    await SecureStore.setItemAsync(key, value);
    // Etwaigen Altbestand aus AsyncStorage entfernen
    await AsyncStorage.removeItem(key);
  } catch (e) {
    await AsyncStorage.setItem(key, value);
  }
}

/** Entfernt einen Wert aus Keychain und AsyncStorage. */
export async function removeSecureItem(key) {
  try { await AsyncStorage.removeItem(key); } catch (e) {}
  if (!available) return;
  try { await SecureStore.deleteItemAsync(key); } catch (e) {}
}
