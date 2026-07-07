/**
 * genmobility.js — Mobility-Medien (Standbilder + optional Video-Loops) via Gemini Web-App
 *
 * Spiegelt die bewährte genimages.js-Pipeline: treibt die Gemini-Web-App per
 * Playwright und fängt die generierten Medien-Blobs über einen createObjectURL-
 * Monkeypatch ab (kostenlos, kein API-Key, kein CORS).
 *
 * Quelle der Übungen: ../src/data/mobilityCatalog.json (eine Wahrheitsquelle für
 * App, Backend und diesen Generator). Dateiname je Übung = <slug>.
 *
 *   MODE = 'poster'  → <slug>.png   (Standbild; funktioniert SOFORT im Player,
 *                      kein expo-video / Dev-Build nötig — bewährte Bild-Pipeline)
 *   MODE = 'video'   → <slug>.mp4   (Loop-Clip; EXPERIMENTELL: braucht Veo-Zugang
 *                      im Gemini-Konto. Veo streamt teils über MediaSource statt
 *                      eines Blobs — dann hier nicht abfangbar, manuell laden.)
 *
 * Ablauf:
 *   1) node scripts/genmobility.js            (MODE unten setzen)
 *   2) Chrome öffnet → einloggen, Bild-/Video-Modell wählen → 60s Countdown
 *   3) Medien landen in scripts/mobility_media/
 *   4) SICHTEN: schlechte/falsche Form löschen → werden beim nächsten Lauf neu erzeugt
 *   5) Hochladen: bash scripts/upload_mobility.sh
 *
 * node scripts/genmobility.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Konfiguration ──────────────────────────────────────────────────────────
const MODE = 'poster';                 // 'poster' (.png) | 'video' (.mp4)
const MAX_PER_CHAT = 1;                 // 1 = neuer Chat pro Übung (kein Context-Bleed)
const START_FROM_SLUG = '';            // leer = alle fehlenden

// SET: 'assessment' = die 6 Scrub-Test-Videos (test-*, 0→100-Bewegung) — PRIORITÄT.
//      'catalog'    = alle Übungen aus dem Katalog (für den Flow-Player, Loops ok).
const SET = 'catalog';

// Assessment-Clips MÜSSEN die Bewegung von 0 % (neutral) bis 100 % (Maximum) in EINER
// langsamen Bewegung zeigen — KEIN Loop, KEINE Wiederholung — sonst klappt das Scrubben nicht.
// Zum ERSTEN Testen ggf. nur den ersten Eintrag drinlassen.
const ASSESSMENT_CLIPS = [
  { slug: 'test-single-leg-squat', name: 'Einbein-Kniebeuge', prompt: "a single athletic person balancing on one leg, side view. The clip BEGINS standing tall and upright (neutral start), then SLOWLY and continuously lowers into a single-leg squat as deep as controlled, the knee tracking over the foot, reaching the deepest controlled position at the very end" },
  { slug: 'test-hip-extension', name: 'Hüftstreckung', prompt: "a single athletic person in a half-kneeling lunge with the back knee on the floor and pelvis upright, side view. The clip BEGINS with the hip only slightly stretched (neutral start), then SLOWLY and continuously pushes the back hip forward into a deep hip-flexor stretch, reaching maximum hip extension at the very end" },
  { slug: 'test-hip-internal-rotation', name: 'Hüft-Innenrotation', prompt: "a single person seated upright on a box with the thigh fixed, front view. The clip BEGINS with the lower leg hanging vertical (neutral start), then SLOWLY swings the foot outward so the hip rotates internally, reaching maximum internal rotation at the very end" },
  { slug: 'test-shoulder-external-rotation', name: 'Schulter-Außenrotation', prompt: "a single person standing, upper arm tucked against the side and elbow bent at 90 degrees, side view. The clip BEGINS with the forearm pointing straight forward (neutral start), then SLOWLY rotates the forearm outward while the elbow stays glued to the side, reaching maximum shoulder external rotation at the very end" },
  { slug: 'test-overhead', name: 'Overhead', prompt: "a single person standing with the back flat against a wall, side view. The clip BEGINS with both straight arms down by the sides (neutral start), then SLOWLY raises both straight arms forward and overhead toward the wall, reaching maximum overhead reach at the very end" },
  { slug: 'test-wrist-extension', name: 'Handgelenk-Streckung', prompt: "a close-up of a single person's forearm held horizontal with the palm facing down, side view. The clip BEGINS with the hand in line with the forearm (neutral start), then SLOWLY extends the hand and fingers upward, reaching maximum wrist extension at the very end" },
];

const CATALOG_ALL = require('../src/data/mobilityCatalog.json');
const ITEMS = SET === 'assessment'
  ? ASSESSMENT_CLIPS
  : CATALOG_ALL.map(e => ({ slug: e.slug, name: e.name, prompt: e.prompt }));

const OUTPUT_DIR = path.join(__dirname, 'mobility_media');
const EXT = MODE === 'video' ? 'mp4' : 'png';
const MIME = MODE === 'video' ? 'video/' : 'image/';
const TIMEOUT_MS = MODE === 'video' ? 240000 : 90000;
const MIN_BYTES = MODE === 'video' ? 50000 : 10000;

const PROMPT_POSTER = (p) =>
  `Clean instructional fitness illustration showing ${p}. ` +
  `Flat modern vector style, single athletic figure in neutral sportswear, ` +
  `plain light background, anatomically correct posture, clear side view, ` +
  `full body visible, centered, no text, no labels, no arrows.`;

// Video für den Scrub: EINE durchgehende Bewegung von neutral → Maximum, feste Kamera,
// kein Loop, keine Wiederholung. So entspricht Reglerposition = Punkt im Bewegungsumfang.
const PROMPT_VIDEO = (p) =>
  `A single continuous instructional fitness demo video, fixed locked-off camera, one realistic ` +
  `athletic person, plain neutral studio background, even soft lighting: ${p}. ` +
  `ONE slow continuous controlled motion from the neutral start to the maximum end position — ` +
  `NO repetition, NO looping, NO returning, the movement only progresses forward once. ` +
  `No text, no captions, no on-screen graphics, the camera stays completely still. About 6 seconds.`;

const PROMPT = (p) => (MODE === 'video' ? PROMPT_VIDEO(p) : PROMPT_POSTER(p));

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Fängt image/* UND video/* Blobs beim Erstellen ab (vor revoke).
const INIT_SCRIPT = `
(function() {
  window.__blobCaptures = [];
  const _orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(obj) {
    const url = _orig(obj);
    if (obj && obj instanceof Blob && obj.type && (obj.type.startsWith('image/') || obj.type.startsWith('video/'))) {
      const reader = new FileReader();
      reader.onloadend = function() {
        const b64 = reader.result ? reader.result.split(',')[1] : null;
        if (b64 && b64.length > 10000) {
          window.__blobCaptures.push({ url, b64, type: obj.type, ts: Date.now() });
        }
      };
      reader.readAsDataURL(obj);
    }
    return url;
  };
})();
`;

async function getStartIdx(page) {
  try { return await page.evaluate(() => (window.__blobCaptures || []).length); } catch { return 0; }
}

async function waitForCapture(page, startIdx, wantMime, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(2000);
    try {
      const b64 = await page.evaluate(({ idx, mime }) => {
        const caps = window.__blobCaptures || [];
        for (let i = idx; i < caps.length; i++) {
          if (caps[i] && caps[i].type && caps[i].type.startsWith(mime) && caps[i].b64 && caps[i].b64.length > 10000) {
            return caps[i].b64;
          }
        }
        return null;
      }, { idx: startIdx, mime: wantMime });
      if (b64) return Buffer.from(b64, 'base64');
    } catch (e) {
      if (e.message.includes('context was destroyed') || e.message.includes('navigation')) await sleep(3000);
    }
  }
  throw new Error('Timeout — kein passender Blob abgefangen');
}

async function sendPrompt(page, text) {
  const selectors = [
    'rich-textarea .ql-editor', 'rich-textarea [contenteditable="true"]',
    '[contenteditable="true"]', 'div[role="textbox"]', 'textarea',
  ];
  let input = null;
  for (const sel of selectors) {
    try { const el = await page.waitForSelector(sel, { timeout: 5000, state: 'visible' }); if (el) { input = el; break; } } catch {}
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

  const existing = new Set(
    fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.' + EXT)).map(f => path.basename(f, '.' + EXT))
  );
  let todo = ITEMS.filter(e => !existing.has(e.slug));
  if (START_FROM_SLUG) {
    const i = todo.findIndex(e => e.slug === START_FROM_SLUG);
    if (i > 0) { console.log(`⏩ Starte ab "${START_FROM_SLUG}"\n`); todo = todo.slice(i); }
  }

  console.log(`🧘 SET=${SET} · MODE=${MODE} · ${todo.length} ${EXT.toUpperCase()} zu generieren (${existing.size} vorhanden)\n`);
  if (todo.length === 0) { console.log('✅ Alle vorhanden!'); return; }

  const profile = path.join(__dirname, 'playwright_profile');
  const context = await chromium.launchPersistentContext(profile, {
    headless: false, channel: 'chrome', viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  await context.addInitScript(INIT_SCRIPT);

  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  console.log('👉 In Chrome: 1) einloggen  2) Modell mit ' + (MODE === 'video' ? 'VIDEO (Veo)' : 'Bild') + '-Generierung wählen\n');
  console.log('Startet in 60 Sekunden...\n');
  for (let i = 60; i > 0; i--) { process.stderr.write(`\r   ⏳ ${i}s...`); await sleep(1000); }
  process.stderr.write('\n\n▶️  Los gehts!\n\n');

  let ok = 0, fail = 0, inChat = 0;
  for (const it of todo) {
    const num = ok + fail + 1;
    if (inChat > 0 && inChat % MAX_PER_CHAT === 0) {
      await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(3000);
    }
    process.stdout.write(`  [${num}/${todo.length}] ${it.slug} ... `);
    try {
      const startIdx = await getStartIdx(page);
      try { await sendPrompt(page, PROMPT(it.prompt)); }
      catch { await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 20000 }); await sleep(3000); await sendPrompt(page, PROMPT(it.prompt)); }
      const buf = await waitForCapture(page, startIdx, MIME, TIMEOUT_MS);
      if (buf.length < MIN_BYTES) throw new Error('zu klein');
      fs.writeFileSync(path.join(OUTPUT_DIR, `${it.slug}.${EXT}`), buf);
      console.log(`✅ (${(buf.length / 1024).toFixed(0)} KB)`);
      ok++; inChat++;
    } catch (e) { console.log(`❌ ${e.message}`); fail++; inChat++; }
    await sleep(2500);
  }

  console.log(`\n✅ ${ok} generiert  ❌ ${fail} Fehler`);
  console.log(`📁 ${OUTPUT_DIR}`);
  console.log(`➡️  Sichten, dann: bash scripts/upload_mobility.sh\n`);
  await context.close();
}

main().catch(e => { console.error('Fehler:', e.message); process.exit(1); });
