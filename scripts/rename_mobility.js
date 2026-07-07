/**
 * rename_mobility.js — Heruntergeladene Scrub-Videos den richtigen Slugs zuordnen.
 *
 * Du legst die 6 heruntergeladenen Videos (Standardnamen egal) in
 *   scripts/mobility_media_incoming/
 * — in DER REIHENFOLGE generiert/heruntergeladen, die in ORDER steht.
 * Das Skript sortiert nach Download-Zeit (älteste zuerst) und benennt um nach
 *   scripts/mobility_media/test-*.mp4
 *
 * node scripts/rename_mobility.js              → ordnet per Zeit zu
 * node scripts/rename_mobility.js 3 1 2 ...    → manuelle Zuordnung (Datei-Index → ORDER-Position)
 */
const fs = require('fs');
const path = require('path');

const INCOMING = path.join(__dirname, 'mobility_media_incoming');
const OUT = path.join(__dirname, 'mobility_media');

// Reihenfolge = Reihenfolge, in der du generierst (siehe Walkthrough):
const ORDER = [
  'test-single-leg-squat',
  'test-hip-extension',
  'test-hip-internal-rotation',
  'test-shoulder-external-rotation',
  'test-overhead',
  'test-wrist-extension',
];

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(INCOMING)) { console.error('Kein Ordner', INCOMING); process.exit(1); }

let files = fs.readdirSync(INCOMING).filter(f => /\.(mp4|mov|webm|m4v)$/i.test(f));
files = files
  .map(f => ({ f, t: fs.statSync(path.join(INCOMING, f)).mtimeMs }))
  .sort((a, b) => a.t - b.t)
  .map(x => x.f);

console.log(`📥 ${files.length} Video(s) in mobility_media_incoming/ (nach Zeit sortiert):`);
files.forEach((f, i) => console.log(`   [${i + 1}] ${f}`));

if (files.length === 0) { console.log('Nichts zu tun.'); process.exit(0); }
if (files.length !== ORDER.length) {
  console.log(`\n⚠️  Erwartet ${ORDER.length} Dateien, gefunden ${files.length}. Es werden nur ${Math.min(files.length, ORDER.length)} zugeordnet.`);
}

console.log('\n🔁 Zuordnung:');
const n = Math.min(files.length, ORDER.length);
for (let i = 0; i < n; i++) {
  const dest = path.join(OUT, ORDER[i] + '.mp4');
  fs.copyFileSync(path.join(INCOMING, files[i]), dest);
  console.log(`   ${files[i]}  →  ${ORDER[i]}.mp4`);
}
console.log('\n✅ Fertig. Prüfen ist schwer ohne Ansehen — falls eins vertauscht ist, sag mir welche.');
console.log('➡️  Hochladen:  bash scripts/upload_mobility.sh');
