/**
 * screens/AuthScreen.js — Login / Registrierung
 *
 * Erster Screen nach dem Onboarding. Zeigt Feature-Highlights (FEATURES-Array)
 * und Login/Registrierungs-Formular. Schaltet zwischen Login- und Register-Modus.
 *
 * Nach erfolgreicher Auth navigiert useStore().login() → HomeScreen via Navigator.
 */

// React/RN
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Modal,
} from 'react-native';

// Third-party
import { Feather } from '@expo/vector-icons';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';
import { LegalBody } from './LegalScreen';

const FEATURES = [
  { icon: 'activity', text: 'KI Trainingsplan' },
  { icon: 'bar-chart-2', text: 'Ernährung tracken' },
  { icon: 'calendar', text: 'Wettkampfplanung' },
  { icon: 'link', text: 'Strava & Garmin' },
];

function InputField({ label, value, onChange, placeholder, secure, autoCapitalize }) {
  const { colors: C, type: T, radius: R } = useTheme();
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[T.label, { color: C.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          style={{
            flex: 1, backgroundColor: C.bgSecondary,
            borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
            borderRadius: R.md, color: C.text, fontSize: 15, padding: 12,
          }}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.textTertiary}
          secureTextEntry={secure && !show}
          autoCapitalize={autoCapitalize || 'none'}
          autoCorrect={false}
        />
        {secure && (
          <TouchableOpacity style={{ position: 'absolute', right: 12 }} onPress={() => setShow(!show)}>
            <Feather name={show ? 'eye-off' : 'eye'} size={18} color={C.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function AuthScreen() {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'join'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // null | 'privacy' | 'terms'
  const { login, register, loading } = useStore();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return Alert.alert('Fehler', 'Bitte Username und Passwort eingeben.');
    try { await login(username.trim(), password); }
    catch (e) { Alert.alert('Anmeldung fehlgeschlagen', e.message); }
  };

  const handleRegister = async () => {
    if (!username.trim() || !password.trim()) return Alert.alert('Fehler', 'Username und Passwort erforderlich.');
    if (password.length < 8) return Alert.alert('Fehler', 'Passwort muss mindestens 8 Zeichen haben.');
    if (!consent) return Alert.alert('Zustimmung erforderlich', 'Bitte akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung, um fortzufahren.');
    try { await register(username.trim(), password, displayName.trim() || username.trim(), householdName.trim() || `${username.trim()}s Haushalt`); }
    catch (e) { Alert.alert('Registrierung fehlgeschlagen', e.message); }
  };

  const handleJoin = async () => {
    if (!username.trim() || !password.trim() || !inviteCode.trim()) return Alert.alert('Fehler', 'Alle Felder ausfüllen.');
    try {
      await login(username.trim(), password);
      const { api } = require('../api/client');
      await api.joinHousehold(inviteCode.trim().toUpperCase());
    } catch(e) { Alert.alert('Fehler', e.message); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: S.lg, paddingTop: 60, paddingBottom: S.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero ── */}
        <View style={{ alignItems: 'center', marginBottom: S.xl }}>
          <Text style={{ color: C.text, fontSize: 44, fontWeight: '800', letterSpacing: -2, marginBottom: 6 }}>keepr</Text>
          <Text style={[T.body, { color: C.textSecondary, marginBottom: S.lg }]}>Dein KI-Trainings- & Ernährungscoach</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: S.sm }}>
            {FEATURES.map(f => (
              <View key={f.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.full, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <Feather name={f.icon} size={13} color={C.textSecondary} />
                <Text style={[T.label, { color: C.textSecondary }]}>{f.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Mode tabs ── */}
        <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.md, padding: 4, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          {[['login', 'Anmelden'], ['register', 'Neu hier'], ['join', 'Beitreten']].map(([m, l]) => (
            <TouchableOpacity
              key={m}
              style={{ flex: 1, paddingVertical: 10, borderRadius: R.sm, alignItems: 'center', backgroundColor: mode === m ? C.accent : 'transparent' }}
              onPress={() => setMode(m)}
            >
              <Text style={[T.label, { color: mode === m ? C.accentText : C.textSecondary }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Login ── */}
        {mode === 'login' && (
          <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <Text style={[T.h3, { color: C.text, marginBottom: S.md }]}>Willkommen zurück</Text>
            <InputField label="Username" value={username} onChange={setUsername} placeholder="dein_username" />
            <InputField label="Passwort" value={password} onChange={setPassword} placeholder="••••••••" secure />
            <TouchableOpacity
              style={{ backgroundColor: C.accent, borderRadius: R.md, padding: 15, alignItems: 'center', marginTop: 6, opacity: loading ? 0.6 : 1 }}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={[T.bodyMed, { color: C.accentText }]}>{loading ? '…' : 'Anmelden'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: S.md, alignItems: 'center' }} onPress={() => setMode('register')}>
              <Text style={[T.caption, { color: C.textSecondary }]}>
                Noch kein Account? <Text style={{ color: C.tint }}>Jetzt registrieren</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Register ── */}
        {mode === 'register' && (
          <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <Text style={[T.h3, { color: C.text, marginBottom: S.md }]}>Account erstellen</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.tint + '08', borderRadius: R.sm, padding: 10, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '20' }}>
              <Feather name="zap" size={14} color={C.tint} />
              <Text style={[T.caption, { color: C.textSecondary, marginLeft: 8, flex: 1 }]}>
                Nach der Registrierung richtest du dein Athletenprofil ein — dauert 2 Minuten.
              </Text>
            </View>
            <InputField label="Username" value={username} onChange={setUsername} placeholder="dein_username" />
            <InputField label="Anzeigename" value={displayName} onChange={setDisplayName} placeholder="Manuel" autoCapitalize="words" />
            <InputField label="Passwort" value={password} onChange={setPassword} placeholder="••••••••" secure />
            <InputField label="Haushalt Name (optional)" value={householdName} onChange={setHouseholdName} placeholder="Mein Haushalt" autoCapitalize="words" />

            {/* Rechtliches: AGB-Zustimmung + Einwilligung Gesundheitsdaten (Art. 9 DSGVO) */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: S.sm }}
              onPress={() => setConsent(!consent)}
              activeOpacity={0.7}
            >
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: consent ? C.accent : C.borderStrong, backgroundColor: consent ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                {consent && <Feather name="check" size={14} color={C.accentText} />}
              </View>
              <Text style={[T.caption, { color: C.textSecondary, flex: 1, lineHeight: 18 }]}>
                Ich akzeptiere die{' '}
                <Text style={{ color: C.text, fontWeight: '700', textDecorationLine: 'underline' }} onPress={() => setLegalModal('terms')}>Nutzungsbedingungen</Text>
                {' '}und willige in die Verarbeitung meiner Gesundheitsdaten gemäß der{' '}
                <Text style={{ color: C.text, fontWeight: '700', textDecorationLine: 'underline' }} onPress={() => setLegalModal('privacy')}>Datenschutzerklärung</Text>
                {' '}ein.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: C.accent, borderRadius: R.md, padding: 15, alignItems: 'center', marginTop: 6, opacity: loading || !consent ? 0.6 : 1 }}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={[T.bodyMed, { color: C.accentText }]}>{loading ? '…' : 'Account erstellen →'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: S.md, alignItems: 'center' }} onPress={() => setMode('login')}>
              <Text style={[T.caption, { color: C.textSecondary }]}>
                Schon einen Account? <Text style={{ color: C.tint }}>Anmelden</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Join household ── */}
        {mode === 'join' && (
          <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <Text style={[T.h3, { color: C.text, marginBottom: S.sm }]}>Haushalt beitreten</Text>
            <Text style={[T.body, { color: C.textSecondary, marginBottom: S.md, lineHeight: 22 }]}>
              Du hast einen Einladungscode erhalten? Melde dich an und tritt dem Haushalt bei.
            </Text>
            <InputField label="Username" value={username} onChange={setUsername} placeholder="dein_username" />
            <InputField label="Passwort" value={password} onChange={setPassword} placeholder="••••••••" secure />
            <View style={{ marginBottom: 14 }}>
              <Text style={[T.label, { color: C.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Einladungscode</Text>
              <TextInput
                style={{
                  backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
                  borderRadius: R.md, color: C.tint, fontSize: 18, fontWeight: '700', padding: 12,
                  letterSpacing: 4, textAlign: 'center',
                }}
                value={inviteCode}
                onChangeText={v => setInviteCode(v.toUpperCase())}
                placeholder="ABC123"
                placeholderTextColor={C.textTertiary}
                autoCapitalize="characters"
                maxLength={6}
              />
            </View>
            <TouchableOpacity
              style={{ backgroundColor: C.accent, borderRadius: R.md, padding: 15, alignItems: 'center', marginTop: 6, opacity: loading ? 0.6 : 1 }}
              onPress={handleJoin}
              disabled={loading}
            >
              <Text style={[T.bodyMed, { color: C.accentText }]}>{loading ? '…' : 'Beitreten'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center', marginTop: S.lg }]}>keepr v1.0</Text>
      </ScrollView>

      {/* Rechtstexte (vor Registrierung einsehbar, ohne Navigation) */}
      <Modal visible={!!legalModal} animationType="slide" onRequestClose={() => setLegalModal(null)}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.md, paddingTop: 60, paddingBottom: S.sm }}>
            <Text style={[T.h3, { color: C.text }]}>Rechtliches</Text>
            <TouchableOpacity onPress={() => setLegalModal(null)} hitSlop={8}>
              <Feather name="x" size={22} color={C.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            {legalModal ? <LegalBody type={legalModal} /> : null}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
