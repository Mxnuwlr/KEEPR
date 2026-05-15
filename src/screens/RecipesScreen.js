import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { getAiRecipeSuggestions } from '../api/client';
import { useTheme } from '../theme';
import { FAB } from '../components/ui';

export default function RecipesScreen({ navigation, tabBar }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const { recipes, inventory, geminiKey, createRecipe, deleteRecipe } = useStore();
  const [aiLoading, setAiLoading] = useState(false);
  const [tab, setTab] = useState('all');

  const loadAiSuggestions = async () => {
    if (!geminiKey) return Alert.alert('KI nicht verfügbar', 'Kein API Key konfiguriert.');
    if (inventory.length === 0) return Alert.alert('Inventar leer', 'Füge erst Produkte hinzu.');
    setAiLoading(true);
    try {
      const suggestions = await getAiRecipeSuggestions(inventory, geminiKey);
      for (const s of suggestions) {
        await createRecipe({
          name: s.name, emoji: s.emoji || '🍽️', description: '',
          prepTime: s.time || '', difficulty: s.difficulty || 'Mittel',
          servings: s.servings || 2, totalCalories: s.totalCalories || 0,
          totalProtein: s.totalProtein || 0, totalCarbs: s.totalCarbs || 0, totalFat: s.totalFat || 0,
          steps: s.steps || '', isAiGenerated: true,
          ingredients: [
            ...(s.ingredients_used || []).map(n => typeof n === 'string' ? { name: n, amount: 0, unit: '' } : { name: n.name, amount: n.amount || 0, unit: n.unit || '' }),
            ...(s.ingredients_needed || []).map(n => typeof n === 'string' ? { name: n, amount: 0, unit: '' } : { name: n.name, amount: n.amount || 0, unit: n.unit || '' }),
          ],
        });
      }
      Alert.alert('Fertig', `${suggestions.length} Rezepte hinzugefügt.`);
    } catch (e) { Alert.alert('Fehler', e.message); }
    setAiLoading(false);
  };

  const filtered = recipes.filter(r =>
    tab === 'all' ? true : tab === 'own' ? !r.is_ai_generated : !!r.is_ai_generated
  );

  const TABS = [
    { value: 'all', label: 'Alle' },
    { value: 'own', label: 'Eigene' },
    { value: 'ai', label: 'KI' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {tabBar}
      {/* Toolbar */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: S.sm,
      }}>
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          {TABS.map(t => {
            const active = tab === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                onPress={() => setTab(t.value)}
                style={{
                  paddingVertical: 5, paddingHorizontal: 12, borderRadius: R.full,
                  backgroundColor: active ? C.accent : 'transparent',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: active ? C.accent : C.border,
                }}
              >
                <Text style={[T.label, { color: active ? C.accentText : C.textSecondary }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {aiLoading
          ? <ActivityIndicator size="small" color={C.textSecondary} />
          : (
            <TouchableOpacity
              onPress={loadAiSuggestions}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingVertical: 6, paddingHorizontal: S.md, borderRadius: R.full,
                borderWidth: StyleSheet.hairlineWidth, borderColor: C.tint + '60',
                backgroundColor: C.tint + '12',
              }}
            >
              <Feather name="cpu" size={13} color={C.tint} />
              <Text style={[T.label, { color: C.tint }]}>KI-Vorschläge</Text>
            </TouchableOpacity>
          )
        }
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={i => i.id.toString()}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60, gap: S.sm }}>
            <Feather name="book-open" size={40} color={C.textTertiary} />
            <Text style={[T.h3, { color: C.textSecondary }]}>Noch keine Rezepte</Text>
            <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center' }]}>
              Tippe auf KI-Vorschläge oder erstelle ein eigenes Rezept
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              backgroundColor: C.surface,
              borderRadius: R.lg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: C.border,
              padding: S.md,
              marginBottom: S.sm,
            }}
            onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: S.sm }}>
              <Text style={{ fontSize: 22, marginRight: S.sm }}>{item.emoji || '🍽️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyMed, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
                {item.description ? (
                  <Text style={[T.caption, { color: C.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center' }}>
                {item.is_ai_generated && (
                  <View style={{
                    backgroundColor: C.tint + '18', borderRadius: R.sm,
                    paddingHorizontal: 6, paddingVertical: 2,
                  }}>
                    <Text style={[T.label, { color: C.tint }]}>KI</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => navigation.navigate('RecipeEdit', { recipe: item })} hitSlop={8}>
                  <Feather name="edit-2" size={15} color={C.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Alert.alert('Löschen?', item.name, [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'Löschen', style: 'destructive', onPress: () => deleteRecipe(item.id) },
                  ])}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={15} color={C.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
              {item.prep_time ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="clock" size={11} color={C.textTertiary} />
                  <Text style={[T.caption, { color: C.textSecondary }]}>{item.prep_time}</Text>
                </View>
              ) : null}
              {item.difficulty ? (
                <Text style={[T.caption, { color: C.textSecondary }]}>{item.difficulty}</Text>
              ) : null}
              {item.total_calories ? (
                <Text style={[T.caption, { color: C.textSecondary }]}>{Math.round(item.total_calories)} kcal</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />

      <FAB onPress={() => navigation.navigate('RecipeEdit', { recipe: null })} />
    </View>
  );
}
