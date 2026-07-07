/**
 * components/ErrorBoundary.js — Globale Fehler-Absicherung
 *
 * Fängt unbehandelte Render-Fehler auf und zeigt einen Fallback-Screen
 * statt eines kompletten App-Absturzes.
 *
 * Verwendung: <ErrorBoundary> ... </ErrorBoundary>
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Hier könnte ein Crash-Reporting-Service (z.B. Sentry) aufgerufen werden
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Feather name="alert-triangle" size={48} color="#EF4444" style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Ups, da ist was schiefgelaufen</Text>
        <Text style={styles.subtitle}>
          Die App ist auf einen unerwarteten Fehler gestoßen.
        </Text>
        {/* Technische Details nur im Entwicklungs-Build zeigen — in Produktion
            keine internen Stacktraces an Endnutzer durchsickern lassen. */}
        {__DEV__ && (
          <ScrollView style={styles.errorBox} contentContainerStyle={{ padding: 12 }}>
            <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
          </ScrollView>
        )}
        <TouchableOpacity
          style={styles.button}
          onPress={() => this.setState({ hasError: false, error: null })}
        >
          <Text style={styles.buttonText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e0c',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { color: '#f0ece3', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#9b9489', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  errorBox: {
    backgroundColor: '#1a1916',
    borderRadius: 10,
    maxHeight: 160,
    width: '100%',
    marginBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2e2c29',
  },
  errorText: { color: '#e05252', fontSize: 12, fontFamily: 'Courier' },
  button: {
    backgroundColor: '#e8c547',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  buttonText: { color: '#0f0e0c', fontWeight: '700', fontSize: 16 },
});
