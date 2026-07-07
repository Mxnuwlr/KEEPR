/**
 * screens/HouseholdScreen.js — Haushalt & Einkaufsliste
 *
 * Zeigt Haushaltsmitglieder und eine geteilte Einkaufsliste.
 * Einkaufsliste wird über das Backend synchronisiert (alle Mitglieder sehen
 * dieselbe Liste). Graceful Degradation wenn Endpoints noch nicht vorhanden.
 *
 * MemberAvatar — Profilbild oder Initialen-Fallback
 * ShoppingItem  — Einkaufslisten-Eintrag mit Checkbox + Löschen
 */

// React/RN
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, RefreshControl, ActivityIndicator, Share,
} from 'react-native';

// Third-party
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';
import { ScreenHeader } from '../components/ui';
import { api, getBaseUrl } from '../api/client';

function MemberAvatar({ member, size = 44 }) {
  const { colors: C } = useTheme();
  const initials = (member?.displayName || member?.username || '?')[0].toUpperCase();
  const colors = ['#60A5FA','#F87171','#34D399','#FDBA74','#A78BFA','#F472B6','#FCD34D'];
  const color = colors[(member?.username?.charCodeAt(0) || 0) % colors.length];

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '30', borderWidth: 2, borderColor: color + '60', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontSize: size * 0.38, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

function ShoppingItem({ item, onToggle, onDelete }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 11, gap: S.sm }}>
      <TouchableOpacity onPress={() => onToggle(item)} hitSlop={8}>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: item.checked ? C.success : C.border, backgroundColor: item.checked ? C.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {item.checked && <Feather name="check" size={12} color="#fff" />}
        </View>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[T.body, { color: item.checked ? C.textTertiary : C.text, textDecorationLine: item.checked ? 'line-through' : 'none' }]}>
          {item.name}
        </Text>
        {item.amount ? (
          <Text style={[T.caption, { color: C.textTertiary }]}>{item.amount}</Text>
        ) : null}
      </View>
      {item.addedBy && (
        <Text style={[T.caption, { color: C.textTertiary }]}>{item.addedByName || item.addedBy}</Text>
      )}
      <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={8}>
        <Feather name="x" size={16} color={C.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

function Divider() {
  const { colors: C, spacing: S } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: S.md }} />;
}

export default function HouseholdScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { user } = useStore();

  const [members, setMembers] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);

  const load = async () => {
    try {
      const [membersData, listData] = await Promise.allSettled([
        api.getHouseholdMembers(),
        api.getShoppingList(),
      ]);
      if (membersData.status === 'fulfilled') setMembers(membersData.value || []);
      if (listData.status === 'fulfilled') setShoppingList(listData.value || []);
    } catch (e) {}
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const addItem = async () => {
    const name = newItem.trim();
    if (!name) return;
    setAdding(true);
    try {
      const item = await api.addShoppingItem({ name, amount: newAmount.trim() || null });
      setShoppingList(prev => [...prev, item]);
      setNewItem('');
      setNewAmount('');
      setShowAddRow(false);
    } catch (e) {
      // Backend nicht erreichbar: lokal hinzufügen
      setShoppingList(prev => [...prev, { id: Date.now(), name, amount: newAmount.trim() || null, checked: false }]);
      setNewItem('');
      setNewAmount('');
      setShowAddRow(false);
    }
    setAdding(false);
  };

  const toggleItem = async (item) => {
    // Optimistisch updaten
    setShoppingList(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
    try { await api.toggleShoppingItem(item.id, !item.checked); } catch (e) {}
  };

  const deleteItem = async (id) => {
    setShoppingList(prev => prev.filter(i => i.id !== id));
    try { await api.deleteShoppingItem(id); } catch (e) {}
  };

  const clearChecked = () => {
    Alert.alert(
      'Erledigte löschen?',
      'Alle abgehakten Einträge werden entfernt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: async () => {
          setShoppingList(prev => prev.filter(i => !i.checked));
          try { await api.clearCheckedItems(); } catch (e) {}
        }},
      ]
    );
  };

  const shareInvite = async () => {
    if (!user?.inviteCode) return;
    await Share.share({ message: `Tritt meinem keepr-Haushalt bei! Einladungscode: ${user.inviteCode}` });
  };

  const unchecked = shoppingList.filter(i => !i.checked);
  const checked = shoppingList.filter(i => i.checked);
  const hasChecked = checked.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header (App-Standard) */}
      <ScreenHeader title={user?.householdName || 'Haushalt'} onBack={() => navigation.goBack()} rightIcon="user-plus" onRight={shareInvite} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.textSecondary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textSecondary} />}
        >
          {/* Mitglieder */}
          <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: S.md, paddingTop: S.lg, paddingBottom: 6 }]}>
            Mitglieder {members.length > 0 ? `(${members.length})` : ''}
          </Text>
          <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' }}>
            {members.length === 0 ? (
              <View style={{ padding: S.lg, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', marginBottom: S.md }}>
                  <MemberAvatar member={user} size={52} />
                </View>
                <Text style={[T.body, { color: C.text, fontWeight: '600', marginBottom: S.xs }]}>Nur du bisher</Text>
                <Text style={[T.caption, { color: C.textSecondary, textAlign: 'center', marginBottom: S.md }]}>
                  Lade jemanden ein, deinen Haushalt zu teilen.
                </Text>
                <View style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: S.lg, marginBottom: S.sm }}>
                  <Text style={{ color: C.accent, fontSize: 28, fontWeight: '800', letterSpacing: 8, textAlign: 'center' }}>{user?.inviteCode || '——'}</Text>
                </View>
                <TouchableOpacity
                  onPress={shareInvite}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: C.accent + '15', paddingHorizontal: S.md, paddingVertical: 8, borderRadius: R.full, borderWidth: StyleSheet.hairlineWidth, borderColor: C.accent + '40' }}
                >
                  <Feather name="share-2" size={14} color={C.accent} />
                  <Text style={[T.label, { color: C.accent }]}>Code teilen</Text>
                </TouchableOpacity>
              </View>
            ) : (
              members.map((member, idx) => (
                <React.Fragment key={member.id || idx}>
                  {idx > 0 && <Divider />}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.sm, gap: S.sm }}>
                    <MemberAvatar member={member} />
                    <View style={{ flex: 1 }}>
                      <Text style={[T.body, { color: C.text, fontWeight: '600' }]}>{member.displayName || member.username}</Text>
                      <Text style={[T.caption, { color: C.textTertiary }]}>@{member.username}</Text>
                    </View>
                    {member.id === user?.id && (
                      <View style={{ backgroundColor: C.accent + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.full }}>
                        <Text style={[T.label, { color: C.accent }]}>Du</Text>
                      </View>
                    )}
                  </View>
                </React.Fragment>
              ))
            )}
          </View>

          {/* Einkaufsliste */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingTop: S.lg, paddingBottom: 6 }}>
            <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 }]}>
              Einkaufsliste {unchecked.length > 0 ? `(${unchecked.length})` : ''}
            </Text>
            {hasChecked && (
              <TouchableOpacity onPress={clearChecked}>
                <Text style={[T.caption, { color: C.danger }]}>Erledigte löschen</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' }}>
            {/* Neue Zeile hinzufügen */}
            {showAddRow ? (
              <View style={{ padding: S.md, gap: S.sm }}>
                <TextInput
                  style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 10, color: C.text, fontSize: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                  placeholder="Artikel eingeben…"
                  placeholderTextColor={C.textTertiary}
                  value={newItem}
                  onChangeText={setNewItem}
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={addItem}
                />
                <TextInput
                  style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 10, color: C.text, fontSize: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                  placeholder="Menge (optional, z.B. 2 Stück, 500g)"
                  placeholderTextColor={C.textTertiary}
                  value={newAmount}
                  onChangeText={setNewAmount}
                  returnKeyType="done"
                  onSubmitEditing={addItem}
                />
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                  <TouchableOpacity
                    onPress={() => { setShowAddRow(false); setNewItem(''); setNewAmount(''); }}
                    style={{ flex: 1, borderRadius: R.md, paddingVertical: 10, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                  >
                    <Text style={[T.body, { color: C.textSecondary }]}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={addItem}
                    disabled={!newItem.trim() || adding}
                    style={{ flex: 2, backgroundColor: !newItem.trim() ? C.bgTertiary : C.accent, borderRadius: R.md, paddingVertical: 10, alignItems: 'center' }}
                  >
                    {adding
                      ? <ActivityIndicator size="small" color={C.accentText} />
                      : <Text style={[T.body, { color: !newItem.trim() ? C.textTertiary : C.accentText, fontWeight: '600' }]}>Hinzufügen</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowAddRow(true)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 13, gap: S.sm }}
              >
                <Feather name="plus-circle" size={18} color={C.accent} />
                <Text style={[T.body, { color: C.accent }]}>Artikel hinzufügen</Text>
              </TouchableOpacity>
            )}

            {/* Offene Einträge */}
            {unchecked.length > 0 && (
              <>
                {(!showAddRow) && <Divider />}
                {unchecked.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    {idx > 0 && <Divider />}
                    <ShoppingItem item={item} onToggle={toggleItem} onDelete={deleteItem} />
                  </React.Fragment>
                ))}
              </>
            )}

            {/* Erledigte Einträge */}
            {checked.length > 0 && (
              <>
                <Divider />
                <View style={{ paddingHorizontal: S.md, paddingTop: S.sm, paddingBottom: 2 }}>
                  <Text style={[T.label, { color: C.textTertiary }]}>ERLEDIGT ({checked.length})</Text>
                </View>
                {checked.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    <Divider />
                    <ShoppingItem item={item} onToggle={toggleItem} onDelete={deleteItem} />
                  </React.Fragment>
                ))}
              </>
            )}

            {/* Leerer Zustand */}
            {shoppingList.length === 0 && !showAddRow && (
              <View style={{ paddingVertical: S.xl, alignItems: 'center' }}>
                <Feather name="shopping-cart" size={32} color={C.textTertiary} style={{ marginBottom: S.sm }} />
                <Text style={[T.body, { color: C.textTertiary }]}>Liste ist leer</Text>
                <Text style={[T.caption, { color: C.textTertiary, marginTop: 4 }]}>Füge den ersten Artikel hinzu</Text>
              </View>
            )}
          </View>

          {/* Haushalt verlassen / Einladungscode */}
          {members.length > 0 && (
            <>
              <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: S.md, paddingTop: S.lg, paddingBottom: 6 }]}>
                Einladung
              </Text>
              <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden' }}>
                <View style={{ paddingHorizontal: S.md, paddingVertical: S.md, flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { color: C.textSecondary }]}>Einladungscode</Text>
                    <Text style={{ color: C.accent, fontSize: 20, fontWeight: '800', letterSpacing: 5, marginTop: 2 }}>{user?.inviteCode || '——'}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={shareInvite}
                    style={{ backgroundColor: C.accent + '15', paddingHorizontal: S.md, paddingVertical: 8, borderRadius: R.full, borderWidth: StyleSheet.hairlineWidth, borderColor: C.accent + '40' }}
                  >
                    <Feather name="share-2" size={16} color={C.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
