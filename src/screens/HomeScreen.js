import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { api } from '../api/client';
import { useTheme } from '../theme';
import { Surface } from '../components/ui';

function getDays(mhd) { return mhd ? Math.floor((new Date(mhd) - new Date()) / 86400000) : null; }
function getStatus(mhd) {
  if (!mhd) return 'unknown';
  const d = getDays(mhd);
  if (d < 0) return 'expired';
  if (d <= 5) return 'soon';
  return 'ok';
}

function SparkBars({ data, height = 32, color }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.weight || d.ewma);
  const min = Math.min(...vals) - 0.5;
  const max = Math.max(...vals) + 0.5;
  const range = max - min || 1;
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {vals.map((v, i) => {
        const barH = Math.max(3, ((v - min) / range) * height);
        return (
          <View
            key={i}
            style={{
              flex: 1, height: barH, borderRadius: 2,
              backgroundColor: i === vals.length - 1 ? color : `${color}44`,
            }}
          />
        );
      })}
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    user, inventory, calorieTotals,
    fetchInventory, fetchCalories, fetchWeightAnalysis, weightAnalysis, addWeight,
  } = useStore();

  const [refreshing, setRefreshing] = useState(false);
  const [dailyReview, setDailyReview] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [weightModal, setWeightModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [adjustModal, setAdjustModal] = useState(false);

  const expired = inventory.filter(i => getStatus(i.mhd) === 'expired').length;
  const soon = inventory.filter(i => getStatus(i.mhd) === 'soon').length;
  const goal = user?.calorieGoal || 2000;
  const calPct = Math.min(calorieTotals.calories / goal, 1);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Hey' : 'Guten Abend';

  const rec = weightAnalysis?.recommendation;
  const wData = weightAnalysis?.weights?.slice(-14) || [];
  const currentW = weightAnalysis?.currentWeight || user?.weight;
  const trendPerWeek = weightAnalysis?.weightChangePerWeek;

  useEffect(() => {
    fetchInventory();
    fetchCalories();
    fetchWeightAnalysis();
    loadDailyReview();
  }, []);

  const loadDailyReview = async () => {
    setReviewLoading(true);
    try {
      const data = await api.getDailyReview();
      setDailyReview(data.review || '');
    } catch (e) {}
    setReviewLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchInventory(), fetchCalories(), fetchWeightAnalysis()]);
    await loadDailyReview();
    setRefreshing(false);
  };

  const saveWeight = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 20 || w > 300) return Alert.alert('Ungültiges Gewicht');
    await addWeight(w);
    setWeightModal(false);
    setWeightInput('');
  };

  const applyRecommendation = async () => {
    if (!rec) return;
    const { updateProfile } = useStore.getState();
    await updateProfile({
      calorieGoal: rec.suggestedGoal,
      proteinGoal: rec.macros?.protein,
      carbsGoal: rec.macros?.carbs,
      fatGoal: rec.macros?.fat,
    });
    setAdjustModal(false);
    Alert.alert('Angepasst', `Neues Kalorienziel: ${rec.suggestedGoal} kcal`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Weight Modal */}
      <Modal visible={weightModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: S.xl }}>
          <View style={{ backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, borderWidth: 0.5, borderColor: C.border }}>
            <Text style={[T.h3, { color: C.text, marginBottom: S.md }]}>Gewicht eintragen</Text>
            <TextInput
              style={{
                backgroundColor: C.bgSecondary, borderRadius: R.md,
                padding: S.md, color: C.text,
                fontSize: 32, fontWeight: '700', textAlign: 'center',
                borderWidth: 0.5, borderColor: C.border, marginBottom: S.sm,
              }}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder={`${currentW || '75'}`}
              placeholderTextColor={C.textTertiary}
              autoFocus
            />
            <Text style={[T.caption, { color: C.textSecondary, textAlign: 'center', marginBottom: S.md }]}>kg</Text>
            <TouchableOpacity
              style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', marginBottom: S.sm }}
              onPress={saveWeight}
            >
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>Speichern</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: S.sm, alignItems: 'center' }} onPress={() => setWeightModal(false)}>
              <Text style={[T.caption, { color: C.textSecondary }]}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Adjust Modal */}
      <Modal visible={adjustModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, borderWidth: 0.5, borderColor: C.border, paddingBottom: insets.bottom + S.lg }}>
            <Text style={[T.h3, { color: C.text, marginBottom: S.xs }]}>Kalorien anpassen</Text>
            <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.lg }]}>{rec?.reason}</Text>
            <View style={{ flexDirection: 'row', gap: S.md, marginBottom: S.lg }}>
              <View style={{ flex: 1, backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, alignItems: 'center' }}>
                <Text style={[T.label, { color: C.textSecondary, marginBottom: S.xs }]}>JETZT</Text>
                <Text style={[T.h2, { color: C.text }]}>{rec?.currentGoal}</Text>
                <Text style={[T.caption, { color: C.textSecondary }]}>kcal</Text>
              </View>
              <View style={{ alignSelf: 'center' }}>
                <Feather name="arrow-right" size={18} color={C.textSecondary} />
              </View>
              <View style={{ flex: 1, backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, alignItems: 'center', borderWidth: 1, borderColor: C.tint + '40' }}>
                <Text style={[T.label, { color: C.tint, marginBottom: S.xs }]}>NEU</Text>
                <Text style={[T.h2, { color: C.tint }]}>{rec?.suggestedGoal}</Text>
                <Text style={[T.caption, { color: C.tint }]}>kcal</Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', marginBottom: S.sm }}
              onPress={applyRecommendation}
            >
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>Anpassen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: S.sm, alignItems: 'center' }} onPress={() => setAdjustModal(false)}>
              <Text style={[T.caption, { color: C.textSecondary }]}>Ignorieren</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + S.lg, paddingBottom: 130, paddingHorizontal: S.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textSecondary} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xl }}>
          <View>
            <Text style={[T.caption, { color: C.textSecondary }]}>{greeting},</Text>
            <Text style={[T.h1, { color: C.text }]}>{user?.displayName || user?.username}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profil')}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: C.bgSecondary, borderWidth: 0.5, borderColor: C.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={[T.bodyMed, { color: C.text, fontWeight: '700' }]}>
              {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* AI Review */}
        {(dailyReview || reviewLoading) && (
          <Surface style={{ marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm }}>
              <Feather name="cpu" size={14} color={C.textSecondary} />
              <Text style={[T.label, { color: C.textSecondary }]}>KI TAGESANALYSE</Text>
            </View>
            <Text style={[T.caption, { color: reviewLoading ? C.textTertiary : C.text, lineHeight: 20 }]}>
              {reviewLoading ? 'Analysiere…' : dailyReview}
            </Text>
          </Surface>
        )}

        {/* AI Recommendation */}
        {rec && (
          <Surface onPress={() => setAdjustModal(true)} style={{ marginBottom: S.md, borderColor: C.tint + '40' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <Feather name="zap" size={18} color={C.tint} />
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyMed, { color: C.text }]}>Anpassung verfügbar</Text>
                <Text style={[T.caption, { color: C.textSecondary }]}>{rec.reason}</Text>
              </View>
              <View style={{ backgroundColor: C.tint + '20', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: 4 }}>
                <Text style={[T.label, { color: C.tint }]}>
                  {rec.adjustment > 0 ? '+' : ''}{rec.adjustment} kcal
                </Text>
              </View>
            </View>
          </Surface>
        )}

        {/* Stats Row */}
        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.md }}>
          {/* Kalorien */}
          <Surface style={{ flex: 1 }} onPress={() => navigation.navigate('Tracken')}>
            <Text style={[T.label, { color: C.textSecondary, marginBottom: S.xs }]}>KALORIEN</Text>
            <Text style={[T.h2, { color: C.text }]}>{Math.round(calorieTotals.calories)}</Text>
            <Text style={[T.caption, { color: C.textSecondary }]}>von {goal}</Text>
            <View style={{ height: 3, backgroundColor: C.bgTertiary, borderRadius: 2, marginTop: S.sm, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${calPct * 100}%`, backgroundColor: calPct >= 1 ? C.danger : C.tint, borderRadius: 2 }} />
            </View>
          </Surface>

          {/* Inventar */}
          <Surface style={{ flex: 1 }} onPress={() => navigation.navigate('Speisekammer')}>
            <Text style={[T.label, { color: C.textSecondary, marginBottom: S.xs }]}>INVENTAR</Text>
            <Text style={[T.h2, { color: C.text }]}>{inventory.length}</Text>
            <Text style={[T.caption, { color: expired > 0 || soon > 0 ? C.warning : C.textSecondary }]}>
              {expired > 0 ? `${expired} abgelaufen` : soon > 0 ? `${soon} bald ab` : 'Alles frisch'}
            </Text>
          </Surface>
        </View>

        {/* Gewicht Card */}
        <Surface onPress={() => setWeightModal(true)} style={{ marginBottom: S.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: S.sm }}>
            <View>
              <Text style={[T.label, { color: C.textSecondary, marginBottom: S.xs }]}>GEWICHT</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={[T.h1, { color: C.text }]}>{currentW?.toFixed(1) || '—'}</Text>
                <Text style={[T.caption, { color: C.textSecondary }]}>kg</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: S.xs }}>
              <TouchableOpacity
                onPress={() => setWeightModal(true)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgSecondary, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Feather name="plus" size={16} color={C.text} />
              </TouchableOpacity>
              {trendPerWeek !== undefined && trendPerWeek !== null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Feather
                    name={trendPerWeek >= 0 ? 'trending-up' : 'trending-down'}
                    size={11}
                    color={Math.abs(trendPerWeek) <= 0.5 ? C.success : C.warning}
                  />
                  <Text style={[T.caption, { color: Math.abs(trendPerWeek) <= 0.5 ? C.success : C.warning }]}>
                    {trendPerWeek >= 0 ? '+' : ''}{trendPerWeek?.toFixed(2)} kg/W
                  </Text>
                </View>
              )}
            </View>
          </View>
          {wData.length > 1 ? (
            <SparkBars data={wData} height={28} color={C.tint} />
          ) : (
            <Text style={[T.caption, { color: C.textTertiary }]}>Noch keine Messungen · Tippe zum Starten</Text>
          )}
        </Surface>

        {/* Quick Actions */}
        <Text style={[T.label, { color: C.textTertiary, marginBottom: S.sm, textTransform: 'uppercase' }]}>Schnellzugriff</Text>
        <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
          {[
            { icon: 'camera', label: 'Scan', sub: 'Kassenzettel', nav: () => navigation.navigate('Speisekammer') },
            { icon: 'plus-circle', label: 'Eintragen', sub: 'Mahlzeit', nav: () => navigation.navigate('Tracken') },
            { icon: 'zap', label: 'Training', sub: 'Plan öffnen', nav: () => navigation.navigate('Training') },
          ].map(a => (
            <Surface key={a.label} style={{ flex: 1 }} onPress={a.nav}>
              <Feather name={a.icon} size={20} color={C.textSecondary} style={{ marginBottom: S.sm }} />
              <Text style={[T.label, { color: C.text }]}>{a.label}</Text>
              <Text style={[T.caption, { color: C.textTertiary }]}>{a.sub}</Text>
            </Surface>
          ))}
        </View>

        {/* MHD Warning */}
        {(expired > 0 || soon > 0) && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Speisekammer')}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: S.md,
              backgroundColor: C.warning + '12', borderRadius: R.lg,
              padding: S.md, borderWidth: 0.5, borderColor: C.warning + '40',
            }}
          >
            <Feather name="alert-triangle" size={18} color={C.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[T.bodyMed, { color: C.text }]}>MHD Warnungen</Text>
              <Text style={[T.caption, { color: C.textSecondary }]}>
                {expired > 0 ? `${expired} abgelaufen` : ''}
                {expired > 0 && soon > 0 ? ' · ' : ''}
                {soon > 0 ? `${soon} bald ablaufend` : ''}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.textTertiary} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
