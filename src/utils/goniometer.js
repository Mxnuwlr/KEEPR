/**
 * utils/goniometer.js — Winkelmesser über Geräte-Sensorik (DeviceMotion)
 *
 * Misst, um wie viel Grad das Gerät seit dem Start gedreht/gekippt wurde
 * (max. erreichter Winkel = Bewegungsumfang). Genutzt fürs Mobility-Assessment
 * (Handy an Körperteil legen → Start → Bewegung → max. Winkel).
 *
 * Braucht `expo-sensors` (DeviceMotion). Funktioniert nur im nativen Dev-Build,
 * nicht in Expo Go. Fällt sauber zurück (available=false), wenn nicht vorhanden.
 *
 * Export: useGoniometer() → { available, angle, maxAngle, running, start, stop, reset }
 */

import { useEffect, useRef, useState, useCallback } from 'react';

let DeviceMotion = null;
try {
  DeviceMotion = require('expo-sensors').DeviceMotion;
} catch (e) {
  // expo-sensors nicht installiert / nicht verfügbar (z.B. Expo Go)
}

const RAD2DEG = 180 / Math.PI;

// Normalisiert eine Winkeldifferenz auf [-180, 180] Grad
function normDeg(d) {
  let x = d % 360;
  if (x > 180) x -= 360;
  if (x < -180) x += 360;
  return x;
}

export function useGoniometer() {
  const available = !!DeviceMotion;
  const [angle, setAngle] = useState(0);
  const [maxAngle, setMaxAngle] = useState(0);
  const [running, setRunning] = useState(false);
  const baseRef = useRef(null);      // { beta, gamma } in Grad beim Start
  const maxRef = useRef(0);
  const subRef = useRef(null);

  const cleanup = useCallback(() => {
    if (subRef.current) { try { subRef.current.remove(); } catch (e) {} subRef.current = null; }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (!available) return false;
    baseRef.current = null;
    maxRef.current = 0;
    setMaxAngle(0);
    setAngle(0);
    try { DeviceMotion.setUpdateInterval(60); } catch (e) {}
    cleanup();
    subRef.current = DeviceMotion.addListener((data) => {
      const r = data?.rotation;
      if (!r) return;
      const beta = r.beta * RAD2DEG;   // Kippen vor/zurück
      const gamma = r.gamma * RAD2DEG; // Kippen seitlich
      if (!baseRef.current) { baseRef.current = { beta, gamma }; return; }
      const dB = normDeg(beta - baseRef.current.beta);
      const dG = normDeg(gamma - baseRef.current.gamma);
      const delta = Math.sqrt(dB * dB + dG * dG); // Gesamt-Winkelabweichung vom Start
      setAngle(Math.round(delta));
      if (delta > maxRef.current) { maxRef.current = delta; setMaxAngle(Math.round(delta)); }
    });
    setRunning(true);
    return true;
  }, [available, cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setRunning(false);
    return Math.round(maxRef.current);
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    baseRef.current = null;
    maxRef.current = 0;
    setRunning(false);
    setAngle(0);
    setMaxAngle(0);
  }, [cleanup]);

  return { available, angle, maxAngle, running, start, stop, reset };
}
