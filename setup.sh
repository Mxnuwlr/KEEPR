#!/bin/bash
mkdir -p src/screens src/api src/store

# App.js
cat > App.js << 'EOF'
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import { useStore } from './src/store';
import ScanScreen from './src/screens/ScanScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import RecipesScreen from './src/screens/RecipesScreen';
import RecipeDetailScreen from './src/screens/RecipeDetailScreen';
import RecipeEditScreen from './src/screens/RecipeEditScreen';
import CaloriesScreen from './src/screens/CaloriesScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import AuthScreen from './src/screens/AuthScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const C = { bg: '#0f0e0c', border: '#2e2c29', accent: '#e8c547', text2: '#9b9489', red: '#e05252' };

function RecipeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RecipesList" component={RecipesScreen} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
      <Stack.Screen name="RecipeEdit" component={RecipeEditScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { inventory } = useStore();
  const alertCount = inventory.filter(i => {
    if (!i.mhd) return false;
    const d = (new Date(i.mhd) - new Date()) / 86400000;
    return d <= 5;
  }).length;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.border, borderTopWidth: 1, paddingBottom: 20, paddingTop: 8, height: 70 }, tabBarActiveTintColor: C.accent, tabBarInactiveTintColor: C.text2, tabBarLabelStyle: { fontSize: 10, marginTop: 2 } }}>
      <Tab.Screen name="Scan" component={ScanScreen} options={{ title: 'Scan', tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📸</Text> }} />
      <Tab.Screen name="Inventar" component={InventoryScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏪</Text> }} />
      <Tab.Screen name="Rezepte" component={RecipeStack} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🍽️</Text> }} />
      <Tab.Screen name="Kalorien" component={CaloriesScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📊</Text> }} />
      <Tab.Screen name="Warnungen" component={AlertsScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚠️</Text>, tabBarBadge: alertCount > 0 ? alertCount : undefined, tabBarBadgeStyle: { backgroundColor: C.red, fontSize: 10 } }} />
      <Tab.Screen name="Einstellungen" component={SettingsScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚙️</Text> }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const { user, init } = useStore();
  const [booting, setBooting] = useState(true);
  useEffect(() => { init().finally(() => setBooting(false)); }, []);
  if (booting) return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 40, marginBottom: 16 }}>🥗</Text>
      <ActivityIndicator color={C.accent} />
    </View>
  );
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      {user ? <MainTabs /> : <Stack.Navigator screenOptions={{ headerShown: false }}><Stack.Screen name="Auth" component={AuthScreen} /></Stack.Navigator>}
    </NavigationContainer>
  );
}
EOF

# src/api/client.js
cat > src/api/client.js << 'EOF'
import AsyncStorage from '@react-native-async-storage/async-storage';
export const BASE_URL = 'http://192.168.2.160:3001';

async function getToken() { return await AsyncStorage.getItem('auth_token'); }

async function request(method, path, body = null, isFormData = false) {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? (isFormData ? body : JSON.stringify(body)) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Serverfehler');
  return data;
}

export const api = {
  register: (b) => request('POST', '/api/register', b),
  login: (b) => request('POST', '/api/login', b),
  joinHousehold: (code) => request('POST', '/api/join-household', { inviteCode: code }),
  getProfile: () => request('GET', '/api/profile'),
  updateProfile: (b) => request('PUT', '/api/profile', b),
  getInventory: () => request('GET', '/api/inventory'),
  addInventoryItem: (i) => request('POST', '/api/inventory', i),
  bulkAddInventory: (items) => request('POST', '/api/inventory/bulk', { items }),
  updateInventoryItem: (id, i) => request('PUT', `/api/inventory/${id}`, i),
  deleteInventoryItem: (id) => request('DELETE', `/api/inventory/${id}`),
  getRecipes: () => request('GET', '/api/recipes'),
  createRecipe: (r) => request('POST', '/api/recipes', r),
  updateRecipe: (id, r) => request('PUT', `/api/recipes/${id}`, r),
  deleteRecipe: (id) => request('DELETE', `/api/recipes/${id}`),
  cookRecipe: (id) => request('POST', `/api/recipes/${id}/cook`),
  uploadRecipeImage: async (recipeId, imageUri) => {
    const form = new FormData();
    form.append('image', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' });
    return request('POST', `/api/recipes/${recipeId}/image`, form, true);
  },
  getCalories: (date) => request('GET', `/api/calories?date=${date}`),
  addCalorieLog: (e) => request('POST', '/api/calories', e),
  deleteCalorieLog: (id) => request('DELETE', `/api/calories/${id}`),
  getWeeklyCalories: () => request('GET', '/api/calories/week'),
  addWeight: (b) => request('POST', '/api/weight', b),
  getWeight: () => request('GET', '/api/weight'),
  searchFood: (q) => request('GET', `/api/food/search?q=${encodeURIComponent(q)}`),
  getFoodByBarcode: (code) => request('GET', `/api/food/barcode/${code}`),
};

export async function analyzeReceiptWithGemini(base64, mimeType, geminiKey) {
  const today = new Date().toISOString().split('T')[0];
  const prompt = `Analysiere diesen Kassenzettel. Extrahiere alle Lebensmittelprodukte und schätze MHD + Nährwerte. Heute: ${today}. MHD-Richtwerte: Frische Milch ~10 Tage, Joghurt ~21 Tage, Hartkäse ~90 Tage, Eier ~28 Tage, Frisches Fleisch ~4 Tage, Brot ~5 Tage, Konserven ~2 Jahre, Nudeln ~2 Jahre. Antworte NUR mit JSON-Array: [{"name":"Name","emoji":"Emoji","mhd":"YYYY-MM-DD","qty":"Menge","category":"Kategorie","caloriesPer100g":100,"proteinPer100g":5,"carbsPer100g":15,"fatPer100g":3}]`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 3000 } }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler');
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  text = text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

export async function getAiRecipeSuggestions(inventory, geminiKey) {
  const itemList = inventory.map(i => `${i.name} (${i.qty}, MHD: ${i.mhd || '?'})`).join('\n');
  const prompt = `Du bist Küchenchef. Erstelle 4 Rezepte basierend auf: ${itemList}. Antworte NUR mit JSON: [{"name":"Name","emoji":"🍽️","time":"30 Min","difficulty":"Einfach","servings":2,"totalCalories":500,"totalProtein":30,"totalCarbs":60,"totalFat":15,"ingredients_used":["Zutat"],"ingredients_needed":["fehlt"],"steps":"Schritt 1..."}]`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 3000 } }) });
  const data = await res.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  text = text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

export async function calculateNutrition(name, geminiKey) {
  const prompt = `Nährwerte pro 100g für "${name}". NUR JSON: {"calories":100,"protein":5,"carbs":15,"fat":3}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 200 } }) });
  const data = await res.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  text = text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}
EOF

# src/store/index.js
cat > src/store/index.js << 'EOF'
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

export const useStore = create((set, get) => ({
  user: null, token: null, geminiKey: '',
  inventory: [], recipes: [], calorieLog: [], calorieTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  selectedDate: new Date().toISOString().split('T')[0],
  loading: false, error: null,

  init: async () => {
    const token = await AsyncStorage.getItem('auth_token');
    const userStr = await AsyncStorage.getItem('user');
    const geminiKey = await AsyncStorage.getItem('gemini_key') || '';
    if (token && userStr) {
      set({ token, user: JSON.parse(userStr), geminiKey });
      try { const profile = await api.getProfile(); set({ user: { ...JSON.parse(userStr), ...profile } }); await get().fetchAll(); }
      catch (e) { await get().logout(); }
    }
    set({ geminiKey });
  },

  setGeminiKey: async (key) => { await AsyncStorage.setItem('gemini_key', key); set({ geminiKey: key }); },

  login: async (username, password) => {
    set({ loading: true, error: null });
    const data = await api.login({ username, password });
    await AsyncStorage.setItem('auth_token', data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    set({ token: data.token, user: data.user, loading: false });
    await get().fetchAll();
  },

  register: async (username, password, displayName, householdName) => {
    set({ loading: true, error: null });
    const data = await api.register({ username, password, displayName, householdName });
    await AsyncStorage.setItem('auth_token', data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    set({ token: data.token, user: data.user, loading: false });
  },

  logout: async () => { await AsyncStorage.multiRemove(['auth_token', 'user']); set({ user: null, token: null, inventory: [], recipes: [], calorieLog: [] }); },

  fetchAll: async () => { await Promise.all([get().fetchInventory(), get().fetchRecipes(), get().fetchCalories()]); },
  fetchInventory: async () => { try { set({ inventory: await api.getInventory() }); } catch(e) {} },
  fetchRecipes: async () => { try { set({ recipes: await api.getRecipes() }); } catch(e) {} },
  fetchCalories: async (date) => {
    const d = date || get().selectedDate;
    try { const data = await api.getCalories(d); set({ calorieLog: data.logs, calorieTotals: data.totals, selectedDate: d }); } catch(e) {}
  },

  addItem: async (item) => { await api.addInventoryItem(item); await get().fetchInventory(); },
  bulkAddItems: async (items) => { await api.bulkAddInventory(items); await get().fetchInventory(); },
  updateItem: async (id, item) => { await api.updateInventoryItem(id, item); await get().fetchInventory(); },
  deleteItem: async (id) => { await api.deleteInventoryItem(id); set(s => ({ inventory: s.inventory.filter(i => i.id !== id) })); },

  createRecipe: async (r) => { const res = await api.createRecipe(r); await get().fetchRecipes(); return res; },
  updateRecipe: async (id, r) => { await api.updateRecipe(id, r); await get().fetchRecipes(); },
  deleteRecipe: async (id) => { await api.deleteRecipe(id); set(s => ({ recipes: s.recipes.filter(r => r.id !== id) })); },
  cookRecipe: async (id) => { const r = await api.cookRecipe(id); await get().fetchInventory(); return r; },

  addCalorieEntry: async (e) => { await api.addCalorieLog(e); await get().fetchCalories(); },
  deleteCalorieEntry: async (id) => { await api.deleteCalorieLog(id); set(s => ({ calorieLog: s.calorieLog.filter(l => l.id !== id) })); },
  updateProfile: async (data) => { await api.updateProfile(data); set(s => ({ user: { ...s.user, ...data } })); await AsyncStorage.setItem('user', JSON.stringify({ ...get().user, ...data })); },
}));
EOF

echo "✅ Alle Dateien erstellt!"
