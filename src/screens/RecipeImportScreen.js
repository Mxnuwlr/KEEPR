/**
 * screens/RecipeImportScreen.js — URL-Import Modal
 *
 * Öffnet sich automatisch wenn eine URL über den iOS-Teilen-Dialog
 * mit keepr geteilt wird. Zeigt URL-Eingabe vor, ruft Backend-Import
 * auf und navigiert dann zu RecipeEdit mit vorausgefüllten Daten.
 *
 * route.params: { url? } — optional vorausgefüllte URL
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';

import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { api } from '../api/client';

export default function RecipeImportScreen({ route, navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState(route?.params?.url || '');
  const [loading, setLoading] = useState(false);

  // Auto-start import if URL was passed in (from share intent)
  useEffect(() => {
    if (route?.params?.url && route.params.url.startsWith('http')) {
      handleImport(route.params.url);
    }
  }, []);

  const handleImport = async (importUrl) => {
    const u = (importUrl || url).trim();
    if (!u) return;
    setLoading(true);
    try {
      const data = await api.importRecipeFromUrl(u);
      navigation.replace('RecipeWizard', {
        recipe: {
          // kein id → Wizard behandelt es als neues Rezept
          name: data.name || '',
          description: data.description || '',
          // totalTime = Gesamtzeit, prepTime/activeTime = Arbeitszeit, cookTime/waitTime = Wartezeit
          prep_time: data.totalTime || data.time || '',
          active_time: data.prepTime || data.activeTime || data.active_time || '',
          wait_time: data.cookTime || data.waitTime || data.restTime || data.passiveTime || data.wait_time || '',
          servings: data.servings || 2,
          steps: (() => {
            const text = data.steps || '';
            if (!text) return JSON.stringify([]);
            const parts = text.split(/\s*\d+[\.\)]\s+/).filter(s => s.trim());
            const arr = parts.length > 1 ? parts
              : text.split(/\n+/).filter(s => s.trim()).length > 1 ? text.split(/\n+/).filter(s => s.trim())
              : [text.trim()];
            return JSON.stringify(arr.map(t => ({ type: 'zubereitung', text: t.trim() })));
          })(),
          ingredients: (data.ingredients || []).map(i => ({
            name: i.name || '',
            amount: i.amount?.toString() || '',
            unit: i.unit || 'g',
            slug: i.slug || null,
            image_url: i.image_url || null,
          })),
          image_path: data.imagePath || null,
          source_url: data.sourceUrl || u,
          meal_type: data.mealType || '',
          recipe_category: data.recipeCategory || '',
        },
      });
    } catch (e) {
      Alert.alert('Import fehlgeschlagen', e.message);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 8, paddingBottom: S.md,
        paddingHorizontal: S.md, flexDirection: 'row', alignItems: 'center', gap: S.sm,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
      }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}
          hitSlop={10}
        >
          <Feather name="x" size={18} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.bodyMed, { flex: 1, color: C.text }]}>Rezept importieren</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: S.lg, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: S.md }}>
            <View style={{ backgroundColor: C.surface, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, minWidth: 220, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
              <ActivityIndicator size="large" color={C.tint} />
              <Text style={[T.bodyMed, { color: C.text, fontWeight: '600' }]}>Rezept wird geladen…</Text>
              <Text style={[T.caption, { color: C.textSecondary, textAlign: 'center' }]}>
                Seite abrufen · Bild herunterladen · KI analysiert
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'center', paddingVertical: S.xl }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.tint + '18', alignItems: 'center', justifyContent: 'center', marginBottom: S.md }}>
                <Feather name="link" size={28} color={C.tint} />
              </View>
              <Text style={[T.h3, { color: C.text, marginBottom: S.xs, textAlign: 'center' }]}>
                URL einfügen
              </Text>
              <Text style={[T.caption, { color: C.textSecondary, textAlign: 'center', lineHeight: 18 }]}>
                Rezept-Link von Chefkoch, Lecker, AllRecipes,{'\n'}Blogs oder anderen Seiten einfügen.{'\n'}Bilder werden automatisch übernommen.
              </Text>
            </View>

            <TextInput
              style={{
                backgroundColor: C.surface, borderRadius: R.lg,
                borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
                paddingHorizontal: S.md, paddingVertical: 14,
                color: C.text, fontSize: 14, marginBottom: S.md,
              }}
              value={url}
              onChangeText={setUrl}
              placeholder="https://www.chefkoch.de/rezepte/..."
              placeholderTextColor={C.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={() => handleImport()}
              autoFocus={!route?.params?.url}
            />

            <TouchableOpacity
              onPress={() => handleImport()}
              disabled={!url.trim()}
              style={{
                backgroundColor: url.trim() ? C.accent : C.bgSecondary,
                borderRadius: R.lg, paddingVertical: 15,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm,
              }}
            >
              <Feather name="download" size={17} color={url.trim() ? C.accentText : C.textTertiary} />
              <Text style={[T.bodyMed, { color: url.trim() ? C.accentText : C.textTertiary, fontWeight: '700' }]}>
                Rezept importieren
              </Text>
            </TouchableOpacity>

            <Text style={[T.caption, { color: C.textTertiary, textAlign: 'center', marginTop: S.md, lineHeight: 16 }]}>
              Hinweis: TikTok & Instagram erfordern Login und können nicht direkt importiert werden.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
