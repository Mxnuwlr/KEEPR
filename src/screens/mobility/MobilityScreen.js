/**
 * screens/mobility/MobilityScreen.js — Mobility-Übersicht (Sub-Tab unter Training)
 *
 * Zeigt den aktuellen Mobility-Score (gesamt + je Körperzone) und startet das
 * Sensor-Assessment. Personalisierte KI-Flows folgen in Phase 2.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../../store';
import { useTheme } from '../../theme';
import { api } from '../../api/client';
import LineChart from '../../components/LineChart';
import { MOBILITY_ZONES, getZone, weakestZones } from '../../data/mobility';
import { assessRecovery } from '../../utils/recovery';

const daysAgo = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

const FLOW_TIMES = [8, 15, 22];
const FLOW_GOALS = [
  { key: 'mobility', label: 'Mobility', icon: 'activity' },
  { key: 'stretch', label: 'Stretching', icon: 'maximize-2' },
  { key: 'recovery', label: 'Recovery', icon: 'moon' },
  { key: 'warmup', label: 'Aufwärmen', icon: 'zap' },
];
// Mehrfachauswahl — nichts gewählt = nur Körpergewicht. Labels werden im Backend
// auf Katalog-Tokens gemappt (foam_roller, massage_ball, massage_gun, band, mini_band, stick, block, strap, bar).
const FLOW_EQUIP = ['Foam Roller', 'Massageball', 'Massage Gun', 'Widerstandsband', 'Mini-Band', 'Mobility-Stab', 'Yoga-Block', 'Gurt', 'Klimmzugstange'];

function scoreColor(C, v) {
  if (v == null) return C.textTertiary;
  if (v >= 75) return C.success;
  if (v >= 50) return C.warning;
  return C.danger;
}

export default function MobilityScreen({ navigation, tabBar }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { mobilityResult, fetchMobilityResult, generateMobilityFlow, user, dailyContext, externalData } = useStore();
  const recovery = React.useMemo(() => assessRecovery({ dailyContext, externalData }), [dailyContext, externalData]);

  const [flowModal, setFlowModal] = useState(false);
  const [flowMin, setFlowMin] = useState(15);
  const [flowGoal, setFlowGoal] = useState('mobility');
  const [flowEquip, setFlowEquip] = useState([]); // leer = nur Körpergewicht
  const toggleEquip = (e) => setFlowEquip((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  const [flowLoading, setFlowLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchMobilityResult();
    api.getMobilityHistory().then(h => setHistory(Array.isArray(h) ? h : [])).catch(() => {});
  }, []);

  const since = daysAgo(mobilityResult?.date);
  const dueForCheck = since != null && since >= 7;
  const fullDate = mobilityResult?.results?.__meta?.fullDate || null;
  const fullSince = daysAgo(fullDate);
  const fullDue = !!mobilityResult && (fullSince == null || fullSince >= 35);
  const prevOverall = history.length >= 2 ? history[history.length - 2].overall : null;
  const delta = (prevOverall != null && mobilityResult?.overall != null) ? mobilityResult.overall - prevOverall : null;

  const startFlow = async () => {
    setFlowLoading(true);
    try {
      const focusZones = weakestZones(mobilityResult?.byZone, 2);
      const sport = Array.isArray(user?.sportTypes) && user.sportTypes.length ? user.sportTypes[0] : null;
      const flow = await generateMobilityFlow({ minutes: flowMin, equipment: flowEquip.join(', '), focusZones, sport, goal: flowGoal });
      setFlowModal(false);
      navigation.navigate('MobilityFlow', { flow });
    } catch (e) {
      Alert.alert('Fehler', e.message || 'Flow konnte nicht erstellt werden.');
    } finally {
      setFlowLoading(false);
    }
  };

  const overall = mobilityResult?.overall;
  const byZone = mobilityResult?.byZone || {};
  const zoneEntries = Object.keys(MOBILITY_ZONES);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {tabBar}
      <ScrollView contentContainerStyle={{ padding: S.md, paddingBottom: insets.bottom + 160 }} showsVerticalScrollIndicator={false}>

        {recovery.level !== 'good' && recovery.hasData && (
          <TouchableOpacity
            onPress={() => { setFlowGoal('recovery'); setFlowModal(true); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (recovery.poor ? C.danger : C.warning) + '14', borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: (recovery.poor ? C.danger : C.warning) + '50' }}
          >
            <Feather name="moon" size={16} color={recovery.poor ? C.danger : C.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[T.bodyMed, { color: recovery.poor ? C.danger : C.warning }]}>{recovery.summaryDe}</Text>
              <Text style={[T.caption, { color: C.textSecondary }]}>{recovery.reasons.length ? recovery.reasons.join(' · ') + ' — ' : ''}Recovery-Flow empfohlen</Text>
            </View>
            <Feather name="chevron-right" size={16} color={recovery.poor ? C.danger : C.warning} />
          </TouchableOpacity>
        )}

        {!mobilityResult ? (
          // ── Empty State ──
          <View style={{ alignItems: 'center', paddingVertical: S.xxl }}>
            <Feather name="activity" size={40} color={C.tint} style={{ marginBottom: S.md }} />
            <Text style={[T.h3, { color: C.text, marginBottom: S.sm, textAlign: 'center' }]}>Dein Mobilitäts-Check</Text>
            <Text style={[T.caption, { color: C.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: S.lg }]}>
              Miss deine Beweglichkeit per Handy-Sensor und erhalte deinen Mobility-Score je Körperzone — Basis für deine persönlichen Flows.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('MobilityAssessment', { mode: 'full' })}
              style={{ backgroundColor: C.accent, borderRadius: R.lg, paddingVertical: 15, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', gap: S.sm }}
            >
              <Feather name="activity" size={18} color={C.accentText} />
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>Mobilitäts-Check starten</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Score-Karte ── */}
            <View style={{ backgroundColor: C.surface, borderRadius: R.xl, padding: S.lg, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.lg }}>
              <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: S.sm }]}>Mobility-Score</Text>
              <Text style={{ color: scoreColor(C, overall), fontSize: 64, fontWeight: '800', letterSpacing: -2 }}>{overall}%</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.xs }}>
                <Text style={[T.caption, { color: C.textTertiary }]}>
                  Letzter Check {since === 0 ? 'heute' : since === 1 ? 'vor 1 Tag' : `vor ${since} Tagen`}
                </Text>
                {delta != null && delta !== 0 && (
                  <Text style={[T.caption, { color: delta > 0 ? C.success : C.danger, fontWeight: '700' }]}>
                    {delta > 0 ? '+' : ''}{delta} seit letztem
                  </Text>
                )}
              </View>
              {history.length >= 2 && (
                <View style={{ marginTop: S.md }}>
                  <LineChart data={history.map(h => ({ value: h.overall || 0 }))} width={Dimensions.get('window').width - 2 * S.md - 2 * S.lg} height={70} color={C.accent} colors={C} />
                </View>
              )}
            </View>
            {dueForCheck && (
              <TouchableOpacity
                onPress={() => navigation.navigate('MobilityAssessment', { mode: fullDue ? 'full' : 'quick' })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.warning + '14', borderRadius: R.md, padding: S.md, marginBottom: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.warning + '40' }}
              >
                <Feather name="bell" size={16} color={C.warning} />
                <Text style={[T.caption, { color: C.textSecondary, flex: 1 }]}>
                  {fullDue
                    ? `Voll-Check fällig (${fullSince == null ? 'noch keiner' : `vor ${fullSince} Tagen`}) — ein paar Minuten mehr für das volle Bild.`
                    : `Dein letzter Check ist ${since} Tage her — schneller Wochen-Check (~3 Min) für deinen Fortschritt.`}
                </Text>
                <Feather name="chevron-right" size={16} color={C.warning} />
              </TouchableOpacity>
            )}

            {/* ── Zonen ── */}
            <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: S.sm }]}>Nach Körperzone</Text>
            <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.lg }}>
              {zoneEntries.map((z, i) => {
                const v = byZone[z];
                const col = scoreColor(C, v);
                return (
                  <View key={z} style={{ marginBottom: i < zoneEntries.length - 1 ? S.md : 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={[T.body, { color: C.text }]}>{getZone(z).label}</Text>
                      <Text style={[T.bodyMed, { color: col }]}>{v != null ? `${v}%` : '–'}</Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: C.bgTertiary, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${v || 0}%`, backgroundColor: col, borderRadius: 3 }} />
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.sm }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('MobilityAssessment', { mode: 'quick' })}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.lg, paddingVertical: 14, backgroundColor: C.accent }}
              >
                <Feather name="zap" size={16} color={C.accentText} />
                <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>Schnell-Check</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('MobilityAssessment', { mode: 'full' })}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.lg, paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.accent }}
              >
                <Feather name="refresh-cw" size={16} color={C.accent} />
                <Text style={[T.bodyMed, { color: C.accent, fontWeight: '700' }]}>Voll-Check</Text>
              </TouchableOpacity>
            </View>
            <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center', marginBottom: S.lg }]}>
              Schnell-Check (~3 Min) wöchentlich · Voll-Check alle 4–6 Wochen
            </Text>
          </>
        )}

        {/* ── Personalisierten Flow starten ── */}
        <TouchableOpacity
          onPress={() => setFlowModal(true)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.tint, borderRadius: R.lg, paddingVertical: 16 }}
        >
          <Feather name="play-circle" size={20} color={C.tintText} />
          <Text style={[T.bodyMed, { color: C.tintText, fontWeight: '800', fontSize: 16 }]}>Personalisierten Flow starten</Text>
        </TouchableOpacity>
        <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center', marginTop: S.sm }]}>
          KI baut den Flow aus Zeit, Equipment{mobilityResult ? ' & deinen schwächsten Zonen' : ''}.
        </Text>

      </ScrollView>

      {/* Flow-Start-Modal */}
      <Modal visible={flowModal} transparent animationType="fade" onRequestClose={() => setFlowModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: S.lg, paddingBottom: insets.bottom + S.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.md }}>
              <Text style={[T.h3, { color: C.text, flex: 1 }]}>Mobility-Flow</Text>
              <TouchableOpacity onPress={() => setFlowModal(false)} hitSlop={8} disabled={flowLoading}><Feather name="x" size={20} color={C.textSecondary} /></TouchableOpacity>
            </View>

            <Text style={[T.label, { color: C.textTertiary, marginBottom: 8 }]}>ZIEL</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: S.lg }}>
              {FLOW_GOALS.map((g) => {
                const on = flowGoal === g.key;
                return (
                  <TouchableOpacity key={g.key} onPress={() => setFlowGoal(g.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: on ? C.accent : C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: on ? C.accent : C.border }}>
                    <Feather name={g.icon} size={14} color={on ? C.accentText : C.textSecondary} />
                    <Text style={[T.label, { color: on ? C.accentText : C.textSecondary, fontWeight: '700' }]}>{g.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[T.label, { color: C.textTertiary, marginBottom: 8 }]}>DAUER</Text>
            <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
              {FLOW_TIMES.map((m) => (
                <TouchableOpacity key={m} onPress={() => setFlowMin(m)} style={{ flex: 1, paddingVertical: 12, borderRadius: R.md, alignItems: 'center', backgroundColor: flowMin === m ? C.accent : C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: flowMin === m ? C.accent : C.border }}>
                  <Text style={{ color: flowMin === m ? C.accentText : C.textSecondary, fontWeight: '700' }}>{m} Min</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[T.label, { color: C.textTertiary, marginBottom: 4 }]}>HILFSMITTEL (optional, mehrere möglich)</Text>
            <Text style={[T.caption, { color: C.textTertiary, marginBottom: 8 }]}>{flowEquip.length ? flowEquip.join(' · ') : 'Nichts gewählt → nur Körpergewicht'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: S.lg }}>
              {FLOW_EQUIP.map((e) => {
                const on = flowEquip.includes(e);
                return (
                  <TouchableOpacity key={e} onPress={() => toggleEquip(e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: R.full, backgroundColor: on ? C.accent + '20' : C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: on ? C.accent : C.border }}>
                    {on && <Feather name="check" size={13} color={C.accent} />}
                    <Text style={[T.label, { color: on ? C.text : C.textSecondary }]}>{e}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={startFlow} disabled={flowLoading} style={{ backgroundColor: C.accent, borderRadius: R.lg, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm, opacity: flowLoading ? 0.6 : 1 }}>
              {flowLoading ? <ActivityIndicator size="small" color={C.accentText} /> : <Feather name="play" size={18} color={C.accentText} />}
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>{flowLoading ? 'KI erstellt Flow…' : 'Los geht’s'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
