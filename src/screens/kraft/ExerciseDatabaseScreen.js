import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ScrollView, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { EXERCISES, MUSCLE_GROUPS, EQUIPMENT_TYPES, MUSCLE_COLORS, getExerciseImageUrl } from '../../data/exercises';
import { useKraftStore } from '../../store/kraftStore';

const EQUIPMENT_ICONS = {
  Langhantel: 'minus', Kurzhantel: 'disc', Kabelzug: 'link',
  Maschine: 'settings', Körpergewicht: 'user', Kettlebell: 'circle',
};

function ExerciseRow({ item, selectMode, onSelect, onDetail }) {
  const { colors: C, spacing: S, radius: R } = useTheme();
  const imgUrl = getExerciseImageUrl(item);
  const [imgFailed, setImgFailed] = useState(false);
  const muscleColor = MUSCLE_COLORS[item.muscle_group] || C.accent;
  const preview = item.instructions_de?.split('\n')[0]?.replace(/^\d+\.\s*/, '') || '';

  return (
    <TouchableOpacity
      onPress={() => onDetail(item)}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}
      activeOpacity={0.7}
    >
      {/* Thumbnail */}
      <View style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: C.surface, marginRight: S.sm, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
        {imgUrl && !imgFailed ? (
          <Image source={{ uri: imgUrl }} style={{ width: 54, height: 54, resizeMode: 'cover' }} onError={() => setImgFailed(true)} />
        ) : (
          <View style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: muscleColor + '22', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 20 }}>
              {item.muscle_group === 'Brust' ? '🫀' : item.muscle_group === 'Rücken' ? '🏋️' :
               item.muscle_group === 'Beine' ? '🦵' : item.muscle_group === 'Schultern' ? '💙' :
               item.muscle_group === 'Bauch' ? '⚡' : item.muscle_group === 'Gesäß' ? '🍑' : '💪'}
            </Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{item.name_de}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 }}>
          <View style={{ backgroundColor: muscleColor + '33', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ color: muscleColor, fontSize: 11, fontWeight: '700' }}>{item.muscle_group}</Text>
          </View>
          <Feather name={EQUIPMENT_ICONS[item.equipment] || 'tool'} size={11} color={C.textTertiary} />
          <Text style={{ color: C.textTertiary, fontSize: 11 }}>{item.equipment}</Text>
        </View>
        {preview ? <Text style={{ color: C.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{preview}</Text> : null}
      </View>

      {/* Action button */}
      {selectMode ? (
        <TouchableOpacity
          onPress={() => onSelect(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ backgroundColor: C.accent, borderRadius: 8, padding: 8, marginLeft: 8 }}
        >
          <Feather name="plus" size={17} color={C.bg} />
        </TouchableOpacity>
      ) : (
        <Feather name="chevron-right" size={18} color={C.textTertiary} style={{ marginLeft: 4 }} />
      )}
    </TouchableOpacity>
  );
}

export default function ExerciseDatabaseScreen({ navigation, route }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();

  // returnTo: caller-screen name to navigate back with selected exercise
  const selectMode = !!route?.params?.returnTo;
  const { setPendingExercise } = useKraftStore();

  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('Alle');
  const [equipment, setEquipment] = useState('Alle');

  const filtered = useMemo(() => EXERCISES.filter(ex => {
    const matchQ = !query || ex.name_de.toLowerCase().includes(query.toLowerCase());
    const matchM = muscle === 'Alle' || ex.muscle_group === muscle;
    const matchE = equipment === 'Alle' || ex.equipment === equipment;
    return matchQ && matchM && matchE;
  }), [query, muscle, equipment]);

  const handleSelect = (ex) => {
    setPendingExercise(ex);
    navigation.goBack();
  };

  const handleDetail = (ex) => {
    navigation.navigate('ExerciseDetail', { exercise: ex });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.md, paddingBottom: S.sm, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: S.sm }}>
            <Feather name="arrow-left" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[T.h2, { color: C.text, flex: 1 }]}>
            {selectMode ? 'Übung hinzufügen' : 'Übungsdatenbank'}
          </Text>
          <Text style={{ color: C.textTertiary, fontSize: 13 }}>{filtered.length}</Text>
        </View>

        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, paddingHorizontal: S.sm, marginBottom: S.sm }}>
          <Feather name="search" size={16} color={C.textSecondary} style={{ marginRight: S.xs }} />
          <TextInput
            style={{ flex: 1, color: C.text, paddingVertical: 10, fontSize: 15 }}
            placeholder="Übung suchen…"
            placeholderTextColor={C.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoFocus={selectMode}
          />
          {query ? <TouchableOpacity onPress={() => setQuery('')}><Feather name="x" size={16} color={C.textSecondary} /></TouchableOpacity> : null}
        </View>

        {/* Muscle filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
          {MUSCLE_GROUPS.map(m => {
            const color = MUSCLE_COLORS[m];
            const active = muscle === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setMuscle(m)}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: active ? (color || C.accent) : C.surface, marginRight: 6, borderWidth: active ? 0 : 1, borderColor: C.border }}
              >
                <Text style={{ color: active ? 'white' : C.textSecondary, fontSize: 13, fontWeight: '600' }}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Equipment filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {EQUIPMENT_TYPES.map(eq => (
            <TouchableOpacity
              key={eq}
              onPress={() => setEquipment(eq)}
              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: equipment === eq ? C.accent + '22' : 'transparent', marginRight: 6, borderWidth: 1, borderColor: equipment === eq ? C.accent : C.border }}
            >
              <Text style={{ color: equipment === eq ? C.accent : C.textTertiary, fontSize: 12, fontWeight: '600' }}>{eq}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {selectMode && (
        <View style={{ paddingHorizontal: S.md, paddingVertical: 6, backgroundColor: C.accent + '18' }}>
          <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>
            Tippe auf "+" um hinzuzufügen · Tippe auf Name für Details
          </Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={ex => String(ex.id)}
        renderItem={({ item }) => (
          <ExerciseRow
            item={item}
            selectMode={selectMode}
            onSelect={handleSelect}
            onDetail={handleDetail}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ color: C.textTertiary, fontSize: 16 }}>Keine Übungen gefunden</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        keyboardDismissMode="on-drag"
      />
    </View>
  );
}
