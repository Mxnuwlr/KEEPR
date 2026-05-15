import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { useStore } from '../store';

const C = { bg: '#0f0e0c', surface: '#1a1916', border: '#2e2c29', text: '#f0ece3', text2: '#9b9489', text3: '#5c574f', red: '#e05252', orange: '#e08a3a' };
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('de-DE') : '?'; }
function getDays(mhd) { return mhd ? Math.floor((new Date(mhd) - new Date()) / 86400000) : null; }

export default function AlertsScreen() {
  const { inventory, deleteItem } = useStore();
  const expired = inventory.filter(i => i.mhd && getDays(i.mhd) < 0);
  const soon = inventory.filter(i => i.mhd && getDays(i.mhd) >= 0 && getDays(i.mhd) <= 5);
  const confirmDelete = (id) => Alert.alert('Löschen?', '', [{ text: 'Abbrechen' }, { text: 'Löschen', style: 'destructive', onPress: () => deleteItem(id) }]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 130 }}>
      <Text style={styles.header}>⚠️ MHD-Warnungen</Text>
      {expired.length === 0 && soon.length === 0 && (
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Text style={{ fontSize: 44 }}>✅</Text>
          <Text style={{ color: C.text3, marginTop: 10 }}>Alles frisch! Keine Warnungen.</Text>
        </View>
      )}
      {expired.length > 0 && <>
        <Text style={[styles.sectionLabel, { color: C.red }]}>Abgelaufen ({expired.length})</Text>
        {expired.map(item => (
          <View key={item.id} style={[styles.alertRow, { backgroundColor: 'rgba(224,82,82,0.08)', borderColor: 'rgba(224,82,82,0.25)' }]}>
            <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '500' }}>{item.name}</Text>
              <Text style={{ color: C.text2, fontSize: 12 }}>MHD: {fmtDate(item.mhd)} · vor {Math.abs(getDays(item.mhd))} Tag(en)</Text>
            </View>
            <TouchableOpacity onPress={() => confirmDelete(item.id)}><Text style={{ color: C.red, fontSize: 20 }}>×</Text></TouchableOpacity>
          </View>
        ))}
      </>}
      {soon.length > 0 && <>
        <Text style={[styles.sectionLabel, { color: C.orange, marginTop: 16 }]}>Läuft bald ab ({soon.length})</Text>
        {soon.map(item => (
          <View key={item.id} style={styles.alertRow}>
            <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '500' }}>{item.name}</Text>
              <Text style={{ color: C.text2, fontSize: 12 }}>MHD: {fmtDate(item.mhd)} · noch {getDays(item.mhd)} Tag(e)</Text>
            </View>
          </View>
        ))}
      </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 24, color: '#f0ece3', fontWeight: '300', marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  alertRow: { backgroundColor: 'rgba(224,138,58,0.08)', borderWidth: 1, borderColor: 'rgba(224,138,58,0.25)', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
});
