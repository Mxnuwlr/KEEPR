/**
 * components/WeeklyReviewModal.js — Wochen-Review (Soll vs. Ist)
 *
 * Wertet eine Trainingswoche aus: geplante Einheiten (Soll) vs. tatsächlich
 * absolvierte (Ist), aufgeschlüsselt nach Sportart. Es werden nur Sportarten
 * gezeigt, die geplant waren ODER gemacht wurden.
 *
 * Datenquelle: das bereits im CalendarScreen geladene `weekData`
 * (api.getCalendarDay pro Tag) — kein zusätzlicher Netzwerk-Call.
 *
 * Props:
 *   visible    — boolean
 *   weekData   — { [date]: { training: { planned, completed, completedAll } } }
 *   weekDates  — string[] (7 ISO-Daten der Woche)
 *   weekLabel  — Anzeige-Label der Woche
 *   onClose    — () => void
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '../theme';
import { getSport, SPORT_CATEGORIES } from '../data/sports';

const fmtH = (min) => {
  const m = Math.round(min || 0);
  if (m < 60) return `${m} Min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};

export default function WeeklyReviewModal({ visible, weekData = {}, weekDates = [], weekLabel = '', onClose }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();

  const { rows, totals } = useMemo(() => {
    const agg = {};
    const ensure = (k) => (agg[k] || (agg[k] = { key: k, plannedCount: 0, plannedMin: 0, doneCount: 0, doneMin: 0 }));

    weekDates.forEach(date => {
      const t = weekData[date]?.training || {};
      const plannedRaw = t.planned;
      const planned = Array.isArray(plannedRaw) ? plannedRaw : (plannedRaw ? [plannedRaw] : []);
      planned.filter(p => p && !p.is_rest).forEach(p => {
        const a = ensure(p.sport_type || 'other');
        a.plannedCount += 1;
        a.plannedMin += p.duration || 0;
      });
      const done = t.completedAll?.length ? t.completedAll : (t.completed ? [t.completed] : []);
      done.forEach(w => {
        const a = ensure(w.sport_type || 'other');
        a.doneCount += 1;
        a.doneMin += w.duration_minutes || w.duration || 0;
      });
    });

    const list = Object.values(agg)
      .filter(r => r.plannedCount > 0 || r.doneCount > 0)
      .sort((a, b) => {
        const sa = getSport(a.key), sb = getSport(b.key);
        const ca = SPORT_CATEGORIES[sa.category]?.order || 99;
        const cb = SPORT_CATEGORIES[sb.category]?.order || 99;
        if (ca !== cb) return ca - cb;
        return (b.doneMin + b.plannedMin) - (a.doneMin + a.plannedMin);
      });

    const totals = list.reduce((acc, r) => ({
      plannedCount: acc.plannedCount + r.plannedCount,
      plannedMin: acc.plannedMin + r.plannedMin,
      doneCount: acc.doneCount + r.doneCount,
      doneMin: acc.doneMin + r.doneMin,
    }), { plannedCount: 0, plannedMin: 0, doneCount: 0, doneMin: 0 });

    return { rows: list, totals };
  }, [weekData, weekDates]);

  const completionPct = totals.plannedMin > 0 ? Math.min(1, totals.doneMin / totals.plannedMin) : (totals.doneMin > 0 ? 1 : 0);

  const Stat = ({ value, label, color }) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[T.h2, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[T.label, { color: C.textTertiary, marginTop: 2, textAlign: 'center' }]}>{label}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.lg, paddingTop: S.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
          <View style={{ flex: 1 }}>
            <Text style={[T.h3, { color: C.text }]}>Wochen-Review</Text>
            {!!weekLabel && <Text style={[T.caption, { color: C.textSecondary }]}>{weekLabel}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}><Feather name="x" size={22} color={C.textSecondary} /></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 60 }}>
          {/* Zusammenfassung Soll vs. Ist */}
          <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.lg }}>
            <View style={{ flexDirection: 'row' }}>
              <Stat value={fmtH(totals.doneMin)} label="Ist" color={C.success} />
              <Stat value={fmtH(totals.plannedMin)} label="Soll" color={C.text} />
              <Stat value={`${totals.doneCount}/${totals.plannedCount || totals.doneCount}`} label="Einheiten" color={C.tint} />
            </View>
            <View style={{ height: 6, backgroundColor: C.bgTertiary, borderRadius: 3, overflow: 'hidden', marginTop: S.md }}>
              <View style={{ height: '100%', width: `${completionPct * 100}%`, backgroundColor: completionPct >= 0.85 ? C.success : C.warning, borderRadius: 3 }} />
            </View>
            <Text style={[T.caption, { color: C.textTertiary, textAlign: 'right', marginTop: S.xs }]}>
              {Math.round(completionPct * 100)}% des geplanten Umfangs
            </Text>
          </View>

          {/* Aufschlüsselung nach Sportart */}
          <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: S.sm }]}>Nach Sportart</Text>

          {rows.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: S.xxl }}>
              <Feather name="bar-chart-2" size={36} color={C.textTertiary} />
              <Text style={[T.body, { color: C.textSecondary, marginTop: S.md }]}>Keine geplanten oder absolvierten Einheiten</Text>
            </View>
          ) : (
            <View style={{ gap: S.sm }}>
              {rows.map(r => {
                const sport = getSport(r.key);
                const maxMin = Math.max(r.plannedMin, r.doneMin, 1);
                return (
                  <View key={r.key} style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${sport.color}20`, alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialCommunityIcons name={sport.mci} size={17} color={sport.color} />
                      </View>
                      <Text style={[T.bodyMed, { color: C.text, flex: 1 }]}>{sport.label}</Text>
                      <Text style={[T.caption, { color: C.textSecondary }]}>
                        {r.doneCount}/{r.plannedCount || r.doneCount} Einheiten
                      </Text>
                    </View>

                    {/* Soll-Balken */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: 4 }}>
                      <Text style={[T.label, { color: C.textTertiary, width: 30 }]}>Soll</Text>
                      <View style={{ flex: 1, height: 8, backgroundColor: C.bgTertiary, borderRadius: 4, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${(r.plannedMin / maxMin) * 100}%`, backgroundColor: `${sport.color}70`, borderRadius: 4 }} />
                      </View>
                      <Text style={[T.caption, { color: C.textTertiary, width: 56, textAlign: 'right' }]}>{fmtH(r.plannedMin)}</Text>
                    </View>
                    {/* Ist-Balken */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                      <Text style={[T.label, { color: C.textSecondary, width: 30 }]}>Ist</Text>
                      <View style={{ flex: 1, height: 8, backgroundColor: C.bgTertiary, borderRadius: 4, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${(r.doneMin / maxMin) * 100}%`, backgroundColor: sport.color, borderRadius: 4 }} />
                      </View>
                      <Text style={[T.caption, { color: C.text, width: 56, textAlign: 'right' }]}>{fmtH(r.doneMin)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
