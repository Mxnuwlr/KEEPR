import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { BASE_URL } from '../api/client';

export default function RecipeDetailScreen({ route, navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { recipeId } = route.params;
  const { recipes, cookRecipe, addCalorieEntry } = useStore();
  const recipe = recipes.find(r => r.id === recipeId);

  const totalServings = recipe?.servings || 1;
  const [cookPortions, setCookPortions] = useState(1);

  if (!recipe) return null;

  const scale = cookPortions / totalServings;

  const macros = [
    { label: 'kcal', value: Math.round((recipe.total_calories || 0) * scale), color: C.warning },
    { label: 'Protein', value: Math.round((recipe.total_protein || 0) * scale) + 'g', color: C.success },
    { label: 'Carbs', value: Math.round((recipe.total_carbs || 0) * scale) + 'g', color: C.tint },
    { label: 'Fett', value: Math.round((recipe.total_fat || 0) * scale) + 'g', color: C.danger },
  ];

  const handleCook = () => {
    Alert.alert(
      'Kochen?',
      `${cookPortions} Portion${cookPortions !== 1 ? 'en' : ''} · Zutaten werden anteilig abgezogen.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Kochen!', onPress: async () => {
          try {
            const r = await cookRecipe(recipe.id, cookPortions, totalServings);
            await addCalorieEntry({
              mealType: 'Mittagessen', name: recipe.name,
              calories: Math.round((recipe.total_calories || 0) * scale),
              protein: Math.round((recipe.total_protein || 0) * scale),
              carbs: Math.round((recipe.total_carbs || 0) * scale),
              fat: Math.round((recipe.total_fat || 0) * scale),
            });
            Alert.alert('Gekocht!', `${cookPortions} Portion${cookPortions !== 1 ? 'en' : ''} · ${r.removed} Zutaten angepasst.`);
            navigation.goBack();
          } catch(e) { Alert.alert('Fehler', e.message); }
        }},
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 8, paddingBottom: S.md,
        paddingHorizontal: S.md,
        flexDirection: 'row', alignItems: 'center', gap: S.sm,
        backgroundColor: C.bg,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="arrow-left" size={18} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.bodyMed, { flex: 1, color: C.text }]} numberOfLines={1}>{recipe.emoji} {recipe.name}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('RecipeEdit', { recipe })} hitSlop={10}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
          <Feather name="edit-2" size={15} color={C.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* Cover image */}
        {recipe.image_path && (
          <Image source={{ uri: `${BASE_URL}${recipe.image_path}` }} style={{ width: '100%', height: 220, resizeMode: 'cover' }} />
        )}

        <View style={{ paddingHorizontal: S.md, paddingTop: S.lg }}>
          {/* Title + meta */}
          <Text style={[T.h2, { color: C.text, marginBottom: S.sm }]}>{recipe.emoji} {recipe.name}</Text>
          <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg, flexWrap: 'wrap' }}>
            {recipe.prep_time && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <Feather name="clock" size={12} color={C.textSecondary} />
                <Text style={[T.caption, { color: C.textSecondary }]}>{recipe.prep_time}</Text>
              </View>
            )}
            {recipe.difficulty && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bgSecondary, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <Feather name="bar-chart-2" size={12} color={C.textSecondary} />
                <Text style={[T.caption, { color: C.textSecondary }]}>{recipe.difficulty}</Text>
              </View>
            )}
          </View>

          {/* Portion stepper */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth,
            borderColor: C.border, paddingHorizontal: S.md, paddingVertical: 12, marginBottom: S.lg,
          }}>
            <View>
              <Text style={[T.label, { color: C.textSecondary }]}>Portionen kochen</Text>
              <Text style={[T.caption, { color: C.textTertiary }]}>Rezept für {totalServings} Portionen</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <TouchableOpacity
                onPress={() => setCookPortions(p => Math.max(1, p - 1))}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Feather name="minus" size={16} color={cookPortions <= 1 ? C.textTertiary : C.text} />
              </TouchableOpacity>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 22, minWidth: 30, textAlign: 'center' }}>{cookPortions}</Text>
              <TouchableOpacity
                onPress={() => setCookPortions(p => p + 1)}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Feather name="plus" size={16} color={C.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Macros — scale with portions */}
          <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
            {macros.map(m => (
              <View key={m.label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: R.lg, paddingVertical: 12, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                <Text style={{ color: m.color, fontWeight: '700', fontSize: 16 }}>{m.value}</Text>
                <Text style={[T.caption, { color: C.textTertiary, fontSize: 10, marginTop: 2 }]}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* Ingredients — scale amounts with portions */}
          {recipe.ingredients?.length > 0 && (
            <View style={{ marginBottom: S.lg }}>
              <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: S.sm }]}>Zutaten</Text>
              <View style={{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                {recipe.ingredients.map((ing, i) => {
                  const scaledAmt = ing.amount > 0 ? Math.round(ing.amount * scale * 10) / 10 : 0;
                  return (
                    <View key={i} style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: S.md, paddingVertical: 12,
                      borderBottomWidth: i < recipe.ingredients.length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: C.border, gap: S.sm,
                    }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, flexShrink: 0 }} />
                      <Text style={[T.body, { color: C.text, flex: 1 }]}>{ing.name}</Text>
                      {scaledAmt > 0 && (
                        <Text style={[T.bodyMed, { color: C.textSecondary }]}>{scaledAmt} {ing.unit}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Steps */}
          {recipe.steps ? (
            <View style={{ marginBottom: S.lg }}>
              <Text style={[T.label, { color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: S.sm }]}>Zubereitung</Text>
              <View style={{ backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: S.md }}>
                {recipe.steps
                  .replace(/\s+(\d+)\.\s+/g, '\n$1. ')
                  .split('\n')
                  .filter(l => l.trim())
                  .map((line, i, arr) => (
                    <Text key={i} style={[T.body, { color: C.text, lineHeight: 24, marginBottom: i < arr.length - 1 ? 10 : 0 }]}>{line.trim()}</Text>
                  ))}
              </View>
            </View>
          ) : null}

          {/* Cook button */}
          <TouchableOpacity
            style={{ backgroundColor: C.accent, borderRadius: R.lg, padding: S.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm }}
            onPress={handleCook}
            activeOpacity={0.85}
          >
            <Feather name="check-circle" size={18} color={C.accentText} />
            <Text style={[T.bodyMed, { color: C.accentText, fontWeight: '700' }]}>
              {cookPortions} Portion{cookPortions !== 1 ? 'en' : ''} kochen & abziehen
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
