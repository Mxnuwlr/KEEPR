/**
 * generate_ingredient_images_gemini.js
 *
 * Automatisiert Gemini Web App um Lebensmittelbilder zu generieren.
 *
 * Ausführen:
 *   node generate_ingredient_images_gemini.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'ingredient_images');

const INGREDIENTS = [
  { name: 'Tomaten',              slug: 'tomaten' },
  { name: 'Zwiebeln',             slug: 'zwiebeln' },
  { name: 'Knoblauch',            slug: 'knoblauch' },
  { name: 'Paprika rot',          slug: 'paprika-rot' },
  { name: 'Paprika gelb',         slug: 'paprika-gelb' },
  { name: 'Paprika grün',         slug: 'paprika-gruen' },
  { name: 'Karotten',             slug: 'karotten' },
  { name: 'Zucchini',             slug: 'zucchini' },
  { name: 'Gurke',                slug: 'gurke' },
  { name: 'Salat',                slug: 'salat' },
  { name: 'Spinat',               slug: 'spinat' },
  { name: 'Brokkoli',             slug: 'brokkoli' },
  { name: 'Blumenkohl',           slug: 'blumenkohl' },
  { name: 'Weißkohl',             slug: 'weisskohl' },
  { name: 'Rotkohl',              slug: 'rotkohl' },
  { name: 'Lauch',                slug: 'lauch' },
  { name: 'Sellerie',             slug: 'sellerie' },
  { name: 'Kartoffeln',           slug: 'kartoffeln' },
  { name: 'Süßkartoffeln',        slug: 'suesskartoffeln' },
  { name: 'Champignons',          slug: 'champignons' },
  { name: 'Erbsen',               slug: 'erbsen' },
  { name: 'Grüne Bohnen',         slug: 'gruene-bohnen' },
  { name: 'Mais',                 slug: 'mais' },
  { name: 'Aubergine',            slug: 'aubergine' },
  { name: 'Avocado',              slug: 'avocado' },
  { name: 'Äpfel',                slug: 'aepfel' },
  { name: 'Bananen',              slug: 'bananen' },
  { name: 'Orangen',              slug: 'orangen' },
  { name: 'Zitronen',             slug: 'zitronen' },
  { name: 'Erdbeeren',            slug: 'erdbeeren' },
  { name: 'Himbeeren',            slug: 'himbeeren' },
  { name: 'Blaubeeren',           slug: 'blaubeeren' },
  { name: 'Trauben',              slug: 'trauben' },
  { name: 'Mangos',               slug: 'mangos' },
  { name: 'Ananas',               slug: 'ananas' },
  { name: 'Hähnchenbrustfilet',   slug: 'haehnchenbrustfilet' },
  { name: 'Hähnchenschenkel',     slug: 'haehnchenschenkel' },
  { name: 'Hackfleisch',          slug: 'hackfleisch' },
  { name: 'Rinderfilet',          slug: 'rinderfilet' },
  { name: 'Schweinefilet',        slug: 'schweinefilet' },
  { name: 'Speck',                slug: 'speck' },
  { name: 'Lachs',                slug: 'lachs' },
  { name: 'Thunfisch',            slug: 'thunfisch' },
  { name: 'Garnelen',             slug: 'garnelen' },
  { name: 'Schinken',             slug: 'schinken' },
  { name: 'Eier',                 slug: 'eier' },
  { name: 'Butter',               slug: 'butter' },
  { name: 'Milch',                slug: 'milch' },
  { name: 'Sahne',                slug: 'sahne' },
  { name: 'Joghurt',              slug: 'joghurt' },
  { name: 'Quark',                slug: 'quark' },
  { name: 'Frischkäse',           slug: 'frischkaese' },
  { name: 'Parmesan',             slug: 'parmesan' },
  { name: 'Mozzarella',           slug: 'mozzarella' },
  { name: 'Gouda',                slug: 'gouda' },
  { name: 'Feta',                 slug: 'feta' },
  { name: 'Crème fraîche',        slug: 'creme-fraiche' },
  { name: 'Schmand',              slug: 'schmand' },
  { name: 'Spaghetti',            slug: 'spaghetti' },
  { name: 'Penne',                slug: 'penne' },
  { name: 'Reis',                 slug: 'reis' },
  { name: 'Mehl',                 slug: 'mehl' },
  { name: 'Haferflocken',         slug: 'haferflocken' },
  { name: 'Quinoa',               slug: 'quinoa' },
  { name: 'Linsen',               slug: 'linsen' },
  { name: 'Kichererbsen',         slug: 'kichererbsen' },
  { name: 'Olivenöl',             slug: 'olivenoel' },
  { name: 'Salz',                 slug: 'salz' },
  { name: 'Pfeffer',              slug: 'pfeffer' },
  { name: 'Paprikapulver',        slug: 'paprikapulver' },
  { name: 'Curry',                slug: 'curry' },
  { name: 'Zimt',                 slug: 'zimt' },
  { name: 'Chili',                slug: 'chili' },
  { name: 'Oregano',              slug: 'oregano' },
  { name: 'Basilikum',            slug: 'basilikum' },
  { name: 'Rosmarin',             slug: 'rosmarin' },
  { name: 'Petersilie',           slug: 'petersilie' },
  { name: 'Ingwer',               slug: 'ingwer' },
  { name: 'Tomatenmark',          slug: 'tomatenmark' },
  { name: 'Senf',                 slug: 'senf' },
  { name: 'Sojasoße',             slug: 'sojasosse' },
  { name: 'Honig',                slug: 'honig' },
  { name: 'Zucker',               slug: 'zucker' },
  { name: 'Dosentomaten',         slug: 'dosentomaten' },
  { name: 'Kokosmilch',           slug: 'kokosmilch' },
  { name: 'Schokolade',           slug: 'schokolade' },
  { name: 'Walnüsse',             slug: 'walnuesse' },
  { name: 'Mandeln',              slug: 'mandeln' },
  { name: 'Erdnussbutter',        slug: 'erdnussbutter' },
  { name: 'Brot',                 slug: 'brot' },
  { name: 'Toastbrot',            slug: 'toastbrot' },
];

const PROMPT = (name) =>
  `Generate an image of ${name} on a white background. Clean food photo, centered, no text.`;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const existing = new Set(
    fs.readdirSync(OUTPUT_DIR).map(f => path.basename(f, path.extname(f)))
  );

  const todo = INGREDIENTS.filter(i => !existing.has(i.slug));
  console.log(`\n🎨 ${todo.length} Bilder zu generieren (${existing.size} bereits vorhanden)\n`);

  if (todo.length === 0) {
    console.log('✅ Alle Bilder bereits vorhanden!');
    return;
  }

  // Echter Chrome mit deinem bestehenden Profil — bereits eingeloggt!
  // WICHTIG: Chrome muss vorher vollständig geschlossen sein!
  const userDataDir = `${process.env.HOME}/Library/Application Support/Google/Chrome`;

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    viewport: null,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = await context.newPage();

  await page.goto('https://gemini.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('⏳ Warte 10 Sekunden damit Gemini lädt...\n');
  await sleep(10000);
  console.log('▶️  Starte jetzt...\n');

  let ok = 0;
  let fail = 0;

  for (const ing of todo) {
    const num = ok + fail + 1;
    process.stdout.write(`  [${num}/${todo.length}] "${ing.name}"... `);

    try {
      // Neue Konversation starten
      await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);

      // Input-Feld — mehrere Selektoren versuchen
      let input = null;
      const selectors = [
        'rich-textarea .ql-editor',
        'rich-textarea [contenteditable="true"]',
        '[contenteditable="true"][aria-label]',
        'textarea[placeholder]',
        '.input-area-container [contenteditable]',
        'div[role="textbox"]',
      ];

      for (const sel of selectors) {
        try {
          input = await page.waitForSelector(sel, { timeout: 3000 });
          if (input) break;
        } catch {}
      }

      if (!input) throw new Error('Input-Feld nicht gefunden');

      await input.click();
      await sleep(300);
      await page.keyboard.type(PROMPT(ing.name), { delay: 20 });
      await sleep(500);
      await page.keyboard.press('Enter');

      // Auf generiertes Bild warten (max 90 Sekunden)
      let imgEl = null;
      const imgSelectors = [
        'img.generative-image',
        '[data-test-id="generated-image"] img',
        '.image-generation img',
        'model-response img[src*="blob"]',
        'div[data-response-index] img[src*="blob"]',
        '.response-container img[src*="blob"]',
      ];

      const deadline = Date.now() + 90000;
      while (Date.now() < deadline && !imgEl) {
        for (const sel of imgSelectors) {
          try {
            imgEl = await page.$(sel);
            if (imgEl) break;
          } catch {}
        }
        if (!imgEl) await sleep(2000);
      }

      // Fallback: größtes Bild in der Antwort nehmen
      if (!imgEl) {
        imgEl = await page.evaluateHandle(() => {
          const imgs = [...document.querySelectorAll('img')];
          return imgs
            .filter(i => i.naturalWidth > 200 && i.naturalHeight > 200 && !i.src.includes('avatar') && !i.src.includes('google.com/images'))
            .sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight))[0] || null;
        });
        if (imgEl && !(await imgEl.asElement())) imgEl = null;
      }

      if (!imgEl) throw new Error('Kein Bild generiert (Timeout)');

      // Bild als Screenshot speichern
      const imgPath = path.join(OUTPUT_DIR, `${ing.slug}.png`);
      const el = imgEl.asElement ? imgEl.asElement() : imgEl;
      await el.screenshot({ path: imgPath });

      const size = fs.statSync(imgPath).size;
      if (size < 2000) throw new Error('Bild zu klein');

      console.log(`✅ (${(size / 1024).toFixed(0)} KB)`);
      ok++;

    } catch (e) {
      console.log(`❌ ${e.message}`);
      fail++;
    }

    await sleep(2000);
  }

  console.log(`\n✅ ${ok} Bilder generiert, ❌ ${fail} Fehler`);
  console.log(`📁 ${OUTPUT_DIR}\n`);

  await context.close();
}

main().catch(e => {
  console.error('Fehler:', e.message);
  process.exit(1);
});
