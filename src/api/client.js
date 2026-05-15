import AsyncStorage from '@react-native-async-storage/async-storage';
export const BASE_URL = 'http://192.168.2.40:3001';

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
  // Auth
  register: (b) => request('POST', '/api/register', b),
  login: (b) => request('POST', '/api/login', b),
  joinHousehold: (code) => request('POST', '/api/join-household', { inviteCode: code }),

  // Profile
  getProfile: () => request('GET', '/api/profile'),
  updateProfile: (b) => request('PUT', '/api/profile', b),

  // Inventory
  getInventory: () => request('GET', '/api/inventory'),
  addInventoryItem: (i) => request('POST', '/api/inventory', i),
  bulkAddInventory: (items) => request('POST', '/api/inventory/bulk', { items }),
  updateInventoryItem: (id, i) => request('PUT', `/api/inventory/${id}`, i),
  deleteInventoryItem: (id) => request('DELETE', `/api/inventory/${id}`),

  // Recipes
  getRecipes: () => request('GET', '/api/recipes'),
  createRecipe: (r) => request('POST', '/api/recipes', r),
  updateRecipe: (id, r) => request('PUT', `/api/recipes/${id}`, r),
  deleteRecipe: (id) => request('DELETE', `/api/recipes/${id}`),
  cookRecipe: (id, portions, totalServings) => request('POST', `/api/recipes/${id}/cook`, { portions: portions || 1, totalServings: totalServings || 1 }),
  uploadRecipeImage: async (recipeId, imageUri) => {
    const form = new FormData();
    form.append('image', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' });
    return request('POST', `/api/recipes/${recipeId}/image`, form, true);
  },

  // Calories
  getCalories: (date) => request('GET', `/api/calories?date=${date}`),
  addCalorieLog: (e) => request('POST', '/api/calories', e),
  updateCalorieLog: (id, e) => request('PUT', `/api/calories/${id}`, e),
  deleteCalorieLog: (id) => request('DELETE', `/api/calories/${id}`),
  getWeeklyCalories: () => request('GET', '/api/calories/week'),
  getCalendarCalories: (year, month) => request('GET', `/api/calories/calendar?year=${year}&month=${month}`),
  getStreak: () => request('GET', '/api/calories/streak'),

  // Weight
  addWeight: (b) => request('POST', '/api/weight', b),
  getWeight: () => request('GET', '/api/weight'),

  // Food
  searchFood: (q) => request('GET', `/api/food/search?q=${encodeURIComponent(q)}`),
  getFoodByBarcode: (code) => request('GET', `/api/food/barcode/${code}`),

  // Config
  getGeminiKey: () => request('GET', '/api/config/gemini'),

  // Training
  getTrainingPlan: (weekKey) => request('GET', `/api/training/plan${weekKey ? `?week=${weekKey}` : ''}`),
  generateTrainingPlan: (b) => request('POST', '/api/training/generate', b),
  saveTrainingPlan: (b) => request('POST', '/api/training/plan/save', b),
  completeWorkout: (b) => request('POST', '/api/training/complete', b),
  deleteCompletedWorkout: (id) => request('DELETE', `/api/training/complete/${id}`),
  getTrainingHistory: (from, to) => request('GET', `/api/training/history${from ? `?from=${from}` : ''}${to ? `&to=${to}` : ''}`),
  chatWithCoach: (message, context) => request('POST', '/api/training/chat', { message, context }),

  // Daily Log
  getDailyLog: (date) => request('GET', `/api/daily-log?date=${date}`),
  getDailyLogs: (from, to) => request('GET', `/api/daily-log${from ? `?from=${from}` : ''}${to ? `&to=${to}` : ''}`),
  saveDailyLog: (b) => request('POST', '/api/daily-log', b),

  // Calendar (combined)
  getCalendarDay: (date) => request('GET', `/api/calendar/day?date=${date}`),
  getCalendarMonth: (year, month) => request('GET', `/api/calendar/month?year=${year}&month=${month}`),

  // Water
  getWater: (date) => request('GET', `/api/water?date=${date}`),
  addWater: (ml, date) => request('POST', '/api/water', { ml, date }),
  deleteWater: (id) => request('DELETE', `/api/water/${id}`),

  // Weight analysis
  getWeightAnalysis: () => request('GET', '/api/weight/analysis'),

  // Home daily review
  getDailyReview: () => request('GET', '/api/home/daily-review'),

  // AI meal plan
  getAIMealPlan: () => request('POST', '/api/calories/ai-plan', {}),

  // Inventory use
  useInventoryItem: (id, amount) => request('POST', `/api/inventory/${id}/use`, { amount }),

  // Connected Apps
  getConnectedApps: () => request('GET', '/api/connected-apps'),
  disconnectApp: (appName) => request('DELETE', `/api/connected-apps/${appName}`),
  getStravaAuthUrl: () => request('GET', '/api/strava/auth-url'),
  syncStrava: () => request('POST', '/api/strava/sync'),

  // Avatar
  uploadAvatar: async (imageUri) => {
    const form = new FormData();
    form.append('avatar', { uri: imageUri, name: 'avatar.jpg', type: 'image/jpeg' });
    return request('POST', '/api/profile/avatar', form, true);
  },

  // Dokument-Text extrahieren
  parseDocument: (base64, mimeType, filename) => request('POST', '/api/training/parse-document', { base64, mimeType, filename }),
  // Trainingsplan-Text → strukturiertes JSON
  parsePlanStructure: (text) => request('POST', '/api/training/parse-plan-structure', { text }),

  // Kraft-Tracking
  getExercises: (q, muscle, equipment) => request('GET', `/api/kraft/exercises?q=${q||''}&muscle=${encodeURIComponent(muscle||'')}&equipment=${encodeURIComponent(equipment||'')}`),
  createCustomExercise: (b) => request('POST', '/api/kraft/exercises', b),
  getRoutines: () => request('GET', '/api/kraft/routines'),
  createRoutine: (b) => request('POST', '/api/kraft/routines', b),
  updateRoutine: (id, b) => request('PUT', `/api/kraft/routines/${id}`, b),
  deleteRoutine: (id) => request('DELETE', `/api/kraft/routines/${id}`),
  getSessions: (limit, offset) => request('GET', `/api/kraft/sessions?limit=${limit||20}&offset=${offset||0}`),
  saveSession: (b) => request('POST', '/api/kraft/sessions', b),
  deleteSession: (id) => request('DELETE', `/api/kraft/sessions/${id}`),
  getPRs: () => request('GET', '/api/kraft/prs'),
  getExerciseHistory: (id) => request('GET', `/api/kraft/exercise/${id}/history`),
  getVolumeStats: () => request('GET', '/api/kraft/stats/volume'),
};

// ============================================================
// GEMINI AI FUNCTIONS
// ============================================================

const GEMINI_URL = (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${key}`;

async function geminiRequest(key, body, { timeoutMs = 30000, retries = 5 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, Math.min(3000 * i, 15000)));
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(GEMINI_URL(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const data = await res.json();
      if (!res.ok) { lastErr = new Error(data.error?.message || 'Fehler'); console.error('[Gemini] HTTP', res.status, data.error?.message); continue; }
      return extractGeminiText(data);
    } catch(e) { lastErr = e; console.error('[Gemini] Fetch error:', e?.message); }
  }
  throw lastErr;
}

function extractGeminiText(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.filter(p => !p.thought).map(p => p.text || '').join('');
}

function parseGeminiJson(text) {
  let s = text.replace(/```json\n?|```\n?/g, '').trim();
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');
  // Try direct parse
  try { return JSON.parse(s); } catch(e) {}
  // Extract JSON starting from first { or [
  const oi = s.indexOf('{'), ai = s.indexOf('[');
  const start = oi !== -1 && (ai === -1 || oi < ai) ? oi : ai;
  if (start !== -1) {
    const extracted = s.slice(start).replace(/,(\s*[}\]])/g, '$1');
    try { return JSON.parse(extracted); } catch(e) {}
  }
  throw new Error('KI-Antwort konnte nicht gelesen werden');
}

export async function analyzeReceiptWithGemini(base64, mimeType, geminiKey) {
  const today = new Date().toISOString().split('T')[0];
  const prompt = `Analysiere diesen deutschen Kassenzettel. Extrahiere alle Lebensmittelprodukte AUSSER Getränken (keine Säfte, Wasser, Softdrinks, Bier, Wein, Kaffee, Tee, Energy Drinks).

MENGEN-REGELN (sehr wichtig!):
1. Steht auf dem Kassenzettel ein Gewicht oder eine Menge direkt beim Artikel (z.B. "0,456 kg", "500 g", "6 St")? → Diese exakt übernehmen und umrechnen (z.B. "0,456 kg" → "456 g").
2. Kein Gewicht auf Zettel? → Schätze nach Standardverpackung:
   - Mehl, Zucker, Reis, Nudeln, Haferflocken, Linsen: "1 kg"
   - Butter: "250 g"
   - Käse am Stück: "400 g" | Scheibenkäse: "200 g"
   - Joghurt, Quark: "500 g" | Griechischer Joghurt: "400 g"
   - Schmand, Sauerrahm, Creme fraiche: "200 g"
   - Frischkäse: "200 g"
   - Sahne: "200 ml"
   - Eier: erkenne Packungsgröße (S/M/L/XL → 6/10/12 Stück), Standard: "10 Stück"
   - Brot (Laib): "500 g" | Brötchen: "6 Stück"
   - Frisches Fleisch/Geflügel/Fisch (Theke): Gewicht vom Zettel, sonst "300 g"
   - Wurst aufschnitt: "100 g"
   - Konserven/Dosen: "1 Dose 400 g"
   - Tomaten (Dose): "1 Dose 400 g"
   - Tiefkühlgemüse: "750 g" | Tiefkühlpizza: "1 Stück"
   - Müsli/Cerealien: "500 g"
   - Marmelade, Honig, Aufstrich: "1 Glas 350 g"
   - Schokolade, Riegel: "100 g"
   - Chips, Snacks: "175 g"
   - Nüsse: "200 g"
   - Meerefrüchte aus Dose: "1 Dose 185 g"
   - Sonstiges Einzelprodukt: "1 Stück"
3. Wenn nach obigen Regeln trotzdem unklar: setze "unsicher": true (sonst false)
4. Erscheint dasselbe Produkt mehrmals auf dem Zettel? → NUR EINMAL ausgeben, "count" auf die Anzahl setzen (z.B. 3x Joghurt → count:3, qty:"500 g"). Bei Theken-Artikeln mit unterschiedlichem Gewicht: count:1, qty = Summe aller Gewichte.

Heute: ${today}
MHD-Richtwerte: Frische Milch 10 Tage, Joghurt 21 Tage, Hartkäse 90 Tage, Weichkäse 14 Tage, Eier 28 Tage, Frisches Fleisch 3 Tage, Geflügel 2 Tage, Brot 5 Tage, Aufschnitt 5 Tage, Konserven 730 Tage, Nudeln/Reis/Mehl 730 Tage, Tiefkühl 180 Tage, Butter 60 Tage.

WICHTIG: Antworte AUSSCHLIESSLICH mit JSON-Array, kein Markdown:
[{"name":"Name auf Deutsch","emoji":"passendes Emoji","mhd":"YYYY-MM-DD","qty":"Menge pro Stück","count":1,"category":"Kategorie","caloriesPer100g":100,"proteinPer100g":5,"carbsPer100g":15,"fatPer100g":3,"unsicher":false}]`;
  let text = '';
  try {
    const res = await fetch(GEMINI_URL(geminiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 8192 } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Fehler');
    text = extractGeminiText(data);
  } catch(e) {
    throw e;
  }
  text = text.replace(/```json\n?|```\n?/g, '').trim();
  if (!text) throw new Error('Keine Antwort von Gemini');
  // Robustes Parsing: Array extrahieren, bei unvollständigem JSON Abschneiden
  const startIdx = text.indexOf('[');
  if (startIdx === -1) throw new Error('Kein JSON-Array in Antwort gefunden');
  text = text.slice(startIdx);
  // Falls JSON abgeschnitten: letztes vollständiges Objekt finden
  try {
    return JSON.parse(text);
  } catch(e) {
    const lastComma = text.lastIndexOf(',\n  {');
    if (lastComma > 0) {
      try { return JSON.parse(text.slice(0, lastComma) + ']'); } catch(e2) {}
    }
    const lastBrace = text.lastIndexOf('},');
    if (lastBrace > 0) {
      try { return JSON.parse(text.slice(0, lastBrace + 1) + ']'); } catch(e3) {}
    }
    throw new Error('JSON konnte nicht geparst werden (möglicherweise zu viele Produkte)');
  }
}

export async function analyzeFoodPhoto(base64, mimeType, geminiKey, hint = '') {
  const hintText = hint ? `\nHinweis vom Nutzer: "${hint}"` : '';
  const prompt = `Analysiere dieses Essensfoto. Erkenne alle sichtbaren Zutaten/Komponenten einzeln.${hintText}
Antworte NUR mit JSON, kein Markdown:
{"name":"Gerichtname","components":[{"name":"Komponente","calories":200,"protein":10,"carbs":30,"fat":5,"amountG":150}],"total":{"calories":500,"protein":30,"carbs":60,"fat":15,"amountG":350}}`;
  const text = await geminiRequest(geminiKey, { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4000 } });
  return parseGeminiJson(text);
}

export async function getAiRecipeSuggestions(inventory, geminiKey) {
  const itemList = inventory.map(i => `${i.name} (${i.qty}, MHD: ${i.mhd || '?'})`).join('\n');
  const prompt = `Du bist Profi-Küchenchef. Erstelle 4 Rezepte basierend auf diesen Zutaten:\n${itemList}\n\nAntworte NUR mit JSON-Array. Für jedes Rezept: Mengenangaben für ALLE Zutaten, und eine sehr ausführliche Zubereitung mit 8-12 nummerierten Schritten (Temperaturen, Zeiten, Konsistenzen, häufige Fehler vermeiden). Verwende dieses Format exakt:\n[{"name":"Name","emoji":"🍽️","time":"30 Min","difficulty":"Einfach","servings":2,"totalCalories":500,"totalProtein":30,"totalCarbs":60,"totalFat":15,"ingredients_used":[{"name":"Zutat","amount":200,"unit":"g"}],"ingredients_needed":[{"name":"fehlende Zutat","amount":1,"unit":"Stück"}],"steps":"1. Schritt eins sehr detailliert...\n2. Schritt zwei sehr detailliert...\n3. Schritt drei..."}]`;
  const text = await geminiRequest(geminiKey, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 8000 } }, { retries: 5, timeoutMs: 60000 });
  return parseGeminiJson(text);
}

export async function calculateNutrition(name, geminiKey) {
  const prompt = `Nährwerte pro 100g für "${name}". NUR JSON: {"calories":100,"protein":5,"carbs":15,"fat":3}`;
  const text = await geminiRequest(geminiKey, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 200 } });
  return parseGeminiJson(text);
}

export async function lookupBarcode(barcode, geminiKey) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1) {
        const p = data.product;
        const n = p.nutriments || {};
        const servings = [];
        if (p.serving_size) {
          const match = p.serving_size.match(/([\d.,]+)\s*(g|ml|kg|l)/i);
          if (match) {
            const servingG = parseFloat(match[1].replace(',','.'));
            servings.push({ label: p.serving_size, grams: servingG });
          }
        }
        servings.push({ label: '100g', grams: 100 });
        return {
          name: p.product_name_de || p.product_name || 'Unbekannt',
          emoji: '🏷️',
          qty: p.quantity || '1 Stück',
          category: p.categories_tags?.[0]?.replace('en:', '') || 'Sonstiges',
          caloriesPer100g: n['energy-kcal_100g'] || null,
          proteinPer100g: n['proteins_100g'] || null,
          carbsPer100g: n['carbohydrates_100g'] || null,
          fatPer100g: n['fat_100g'] || null,
          servings,
        };
      }
    } catch(e) { if (attempt === 0) await new Promise(r => setTimeout(r, 1000)); }
  }

  if (geminiKey) {
    try {
      const prompt = `Produkt mit Barcode ${barcode}. Antworte NUR mit diesem JSON: {"name":"Name","emoji":"🍽️","qty":"1 Stück","category":"Lebensmittel","caloriesPer100g":0,"proteinPer100g":0,"carbsPer100g":0,"fatPer100g":0}`;
      const res = await fetch(GEMINI_URL(geminiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 1000 } })
      });
      const data = await res.json();
      let text = extractGeminiText(data);
      text = text.replace(/```json|```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch(e) {}
  }

  throw new Error('Produkt nicht gefunden');
}

export async function generateSingleMealWithGemini(user, geminiKey, mealType, servings, preference = '') {
  const calorieGoal = user?.calorieGoal || 2000;
  const mealShare = mealType === 'Snack' ? 0.1 : mealType === 'Frühstück' ? 0.25 : 0.325;
  const targetCal = Math.round(calorieGoal * mealShare);
  const targetP = Math.round(targetCal * 0.3 / 4);
  const diet = user?.dietType || 'omnivor';
  const prefText = preference.trim() ? `\nVorgabe des Nutzers: ${preference.trim()}` : '';
  const prompt = `Erstelle eine einzelne Mahlzeit auf Deutsch (${mealType}) für ${servings} Person(en).
Ernährungsweise: ${diet}. Ziel: ~${targetCal} kcal, ~${targetP}g Protein.${prefText}
Antworte NUR mit einem JSON-Objekt:
{"type":"${mealType}","emoji":"🍽️","name":"...","prepTime":"...","calories":${targetCal},"protein":${targetP},"carbs":0,"fat":0,"servings":${servings},"ingredients":["..."],"stepsShort":["..."],"steps":["..."]}
Passe calories/protein/carbs/fat an das tatsächliche Gericht an. Mindestens 3 Zutaten, 2 kurze und 4 detaillierte Schritte.`;
  const res = await fetch(GEMINI_URL(geminiKey), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 2000 } })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler');
  const text = extractGeminiText(data);
  return parseGeminiJson(text);
}

export async function generateMealPlanWithGemini(user, geminiKey, servings = 1, wishDishes = '', kitchenEquipment = []) {
  const calorieGoal = user?.calorieGoal || 2000;
  const protein = Math.round((calorieGoal * 0.3) / 4);
  const carbs = Math.round((calorieGoal * 0.4) / 4);
  const fat = Math.round((calorieGoal * 0.3) / 9);
  const diet = user?.dietType || 'omnivor';
  const goals = user?.goals || [];
  const calorieStrategy = goals.includes('lose')
    ? `Ziel: Gewichtsreduktion — Kalorien pro Tag leicht UNTER dem Ziel (${calorieGoal - 200}–${calorieGoal} kcal). Protein hoch halten.`
    : goals.includes('gain')
    ? `Ziel: Muskelaufbau — Kalorien pro Tag leicht ÜBER dem Ziel (${calorieGoal}–${calorieGoal + 200} kcal). Protein hoch halten.`
    : `Ziel: Gewicht halten — Kalorien nahe am Ziel (±150 kcal). Makros ausgewogen.`;
  const equipmentText = kitchenEquipment.length > 0
    ? `\nVerfügbare Küchengeräte: ${kitchenEquipment.join(', ')}. Nutze diese Geräte gezielt in den Rezepten und pass die Zubereitungsschritte entsprechend an.`
    : '';
  const prompt = `Erstelle einen 7-Tage-Ernährungsplan auf Deutsch für ${servings} Person(en).
Ernährungsweise: ${diet}. ${calorieStrategy}
Makroziele pro Person: ~${protein}g P, ~${carbs}g K, ~${fat}g F.${equipmentText}
${wishDishes.trim() ? `\nWunschgerichte (vereinzelt einbauen, nicht die ganze Woche): ${wishDishes.trim()}` : ''}

Abwechslungsreich, max. 2× gleiche Mahlzeit/Woche. Antworte NUR mit JSON:
{"days":[{"dayName":"Montag","totalCalories":0,"totalProtein":0,"meals":[{"type":"Frühstück","emoji":"🥣","name":"...","prepTime":"10 Min","calories":0,"protein":0,"carbs":0,"fat":0,"servings":${servings},"ingredients":["200g ..."],"stepsShort":["Kurzer Schritt 1","Kurzer Schritt 2","Kurzer Schritt 3"]},{"type":"Mittagessen",...},{"type":"Abendessen",...},{"type":"Snack",...}]},...]}
Genau 7 Tage, genau 4 Mahlzeiten pro Tag. stepsShort: 2–3 kurze Übersichtsschritte (kein steps-Feld nötig).`;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 3000));
      const res = await fetch(GEMINI_URL(geminiKey), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 12000 } })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler');
      const text = extractGeminiText(data);
      if (!text) throw new Error('Leere Antwort von Gemini');
      return parseGeminiJson(text);
    } catch(e) { lastErr = e; }
  }
  throw lastErr;
}

export async function swapIngredientWithGemini(meal, ingredientText, swapNote, geminiKey) {
  const otherIngredients = (meal.ingredients || []).filter(i => i !== ingredientText).join(', ');
  const prompt = `Rezept: "${meal.name}" für ${meal.servings || 1} Person(en).
Aktuelle Zutaten: ${(meal.ingredients || []).join(', ')}.
Ersetze "${ingredientText}" durch: "${swapNote}".
Berechne danach die neuen Gesamtmakros des ganzen Gerichts.
Antworte NUR mit JSON:
{"ingredients":["neue Zutat 1","neue Zutat 2"],"calories":0,"protein":0,"carbs":0,"fat":0}
ingredients = nur die Ersatzzutaten (nicht die anderen). calories/protein/carbs/fat = neue Gesamtwerte des Gerichts.`;
  const res = await fetch(GEMINI_URL(geminiKey), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 250 } })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler');
  const text = extractGeminiText(data);
  const result = parseGeminiJson(text);
  if (!result?.ingredients) throw new Error('Ungültige Antwort');
  return result; // { ingredients: [...], calories, protein, carbs, fat }
}

export async function generateDetailedStepsWithGemini(meal, geminiKey) {
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients.join(', ') : '';
  const prompt = `Du bist Profikoch und erklärst einem absoluten Kochanfänger das folgende Rezept Schritt für Schritt.

Gericht: ${meal.name}
Zutaten: ${ingredients}
Portionen: ${meal.servings || 1}

Erstelle eine WIRKLICH ausführliche Kochanleitung auf Deutsch — so detailliert, dass jemand der noch NIE gekocht hat keinen Fehler machen kann.

Regeln für jeden Schritt:
- Beginne mit einer klaren Aktionsbezeichnung (z.B. "Zwiebeln schneiden:", "Pfanne erhitzen:")
- Nenne EXAKTE Mengen mit Einheit (z.B. "1 EL Olivenöl", "200ml Wasser")
- Nenne EXAKTE Temperaturen in °C (z.B. "bei 180°C Ober-/Unterhitze", "mittlere Hitze ca. 160°C")
- Nenne EXAKTE Zeiten in Minuten ("3–4 Minuten", "ca. 12 Minuten")
- Beschreibe das visuelle Ergebnis ("goldbraune Farbe", "leicht glasig", "Blasen bilden sich")
- Beschreibe das Geräusch oder den Geruch wenn hilfreich ("brutzelt kräftig", "riecht nussig")
- Erkläre WARUM dieser Schritt wichtig ist wenn nicht offensichtlich
- Nenne häufige Fehler und wie man sie vermeidet
- Gib Anfänger-Tipps wo nötig (z.B. "Wenn die Pfanne raucht, ist sie zu heiß")

Antworte NUR mit einem JSON-Array aus 8–14 Strings (die Schritte). Kein Markdown, kein Text davor/danach:
["Schritt 1 sehr ausführlich...","Schritt 2 sehr ausführlich...",...]`;

  const res = await fetch(GEMINI_URL(geminiKey), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 4000 } })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler');
  const text = extractGeminiText(data);
  const result = parseGeminiJson(text);
  if (!Array.isArray(result)) throw new Error('Ungültige Antwort');
  return result;
}

export async function generateTrainingPlanWithGemini(user, trainingType, weekKey, geminiKey, additionalContext = '', weekPlanText = null, currentPhase = null) {
  const sports = user?.sportTypes?.length ? user.sportTypes.join(', ') : (trainingType || 'Ausdauer');
  const extras = [user?.ftp && `FTP ${user.ftp}W`, user?.maxHr && `HFmax ${user.maxHr}`, user?.weight && `${user.weight}kg`].filter(Boolean).join(', ');

  // [1] Always-apply rules come FIRST — highest priority
  const rulesSection = additionalContext?.trim()
    ? `[1] UNVERÄNDERLICHE REGELN – IMMER BEFOLGEN, HÖCHSTE PRIORITÄT, NIEMALS IGNORIEREN:\n${additionalContext.trim()}\n\n`
    : '';

  // [2] Weekly plan — must be followed exactly
  const weekSection = weekPlanText
    ? `[2] WOCHENPLAN – EXAKT UMSETZEN${currentPhase ? ` (${currentPhase})` : ''}:\n${weekPlanText}\n\nSetze JEDEN Trainingsinhalt 1:1 um: gleiche Sportart, gleiche Anzahl, gleiche Dauer. Keine Abweichungen.\n\n`
    : `Sportarten: ${sports}.\n\n`;

  const prompt = `Du bist Trainer. Erstelle einen 7-Tage-Trainingsplan (Montag bis Sonntag) auf Deutsch.

${rulesSection}${weekSection}Athletenwerte: ${extras || 'keine Angabe'}.

Gib NUR ein JSON-Objekt zurück mit: plan_name (String), description (String), planData ({weeklyLoad: String}), sessions (Array).
sessions enthält ALLE 7 Tage (day_index 0=Mo bis 6=So) — mehrere Sessions pro Tag möglich, Ruhetage is_rest:true.
Jede Session: day_index, sport_type (run/bike/swim/strength/yoga/mobility), is_rest (boolean), focus (String), duration (Minuten), intensity (Z1-Z5 oder leer), exercises (Array).
Jede Übung: name, emoji, zone, sets (Zahl), reps (Zahl), duration (Minuten).
Ruhetage: leeres exercises-Array, is_rest true. Alle 7 Tage müssen vorhanden sein.`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 4000));
    try {
      const res = await fetch(GEMINI_URL(geminiKey), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 8000 } })
      });
      const data = await res.json();
      if (!res.ok) {
        lastError = new Error(data.error?.message || 'Gemini Fehler');
        const isOverloaded = res.status === 503 || (data.error?.message || '').includes('high demand') || (data.error?.message || '').includes('overloaded');
        if (!isOverloaded) throw lastError;
        continue;
      }
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.filter(p => !p.thought).map(p => p.text || '').join('');
      const plan = parseGeminiJson(text);
      const sessions = (plan.sessions || []).map((s, i) => ({ ...s, id: Date.now() + i }));
      return { ...plan, sessions, week_key: weekKey, id: Date.now(), completedWorkouts: [] };
    } catch(e) {
      lastError = e;
      if (!e.message?.includes('high demand') && !e.message?.includes('overloaded')) throw e;
    }
  }
  throw lastError;
}

export async function analyzeWorkoutWithGemini(session, workoutData, user, geminiKey) {
  const sportLabels = { run: 'Laufen', bike: 'Radfahren', swim: 'Schwimmen', strength: 'Kraft', yoga: 'Yoga', triathlon: 'Triathlon', mobility: 'Mobility' };
  const sport = sportLabels[session?.sport_type] || session?.sport_type || 'Training';
  const planned = `Geplant: ${session?.focus || 'Einheit'}, ${session?.duration || '?'} Min, Intensität: ${session?.intensity || '–'}`;
  const actual = [
    workoutData.durationMinutes && `Dauer: ${workoutData.durationMinutes} Min`,
    workoutData.distance && `Distanz: ${workoutData.distance} km`,
    workoutData.avgHr && `Ø HR: ${workoutData.avgHr} bpm`,
    workoutData.maxHr && `Max HR: ${workoutData.maxHr} bpm`,
    workoutData.avgPower && `Ø Power: ${workoutData.avgPower} W`,
    workoutData.calories && `Kalorien: ${workoutData.calories} kcal`,
    workoutData.perceivedEffort && `RPE: ${workoutData.perceivedEffort}/10`,
    workoutData.rating && `Bewertung: ${workoutData.rating}/5`,
    workoutData.notes && `Notizen: ${workoutData.notes}`,
  ].filter(Boolean).join(', ');
  const profile = [user?.ftp && `FTP ${user.ftp}W`, user?.maxHr && `HFmax ${user.maxHr}`, user?.fitnessLevel].filter(Boolean).join(', ');
  const prompt = `Analysiere dieses ${sport}-Training kurz auf Deutsch (max. 4–5 Sätze). Sei konkret, hilfreich und ermutigend. Gib praktische Hinweise für die nächste Einheit.
${planned}
Tatsächlich: ${actual || 'keine Daten'}
Athletenprofil: ${profile || 'unbekannt'}
Antworte NUR mit dem Feedback-Text, kein JSON, keine Formatierung.`;
  const res = await fetch(GEMINI_URL(geminiKey), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 500 } })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler');
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.filter(p => !p.thought).map(p => p.text || '').join('').trim();
}

// ============================================================
// PACE HELPERS
// ============================================================
export function secondsToPace(totalSeconds) {
  if (!totalSeconds) return '';
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function paceToSeconds(paceStr) {
  if (!paceStr) return null;
  const parts = paceStr.split(':');
  if (parts.length !== 2) return null;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

export function getSportIcon(sportType) {
  const icons = {
    swim: 'water-outline',
    bike: 'bicycle-outline',
    run: 'footsteps-outline',
    strength: 'barbell-outline',
    rest: 'moon-outline',
    yoga: 'body-outline',
    mobility: 'walk-outline',
    mixed: 'medal-outline',
    triathlon: 'trophy-outline',
  };
  return icons[sportType] || 'fitness-outline';
}

export function getSportColor(sportType) {
  const colors = {
    swim: '#2196f3',
    bike: '#ff9800',
    run: '#4caf50',
    strength: '#e8c547',
    rest: '#555555',
    yoga: '#9c27b0',
    mobility: '#ce93d8',
    mixed: '#e8c547',
    triathlon: '#ff5722',
  };
  return colors[sportType] || '#e8c547';
}
