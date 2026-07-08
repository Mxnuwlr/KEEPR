/**
 * screens/LegalScreen.js — Rechtstexte (Datenschutzerklärung / Nutzungsbedingungen)
 *
 * Route "Legal" mit param { type: 'privacy' | 'terms' }.
 * LegalBody ist exportiert und wird auch im AuthScreen (Consent-Modal
 * vor der Registrierung) wiederverwendet.
 * Inhalte liegen in src/data/legal.js.
 */

// React/RN
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

// Internal
import { useTheme } from '../theme';
import { ScreenHeader } from '../components/ui';
import { PRIVACY_SECTIONS, TERMS_SECTIONS, LEGAL_STAND } from '../data/legal';

export const LEGAL_TITLES = { privacy: 'Datenschutzerklärung', terms: 'Nutzungsbedingungen' };

/** Reiner Inhalt (ohne Header/ScrollView) — auch fürs Consent-Modal im AuthScreen. */
export function LegalBody({ type }) {
  const { colors: C, spacing: S, type: T } = useTheme();
  const sections = type === 'terms' ? TERMS_SECTIONS : PRIVACY_SECTIONS;
  return (
    <View>
      <Text style={[T.h2, { color: C.text }]}>{LEGAL_TITLES[type] || LEGAL_TITLES.privacy}</Text>
      <Text style={[T.caption, { color: C.textTertiary, marginTop: 4, marginBottom: S.lg }]}>Stand: {LEGAL_STAND}</Text>
      {sections.map((s, i) => (
        <View key={i} style={{ marginBottom: S.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <Text style={[T.label, { color: C.textTertiary, fontVariant: ['tabular-nums'] }]}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={[T.h3, { color: C.text, flex: 1 }]}>{s.title}</Text>
          </View>
          <Text style={[T.body, { color: C.textSecondary, lineHeight: 22 }]}>{s.text}</Text>
          {i < sections.length - 1 && (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginTop: S.lg }} />
          )}
        </View>
      ))}
    </View>
  );
}

export default function LegalScreen({ navigation, route }) {
  const { colors: C, spacing: S } = useTheme();
  const type = route?.params?.type || 'privacy';
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Rechtliches" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <LegalBody type={type} />
      </ScrollView>
    </View>
  );
}
