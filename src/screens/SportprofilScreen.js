/**
 * screens/SportprofilScreen.js — Sportprofil bearbeiten
 *
 * Bearbeitungsformular für das Sportprofil des Nutzers.
 * SPORTS — Verfügbare Sportarten mit Icon (MaterialCommunityIcons) und Farbe
 *
 * secondsToPace() / paceToSeconds() für Pace-Eingabe und -Anzeige.
 * Aktivitäts-Log-Foto via ImagePicker (expo-image-picker).
 */

// React/RN
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';

// Third-party
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// Internal
import { useStore } from '../store';
import { useTheme } from '../theme';
import { ScreenHeader, FieldRow } from '../components/ui';
import { api, secondsToPace, paceToSeconds } from '../api/client';

const SPORTS = [
  { key: 'run', label: 'Laufen', icon: 'run', color: '#4CAF50' },
  { key: 'bike', label: 'Radfahren', icon: 'bike', color: '#FF9800' },
  { key: 'swim', label: 'Schwimmen', icon: 'swim', color: '#2196F3' },
  { key: 'strength', label: 'Kraft', icon: 'weight-lifter', color: '#E8C547' },
  { key: 'triathlon', label: 'Triathlon', icon: 'run-fast', color: '#FF5722' },
  { key: 'hyrox', label: 'Hyrox / Functional', icon: 'kettlebell', color: '#FBC02D' },
  { key: 'calisthenics', label: 'Calisthenics', icon: 'human-handsup', color: '#F9A825' },
  { key: 'row', label: 'Rudern', icon: 'rowing', color: '#26C6DA' },
  { key: 'hike', label: 'Wandern', icon: 'hiking', color: '#689F38' },
  { key: 'climbing', label: 'Klettern', icon: 'image-filter-hdr', color: '#795548' },
  { key: 'pilates', label: 'Pilates', icon: 'yoga', color: '#AB47BC' },
  { key: 'mobility', label: 'Mobility', icon: 'human', color: '#CE93D8' },
];

const FITNESS_LABELS = { beginner: 'Anfänger', intermediate: 'Mittel', advanced: 'Fortgeschritten', elite: 'Elite' };
const VOLUME_LABELS = { short: 'Kurz & knackig', balanced: 'Ausgewogen', high: 'Umfangreich' };
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function parseTrainingPlan(text) {
  const blocks = [];
  const sections = text.split(/(?=Fokus auf )/);
  for (const section of sections) {
    if (!section.trim() || !section.includes('Fokus auf')) continue;
    const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
    const blockName = lines[0];
    const weeks = [];
    let currentWeek = null;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^Woche \d+:/.test(line) || /^Deload:/.test(line)) {
        if (currentWeek) weeks.push(currentWeek);
        currentWeek = { header: line.replace(':', '').trim(), lines: [line] };
      } else if (currentWeek) {
        currentWeek.lines.push(line);
      }
    }
    if (currentWeek) weeks.push(currentWeek);
    if (weeks.length > 0) blocks.push({ name: blockName, weeks });
  }
  return blocks;
}

export default function SportprofilScreen({ navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { user, updateProfile } = useStore();
  const [contextDraft, setContextDraft] = useState(user?.trainingContext || '');
  const [contextSaving, setContextSaving] = useState(false);
  const [attachedFile, setAttachedFile] = useState(user?.trainingContextFile || null);
  const [injuryDraft, setInjuryDraft] = useState(user?.injuries || '');
  const [injurySaving, setInjurySaving] = useState(false);
  const [trainingStartDate, setTrainingStartDate] = useState(user?.trainingPlanStartDate ? new Date(user.trainingPlanStartDate) : null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const save = async (updates) => {
    try { await updateProfile({ ...user, ...updates }); } catch(e) { Alert.alert('Fehler', e.message); }
  };

  const saveContext = async () => {
    setContextSaving(true);
    try {
      await updateProfile({
        ...user,
        trainingContext: contextDraft,
        trainingContextFile: attachedFile,
        trainingPlanStartDate: trainingStartDate ? trainingStartDate.toISOString().split('T')[0] : null,
        trainingPlanBlocks: attachedFile?.blocks || (attachedFile?.content ? parseTrainingPlan(attachedFile.content) : (user?.trainingPlanBlocks || null)),
        trainingPlanStructured: attachedFile?.structuredPlan || user?.trainingPlanStructured || null,
      });
    }
    catch(e) { Alert.alert('Fehler', e.message); }
    setContextSaving(false);
  };

  const saveInjury = async () => {
    setInjurySaving(true);
    try { await updateProfile({ ...user, injuries: injuryDraft }); }
    catch(e) { Alert.alert('Fehler', e.message); }
    setInjurySaving(false);
  };

  const pickFile = async () => {
    try {
      const DocumentPicker = require('expo-document-picker');
      const FileSystem = require('expo-file-system/legacy');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      let content = '';
      try {
        if (asset.mimeType?.startsWith('text/')) {
          content = await FileSystem.readAsStringAsync(asset.uri);
        } else {
          // docx/pdf: als base64 lesen und Backend Text extrahieren lassen
          const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
          const res = await api.parseDocument(base64, asset.mimeType, asset.name);
          content = res.text || '';
        }
      } catch(e) { Alert.alert('Text-Extraktion fehlgeschlagen', e.message); }
      // Gemini parsed das Dokument in strukturiertes JSON
      let structuredPlan = null;
      if (content && content.length > 50) {
        try {
          structuredPlan = await api.parsePlanStructure(content);
        } catch(e) {}
      }
      const blocks = structuredPlan?.blocks || (content ? parseTrainingPlan(content) : []);
      setAttachedFile({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size, content, blocks, structuredPlan });
      if (blocks.length > 0) Alert.alert('Plan erkannt ✓', `${blocks.length} Trainingsblöcke erkannt (${blocks.map(b => b.name.replace('Fokus auf ', '')).join(', ')}). Setze jetzt das Startdatum.`);
    } catch(e) { Alert.alert('Datei-Picker nicht verfügbar', 'Bitte erst npx expo run:ios ausführen.'); }
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('Berechtigung fehlt');
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: false });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setAttachedFile({ name: asset.uri.split('/').pop() || 'Bild', uri: asset.uri, mimeType: 'image/jpeg', size: asset.fileSize });
    } catch(e) { Alert.alert('Fehler', e.message); }
  };

  const toggleSport = (s) => {
    const current = user?.sportTypes || [];
    save({ sportTypes: current.includes(s) ? current.filter(x => x !== s) : [...current, s] });
  };
  const toggleDay = (i) => {
    const current = user?.availableDays || [];
    save({ availableDays: current.includes(i) ? current.filter(x => x !== i) : [...current, i] });
  };

  const divider = <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 16 }} />;
  const sectionLabel = (t) => (
    <Text style={[T.label, { color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: S.md, paddingTop: S.lg, paddingBottom: 6 }]}>{t}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Sportprofil" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

        {/* Sportarten */}
        {sectionLabel('Sportarten')}
        <View style={{ marginHorizontal: S.md, flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
          {SPORTS.map((sport) => {
            const active = (user?.sportTypes || []).includes(sport.key);
            return (
              <TouchableOpacity
                key={sport.key}
                onPress={() => toggleSport(sport.key)}
                activeOpacity={0.7}
                style={{
                  width: '48%', flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 12, paddingHorizontal: 12, borderRadius: R.lg,
                  backgroundColor: active ? sport.color + '18' : C.surface,
                  borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                  borderColor: active ? sport.color : C.border,
                }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: active ? sport.color + '25' : C.bgTertiary, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name={sport.icon} size={19} color={active ? sport.color : C.textTertiary} />
                </View>
                <Text style={[T.label, { flex: 1, color: active ? C.text : C.textSecondary }]} numberOfLines={2}>{sport.label}</Text>
                {active && <Feather name="check-circle" size={16} color={sport.color} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Trainingsplanung */}
        {sectionLabel('Trainingsplanung')}
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 13 }}>
            <Text style={[T.body, { color: C.textSecondary, marginBottom: S.sm }]}>Trainingstage</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {DAYS.map((d, i) => {
                const active = (user?.availableDays || []).includes(i);
                return (
                  <TouchableOpacity key={i} onPress={() => toggleDay(i)} style={{ flex: 1, paddingVertical: 8, borderRadius: R.sm, backgroundColor: active ? C.accent : C.bgTertiary, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: active ? C.accent : C.border }}>
                    <Text style={[T.label, { color: active ? C.accentText : C.textSecondary }]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {divider}
          <FieldRow last icon="clock" label="Max. Stunden/Woche" value={user?.trainingHoursPerWeek} onSave={v => save({ trainingHoursPerWeek: parseInt(v) || null })} placeholder="8" unit="h" />
          {divider}
          <View style={{ paddingHorizontal: 16, paddingVertical: 13 }}>
            <Text style={[T.body, { color: C.textSecondary, marginBottom: S.sm }]}>Fitness Level</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {Object.entries(FITNESS_LABELS).map(([id, label]) => (
                <TouchableOpacity key={id} style={{ flex: 1, paddingVertical: 8, borderRadius: R.sm, backgroundColor: user?.fitnessLevel === id ? C.accent : C.bgTertiary, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: user?.fitnessLevel === id ? C.accent : C.border }} onPress={() => save({ fitnessLevel: id })}>
                  <Text style={[T.label, { color: user?.fitnessLevel === id ? C.accentText : C.textSecondary, fontSize: 10 }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {divider}
          <View style={{ paddingHorizontal: 16, paddingVertical: 13 }}>
            <Text style={[T.body, { color: C.textSecondary, marginBottom: 2 }]}>Trainingsumfang pro Einheit</Text>
            <Text style={[T.caption, { color: C.textTertiary, marginBottom: S.sm }]}>Wie viele Übungen die KI pro Kraft-Einheit einplant</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {Object.entries(VOLUME_LABELS).map(([id, label]) => {
                const active = (user?.sessionVolumePref || 'balanced') === id;
                return (
                  <TouchableOpacity key={id} style={{ flex: 1, paddingVertical: 8, borderRadius: R.sm, backgroundColor: active ? C.accent : C.bgTertiary, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: active ? C.accent : C.border }} onPress={() => save({ sessionVolumePref: id })}>
                    <Text style={[T.label, { color: active ? C.accentText : C.textSecondary, fontSize: 10 }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {divider}
          <FieldRow last icon="list" label="Übungen pro Krafteinheit" value={user?.preferredExercises} onSave={v => save({ preferredExercises: parseInt(v) || null })} placeholder="z.B. 6" hint="Wunsch — leer = KI entscheidet" />
          {divider}
          <FieldRow last icon="watch" label="Wunsch-Einheitsdauer" value={user?.preferredSessionMin} onSave={v => save({ preferredSessionMin: parseInt(v) || null })} placeholder="z.B. 60" unit="Min" hint="Leer = KI entscheidet" />
        </View>

        {/* Leistungswerte */}
        {sectionLabel('Leistungswerte')}
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <FieldRow last icon="zap" label="FTP" value={user?.ftp} onSave={v => save({ ftp: parseInt(v) || null })} placeholder="250" unit="W" hint="Functional Threshold Power (Rad)" />
          {divider}
          <FieldRow last icon="heart" label="Max-Herzfrequenz" value={user?.maxHr} onSave={v => save({ maxHr: parseInt(v) || null })} placeholder="190" unit="bpm" />
          {divider}
          <FieldRow last icon="moon" label="Ruhe-Herzfrequenz" value={user?.restingHr} onSave={v => save({ restingHr: parseInt(v) || null })} placeholder="55" unit="bpm" />
          {divider}
          <FieldRow last icon="droplet" label="Schwimm-Pace" value={user?.swimPace ? secondsToPace(user.swimPace) : ''} onSave={v => save({ swimPace: paceToSeconds(v) })} placeholder="1:45" unit="/100m" hint="Format: M:SS" />
          {divider}
          <FieldRow last icon="trending-up" label="Lauf-Pace" value={user?.runPace ? secondsToPace(user.runPace) : ''} onSave={v => save({ runPace: paceToSeconds(v) })} placeholder="5:30" unit="/km" hint="Format: M:SS" />
        </View>

        {/* Persönliche Bestleistungen */}
        {sectionLabel('Persönliche Bestleistungen')}
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <FieldRow last icon="award" label="5 km" value={user?.pr5k} onSave={v => save({ pr5k: v })} placeholder="–" hint="Format: MM:SS" />
          {divider}
          <FieldRow last icon="award" label="10 km" value={user?.pr10k} onSave={v => save({ pr10k: v })} placeholder="–" hint="Format: H:MM:SS" />
          {divider}
          <FieldRow last icon="award" label="Halbmarathon" value={user?.prHM} onSave={v => save({ prHM: v })} placeholder="–" hint="Format: H:MM:SS" />
          {divider}
          <FieldRow last icon="award" label="Marathon" value={user?.prMarathon} onSave={v => save({ prMarathon: v })} placeholder="–" hint="Format: H:MM:SS" />
          {divider}
          <FieldRow last icon="award" label="Schwimmen 1 km" value={user?.prSwim1k} onSave={v => save({ prSwim1k: v })} placeholder="–" hint="Format: MM:SS" />
        </View>

        {/* Verletzungen & Gesundheit */}
        {sectionLabel('Verletzungen & Gesundheit')}
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <View style={{ padding: S.md }}>
            <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.sm, lineHeight: 18 }]}>
              Bekannte Verletzungen, Einschränkungen oder gesundheitliche Hinweise — werden automatisch bei der Planerstelling berücksichtigt.
            </Text>
            <TextInput
              style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, color: C.text, fontSize: 14, minHeight: 80, textAlignVertical: 'top', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, lineHeight: 20 }}
              value={injuryDraft}
              onChangeText={setInjuryDraft}
              multiline
              placeholder="z.B. linkes Knie schonen, Rückenproblem L4/L5, keine Sprints…"
              placeholderTextColor={C.textTertiary}
            />
            <TouchableOpacity
              style={{ marginTop: S.sm, backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm, opacity: injurySaving ? 0.6 : 1 }}
              onPress={saveInjury}
              disabled={injurySaving}
            >
              {injurySaving ? <ActivityIndicator color={C.accentText} size="small" /> : <Feather name="save" size={15} color={C.accentText} />}
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>Speichern</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* KI-Trainingshinweise */}
        {sectionLabel('KI-Trainingshinweise')}
        <View style={{ backgroundColor: C.surface, marginHorizontal: S.md, borderRadius: R.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <View style={{ padding: S.md }}>
            <Text style={[T.caption, { color: C.textSecondary, marginBottom: S.sm, lineHeight: 18 }]}>
              Sag der KI in eigenen Worten, wie du dein Training willst — z.B. wie viele Übungen pro Einheit,
              wie lange die Einheiten sein sollen, Wettkämpfe, bevorzugte Tageszeit. Wird beim Plan-Erstellen mit höchster Priorität berücksichtigt.
            </Text>
            <TextInput
              style={{ backgroundColor: C.bgSecondary, borderRadius: R.md, padding: S.md, color: C.text, fontSize: 14, minHeight: 100, textAlignVertical: 'top', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, lineHeight: 20 }}
              value={contextDraft}
              onChangeText={setContextDraft}
              multiline
              placeholder="z.B. Kraft: 6-8 Übungen pro Einheit, ca. 60 Min · lieber Ganzkörper · Halbmarathon am 15.6. · Morgentraining bevorzugt"
              placeholderTextColor={C.textTertiary}
            />

            {attachedFile ? (
              <View style={{ marginTop: S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, backgroundColor: C.bgSecondary, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '60' }}>
                  <Feather name="paperclip" size={15} color={C.tint} />
                  <View style={{ flex: 1 }}>
                    <Text style={[T.label, { color: C.tint }]} numberOfLines={1} ellipsizeMode="middle">{attachedFile.name}</Text>
                    <Text style={[T.caption, { color: C.textTertiary, marginTop: 2 }]}>
                      {attachedFile.blocks?.length > 0 ? `${attachedFile.blocks.length} Blöcke erkannt` : attachedFile.content ? 'Inhalt wird übergeben' : 'Kein Text extrahiert'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setAttachedFile(null)} hitSlop={8}>
                    <Feather name="x" size={16} color={C.textTertiary} />
                  </TouchableOpacity>
                </View>

                {attachedFile.blocks?.length > 0 && (
                  <View style={{ marginTop: S.sm }}>
                    <Text style={[T.label, { color: C.textTertiary, marginBottom: 6 }]}>PLAN-STARTDATUM (Woche 1)</Text>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: S.md, backgroundColor: C.bgSecondary, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: trainingStartDate ? C.tint + '60' : C.border }}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={[T.body, { color: trainingStartDate ? C.text : C.textTertiary }]}>
                        {trainingStartDate ? trainingStartDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Startdatum wählen…'}
                      </Text>
                      <Feather name="calendar" size={16} color={trainingStartDate ? C.tint : C.textTertiary} />
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={trainingStartDate || new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        onChange={(e, date) => { setShowDatePicker(false); if (date) setTrainingStartDate(date); }}
                      />
                    )}
                    {trainingStartDate && (() => {
                      const weeksElapsed = Math.floor((Date.now() - trainingStartDate) / (7*24*3600*1000));
                      const blocks = attachedFile.blocks;
                      const weeksPerBlock = blocks[0]?.weeks?.length || 4;
                      const blockIdx = Math.floor(weeksElapsed / weeksPerBlock) % blocks.length;
                      const weekIdx = weeksElapsed % weeksPerBlock;
                      const block = blocks[blockIdx];
                      const week = block?.weeks[weekIdx];
                      return (
                        <View style={{ marginTop: S.xs, padding: S.sm, backgroundColor: C.tint + '12', borderRadius: R.sm }}>
                          <Text style={[T.caption, { color: C.tint }]}>
                            Aktuelle Phase: {block?.name} · {week?.header || `Woche ${weekIdx+1}`} (Woche {weeksElapsed+1} gesamt)
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                )}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.md }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, padding: S.md, backgroundColor: C.bgSecondary, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                  onPress={pickFile}
                >
                  <Feather name="file-text" size={14} color={C.textSecondary} />
                  <Text style={[T.label, { color: C.textSecondary }]}>PDF / DOCX / TXT</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, padding: S.md, backgroundColor: C.bgSecondary, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
                  onPress={pickImage}
                >
                  <Feather name="image" size={14} color={C.textSecondary} />
                  <Text style={[T.label, { color: C.textSecondary }]}>Foto / Bild</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={{ marginTop: S.md, backgroundColor: C.accent, borderRadius: R.md, padding: S.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm, opacity: contextSaving ? 0.6 : 1 }}
              onPress={saveContext}
              disabled={contextSaving}
            >
              {contextSaving ? <ActivityIndicator color={C.accentText} size="small" /> : <Feather name="save" size={15} color={C.accentText} />}
              <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '600' }]}>Hinweise speichern</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}
