import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { useStore } from '../store';
import { api } from '../api/client';

const C = { bg: '#0f0e0c', surface: '#1a1916', surface2: '#242220', border: '#2e2c29', accent: '#e8c547', text: '#f0ece3', text2: '#9b9489', red: '#e05252' };

export default function SettingsScreen() {
  const { user, geminiKey, setGeminiKey, updateProfile, logout } = useStore();
  const [gKey, setGKey] = useState(geminiKey || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [calorieGoal, setCalorieGoal] = useState(user?.calorieGoal?.toString() || '2000');
  const [proteinGoal, setProteinGoal] = useState(user?.proteinGoal?.toString() || '150');
  const [carbsGoal, setCarbsGoal] = useState(user?.carbsGoal?.toString() || '250');
  const [fatGoal, setFatGoal] = useState(user?.fatGoal?.toString() || '65');
  const [inviteCode, setInviteCode] = useState('');

  const saveProfile = async () => {
    try { await updateProfile({ displayName, calorieGoal: parseInt(calorieGoal), proteinGoal: parseInt(proteinGoal), carbsGoal: parseInt(carbsGoal), fatGoal: parseInt(fatGoal) }); Alert.alert('✅ Gespeichert'); }
    catch(e) { Alert.alert('Fehler', e.message); }
  };

  const joinHousehold = async () => {
    if (!inviteCode.trim()) return;
    try { await api.joinHousehold(inviteCode.trim().toUpperCase()); Alert.alert('✅ Haushalt beigetreten!'); }
    catch(e) { Alert.alert('Fehler', e.message); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 130 }}>
      <Text style={styles.header}>⚙️ Einstellungen</Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>👤 Profil</Text>
        <Text style={styles.label}>Anzeigename</Text>
        <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholderTextColor={C.text2} />
        <Text style={{ color: C.text2, fontSize: 13, marginBottom: 12 }}>Username: {user?.username}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🏠 Haushalt</Text>
        <Text style={styles.label}>Dein Einladungscode</Text>
        <View style={{ backgroundColor: C.surface2, borderRadius: 10, padding: 12, marginBottom: 14, alignItems: 'center' }}>
          <Text style={{ color: C.accent, fontSize: 28, fontWeight: '700', letterSpacing: 4 }}>{user?.inviteCode || '—'}</Text>
          <Text style={{ color: C.text2, fontSize: 12, marginTop: 4 }}>Zeig diesen Code deiner Freundin</Text>
        </View>
        <Text style={styles.label}>Haushalt beitreten</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={inviteCode} onChangeText={setInviteCode} placeholder="Einladungscode" placeholderTextColor={C.text2} autoCapitalize="characters" />
          <TouchableOpacity style={styles.btnSm} onPress={joinHousehold}><Text style={styles.btnSmText}>Beitreten</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🎯 Kalorienziele</Text>
        {[['Tagesziel (kcal)', calorieGoal, setCalorieGoal],['Protein (g)', proteinGoal, setProteinGoal],['Kohlenhydrate (g)', carbsGoal, setCarbsGoal],['Fett (g)', fatGoal, setFatGoal]].map(([label, val, setter]) => (
          <View key={label} style={{ marginBottom: 10 }}>
            <Text style={styles.label}>{label}</Text>
            <TextInput style={styles.input} value={val} onChangeText={setter} keyboardType="numeric" placeholderTextColor={C.text2} />
          </View>
        ))}
        <TouchableOpacity style={styles.btnPrimary} onPress={saveProfile}><Text style={styles.btnPrimaryText}>💾 Speichern</Text></TouchableOpacity>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🤖 Gemini API</Text>
        <Text style={{ color: C.text2, fontSize: 13, marginBottom: 10 }}>Kostenlos unter aistudio.google.com/app/apikey</Text>
        <Text style={styles.label}>API Key</Text>
        <TextInput style={[styles.input, { marginBottom: 10 }]} value={gKey} onChangeText={setGKey} placeholder="AIza..." placeholderTextColor={C.text2} secureTextEntry />
        <TouchableOpacity style={styles.btnSm} onPress={() => { setGeminiKey(gKey); Alert.alert('✅ Gespeichert'); }}><Text style={styles.btnSmText}>Speichern</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.btnDanger} onPress={() => Alert.alert('Abmelden?', '', [{ text: 'Abbrechen' }, { text: 'Abmelden', style: 'destructive', onPress: logout }])}>
        <Text style={{ color: C.red, fontWeight: '600' }}>Abmelden</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 24, color: '#f0ece3', fontWeight: '300', marginBottom: 20 },
  card: { backgroundColor: '#1a1916', borderWidth: 1, borderColor: '#2e2c29', borderRadius: 16, padding: 16, marginBottom: 14 },
  sectionTitle: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 17, color: '#f0ece3', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', color: '#9b9489', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#242220', borderWidth: 1, borderColor: '#2e2c29', borderRadius: 10, color: '#f0ece3', fontSize: 14, padding: 10, marginBottom: 0 },
  btnPrimary: { backgroundColor: '#e8c547', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 4 },
  btnPrimaryText: { color: '#0f0e0c', fontWeight: '600', fontSize: 14 },
  btnSm: { backgroundColor: '#242220', borderWidth: 1, borderColor: '#2e2c29', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  btnSmText: { color: '#f0ece3', fontSize: 13 },
  btnDanger: { backgroundColor: 'rgba(224,82,82,0.1)', borderWidth: 1, borderColor: 'rgba(224,82,82,0.25)', borderRadius: 12, padding: 14, alignItems: 'center' },
});
