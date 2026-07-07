/**
 * screens/ProgressCompareScreen.js — Körper-Vergleich mit Region-Zoom
 *
 * Zeigt Früher/Aktuell-Fortschrittsfotos nebeneinander und geht die von der
 * KI-Analyse markierten Körperregionen Schritt für Schritt durch: beide Bilder
 * zoomen synchron auf die jeweilige Region (eigene Box pro Bild, da die Person
 * unterschiedlich stehen kann), darunter Befund + Trend (besser/gleich/schlechter).
 *
 * Datenquellen (kein eigener API-Call):
 *   store.progressAnalysis.regionen — [{pose, name, box_alt?, box_neu, befund, trend}]
 *   store.progressPhotos            — Fotos je Pose, ältestes = FRÜHER, neuestes = AKTUELL
 * Beim ersten Check-in (nur 1 Termin) gibt es nur box_neu → Einzelbild-Modus.
 */

// React/RN
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

// Third-party
import { Feather } from '@expo/vector-icons';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';
import RegionZoomImage from '../components/RegionZoomImage';

const POSE_DE = {
  front_relaxed: 'Vorne entspannt',
  front_flexed: 'Vorne angespannt',
  side: 'Seite',
  back_flexed: 'Rücken angespannt',
};

/** Box auf Gültigkeit prüfen + auf 0–1000 clampen */
function sanitizeBox(b) {
  if (!Array.isArray(b) || b.length !== 4) return null;
  const [y1, x1, y2, x2] = b.map(v => Math.max(0, Math.min(1000, Number(v) || 0)));
  const box = [Math.min(y1, y2), Math.min(x1, x2), Math.max(y1, y2), Math.max(x1, x2)];
  return (box[2] - box[0]) > 5 && (box[3] - box[1]) > 5 ? box : null;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ProgressCompareScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { progressAnalysis, progressPhotos, fetchProgressAnalysis, fetchProgressPhotos } = useStore();

  useEffect(() => {
    if (!progressAnalysis) fetchProgressAnalysis();
    if (!progressPhotos?.length) fetchProgressPhotos();
  }, []);

  // Ältestes + neuestes Foto je Pose
  const byPose = useMemo(() => {
    const m = {};
    for (const ph of progressPhotos || []) {
      if (!m[ph.pose]) m[ph.pose] = [];
      m[ph.pose].push(ph);
    }
    const out = {};
    for (const pose of Object.keys(m)) {
      const sorted = m[pose].slice().sort((a, b) => (a.date < b.date ? -1 : 1));
      out[pose] = { first: sorted[0], last: sorted[sorted.length - 1] };
    }
    return out;
  }, [progressPhotos]);

  // Regionen validieren (Box clampen, Pose muss Fotos haben)
  const regions = useMemo(() => {
    return (progressAnalysis?.regionen || [])
      .map(r => ({ ...r, box_neu: sanitizeBox(r.box_neu), box_alt: sanitizeBox(r.box_alt) }))
      .filter(r => r.name && r.box_neu && byPose[r.pose]?.last);
  }, [progressAnalysis, byPose]);

  // -1 = Übersicht · 0..n-1 = Region · n = Fazit
  const [index, setIndex] = useState(-1);
  const isSummary = index >= regions.length && regions.length > 0;
  const current = index >= 0 && !isSummary ? regions[index] : null;

  // Angezeigte Pose = Pose der aktuellen Region (Übersicht/Fazit: erste Region)
  const activePose = (current || regions[0])?.pose;
  const photos = activePose ? byPose[activePose] : null;
  const compareMode = photos && photos.first && photos.last && photos.first.id !== photos.last.id;

  // Nur Regionen der aktiven Pose als Boxen (Boxen anderer Posen gehören zu anderen Fotos)
  const poseRegions = useMemo(
    () => regions.map((r, gi) => ({ ...r, gi })).filter(r => r.pose === activePose),
    [regions, activePose]
  );
  const focusInPose = current ? poseRegions.findIndex(r => r.gi === index) : -1;
  const trendColor = (t) => t === 'besser' ? C.success : t === 'schlechter' ? C.danger : t === 'start' ? C.tint : C.textSecondary;
  const mkBoxes = (key) => poseRegions.map((r, i) => ({
    box: r[key],
    color: i === focusInPose ? C.tint : (index === -1 || isSummary) ? trendColor(r.trend) : '#FFFFFF',
    label: String(r.gi + 1),
  }));

  const TREND = {
    besser: { icon: 'trending-up', color: C.success, label: 'Verbessert' },
    gleich: { icon: 'minus', color: C.textSecondary, label: 'Unverändert' },
    schlechter: { icon: 'trending-down', color: C.danger, label: 'Rückschritt' },
    start: { icon: 'flag', color: C.tint, label: 'Ausgangspunkt' },
  };
  const trend = current ? (TREND[current.trend] || TREND.gleich) : null;

  const imgLabel = (which) => {
    if (!photos) return '';
    if (!compareMode) return `AUSGANGSZUSTAND · ${fmtDate(photos.last.date)}`;
    return which === 'old' ? `FRÜHER · ${fmtDate(photos.first.date)}` : `AKTUELL · ${fmtDate(photos.last.date)}`;
  };

  // ── Leerzustand (keine Analyse mit Regionen) ───────────────────
  if (!regions.length) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingTop: 60, paddingBottom: S.sm, gap: S.sm }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <Feather name="x" size={18} color={C.text} />
          </TouchableOpacity>
          <Text style={[T.h3, { color: C.text }]}>Körper-Vergleich</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl }}>
          <Feather name="search" size={40} color={C.textTertiary} />
          <Text style={[T.body, { color: C.textSecondary, textAlign: 'center', marginTop: S.md, lineHeight: 22 }]}>
            Noch keine Regionen-Analyse vorhanden. Starte zuerst die KI-Analyse bei den Fortschrittsfotos — neue Analysen markieren die Körperregionen automatisch.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingTop: 60, paddingBottom: S.sm, gap: S.sm }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="x" size={18} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.h3, { color: C.text, flex: 1 }]}>Körper-Vergleich</Text>
        {current && <Text style={[T.label, { color: C.textSecondary }]}>{index + 1} / {regions.length}</Text>}
      </View>

      {/* Bilder: nebeneinander (Vergleich) oder einzeln (erster Check-in) */}
      <View style={{ flex: 1, flexDirection: 'row', marginHorizontal: S.md, gap: 8 }}>
        {compareMode && (
          <View style={{ flex: 1 }}>
            <Text style={[T.label, { color: C.textTertiary, marginBottom: 4, textAlign: 'center' }]}>{imgLabel('old')}</Text>
            <RegionZoomImage
              uri={photos.first.imageUrl}
              boxes={mkBoxes('box_alt')}
              focus={focusInPose}
              style={{ flex: 1, borderRadius: R.lg }}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[T.label, { color: C.textTertiary, marginBottom: 4, textAlign: 'center' }]}>{imgLabel('new')}</Text>
          <RegionZoomImage
            uri={photos.last.imageUrl}
            boxes={mkBoxes('box_neu')}
            focus={focusInPose}
            style={{ flex: 1, borderRadius: R.lg }}
          />
        </View>
      </View>

      {/* Übersicht */}
      {index === -1 && (
        <View style={{ padding: S.md, paddingBottom: 34 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: S.sm }}>
            <Feather name="crosshair" size={20} color={C.tint} />
            <Text style={[T.h3, { color: C.text, flex: 1 }]}>{regions.length} markante Regionen</Text>
          </View>
          <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.sm }]} numberOfLines={2}>
            {regions.map((r, i) => `${i + 1} ${r.name}`).join(' · ')}
          </Text>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.tint, borderRadius: R.md, padding: 15 }}
            onPress={() => setIndex(0)}
          >
            <Feather name="play" size={17} color={C.tintText} />
            <Text style={[T.bodyMed, { color: C.tintText }]}>Regionen durchgehen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Region-Karte */}
      {current && (
        <View style={{ padding: S.md, paddingBottom: 34 }}>
          <View style={{ backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <Text style={[T.h3, { color: C.text, flex: 1 }]}>{current.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: trend.color + '18', borderRadius: R.sm, paddingHorizontal: 9, paddingVertical: 4 }}>
                <Feather name={trend.icon} size={13} color={trend.color} />
                <Text style={[T.caption, { color: trend.color, fontWeight: '700' }]}>{trend.label}</Text>
              </View>
            </View>
            <Text style={[T.caption, { color: C.textTertiary, marginTop: 2 }]}>{POSE_DE[current.pose] || current.pose}</Text>
            {current.befund ? (
              <Text style={[T.body, { color: C.textSecondary, lineHeight: 21, marginTop: 8 }]}>{current.befund}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.md }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                onPress={() => setIndex(index - 1)}
              >
                <Feather name="chevron-left" size={18} color={C.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.tint, borderRadius: R.md, padding: 13 }}
                onPress={() => setIndex(index + 1)}
              >
                <Text style={[T.bodyMed, { color: C.tintText }]}>{index + 1 < regions.length ? 'Weiter' : 'Fazit'}</Text>
                <Feather name="chevron-right" size={18} color={C.tintText} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Fazit */}
      {isSummary && (
        <View style={{ padding: S.md, paddingBottom: 34 }}>
          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: S.sm }}>
              <Feather name="award" size={20} color={C.tint} />
              <Text style={[T.h3, { color: C.text }]}>Fazit</Text>
            </View>
            {progressAnalysis?.summary ? (
              <Text style={[T.body, { color: C.textSecondary, lineHeight: 21, marginBottom: S.sm }]}>{progressAnalysis.summary}</Text>
            ) : null}
            {progressAnalysis?.estimates?.koerperfett_aktuell ? (
              <Text style={[T.caption, { color: C.text, marginBottom: 4 }]}>
                KF-Schätzung: {progressAnalysis.estimates.koerperfett_vorher ? `${progressAnalysis.estimates.koerperfett_vorher} → ` : ''}{progressAnalysis.estimates.koerperfett_aktuell}{' '}
                <Text style={{ color: C.warning, fontWeight: '700' }}>UNGENAU</Text>
              </Text>
            ) : null}
            {progressAnalysis?.disclaimer ? (
              <Text style={[T.caption, { color: C.textTertiary, lineHeight: 17 }]}>{progressAnalysis.disclaimer}</Text>
            ) : null}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
              onPress={() => setIndex(-1)}
            >
              <Feather name="rotate-ccw" size={15} color={C.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.tint, borderRadius: R.md, padding: 13 }}
              onPress={() => navigation.goBack()}
            >
              <Feather name="check" size={16} color={C.tintText} />
              <Text style={[T.bodyMed, { color: C.tintText }]}>Fertig</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
