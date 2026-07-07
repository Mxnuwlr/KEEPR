/**
 * components/WorkoutProfileChart.js — Workout-Profil (intervals.icu-Stil)
 *
 * Zeigt die Phasen einer Einheit als Balken: Breite = Dauer, Höhe & Farbe = Zone.
 * Aufwärmphase, Load-/Intervall-Phasen und Cooldown werden so visuell erkennbar.
 *
 * Props:
 *   steps    — Array aus getSessionSteps() ({ phase, zone, minutes, label })
 *   height   — Balken-Höhe in px (Standard 64)
 *   showZones — Zonen-Legende darunter anzeigen (Standard true)
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import { getZone, stepsTotalMinutes } from '../utils/workoutStructure';

export default function WorkoutProfileChart({ steps, height = 64, showZones = true }) {
  const { colors: C, type: T, radius: R, spacing: S } = useTheme();
  if (!steps || steps.length === 0) return null;

  const total = stepsTotalMinutes(steps) || 1;
  // Welche Zonen kommen vor (für die Legende)
  const usedZones = [...new Set(steps.map(s => s.zone))]
    .sort((a, b) => getZone(a).height - getZone(b).height);

  return (
    <View>
      {/* Profil-Balken */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 1, backgroundColor: C.bgSecondary, borderRadius: R.md, padding: 4, borderWidth: 0.5, borderColor: C.border }}>
        {steps.map((s, i) => {
          const z = getZone(s.zone);
          const flex = Math.max(0.02, s.minutes / total);
          return (
            <View
              key={i}
              style={{
                flex,
                height: `${Math.max(14, z.height * 100)}%`,
                backgroundColor: z.color,
                borderTopLeftRadius: 3, borderTopRightRadius: 3,
                minWidth: 2,
              }}
            />
          );
        })}
      </View>

      {/* Phasen-Kurzinfo + Gesamtdauer */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: S.xs }}>
        <Text style={[T.caption, { color: C.textTertiary }]} numberOfLines={1}>
          {steps.length} Phasen · {Math.round(total)} Min
        </Text>
        {showZones && (
          <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1, marginLeft: S.sm }}>
            {usedZones.map(zk => {
              const z = getZone(zk);
              return (
                <View key={zk} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: z.color }} />
                  <Text style={[T.caption, { color: C.textTertiary, fontSize: 10 }]}>{z.short}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}
