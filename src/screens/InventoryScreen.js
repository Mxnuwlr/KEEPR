import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput, Modal,
  ScrollView, Alert, Animated, PanResponder, StyleSheet, ActionSheetIOS,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useStore } from '../store';
import { useTheme } from '../theme';

const CATEGORIES = ['Milchprodukte','Fleisch','Fisch','Gemüse','Obst','Brot','Getreide','Konserven','Tiefkühl','Gewürze','Süßes','Sonstiges'];

const CATEGORY_COLORS = {
  'Milchprodukte': '#60A5FA', 'Fleisch': '#F87171', 'Fisch': '#34D399', 'Gemüse': '#86EFAC',
  'Obst': '#FDBA74', 'Brot': '#A78BFA', 'Getreide': '#FCD34D', 'Konserven': '#94A3B8',
  'Tiefkühl': '#7DD3FC', 'Gewürze': '#F9A8D4', 'Süßes': '#F472B6', 'Sonstiges': '#6B7280',
};

function getStatus(mhd) {
  if (!mhd) return 'unknown';
  const d = (new Date(mhd) - new Date()) / 86400000;
  if (d < 0) return 'expired';
  if (d <= 5) return 'soon';
  return 'ok';
}
function getDays(mhd) { return mhd ? Math.floor((new Date(mhd) - new Date()) / 86400000) : null; }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''; }

function SwipeableItem({ item, onDelete, onEdit, onUse, colors: C, radius: R, spacing: S, type: T }) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => { if (g.dx < 0) translateX.setValue(Math.max(g.dx, -80)); },
    onPanResponderRelease: (_, g) => {
      Animated.spring(translateX, {
        toValue: g.dx < -50 ? -80 : 0,
        useNativeDriver: true, tension: 100, friction: 10,
      }).start();
    },
  });

  const closeSwipe = () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();

  const st = getStatus(item.mhd);
  const days = getDays(item.mhd);
  const catColor = CATEGORY_COLORS[item.category] || '#6B7280';
  const statusColor = st === 'expired' ? C.danger : st === 'soon' ? C.warning : C.success;
  const statusText = st === 'expired' ? 'Abgelaufen' : st === 'soon' ? `${days}d` : days !== null ? `${days}d` : '—';

  return (
    <View style={{ marginBottom: 1, overflow: 'hidden' }}>
      {/* Delete bg */}
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}>
        <TouchableOpacity
          style={{ alignItems: 'center' }}
          onPress={() => Alert.alert('Löschen?', item.name, [
            { text: 'Abbrechen', onPress: closeSwipe },
            { text: 'Löschen', style: 'destructive', onPress: () => onDelete(item.id) },
          ])}
        >
          <Feather name="trash-2" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 10, marginTop: 2 }}>Löschen</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          style={{
            backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center',
            paddingVertical: 12, paddingHorizontal: S.md, gap: S.sm,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
          }}
          onPress={() => { closeSwipe(); onUse(item); }}
          onLongPress={() => Alert.alert(item.name, undefined, [
            { text: 'Benutzt', onPress: () => onUse(item) },
            { text: 'Bearbeiten', onPress: () => onEdit(item) },
            { text: 'Löschen', style: 'destructive', onPress: () => onDelete(item.id) },
            { text: 'Abbrechen', style: 'cancel' },
          ])}
          activeOpacity={0.7}
        >
          {/* Category dot */}
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: catColor }} />

          <View style={{ flex: 1 }}>
            <Text style={[T.bodyMed, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[T.caption, { color: C.textSecondary }]}>
              {item.qty || '1 Stück'}{item.mhd ? ` · ${fmtDate(item.mhd)}` : ''}
            </Text>
          </View>

          {item.mhd && (
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.sm,
              backgroundColor: statusColor + '18',
            }}>
              <Text style={[T.caption, { color: statusColor, fontWeight: '600' }]}>{statusText}</Text>
            </View>
          )}

          <TouchableOpacity onPress={() => onEdit(item)} hitSlop={8}>
            <Feather name="edit-2" size={14} color={C.textTertiary} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default function InventoryScreen({ navigation, tabBar }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { inventory, fetchInventory, addItem, updateItem, deleteItem, useInventoryItem } = useStore();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => { fetchInventory(); }, []);

  const filtered = inventory.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'all') return true;
    if (filter === 'expiring') return getStatus(i.mhd) === 'expired' || getStatus(i.mhd) === 'soon';
    return i.category === filter;
  }).sort((a, b) => {
    const order = { expired: 0, soon: 1, unknown: 2, ok: 3 };
    return (order[getStatus(a.mhd)] ?? 3) - (order[getStatus(b.mhd)] ?? 3);
  });

  const expiring = inventory.filter(i => ['expired', 'soon'].includes(getStatus(i.mhd))).length;

  const FILTERS = [
    { value: 'all', label: `Alle (${inventory.length})` },
    ...(expiring > 0 ? [{ value: 'expiring', label: `Läuft ab (${expiring})` }] : []),
    ...CATEGORIES.filter(c => inventory.some(i => i.category === c)).map(c => ({ value: c, label: c })),
  ];

  const UNITS = ['Stück', 'g', 'kg', 'ml', 'L', 'Packung', 'Dose', 'Flasche', 'Beutel', 'Tüte'];

  const openEdit = (item) => navigation.navigate('InventoryAdd', { item });

  const handleUse = (item) => {
    const qtyMatch = (item.qty || '1 Stück').match(/([\d.,]+)\s*(.*)/);
    const unit = qtyMatch ? qtyMatch[2].trim() : 'Stück';
    const isCountable = ['Stück', 'Packung', 'Dose', 'Flasche', 'Beutel', 'Tüte'].includes(unit);
    if (isCountable) {
      Alert.alert(item.name, `1 ${unit} verwenden?`, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: `1 ${unit} benutzt`, onPress: async () => {
          const r = await useInventoryItem(item.id, 1);
          if (r?.deleted) Alert.alert('Aufgebraucht', `${item.name} aus Inventar entfernt.`);
        }},
      ]);
    } else {
      Alert.prompt(item.name, `Wieviel ${unit}? (Aktuell: ${item.qty})`, async (input) => {
        const amt = parseFloat(input?.replace(',', '.'));
        if (!amt || amt <= 0) return;
        const r = await useInventoryItem(item.id, amt);
        if (r?.deleted) Alert.alert('Aufgebraucht', `${item.name} aus Inventar entfernt.`);
      }, 'plain-text', '', 'decimal-pad');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {tabBar}
      {/* Search bar */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: S.sm,
        backgroundColor: C.bgSecondary,
        marginHorizontal: S.md, marginTop: S.md, marginBottom: S.sm,
        borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 10,
        borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
      }}>
        <Feather name="search" size={16} color={C.textTertiary} />
        <TextInput
          style={[T.body, { flex: 1, color: C.text }]}
          placeholder="Suchen…"
          placeholderTextColor={C.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search
          ? <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Feather name="x" size={16} color={C.textSecondary} />
            </TouchableOpacity>
          : <TouchableOpacity
              onPress={() => navigation.navigate('BarcodeScanner', { onScanned: async (p) => { try { await addItem(p); } catch (e) {} } })}
              hitSlop={8}
            >
              <Feather name="maximize" size={18} color={C.textSecondary} />
            </TouchableOpacity>
        }
      </View>

      {/* Filter chips */}
      <View style={{ height: 44 }}>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: S.md, gap: S.sm, alignItems: 'center', height: 44 }}
        >
          {FILTERS.map(f => {
            const active = filter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={{
                  paddingVertical: 5, paddingHorizontal: 12, borderRadius: R.full,
                  backgroundColor: active ? C.accent : 'transparent',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: active ? C.accent : C.border,
                }}
              >
                <Text style={[T.label, { color: active ? C.accentText : C.textSecondary }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={i => i.id.toString()}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60, gap: S.sm }}>
            <Feather name="package" size={40} color={C.textTertiary} />
            <Text style={[T.h3, { color: C.textSecondary }]}>
              {inventory.length === 0 ? 'Inventar leer' : 'Nichts gefunden'}
            </Text>
            <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center' }]}>
              {inventory.length === 0 ? 'Scanne einen Kassenzettel oder füge manuell hinzu' : 'Anderen Suchbegriff versuchen'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SwipeableItem
            item={item} onDelete={deleteItem} onEdit={openEdit} onUse={handleUse}
            colors={C} radius={R} spacing={S} type={T}
          />
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Abbrechen', 'Manuell hinzufügen', 'Kassenzettel scannen'], cancelButtonIndex: 0 },
          (i) => {
            if (i === 1) navigation.navigate('InventoryAdd');
            if (i === 2) navigation.navigate('ScanModal');
          }
        )}
        activeOpacity={0.85}
        style={{
          position: 'absolute', bottom: insets.bottom + 80, right: 20,
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
        }}
      >
        <Feather name="plus" size={24} color={C.accentText} />
      </TouchableOpacity>
    </View>
  );
}
