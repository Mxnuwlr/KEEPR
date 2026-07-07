/**
 * genimages.js — Gemini Web App Bildgenerierung
 *
 * Strategie: URL.createObjectURL() monkey-patchen via addInitScript()
 * → Bilder werden beim Erstellen abgefangen, BEVOR Gemini sie revoket
 * → funktioniert für blob: URLs aus Service Workers
 * → kein CORS, kein fetch(), kein Canvas nötig
 *
 * node genimages.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUTPUT_DIR = path.join(__dirname, 'ingredient_images');
const MAX_PER_CHAT = 1;
const START_FROM_SLUG = ''; // leer = alle fehlenden generieren
const REDO_FALSCH = true;

// name = Anzeigename, slug = Dateiname, subject = präziser englischer Begriff
const INGREDIENTS = [
  { name: 'Tomaten',              slug: 'tomaten',              subject: 'round red vine tomatoes' },
  { name: 'Zwiebeln',             slug: 'zwiebeln',             subject: 'whole yellow onions' },
  { name: 'Knoblauch',            slug: 'knoblauch',            subject: 'whole garlic bulb with loose cloves' },
  { name: 'Paprika rot',          slug: 'paprika-rot',          subject: 'whole red bell pepper' },
  { name: 'Paprika gelb',         slug: 'paprika-gelb',         subject: 'whole yellow bell pepper' },
  { name: 'Paprika grün',         slug: 'paprika-gruen',        subject: 'whole green bell pepper' },
  { name: 'Karotten',             slug: 'karotten',             subject: 'fresh orange carrots with green tops' },
  { name: 'Zucchini',             slug: 'zucchini',             subject: 'whole green zucchini' },
  { name: 'Gurke',                slug: 'gurke',                subject: 'whole fresh cucumber' },
  { name: 'Salat',                slug: 'salat',                subject: 'whole iceberg lettuce head, green' },
  { name: 'Spinat',               slug: 'spinat',               subject: 'fresh baby spinach leaves' },
  { name: 'Brokkoli',             slug: 'brokkoli',             subject: 'fresh broccoli head, green' },
  { name: 'Blumenkohl',           slug: 'blumenkohl',           subject: 'whole white cauliflower head' },
  { name: 'Weißkohl',             slug: 'weisskohl',            subject: 'whole white cabbage head' },
  { name: 'Rotkohl',              slug: 'rotkohl',              subject: 'whole red cabbage head' },
  { name: 'Lauch',                slug: 'lauch',                subject: 'fresh leek stalk, green and white' },
  { name: 'Sellerie',             slug: 'sellerie',             subject: 'fresh celery stalks bunch' },
  { name: 'Kartoffeln',           slug: 'kartoffeln',           subject: 'raw whole potatoes, brown skin' },
  { name: 'Süßkartoffeln',        slug: 'suesskartoffeln',      subject: 'raw whole sweet potatoes, orange skin' },
  { name: 'Champignons',          slug: 'champignons',          subject: 'fresh white button mushrooms' },
  { name: 'Erbsen',               slug: 'erbsen',               subject: 'fresh green peas in open pod' },
  { name: 'Grüne Bohnen',         slug: 'gruene-bohnen',        subject: 'fresh green beans' },
  { name: 'Mais',                 slug: 'mais',                 subject: 'fresh corn cob with yellow kernels' },
  { name: 'Aubergine',            slug: 'aubergine',            subject: 'whole fresh eggplant, dark purple' },
  { name: 'Avocado',              slug: 'avocado',              subject: 'whole avocado, one halved showing green flesh' },
  { name: 'Äpfel',                slug: 'aepfel',               subject: 'whole fresh red apple' },
  { name: 'Bananen',              slug: 'bananen',              subject: 'fresh yellow bananas, bunch of three' },
  { name: 'Orangen',              slug: 'orangen',              subject: 'whole fresh orange, one halved' },
  { name: 'Zitronen',             slug: 'zitronen',             subject: 'whole fresh yellow lemon' },
  { name: 'Erdbeeren',            slug: 'erdbeeren',            subject: 'fresh red strawberries with green stems' },
  { name: 'Himbeeren',            slug: 'himbeeren',            subject: 'fresh red raspberries' },
  { name: 'Blaubeeren',           slug: 'blaubeeren',           subject: 'fresh blueberries' },
  { name: 'Trauben',              slug: 'trauben',              subject: 'bunch of fresh green grapes' },
  { name: 'Mangos',               slug: 'mangos',               subject: 'whole fresh mango, yellow-red skin' },
  { name: 'Ananas',               slug: 'ananas',               subject: 'whole fresh pineapple with green crown' },
  { name: 'Hähnchenbrustfilet',   slug: 'haehnchenbrustfilet',  subject: 'raw boneless skinless chicken breast fillet' },
  { name: 'Hähnchenschenkel',     slug: 'haehnchenschenkel',    subject: 'raw chicken thigh and drumstick with skin' },
  { name: 'Hackfleisch',          slug: 'hackfleisch',          subject: 'raw mixed ground beef and pork mince' },
  { name: 'Rinderfilet',          slug: 'rinderfilet',          subject: 'raw beef tenderloin fillet, red meat' },
  { name: 'Schweinefilet',        slug: 'schweinefilet',        subject: 'raw pork tenderloin fillet' },
  { name: 'Speck',                slug: 'speck',                subject: 'raw streaky bacon strips, pink and white' },
  { name: 'Lachs',                slug: 'lachs',                subject: 'raw salmon fillet, bright orange-pink' },
  { name: 'Thunfisch',            slug: 'thunfisch',            subject: 'raw fresh tuna steak, dark red' },
  { name: 'Garnelen',             slug: 'garnelen',             subject: 'fresh raw king prawns, pink-grey' },
  { name: 'Schinken',             slug: 'schinken',             subject: 'sliced cooked ham, pink, deli style' },
  { name: 'Eier',                 slug: 'eier',                 subject: 'three fresh whole chicken eggs, brown shell' },
  { name: 'Butter',               slug: 'butter',               subject: 'block of butter wrapped in gold foil, partially unwrapped' },
  { name: 'Milch',                slug: 'milch',                subject: 'glass of fresh whole milk, white' },
  { name: 'Sahne',                slug: 'sahne',                subject: 'small jug of fresh heavy cream, white' },
  { name: 'Joghurt',              slug: 'joghurt',              subject: 'plain white yogurt in a small glass jar' },
  { name: 'Quark',                slug: 'quark',                subject: 'fresh white quark cheese in a bowl' },
  { name: 'Frischkäse',           slug: 'frischkaese',          subject: 'fresh cream cheese, white, spread on knife' },
  { name: 'Parmesan',             slug: 'parmesan',             subject: 'wedge of Parmesan cheese with grated pile' },
  { name: 'Mozzarella',           slug: 'mozzarella',           subject: 'fresh mozzarella ball in water' },
  { name: 'Gouda',                slug: 'gouda',                subject: 'round wheel of Gouda cheese, yellow' },
  { name: 'Feta',                 slug: 'feta',                 subject: 'block of white feta cheese crumbled' },
  { name: 'Crème fraîche',        slug: 'creme-fraiche',        subject: 'creamy white crème fraîche in a small bowl' },
  { name: 'Schmand',              slug: 'schmand',              subject: 'thick white sour cream in a small bowl' },
  { name: 'Spaghetti',            slug: 'spaghetti',            subject: 'dry spaghetti noodles bundle, raw, uncooked' },
  { name: 'Penne',                slug: 'penne',                subject: 'dry penne pasta, raw, uncooked, scattered' },
  { name: 'Reis',                 slug: 'reis',                 subject: 'pile of raw white long-grain rice' },
  { name: 'Mehl',                 slug: 'mehl',                 subject: 'pile of white wheat flour with a wooden spoon' },
  { name: 'Haferflocken',         slug: 'haferflocken',         subject: 'rolled oats in a small wooden bowl' },
  { name: 'Quinoa',               slug: 'quinoa',               subject: 'raw white quinoa seeds in a bowl' },
  { name: 'Linsen',               slug: 'linsen',               subject: 'dry brown lentils in a small bowl' },
  { name: 'Kichererbsen',         slug: 'kichererbsen',         subject: 'dry chickpeas in a small bowl' },
  { name: 'Olivenöl',             slug: 'olivenoel',            subject: 'olive oil in a small glass bottle with cork' },
  { name: 'Salz',                 slug: 'salz',                 subject: 'coarse sea salt crystals in a small bowl' },
  { name: 'Pfeffer',              slug: 'pfeffer',              subject: 'whole black peppercorns in a small bowl' },
  { name: 'Paprikapulver',        slug: 'paprikapulver',        subject: 'red paprika powder in a small bowl with a spoon' },
  { name: 'Curry',                slug: 'curry',                subject: 'yellow curry powder in a small bowl with a spoon' },
  { name: 'Zimt',                 slug: 'zimt',                 subject: 'cinnamon sticks and ground cinnamon powder' },
  { name: 'Chili',                slug: 'chili',                subject: 'whole fresh red chili peppers' },
  { name: 'Oregano',              slug: 'oregano',              subject: 'dried oregano herb in a small bowl' },
  { name: 'Basilikum',            slug: 'basilikum',            subject: 'fresh green basil leaves and sprigs' },
  { name: 'Rosmarin',             slug: 'rosmarin',             subject: 'fresh rosemary sprigs, green needles' },
  { name: 'Petersilie',           slug: 'petersilie',           subject: 'fresh flat-leaf parsley bunch, green' },
  { name: 'Ingwer',               slug: 'ingwer',               subject: 'fresh ginger root, one piece whole and one sliced' },
  { name: 'Tomatenmark',          slug: 'tomatenmark',          subject: 'tomato paste in a small bowl, deep red' },
  { name: 'Senf',                 slug: 'senf',                 subject: 'yellow mustard in a small glass jar' },
  { name: 'Sojasoße',             slug: 'sojasosse',            subject: 'soy sauce in a small ceramic bowl, dark brown' },
  { name: 'Honig',                slug: 'honig',                subject: 'golden honey in a small jar with wooden dipper' },
  { name: 'Zucker',               slug: 'zucker',               subject: 'white granulated sugar in a small bowl with a spoon' },
  { name: 'Dosentomaten',         slug: 'dosentomaten',         subject: 'opened can of whole peeled tomatoes' },
  { name: 'Kokosmilch',           slug: 'kokosmilch',           subject: 'coconut milk in a small jug, white' },
  { name: 'Schokolade',           slug: 'schokolade',           subject: 'dark chocolate bar broken into pieces' },
  { name: 'Walnüsse',             slug: 'walnuesse',            subject: 'whole and halved walnuts' },
  { name: 'Mandeln',              slug: 'mandeln',              subject: 'whole raw almonds scattered' },
  { name: 'Erdnussbutter',        slug: 'erdnussbutter',        subject: 'peanut butter in a small jar, creamy brown' },
  { name: 'Brot',                 slug: 'brot',                 subject: 'whole German-style dark rye bread loaf' },
  { name: 'Toastbrot',            slug: 'toastbrot',            subject: 'sliced white toast bread, two slices fanned out' },
];

const PROMPT = (subject) =>
  `Professional food photography of ${subject} on a pure white background. ` +
  `Studio lighting, vibrant natural colors, clean and fresh, appetizing, ` +
  `centered, no text, no labels, no packaging.`;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Wird als InitScript in JEDE Page-Load injiziert.
 * Überschreibt URL.createObjectURL() — fängt Bild-Blobs beim Erstellen ab,
 * bevor Gemini sie revoket. Speichert sie in window.__blobCaptures[].
 */
const INIT_SCRIPT = `
(function() {
  window.__blobCaptures = [];
  const _orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(obj) {
    const url = _orig(obj);
    if (obj && obj instanceof Blob && obj.type && obj.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = function() {
        const b64 = reader.result ? reader.result.split(',')[1] : null;
        if (b64 && b64.length > 10000) {
          window.__blobCaptures.push({ url, b64, ts: Date.now() });
        }
      };
      reader.readAsDataURL(obj);
    }
    return url;
  };
})();
`;

/**
 * Merkt sich den Array-Index VOR dem Prompt und wartet auf Einträge DANACH.
 * Kein Timestamp-Chaos, kein URL-Tracking — simpel und zuverlässig.
 *
 * startIdx muss VOR sendPrompt() abgefragt werden.
 */
async function getStartIdx(page) {
  try {
    return await page.evaluate(() => (window.__blobCaptures || []).length);
  } catch { return 0; }
}

async function waitForBlobCapture(page, startIdx, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(1500);

    try {
      const b64 = await page.evaluate((idx) => {
        const captures = window.__blobCaptures || [];
        for (let i = idx; i < captures.length; i++) {
          if (captures[i] && captures[i].b64 && captures[i].b64.length > 10000) {
            return captures[i].b64;
          }
        }
        return null;
      }, startIdx);

      if (b64) return Buffer.from(b64, 'base64');

    } catch (e) {
      // Navigation/Context destroyed → kurz warten bis Seite neu geladen
      if (e.message.includes('context was destroyed') || e.message.includes('navigation')) {
        await sleep(3000);
      }
    }
  }

  throw new Error('Timeout — kein Bild-Blob abgefangen');
}

async function sendPrompt(page, text) {
  const selectors = [
    'rich-textarea .ql-editor',
    'rich-textarea [contenteditable="true"]',
    '[contenteditable="true"]',
    'div[role="textbox"]',
    'textarea',
  ];
  let input = null;
  for (const sel of selectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 5000, state: 'visible' });
      if (el) { input = el; break; }
    } catch {}
  }
  if (!input) throw new Error('Input-Feld nicht gefunden');

  await input.click({ force: true });
  await sleep(200);
  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Backspace');
  await sleep(100);
  await page.keyboard.type(text, { delay: 12 });
  await sleep(400);
  await page.keyboard.press('Enter');
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // "falsch"-Dateien löschen → werden neu generiert
  if (REDO_FALSCH) {
    const allFiles = fs.readdirSync(OUTPUT_DIR);
    const falschFiles = allFiles.filter(f => f.toLowerCase().includes('falsch') || f.toLowerCase().includes('flasch'));
    for (const f of falschFiles) {
      fs.unlinkSync(path.join(OUTPUT_DIR, f));
      const slug = path.basename(f, path.extname(f)).split(' ')[0];
      console.log(`🗑️  Gelöscht: ${f} → ${slug} wird neu generiert`);
    }
    if (falschFiles.length > 0) console.log('');
  }

  const existing = new Set(
    fs.readdirSync(OUTPUT_DIR).map(f => path.basename(f, path.extname(f)))
  );

  let todo = INGREDIENTS.filter(i => !existing.has(i.slug));

  if (START_FROM_SLUG) {
    const startIdx = todo.findIndex(i => i.slug === START_FROM_SLUG);
    if (startIdx > 0) {
      console.log(`⏩ Starte ab "${START_FROM_SLUG}" (überspringe ${startIdx})\n`);
      todo = todo.slice(startIdx);
    }
  }

  console.log(`🎨 ${todo.length} Bilder zu generieren (${existing.size} vorhanden)\n`);
  if (todo.length === 0) { console.log('✅ Alle vorhanden!'); return; }

  const playwrightProfile = path.join(__dirname, 'playwright_profile');
  const context = await chromium.launchPersistentContext(playwrightProfile, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  // InitScript in ALLE neuen Pages injizieren (auch nach Navigationen)
  await context.addInitScript(INIT_SCRIPT);

  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  console.log('👉 Bitte in Chrome:');
  console.log('   1. Einloggen falls nötig');
  console.log('   2. Modell mit Bildgenerierung einstellen\n');
  console.log('Startet in 60 Sekunden...\n');

  for (let i = 60; i > 0; i--) { process.stderr.write(`\r   ⏳ ${i}s...`); await sleep(1000); }
  process.stderr.write('\n\n');
  console.log('▶️  Los gehts!\n');

  let ok = 0, fail = 0, inCurrentChat = 0;

  for (const ing of todo) {
    const num = ok + fail + 1;

    // Neuer Chat alle MAX_PER_CHAT
    if (inCurrentChat > 0 && inCurrentChat % MAX_PER_CHAT === 0) {
      console.log(`\n🔄 Neuer Chat nach ${MAX_PER_CHAT} Bildern...\n`);
      await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(3000);
    }

    process.stdout.write(`  [${num}/${todo.length}] "${ing.name}"... `);

    try {
      // Index VOR dem Prompt merken
      const startIdx = await getStartIdx(page);

      // Prompt senden
      try {
        await sendPrompt(page, PROMPT(ing.subject));
      } catch {
        process.stdout.write('↩️  ');
        await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(3000);
        await sendPrompt(page, PROMPT(ing.subject));
      }

      // Auf Blob-Capture warten (nur Einträge ab startIdx)
      const imgBuffer = await waitForBlobCapture(page, startIdx, 90000);

      if (imgBuffer.length < 10000) throw new Error('Bild zu klein');

      fs.writeFileSync(path.join(OUTPUT_DIR, `${ing.slug}.png`), imgBuffer);
      console.log(`✅ (${(imgBuffer.length / 1024).toFixed(0)} KB)`);
      ok++;
      inCurrentChat++;

    } catch (e) {
      console.log(`❌ ${e.message}`);
      fail++;
      inCurrentChat++;
    }

    await sleep(2500);
  }

  console.log(`\n✅ ${ok} generiert  ❌ ${fail} Fehler`);
  console.log(`📁 ${OUTPUT_DIR}\n`);
  await context.close();
}

main().catch(e => { console.error('Fehler:', e.message); process.exit(1); });
