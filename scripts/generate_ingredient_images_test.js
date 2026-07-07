/**
 * generate_ingredient_images_test.js
 *
 * Generiert Test-Bilder für 10 Zutaten mit Gemini Image Generation.
 * Führe erst dieses Skript aus und schau ob der Stil passt.
 * Danach gibt es das vollständige Skript mit allen ~300 Zutaten.
 *
 * Ausführen:
 *   GEMINI_KEY=dein_key node generate_ingredient_images_test.js
 *
 * Oder auf dem Pi (wo der Key schon liegt):
 *   node generate_ingredient_images_test.js
 */

const fs = require('fs');
const path = require('path');

const GEMINI_KEY = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
const OUTPUT_DIR = path.join(__dirname, 'ingredient_images_test');

if (!GEMINI_KEY) {
  console.error('❌ Kein GEMINI_KEY gefunden. Bitte setzen: GEMINI_KEY=xxx node ...');
  process.exit(1);
}

// Test-Batch: 10 repräsentative Zutaten aus verschiedenen Kategorien
const TEST_INGREDIENTS = [
  { name: 'Tomaten',        slug: 'tomaten' },
  { name: 'Zwiebel',        slug: 'zwiebel' },
  { name: 'Knoblauch',      slug: 'knoblauch' },
  { name: 'Hähnchenbrustfilet', slug: 'haehnchenbrustfilet' },
  { name: 'Spaghetti',      slug: 'spaghetti' },
  { name: 'Butter',         slug: 'butter' },
  { name: 'Eier',           slug: 'eier' },
  { name: 'Mehl',           slug: 'mehl' },
  { name: 'Olivenöl',       slug: 'olivenoel' },
  { name: 'Paprika rot',    slug: 'paprika-rot' },
];

// Prompt-Stil: anpassen wenn dir was nicht gefällt
// Optionen:
//   - "on a white background" → rein weiß
//   - "on a light gray background" → hellgrau wie Choosy
//   - "top-down view" → von oben
//   - "slight angle" → leicht schräg
const IMAGE_PROMPT = (name) =>
  `A clean, professional food photo of ${name}, isolated on a pure white background, ` +
  `soft natural lighting, no shadows, no text, no labels, no packaging, ` +
  `the food item centered and filling most of the frame, ` +
  `photorealistic, high quality, 200x200 pixels style`;

async function generateImage(ingredient) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${GEMINI_KEY}`;

  const body = {
    contents: [{
      parts: [{ text: IMAGE_PROMPT(ingredient.name) }]
    }],
    generationConfig: {
      responseModalities: ['IMAGE'],
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API Fehler ${res.status}: ${err}`);
  }

  const data = await res.json();

  // Bild aus Response extrahieren
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));

  if (!imagePart) {
    throw new Error(`Kein Bild in Response für "${ingredient.name}"`);
  }

  return Buffer.from(imagePart.inlineData.data, 'base64');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\n🎨 Generiere ${TEST_INGREDIENTS.length} Test-Bilder...\n`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);

  let ok = 0;
  let fail = 0;

  for (const ing of TEST_INGREDIENTS) {
    process.stdout.write(`  Generiere "${ing.name}"... `);
    try {
      const imageBuffer = await generateImage(ing);
      const filePath = path.join(OUTPUT_DIR, `${ing.slug}.png`);
      fs.writeFileSync(filePath, imageBuffer);
      console.log(`✅ gespeichert (${(imageBuffer.length / 1024).toFixed(0)} KB)`);
      ok++;
    } catch (e) {
      console.log(`❌ Fehler: ${e.message}`);
      fail++;
    }

    // Rate limiting: 2 Sekunden Pause zwischen Anfragen
    if (ing !== TEST_INGREDIENTS[TEST_INGREDIENTS.length - 1]) {
      await sleep(2000);
    }
  }

  console.log(`\n✅ ${ok} Bilder generiert, ❌ ${fail} Fehler`);
  console.log(`\n👉 Schau dir die Bilder in ${OUTPUT_DIR} an.`);
  console.log('   Wenn der Stil passt → vollständiges Skript mit allen Zutaten generieren.\n');

  // Wenn du den Stil anpassen willst:
  console.log('💡 Stil-Hinweis: Den Prompt in IMAGE_PROMPT() anpassen und nochmal laufen lassen.\n');
}

main().catch(e => {
  console.error('❌ Unerwarteter Fehler:', e);
  process.exit(1);
});
