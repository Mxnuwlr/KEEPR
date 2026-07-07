/**
 * components/ui.js — Gemeinsame UI-Basiskomponenten
 *
 * Exports:
 *   AppStatusBar   — Statusleiste mit korrektem barStyle für Light/Dark Mode
 *   ScreenHeader   — Navigations-Header mit Back-Button und optionalem Rechts-Button
 *   Surface        — Karten-Container (optional als TouchableOpacity)
 *   PrimaryButton  — Primärer CTA-Button (gefüllt, accent-farbig)
 *   GhostButton    — Sekundärer Button (Outline, optionale danger-Variante)
 *   FilterChips    — Horizontale Chip-Leiste für Filter-Auswahl
 *   MenuRow        — Einstellungs-Zeile mit Icon, Label, Value und Chevron
 *   Divider        — Dünne Trennlinie (hairline)
 *   SectionLabel   — Abschnitts-Überschrift (GROSSBUCHSTABEN, tertiary color)
 *   FAB            — Floating Action Button (position: absolute, rechts unten)
 */

// React/RN
import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Platform,
} from 'react-native';

// Third-party
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Internal
import { useTheme } from '../theme';

// ── AppStatusBar ─────────────────────────────────────────────────
export function AppStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />;
}

// ── ScreenHeader ─────────────────────────────────────────────────
export function ScreenHeader({ title, onBack, rightIcon, onRight, rightLabel }) {
  const { colors: C, spacing: S, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.headerWrap, {
      paddingTop: insets.top + 8,
      paddingHorizontal: S.md,
      paddingBottom: S.md,
      backgroundColor: C.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    }]}>
      <View style={styles.headerRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.headerBtn} hitSlop={8}>
            <Feather name="arrow-left" size={22} color={C.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
        <Text style={[T.h3, { color: C.text }]}>{title}</Text>
        {(onRight || rightLabel) ? (
          <TouchableOpacity onPress={onRight} style={styles.headerBtn} hitSlop={8}>
            {rightIcon
              ? <Feather name={rightIcon} size={22} color={C.text} />
              : <Text style={[T.bodyMed, { color: C.text }]}>{rightLabel}</Text>
            }
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>
    </View>
  );
}

// ── Surface ───────────────────────────────────────────────────────
export function Surface({ children, style, onPress, activeOpacity = 0.75 }) {
  const { colors: C, radius: R, spacing: S } = useTheme();
  const surfaceStyle = [
    {
      backgroundColor: C.surface,
      borderRadius: R.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      padding: S.md,
    },
    style,
  ];
  if (onPress) {
    return (
      <TouchableOpacity style={surfaceStyle} onPress={onPress} activeOpacity={activeOpacity}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={surfaceStyle}>{children}</View>;
}

// ── PrimaryButton ─────────────────────────────────────────────────
export function PrimaryButton({ label, onPress, disabled, icon, style }) {
  const { colors: C, radius: R, type: T, spacing: S } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        {
          backgroundColor: disabled ? C.bgTertiary : C.accent,
          borderRadius: R.md,
          paddingVertical: 14,
          paddingHorizontal: S.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        style,
      ]}
    >
      {icon && <Feather name={icon} size={18} color={disabled ? C.textTertiary : C.accentText} />}
      <Text style={[T.bodyMed, { color: disabled ? C.textTertiary : C.accentText, fontWeight: '600' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── GhostButton ───────────────────────────────────────────────────
export function GhostButton({ label, onPress, icon, style, danger }) {
  const { colors: C, radius: R, type: T, spacing: S } = useTheme();
  const color = danger ? C.danger : C.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        {
          borderRadius: R.md,
          paddingVertical: 13,
          paddingHorizontal: S.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: danger ? C.danger : C.border,
        },
        style,
      ]}
    >
      {icon && <Feather name={icon} size={18} color={color} />}
      {label ? <Text style={[T.bodyMed, { color, fontWeight: '500' }]}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

// ── FilterChips ───────────────────────────────────────────────────
export function FilterChips({ options, value, onChange, style }) {
  const { colors: C, radius: R, spacing: S, type: T } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[{ paddingHorizontal: S.md, gap: S.sm, flexDirection: 'row' }, style]}
    >
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 14,
              borderRadius: R.full,
              backgroundColor: active ? C.accent : 'transparent',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: active ? C.accent : C.border,
            }}
          >
            <Text style={[T.label, { color: active ? C.accentText : C.textSecondary }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── MenuRow ───────────────────────────────────────────────────────
export function MenuRow({ icon, label, value, onPress, danger, rightElement, last }) {
  const { colors: C, spacing: S, type: T } = useTheme();
  const color = danger ? C.danger : C.text;
  const content = (
    <View style={[
      styles.menuRow,
      {
        paddingVertical: S.md,
        paddingHorizontal: S.md,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: C.border,
      },
    ]}>
      {icon && (
        <View style={[styles.menuIcon, { backgroundColor: C.bgSecondary }]}>
          <Feather name={icon} size={17} color={danger ? C.danger : C.textSecondary} />
        </View>
      )}
      <Text style={[T.body, { color, flex: 1 }]}>{label}</Text>
      {rightElement || (
        <>
          {value !== undefined && (
            <Text style={[T.caption, { color: C.textSecondary, marginRight: S.sm }]}>{value}</Text>
          )}
          {onPress && <Feather name="chevron-right" size={16} color={C.textTertiary} />}
        </>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

// ── Divider ───────────────────────────────────────────────────────
export function Divider({ style }) {
  const { colors: C } = useTheme();
  return (
    <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: C.border }, style]} />
  );
}

// ── SectionLabel ─────────────────────────────────────────────────
export function SectionLabel({ children, style }) {
  const { colors: C, spacing: S, type: T } = useTheme();
  return (
    <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', paddingHorizontal: S.md, marginBottom: S.sm, marginTop: S.lg }, style]}>
      {children}
    </Text>
  );
}

// ── FAB ───────────────────────────────────────────────────────────
export function FAB({ onPress, icon = 'plus', style }) {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        {
          position: 'absolute',
          bottom: insets.bottom + 80,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: C.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
        },
        style,
      ]}
    >
      <Feather name={icon} size={22} color={C.accentText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerWrap: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
