import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';

const C = { bg: '#0a0a0a', surface: '#141414', surface2: '#1e1e1e', border: '#222222', accent: '#e8c547', text: '#ffffff', text2: '#666666', red: '#ff4444', orange: '#ff9500', green: '#4caf50' };

function getDays(mhd) { return mhd ? Math.floor((new Date(mhd) - new Date()) / 86400000) : null; }
function getStatus(mhd) {
  if (!mhd) return 'unknown';
  const d = getDays(mhd);
  if (d < 0) return 'expired';
  if (d <= 5) return 'soon';
  return 'ok';
}
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('de-DE') : '?'; }

function MenuRow({ icon, iconBg, iconColor, title, subtitle, onPress, danger, rightElement }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, { backgroundColor: iconBg || '#1e1e1e' }]}>
        <Ionicons name={icon} size={18} color={iconColor || C.text2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, danger && { color: C.red }]}>{title}</Text>
        {subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}
      </View>
      {rightElement || <Ionicons name="chevron-forward" size={16} color={C.text2} />}
    </TouchableOpacity>
  );
}

export default function MehrScreen({ navigation }) {
  const { user, inventory, recipes, logout } = useStore();
  const expired = inventory.filter(i => getStatus(i.mhd) === 'expired');
  const soon = inventory.filter(i => getStatus(i.mhd) === 'soon');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.header}>Mehr</Text>

      {/* MHD Warnungen */}
      {(expired.length > 0 || soon.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MHD Warnungen</Text>
          {expired.length > 0 && (
            <View style={styles.warningCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Ionicons name="warning-outline" size={18} color={C.red} />
                <Text style={{ color: C.red, fontWeight: '700', fontSize: 14 }}>Abgelaufen ({expired.length})</Text>
              </View>
              {expired.slice(0, 3).map(item => (
                <View key={item.id} style={styles.warnRow}>
                  <Text style={styles.warnName}>{item.name}</Text>
                  <Text style={styles.warnDate}>{fmtDate(item.mhd)}</Text>
                </View>
              ))}
              {expired.length > 3 && <Text style={{ color: C.text2, fontSize: 12, marginTop: 6 }}>+{expired.length - 3} weitere</Text>}
            </View>
          )}
          {soon.length > 0 && (
            <View style={[styles.warningCard, { borderColor: 'rgba(255,149,0,0.3)', backgroundColor: 'rgba(255,149,0,0.05)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Ionicons name="time-outline" size={18} color={C.orange} />
                <Text style={{ color: C.orange, fontWeight: '700', fontSize: 14 }}>Bald ablaufend ({soon.length})</Text>
              </View>
              {soon.slice(0, 3).map(item => (
                <View key={item.id} style={styles.warnRow}>
                  <Text style={styles.warnName}>{item.name}</Text>
                  <Text style={[styles.warnDate, { color: C.orange }]}>Noch {getDays(item.mhd)}T</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Kochen */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Kochen</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="restaurant-outline" iconBg="rgba(232,197,71,0.1)" iconColor={C.accent} title="Rezepte" subtitle={`${recipes.length} gespeicherte Rezepte`} onPress={() => navigation.navigate('RezepteTab')} />
        </View>
      </View>

      {/* Haushalt */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Haushalt</Text>
        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>Einladungscode</Text>
          <Text style={styles.inviteCode}>{user?.inviteCode || '—'}</Text>
          <Text style={styles.inviteSub}>Teile diesen Code um deinen Haushalt zu verbinden</Text>
        </View>
      </View>

      {/* Training & Ziele */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Training & Ziele</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="trophy-outline" iconBg="rgba(232,197,71,0.1)" iconColor={C.accent} title="Ziele & Wettkämpfe" subtitle="Wettbewerbskalender verwalten" onPress={() => navigation.navigate('Goals')} />
          <View style={styles.divider} />
          <MenuRow icon="link-outline" iconBg="rgba(76,175,80,0.1)" iconColor={C.green} title="Apps verbinden" subtitle="Strava & mehr" onPress={() => navigation.navigate('ConnectedApps')} />
        </View>
      </View>

      {/* Profil & Einstellungen */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Konto</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="person-outline" iconBg="rgba(33,150,243,0.1)" iconColor="#2196f3" title="Profil bearbeiten" subtitle={user?.displayName || user?.username} onPress={() => navigation.navigate('Profil')} />
          <View style={styles.divider} />
          <MenuRow icon="person-add-outline" iconBg="rgba(76,175,80,0.1)" iconColor={C.green} title="Haushalt beitreten" subtitle="Einladungscode eingeben" onPress={() => Alert.prompt('Einladungscode', 'Code eingeben:', async (code) => { if (code) { try { const { api } = require('../api/client'); await api.joinHousehold(code.trim().toUpperCase()); Alert.alert('✅ Beigetreten!'); } catch(e) { Alert.alert('Fehler', e.message); } } })} />
          <View style={styles.divider} />
          <MenuRow icon="log-out-outline" iconBg="rgba(255,68,68,0.1)" iconColor={C.red} title="Abmelden" danger onPress={() => Alert.alert('Abmelden?', 'Möchtest du dich wirklich abmelden?', [{ text: 'Abbrechen' }, { text: 'Abmelden', style: 'destructive', onPress: logout }])} />
        </View>
      </View>

      {/* App Info */}
      <View style={{ alignItems: 'center', paddingTop: 10 }}>
        <Text style={{ color: '#333', fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>KEEPR</Text>
        <Text style={{ color: '#333', fontSize: 11, marginTop: 2 }}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 20, paddingTop: 60 },
  header: { color: '#ffffff', fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 28 },
  section: { marginBottom: 28 },
  sectionLabel: { color: '#666666', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  menuCard: { backgroundColor: '#141414', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  menuIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  menuSub: { color: '#666666', fontSize: 12, marginTop: 1 },
  divider: { height: 1, backgroundColor: '#1a1a1a', marginLeft: 68 },
  warningCard: { backgroundColor: 'rgba(255,68,68,0.05)', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,68,68,0.2)' },
  warnRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  warnName: { color: '#ffffff', fontSize: 13 },
  warnDate: { color: '#ff4444', fontSize: 13, fontWeight: '600' },
  inviteCard: { backgroundColor: '#141414', borderRadius: 18, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  inviteLabel: { color: '#666666', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  inviteCode: { color: '#e8c547', fontSize: 36, fontWeight: '800', letterSpacing: 8, marginBottom: 8 },
  inviteSub: { color: '#666666', fontSize: 12, textAlign: 'center' },
});
