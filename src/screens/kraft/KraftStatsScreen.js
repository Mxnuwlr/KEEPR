import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { api } from '../../api/client';
import { useKraftStore } from '../../store/kraftStore';

const MUSCLE_COLORS = {
  Brust: '#E8C547', Rücken: '#4CAF50', Schultern: '#2196F3',
  Bizeps: '#FF9800', Trizeps: '#F44336', Beine: '#9C27B0',
  Gesäß: '#E91E63', Bauch: '#00BCD4', Ganzkörper: '#FF5722',
};

export default function KraftStatsScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { prs, fetchPRs } = useKraftStore();
  const [volumeStats, setVolumeStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      await fetchPRs();
      try {
        const data = await api.getVolumeStats();
        setVolumeStats(data || []);
      } catch (e) {}
      setLoading(false);
    };
    load();
  }, []);

  const maxVol = volumeStats.reduce((m, v) => Math.max(m, v.total_volume || 0), 1);
  const prList = Object.entries(prs);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.md, paddingBottom: S.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: S.sm }}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.h2, { color: C.text }]}>Statistiken</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 20 }}>

          {/* Volume per muscle group — last 4 weeks */}
          <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: S.sm }}>VOLUMEN NACH MUSKELGRUPPE (4 WOCHEN)</Text>
          {volumeStats.length === 0 ? (
            <Text style={{ color: C.textTertiary, marginBottom: S.md }}>Noch keine Daten</Text>
          ) : (
            volumeStats.map((item, i) => {
              const barWidth = ((item.total_volume || 0) / maxVol) * 100;
              const barColor = MUSCLE_COLORS[item.muscle_group] || C.accent;
              return (
                <View key={i} style={{ marginBottom: S.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: C.text, fontSize: 13 }}>{item.muscle_group}</Text>
                    <Text style={{ color: C.textSecondary, fontSize: 13 }}>{Math.round(item.total_volume || 0)} kg</Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: C.surface, borderRadius: 4 }}>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: barColor, width: `${barWidth}%` }} />
                  </View>
                </View>
              );
            })
          )}

          {/* PRs */}
          <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '600', marginTop: S.md, marginBottom: S.sm }}>PERSÖNLICHE REKORDE</Text>
          {prList.length === 0 ? (
            <Text style={{ color: C.textTertiary }}>Noch keine Rekorde</Text>
          ) : (
            prList.map(([exerciseId, pr]) => (
              <View key={exerciseId} style={{ backgroundColor: C.surface, borderRadius: R.md, padding: S.sm, marginBottom: S.sm, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '600' }}>{pr.exercise_name}</Text>
                  <Text style={{ color: C.textSecondary, fontSize: 13 }}>{pr.weight_kg} kg × {pr.reps} Wdh</Text>
                </View>
                {pr.estimated_1rm && (
                  <View style={{ backgroundColor: C.accent + '22', paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.sm }}>
                    <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>1RM ~{Math.round(pr.estimated_1rm)} kg</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
