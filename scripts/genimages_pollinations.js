/**
 * genimages_pollinations.js — Zutaten-Bilder via Pollinations.ai
 *
 * Läuft vollautomatisch, kein Browser nötig.
 * Speichert PNGs nach scripts/ingredient_images_pollinations/
 * Generiert außerdem insert_ingredients.sql für den Pi.
 *
 * node genimages_pollinations.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Konfiguration ─────────────────────────────────────────────────────────────
const TEST_RUN    = false;  // true = nur erste 5 Bilder zum Testen; false = alle
const OUTPUT_DIR  = path.join(__dirname, 'ingredient_images_pollinations');
const SQL_FILE    = path.join(__dirname, 'insert_ingredients.sql');
const DELAY_MS    = 120000; // 2 Min. Pause → nie zwei Requests gleichzeitig
const RETRY_DELAY = 60000;  // 1 Min. warten nach Fehler
const MAX_RETRIES = 2;
const TIMEOUT_MS  = 90000;  // 90s pro Bild

// ── Bereits vorhandene Slugs auf dem Pi (werden übersprungen) ─────────────────
const EXISTING_SLUGS = new Set([
  'ananas','aubergine','avocado','bananen','basilikum','blaubeeren','blumenkohl',
  'brokkoli','brot','butter','champignons','chili','creme-fraiche','curry',
  'dosentomaten','eier','erbsen','erdbeeren','erdnussbutter','feta',
  'frischkaese','garnelen','gouda','gruene-bohnen','gurke','haferflocken',
  'haehnchenbrustfilet','haehnchenschenkel','hackfleisch','himbeeren','honig',
  'ingwer','karotten','kartoffeln','kichererbsen','knoblauch','kokosmilch',
  'lachs','lauch','linsen','mais','mandeln','mangos','mehl','milch',
  'mozzarella','olivenoel','orangen','paprikapulver','paprika-gelb',
  'paprika-gruen','paprika-rot','parmesan','penne','pfeffer','petersilie',
  'quark','quinoa','reis','rinderfilet','rosmarin','rotkohl','sahne',
  'salat','salz','schinken','schmand','schokolade','schweinefilet',
  'sellerie','senf','sojasosse','spaghetti','speck','spinat',
  'suesskartoffeln','thunfisch','toastbrot','tomatenmark','trauben',
  'walnuesse','weisskohl','zimt','zitronen','zucker',
]);

// ── Neue Zutaten ───────────────────────────────────────────────────────────────
const NEW_INGREDIENTS = [

  // ── Fleisch ──────────────────────────────────────────────────────────────────
  { name: 'Rindfleisch',          slug: 'rindfleisch',         category: 'Fleisch',       subject: 'raw beef steak, red meat on white background' },
  { name: 'Schweinefleisch',      slug: 'schweinefleisch',     category: 'Fleisch',       subject: 'raw pork chop, pink meat on white background' },
  { name: 'Putenbrustfilet',      slug: 'putenbrustfilet',     category: 'Fleisch',       subject: 'raw turkey breast fillet, pale pink meat' },
  { name: 'Lammfleisch',          slug: 'lammfleisch',         category: 'Fleisch',       subject: 'raw lamb chops with bone, pink meat' },
  { name: 'Entenbrust',           slug: 'entenbrust',          category: 'Fleisch',       subject: 'raw duck breast with skin, dark pink meat' },
  { name: 'Kalbfleisch',          slug: 'kalbfleisch',         category: 'Fleisch',       subject: 'raw veal cutlet schnitzel, pale pink delicate meat' },
  { name: 'Wildfleisch',          slug: 'wildfleisch',         category: 'Fleisch',       subject: 'raw venison deer meat steaks, dark red game meat' },
  { name: 'Kaninchen',            slug: 'kaninchen',           category: 'Fleisch',       subject: 'raw rabbit pieces, pale pink lean meat' },
  { name: 'Bratwurst',            slug: 'bratwurst',           category: 'Fleisch',       subject: 'two raw German bratwurst sausages, pale pink' },
  { name: 'Würstchen',            slug: 'wuestchen',           category: 'Fleisch',       subject: 'two cooked frankfurter wiener sausages, golden skin' },
  { name: 'Salami',               slug: 'salami',              category: 'Fleisch',       subject: 'sliced salami sausage, dark red, fanned slices' },
  { name: 'Chorizo',              slug: 'chorizo',             category: 'Fleisch',       subject: 'sliced Spanish chorizo sausage, red and spicy' },
  { name: 'Schweinebauch',        slug: 'schweinebauch',       category: 'Fleisch',       subject: 'raw pork belly slices, layers of fat and meat' },
  { name: 'Rindersteak',          slug: 'rindersteak',         category: 'Fleisch',       subject: 'raw ribeye beef steak, marbled red meat' },
  { name: 'Schweinekotelett',     slug: 'schweinekotelett',    category: 'Fleisch',       subject: 'raw pork chop with bone, pink meat' },
  { name: 'Mortadella',           slug: 'mortadella',          category: 'Fleisch',       subject: 'sliced mortadella bologna with white fat pieces' },
  { name: 'Leberwurst',           slug: 'leberwurst',          category: 'Fleisch',       subject: 'liver sausage spread in a small bowl, brown smooth paste' },
  { name: 'Hühnerleber',          slug: 'huehnerleber',        category: 'Fleisch',       subject: 'raw chicken livers, dark red-brown, fresh' },
  { name: 'Rindergulasch',        slug: 'rindergulasch',       category: 'Fleisch',       subject: 'raw beef goulash cubes, dark red meat pieces' },

  // ── Fisch & Meeresfrüchte ────────────────────────────────────────────────────
  { name: 'Kabeljau',             slug: 'kabeljau',            category: 'Fisch',         subject: 'raw cod fillet, white flaky fish on white background' },
  { name: 'Forelle',              slug: 'forelle',             category: 'Fisch',         subject: 'whole fresh trout, silver skin with pink spots' },
  { name: 'Hering',               slug: 'hering',              category: 'Fisch',         subject: 'whole fresh herring, silver iridescent skin' },
  { name: 'Makrele',              slug: 'makrele',             category: 'Fisch',         subject: 'whole fresh mackerel, striped blue-green skin' },
  { name: 'Räucherlachs',         slug: 'raeucherlachs',       category: 'Fisch',         subject: 'smoked salmon slices, orange-pink, fanned out' },
  { name: 'Sardinen',             slug: 'sardinen',            category: 'Fisch',         subject: 'opened sardine tin with fish in olive oil' },
  { name: 'Miesmuscheln',         slug: 'miesmuscheln',        category: 'Fisch',         subject: 'fresh blue mussels in shells, pile' },
  { name: 'Calamari',             slug: 'calamari',            category: 'Fisch',         subject: 'fresh squid calamari, white rings and tentacles' },
  { name: 'Scholle',              slug: 'scholle',             category: 'Fisch',         subject: 'whole fresh plaice flatfish, white underbelly' },
  { name: 'Rotbarsch',            slug: 'rotbarsch',           category: 'Fisch',         subject: 'raw redfish fillet, pinkish-white firm fish' },
  { name: 'Seelachs',             slug: 'seelachs',            category: 'Fisch',         subject: 'raw pollock saithe fillet, white fish on white' },
  { name: 'Dorade',               slug: 'dorade',              category: 'Fisch',         subject: 'whole fresh sea bream dorade, silver skin, whole fish' },
  { name: 'Wolfsbarsch',          slug: 'wolfsbarsch',         category: 'Fisch',         subject: 'whole fresh sea bass, silver-grey elongated fish' },
  { name: 'Jakobsmuscheln',       slug: 'jakobsmuscheln',      category: 'Fisch',         subject: 'fresh scallops, round white flesh, orange roe, on shell' },

  // ── Gemüse ───────────────────────────────────────────────────────────────────
  { name: 'Fenchel',              slug: 'fenchel',             category: 'Gemüse',        subject: 'whole fresh fennel bulb with green fronds' },
  { name: 'Rote Bete',            slug: 'rote-bete',           category: 'Gemüse',        subject: 'whole fresh beetroot, dark red-purple, one halved' },
  { name: 'Spargel weiß',         slug: 'spargel-weiss',       category: 'Gemüse',        subject: 'bundle of white asparagus spears tied together' },
  { name: 'Spargel grün',         slug: 'spargel-gruen',       category: 'Gemüse',        subject: 'bunch of fresh green asparagus spears' },
  { name: 'Kohlrabi',             slug: 'kohlrabi',            category: 'Gemüse',        subject: 'whole fresh kohlrabi bulb, light green with leaves' },
  { name: 'Rosenkohl',            slug: 'rosenkohl',           category: 'Gemüse',        subject: 'fresh Brussels sprouts, small green heads, pile' },
  { name: 'Mangold',              slug: 'mangold',             category: 'Gemüse',        subject: 'fresh Swiss chard with colorful stems and green leaves' },
  { name: 'Pak Choi',             slug: 'pak-choi',            category: 'Gemüse',        subject: 'fresh bok choy, white stems and dark green leaves' },
  { name: 'Rucola',               slug: 'rucola',              category: 'Gemüse',        subject: 'fresh rocket arugula salad leaves, dark green' },
  { name: 'Feldsalat',            slug: 'feldsalat',           category: 'Gemüse',        subject: 'fresh lamb lettuce mache, small dark green rosettes' },
  { name: 'Eisbergsalat',         slug: 'eisbergsalat',        category: 'Gemüse',        subject: 'whole iceberg lettuce head, pale crisp green' },
  { name: 'Radicchio',            slug: 'radicchio',           category: 'Gemüse',        subject: 'whole radicchio head, dark red-purple leaves, white veins' },
  { name: 'Endivie',              slug: 'endivie',             category: 'Gemüse',        subject: 'whole Belgian endive chicory, pale yellow-white, elongated' },
  { name: 'Frühlingszwiebeln',    slug: 'fruehlungszwiebeln',  category: 'Gemüse',        subject: 'bunch of fresh spring onions scallions, green and white' },
  { name: 'Schalotten',           slug: 'schalotten',          category: 'Gemüse',        subject: 'small shallot onions, brown skin, two whole one halved' },
  { name: 'Rhabarber',            slug: 'rhabarber',           category: 'Gemüse',        subject: 'fresh rhubarb stalks, red and green cut pieces' },
  { name: 'Radieschen',           slug: 'radieschen',          category: 'Gemüse',        subject: 'bunch of fresh red radishes with green leaves' },
  { name: 'Pastinaken',           slug: 'pastinaken',          category: 'Gemüse',        subject: 'whole fresh parsnips, cream-white long root vegetable' },
  { name: 'Zuckererbsen',         slug: 'zuckererbsen',        category: 'Gemüse',        subject: 'fresh snap peas, bright green plump pods' },
  { name: 'Shiitake-Pilze',       slug: 'shiitake',            category: 'Gemüse',        subject: 'fresh shiitake mushrooms, brown caps, pile' },
  { name: 'Pfifferlinge',         slug: 'pfifferlinge',        category: 'Gemüse',        subject: 'fresh golden chanterelle mushrooms, funnel shaped' },
  { name: 'Steinpilze',           slug: 'steinpilze',          category: 'Gemüse',        subject: 'fresh porcini cep mushrooms, brown caps, thick stems' },
  { name: 'Austernpilze',         slug: 'austernpilze',        category: 'Gemüse',        subject: 'fresh oyster mushrooms, pale grey fan-shaped clusters' },
  { name: 'Artischocken',         slug: 'artischocken',        category: 'Gemüse',        subject: 'whole fresh artichoke, green-purple round head' },
  { name: 'Jalapeños',            slug: 'jalapenos',           category: 'Gemüse',        subject: 'fresh green jalapeño peppers, shiny, pile' },
  { name: 'Getrocknete Tomaten',  slug: 'getrocknete-tomaten', category: 'Gemüse',        subject: 'sun-dried tomato halves in oil in a glass jar, dark red' },
  { name: 'Oliven',               slug: 'oliven',              category: 'Gemüse',        subject: 'mixed black and green olives in a small bowl' },
  { name: 'Kapern',               slug: 'kapern',              category: 'Gemüse',        subject: 'small capers in a glass jar with brine' },
  { name: 'Bambussprossen',       slug: 'bambussprossen',      category: 'Gemüse',        subject: 'bamboo shoots in an open tin, pale yellow segments' },
  { name: 'Blattspinat',          slug: 'blattspinat',         category: 'Gemüse',        subject: 'fresh young baby spinach leaves, bright dark green' },
  { name: 'Topinambur',           slug: 'topinambur',          category: 'Gemüse',        subject: 'Jerusalem artichoke tubers, knobbly beige-brown' },
  { name: 'Kresse',               slug: 'kresse',              category: 'Gemüse',        subject: 'fresh garden cress microgreens in a punnet, tiny green sprouts' },
  { name: 'Bärlauch',             slug: 'baerlauch',           category: 'Gemüse',        subject: 'fresh wild garlic bear garlic leaves, bright green broad' },
  { name: 'Sauerkraut',           slug: 'sauerkraut',          category: 'Gemüse',        subject: 'fermented sauerkraut in a bowl, pale shredded cabbage' },
  { name: 'Cornichons',           slug: 'cornichons',          category: 'Gemüse',        subject: 'small gherkin pickles cornichons in a jar, green' },
  { name: 'Saure Gurken',         slug: 'saure-gurken',        category: 'Gemüse',        subject: 'pickled cucumbers in a jar, green, vinegar brine' },
  { name: 'Kochbananen',          slug: 'kochbananen',         category: 'Gemüse',        subject: 'whole plantain cooking bananas, green-yellow, large' },

  // ── Obst ─────────────────────────────────────────────────────────────────────
  { name: 'Birnen',               slug: 'birnen',              category: 'Obst',          subject: 'two whole fresh green pears, Conference variety' },
  { name: 'Kirschen',             slug: 'kirschen',            category: 'Obst',          subject: 'fresh ripe red cherries with stems, pile' },
  { name: 'Pflaumen',             slug: 'pflaumen',            category: 'Obst',          subject: 'whole fresh plums, dark blue-purple skin' },
  { name: 'Kiwi',                 slug: 'kiwi',                category: 'Obst',          subject: 'whole kiwi and one halved showing bright green flesh' },
  { name: 'Grapefruit',           slug: 'grapefruit',          category: 'Obst',          subject: 'whole grapefruit and one halved, yellow skin, pink flesh' },
  { name: 'Wassermelone',         slug: 'wassermelone',        category: 'Obst',          subject: 'whole watermelon and one wedge showing red flesh, green rind' },
  { name: 'Honigmelone',          slug: 'honigmelone',         category: 'Obst',          subject: 'whole honeydew melon and wedge, pale green flesh' },
  { name: 'Papaya',               slug: 'papaya',              category: 'Obst',          subject: 'whole papaya and one halved showing orange flesh, black seeds' },
  { name: 'Granatapfel',          slug: 'granatapfel',         category: 'Obst',          subject: 'whole pomegranate and one halved showing ruby red seeds' },
  { name: 'Feigen',               slug: 'feigen',              category: 'Obst',          subject: 'fresh figs, one whole one halved showing purple-pink flesh' },
  { name: 'Datteln',              slug: 'datteln',             category: 'Obst',          subject: 'fresh Medjool dates, dark brown sticky, pile' },
  { name: 'Aprikosen',            slug: 'aprikosen',           category: 'Obst',          subject: 'fresh apricots, orange skin, one halved showing stone' },
  { name: 'Pfirsiche',            slug: 'pfirsiche',           category: 'Obst',          subject: 'fresh ripe peaches, yellow-red skin, one halved' },
  { name: 'Limette',              slug: 'limette',             category: 'Obst',          subject: 'whole lime and one halved, bright green citrus' },
  { name: 'Cranberries',          slug: 'cranberries',         category: 'Obst',          subject: 'fresh red cranberries, round, scattered pile' },
  { name: 'Johannisbeeren',       slug: 'johannisbeeren',      category: 'Obst',          subject: 'fresh red currants on stems, translucent red berries' },
  { name: 'Maracuja',             slug: 'maracuja',            category: 'Obst',          subject: 'whole passion fruit and one halved showing yellow seeds' },
  { name: 'Physalis',             slug: 'physalis',            category: 'Obst',          subject: 'fresh physalis cape gooseberries with papery husks, orange' },
  { name: 'Stachelbeeren',        slug: 'stachelbeeren',       category: 'Obst',          subject: 'fresh gooseberries, translucent green oval berries' },
  { name: 'Brombeeren',           slug: 'brombeeren',          category: 'Obst',          subject: 'fresh blackberries, dark shiny drupes, pile' },
  { name: 'Kokosnuss',            slug: 'kokosnuss',           category: 'Obst',          subject: 'whole coconut and one halved showing white flesh and water' },
  { name: 'Kumquats',             slug: 'kumquats',            category: 'Obst',          subject: 'small kumquat orange fruits, oval, bright orange, pile' },

  // ── Milchprodukte ────────────────────────────────────────────────────────────
  { name: 'Mascarpone',           slug: 'mascarpone',          category: 'Milchprodukte', subject: 'mascarpone cheese in a small bowl, thick creamy white' },
  { name: 'Ricotta',              slug: 'ricotta',             category: 'Milchprodukte', subject: 'fresh ricotta cheese in a small bowl, white grainy' },
  { name: 'Camembert',            slug: 'camembert',           category: 'Milchprodukte', subject: 'whole Camembert round with white rind, one wedge cut' },
  { name: 'Brie',                 slug: 'brie',                category: 'Milchprodukte', subject: 'wedge of Brie cheese with white mold rind, creamy inside' },
  { name: 'Emmentaler',           slug: 'emmentaler',          category: 'Milchprodukte', subject: 'wedge of Emmental cheese with holes, yellow' },
  { name: 'Bergkäse',             slug: 'bergkaese',           category: 'Milchprodukte', subject: 'wedge of alpine mountain cheese, golden yellow hard cheese' },
  { name: 'Halloumi',             slug: 'halloumi',            category: 'Milchprodukte', subject: 'block of white halloumi cheese, firm, sliceable' },
  { name: 'Ziegenkäse',           slug: 'ziegenkaese',         category: 'Milchprodukte', subject: 'fresh white goat cheese log, creamy soft rind' },
  { name: 'Gruyère',              slug: 'gruyere',             category: 'Milchprodukte', subject: 'wedge of Gruyère cheese, pale yellow, small holes' },
  { name: 'Buttermilch',          slug: 'buttermilch',         category: 'Milchprodukte', subject: 'glass of fresh buttermilk, white slightly thick' },
  { name: 'Kefir',                slug: 'kefir',               category: 'Milchprodukte', subject: 'glass of kefir fermented milk, white frothy top' },
  { name: 'Schlagsahne',          slug: 'schlagsahne',         category: 'Milchprodukte', subject: 'whipped cream in a bowl, white fluffy soft peaks' },
  { name: 'Saure Sahne',          slug: 'saure-sahne',         category: 'Milchprodukte', subject: 'sour cream in a small bowl, thick white dollop' },
  { name: 'Hüttenkäse',           slug: 'huettenkaese',        category: 'Milchprodukte', subject: 'cottage cheese in a bowl, white lumpy texture' },
  { name: 'Kondensmilch',         slug: 'kondensmilch',        category: 'Milchprodukte', subject: 'condensed milk pouring from a tin, thick white sweet' },

  // ── Getreide, Nudeln & Beilagen ───────────────────────────────────────────────
  { name: 'Fusilli',              slug: 'fusilli',             category: 'Getreide',      subject: 'dry fusilli spiral pasta, uncooked, scattered' },
  { name: 'Tagliatelle',          slug: 'tagliatelle',         category: 'Getreide',      subject: 'dry tagliatelle pasta nests, uncooked flat ribbon' },
  { name: 'Rigatoni',             slug: 'rigatoni',            category: 'Getreide',      subject: 'dry rigatoni tube pasta, uncooked ridged' },
  { name: 'Lasagneblätter',       slug: 'lasagneblaetter',     category: 'Getreide',      subject: 'dry lasagne sheets, uncooked flat rectangular pasta' },
  { name: 'Gnocchi',              slug: 'gnocchi',             category: 'Getreide',      subject: 'fresh potato gnocchi dumplings, small pillows, pale yellow' },
  { name: 'Spätzle',              slug: 'spaetzle',            category: 'Getreide',      subject: 'cooked German Spätzle egg noodles, small irregular yellow' },
  { name: 'Couscous',             slug: 'couscous',            category: 'Getreide',      subject: 'raw dry couscous grains in a small bowl, fine golden' },
  { name: 'Bulgur',               slug: 'bulgur',              category: 'Getreide',      subject: 'raw dry bulgur wheat grains in a small bowl' },
  { name: 'Polenta',              slug: 'polenta',             category: 'Getreide',      subject: 'dry polenta cornmeal in a bowl, coarse yellow' },
  { name: 'Hirse',                slug: 'hirse',               category: 'Getreide',      subject: 'raw dry millet grains in a bowl, tiny yellow seeds' },
  { name: 'Dinkelmehl',           slug: 'dinkelmehl',          category: 'Getreide',      subject: 'spelt flour in a small bowl, off-white powder' },
  { name: 'Vollkornmehl',         slug: 'vollkornmehl',        category: 'Getreide',      subject: 'whole wheat flour in a bowl, brown speckled powder' },
  { name: 'Speisestärke',         slug: 'speisestaerke',       category: 'Getreide',      subject: 'corn starch in a small bowl, pure white very fine powder' },
  { name: 'Paniermehl',           slug: 'paniermehl',          category: 'Getreide',      subject: 'breadcrumbs in a small bowl, golden fine crumbs' },
  { name: 'Glasnudeln',           slug: 'glasnudeln',          category: 'Getreide',      subject: 'dry glass noodles cellophane noodles, transparent bundle' },
  { name: 'Reisnudeln',           slug: 'reisnudeln',          category: 'Getreide',      subject: 'dry rice noodles, white thin flat ribbon bundle' },
  { name: 'Basmati-Reis',         slug: 'basmati-reis',        category: 'Getreide',      subject: 'raw basmati rice in a bowl, long slender white grains' },
  { name: 'Wildreis',             slug: 'wildreis',            category: 'Getreide',      subject: 'wild rice mix in a bowl, dark black and brown long grains' },
  { name: 'Amaranth',             slug: 'amaranth',            category: 'Getreide',      subject: 'tiny amaranth seeds in a small bowl, golden-beige' },
  { name: 'Tortellini',           slug: 'tortellini',          category: 'Getreide',      subject: 'fresh tortellini pasta rings, filled, pale golden' },

  // ── Hülsenfrüchte & pflanzliches Protein ─────────────────────────────────────
  { name: 'Kidneybohnen',         slug: 'kidneybohnen',        category: 'Hülsenfrüchte', subject: 'dried red kidney beans in a bowl, dark red' },
  { name: 'Schwarze Bohnen',      slug: 'schwarze-bohnen',     category: 'Hülsenfrüchte', subject: 'dried black beans in a bowl, shiny black' },
  { name: 'Weißbohnen',           slug: 'weissbohnen',         category: 'Hülsenfrüchte', subject: 'dried white cannellini beans in a bowl' },
  { name: 'Rote Linsen',          slug: 'rote-linsen',         category: 'Hülsenfrüchte', subject: 'dry red lentils in a bowl, bright orange-red' },
  { name: 'Edamame',              slug: 'edamame',             category: 'Hülsenfrüchte', subject: 'fresh edamame soybeans in pods, bright green steamed' },
  { name: 'Tofu',                 slug: 'tofu',                category: 'Hülsenfrüchte', subject: 'block of white firm tofu, cube cut pieces' },
  { name: 'Tempeh',               slug: 'tempeh',              category: 'Hülsenfrüchte', subject: 'block of tempeh, firm compressed fermented soy, beige' },
  { name: 'Sojasprossen',         slug: 'sojasprossen',        category: 'Hülsenfrüchte', subject: 'fresh soybean sprouts, white shoots with yellow tips' },
  { name: 'Mungobohnen',          slug: 'mungobohnen',         category: 'Hülsenfrüchte', subject: 'dry mung beans in a bowl, small round green beans' },

  // ── Brot & Backwaren ─────────────────────────────────────────────────────────
  { name: 'Vollkornbrot',         slug: 'vollkornbrot',        category: 'Backwaren',     subject: 'sliced whole grain bread loaf, dark brown hearty' },
  { name: 'Ciabatta',             slug: 'ciabatta',            category: 'Backwaren',     subject: 'Italian ciabatta bread, rustic crusty airy loaf' },
  { name: 'Baguette',             slug: 'baguette',            category: 'Backwaren',     subject: 'French baguette, long thin crusty golden' },
  { name: 'Brötchen',             slug: 'broetchen',           category: 'Backwaren',     subject: 'two German bread rolls, crusty golden brown round' },
  { name: 'Laugengebäck',         slug: 'laugengebaeck',       category: 'Backwaren',     subject: 'German pretzel Brezel, dark brown glossy, salt crystals' },
  { name: 'Pita-Brot',            slug: 'pita-brot',           category: 'Backwaren',     subject: 'round pita flatbread, pale golden fluffy pocket' },
  { name: 'Wrap',                 slug: 'wrap',                category: 'Backwaren',     subject: 'stack of flour tortilla wraps, white round flat' },
  { name: 'Knäckebrot',           slug: 'knaeckebrot',         category: 'Backwaren',     subject: 'crispy rye crispbread slices, thin brown crackers' },
  { name: 'Croissant',            slug: 'croissant',           category: 'Backwaren',     subject: 'fresh butter croissant, golden flaky layered pastry' },
  { name: 'Pumpernickel',         slug: 'pumpernickel',        category: 'Backwaren',     subject: 'slices of dark pumpernickel rye bread, very dark brown' },
  { name: 'Naan',                 slug: 'naan',                category: 'Backwaren',     subject: 'fresh naan flatbread, puffy charred spots, oval' },
  { name: 'Blätterteig',          slug: 'blaetterteig',        category: 'Backwaren',     subject: 'raw puff pastry sheet, layered white dough, rolled out' },

  // ── Gewürze & Kräuter ────────────────────────────────────────────────────────
  { name: 'Kreuzkümmel',          slug: 'kreuzku emmel',       category: 'Gewürze',       subject: 'cumin seeds in a small bowl, brown aromatic' },
  { name: 'Koriandersamen',       slug: 'koriandersamen',      category: 'Gewürze',       subject: 'coriander seeds in a small bowl, round beige seeds' },
  { name: 'Thymian',              slug: 'thymian',             category: 'Gewürze',       subject: 'fresh thyme sprigs bunch, tiny green leaves' },
  { name: 'Majoran',              slug: 'majoran',             category: 'Gewürze',       subject: 'dried marjoram herb in a bowl, green flakes' },
  { name: 'Salbei',               slug: 'salbei',              category: 'Gewürze',       subject: 'fresh sage leaves, silvery-green velvety oval leaves' },
  { name: 'Lorbeer',              slug: 'lorbeer',             category: 'Gewürze',       subject: 'dried bay laurel leaves, dark green oval, several' },
  { name: 'Muskatnuss',           slug: 'muskatnuss',          category: 'Gewürze',       subject: 'whole nutmeg and grated powder in a small bowl' },
  { name: 'Kurkuma',              slug: 'kurkuma',             category: 'Gewürze',       subject: 'turmeric powder in a bowl, vivid yellow-orange' },
  { name: 'Dill',                 slug: 'dill',                category: 'Gewürze',       subject: 'fresh dill herb bunch, feathery green fronds' },
  { name: 'Schnittlauch',         slug: 'schnittlauch',        category: 'Gewürze',       subject: 'fresh chives bundle, thin bright green stalks' },
  { name: 'Minze',                slug: 'minze',               category: 'Gewürze',       subject: 'fresh mint sprig, bright green round leaves' },
  { name: 'Koriander frisch',     slug: 'koriander-frisch',    category: 'Gewürze',       subject: 'fresh cilantro coriander herb bunch, bright green' },
  { name: 'Chiliflocken',         slug: 'chiliflocken',        category: 'Gewürze',       subject: 'red chili flakes in a small bowl, dried red flakes' },
  { name: 'Sesam',                slug: 'sesam',               category: 'Gewürze',       subject: 'white sesame seeds in a small bowl, tiny round' },
  { name: 'Mohn',                 slug: 'mohn',                category: 'Gewürze',       subject: 'poppy seeds in a small bowl, tiny blue-black seeds' },
  { name: 'Vanille',              slug: 'vanille',             category: 'Gewürze',       subject: 'vanilla pods, dark brown, one split open showing seeds' },
  { name: 'Kardamom',             slug: 'kardamom',            category: 'Gewürze',       subject: 'green cardamom pods and seeds in a small bowl' },
  { name: 'Sternanis',            slug: 'sternanis',           category: 'Gewürze',       subject: 'star anise dried spice, brown star-shaped pieces' },
  { name: 'Kümmel',               slug: 'kuemmel',             category: 'Gewürze',       subject: 'caraway seeds in a small bowl, brown curved seeds' },
  { name: 'Estragon',             slug: 'estragon',            category: 'Gewürze',       subject: 'fresh tarragon herb sprigs, slender bright green leaves' },
  { name: 'Zitronengras',         slug: 'zitronengras',        category: 'Gewürze',       subject: 'fresh lemongrass stalks, pale green-white thick stalks' },
  { name: 'Schwarzkümmel',        slug: 'schwarzkuemmel',      category: 'Gewürze',       subject: 'black nigella seeds in a bowl, tiny angular black seeds' },
  { name: 'Sumach',               slug: 'sumach',              category: 'Gewürze',       subject: 'sumac spice powder in a bowl, deep red-purple' },
  { name: 'Garam Masala',         slug: 'garam-masala',        category: 'Gewürze',       subject: 'garam masala spice blend in a bowl, dark brown aromatic' },
  { name: 'Wacholderbeeren',      slug: 'wacholderbeeren',     category: 'Gewürze',       subject: 'dried juniper berries in a small bowl, dark blue-black round' },
  { name: 'Piment',               slug: 'piment',              category: 'Gewürze',       subject: 'allspice berries in a small bowl, round dark brown' },
  { name: 'Liebstöckel',          slug: 'liebstoeckel',        category: 'Gewürze',       subject: 'fresh lovage herb leaves, dark green serrated leaf' },

  // ── Öle & Fette ──────────────────────────────────────────────────────────────
  { name: 'Kokosöl',              slug: 'kokosoel',            category: 'Öle & Fette',   subject: 'coconut oil in a small glass jar, white solid at room temp' },
  { name: 'Rapsöl',               slug: 'rapsoel',             category: 'Öle & Fette',   subject: 'rapeseed canola oil in a small glass bottle, golden yellow' },
  { name: 'Sonnenblumenöl',       slug: 'sonnenblumenoel',     category: 'Öle & Fette',   subject: 'sunflower oil in a small glass bottle, light golden' },
  { name: 'Sesamöl',              slug: 'sesamoel',            category: 'Öle & Fette',   subject: 'dark toasted sesame oil in a bottle, amber brown' },
  { name: 'Ghee',                 slug: 'ghee',                category: 'Öle & Fette',   subject: 'golden clarified butter ghee in a small glass jar' },
  { name: 'Avocadoöl',            slug: 'avocadooel',          category: 'Öle & Fette',   subject: 'avocado oil in a small bottle, light green-golden' },
  { name: 'Kürbiskernöl',         slug: 'kuerbiskernoel',      category: 'Öle & Fette',   subject: 'pumpkin seed oil in a small bottle, dark green-brown' },

  // ── Nüsse & Samen ────────────────────────────────────────────────────────────
  { name: 'Cashewkerne',          slug: 'cashewkerne',         category: 'Nüsse',         subject: 'whole raw cashew nuts, kidney shaped pale cream' },
  { name: 'Haselnüsse',           slug: 'haselnuesse',         category: 'Nüsse',         subject: 'whole hazelnuts, round brown shell, few cracked open' },
  { name: 'Pinienkerne',          slug: 'pinienkerne',         category: 'Nüsse',         subject: 'pine nuts in a small bowl, small pale cream seeds' },
  { name: 'Sonnenblumenkerne',    slug: 'sonnenblumenkerne',   category: 'Nüsse',         subject: 'sunflower seeds in a bowl, striped black and white' },
  { name: 'Kürbiskerne',          slug: 'kuerbiskerne',        category: 'Nüsse',         subject: 'pumpkin seeds in a bowl, flat oval green seeds' },
  { name: 'Leinsamen',            slug: 'leinsamen',           category: 'Nüsse',         subject: 'flaxseeds in a small bowl, brown flat oval seeds' },
  { name: 'Chiasamen',            slug: 'chiasamen',           category: 'Nüsse',         subject: 'chia seeds in a small bowl, tiny dark speckled seeds' },
  { name: 'Pistazien',            slug: 'pistazien',           category: 'Nüsse',         subject: 'pistachios in shells, half open, green nuts pile' },
  { name: 'Kokosflocken',         slug: 'kokosflocken',        category: 'Nüsse',         subject: 'desiccated coconut flakes in a bowl, white fluffy' },
  { name: 'Erdnüsse',             slug: 'erdnuesse',           category: 'Nüsse',         subject: 'whole peanuts in shells, some shelled, beige pile' },
  { name: 'Pekannüsse',           slug: 'pekannuesse',         category: 'Nüsse',         subject: 'whole pecan nuts, brown wrinkled halves, pile' },
  { name: 'Macadamia',            slug: 'macadamia',           category: 'Nüsse',         subject: 'whole macadamia nuts, round pale cream, some halved' },
  { name: 'Maronen',              slug: 'maronen',             category: 'Nüsse',         subject: 'whole chestnuts, dark brown shiny round, some peeled' },

  // ── Saucen & Condiments ───────────────────────────────────────────────────────
  { name: 'Ketchup',              slug: 'ketchup',             category: 'Saucen',        subject: 'tomato ketchup in a small bowl, bright red sauce' },
  { name: 'Mayonnaise',           slug: 'mayonnaise',          category: 'Saucen',        subject: 'mayonnaise in a small bowl, creamy white dollop' },
  { name: 'Balsamico',            slug: 'balsamico',           category: 'Saucen',        subject: 'dark balsamic vinegar in a small bottle, thick dark brown' },
  { name: 'Apfelessig',           slug: 'apfelessig',          category: 'Saucen',        subject: 'apple cider vinegar in a glass bottle, golden amber' },
  { name: 'Sriracha',             slug: 'sriracha',            category: 'Saucen',        subject: 'Sriracha hot sauce in a squeeze bottle, bright red' },
  { name: 'Tabasco',              slug: 'tabasco',             category: 'Saucen',        subject: 'small Tabasco hot sauce bottle, red label iconic' },
  { name: 'Pesto',                slug: 'pesto',               category: 'Saucen',        subject: 'green basil pesto in a small glass jar with spoon' },
  { name: 'Tahini',               slug: 'tahini',              category: 'Saucen',        subject: 'sesame tahini paste in a jar, light brown creamy' },
  { name: 'Hoisin-Sauce',         slug: 'hoisin',              category: 'Saucen',        subject: 'hoisin sauce in a small bowl, dark brown glossy' },
  { name: 'Fischsauce',           slug: 'fischsauce',          category: 'Saucen',        subject: 'fish sauce in a small bottle, amber brown liquid' },
  { name: 'Teriyaki-Sauce',       slug: 'teriyaki',            category: 'Saucen',        subject: 'teriyaki sauce in a small bowl, dark glossy brown' },
  { name: 'Worcestershire',       slug: 'worcestershire',      category: 'Saucen',        subject: 'Worcestershire sauce in a classic bottle, dark brown' },
  { name: 'Tomatensoße',          slug: 'tomatensauce',        category: 'Saucen',        subject: 'tomato pasta sauce in a jar, chunky red sauce' },
  { name: 'Gemüsebrühe',          slug: 'gemuesebruehe',       category: 'Saucen',        subject: 'vegetable broth bouillon cube, golden-brown block' },
  { name: 'Hühnerbrühe',          slug: 'huehnerbrue',         category: 'Saucen',        subject: 'chicken broth in a cup, clear golden soup' },
  { name: 'Miso-Paste',           slug: 'miso',                category: 'Saucen',        subject: 'white miso paste in a small bowl, pale beige fermented' },
  { name: 'Sambal Oelek',         slug: 'sambal-oelek',        category: 'Saucen',        subject: 'sambal oelek chili paste in a jar, bright red chunky' },
  { name: 'Rote Currypaste',      slug: 'rote-currypaste',     category: 'Saucen',        subject: 'red Thai curry paste in a small bowl, deep red aromatic' },
  { name: 'Ajvar',                slug: 'ajvar',               category: 'Saucen',        subject: 'ajvar roasted red pepper spread in a jar, red chunky' },
  { name: 'Hummus',               slug: 'hummus',              category: 'Saucen',        subject: 'hummus in a bowl, creamy beige with olive oil drizzle' },

  // ── Backzutaten ───────────────────────────────────────────────────────────────
  { name: 'Backpulver',           slug: 'backpulver',          category: 'Backzutaten',   subject: 'baking powder in a small bowl, white fine powder' },
  { name: 'Trockenhefe',          slug: 'trockenhefe',         category: 'Backzutaten',   subject: 'dry active yeast in a bowl, light brown fine granules' },
  { name: 'Frischhefe',           slug: 'frischhefe',          category: 'Backzutaten',   subject: 'fresh yeast cube block, beige-brown on white' },
  { name: 'Puderzucker',          slug: 'puderzucker',         category: 'Backzutaten',   subject: 'icing sugar powdered sugar in a bowl, very fine white' },
  { name: 'Brauner Zucker',       slug: 'brauner-zucker',      category: 'Backzutaten',   subject: 'brown sugar in a bowl, moist golden brown crystals' },
  { name: 'Ahornsirup',           slug: 'ahornsirup',          category: 'Backzutaten',   subject: 'maple syrup in a small bottle, amber golden pouring' },
  { name: 'Agavensirup',          slug: 'agavensirup',         category: 'Backzutaten',   subject: 'agave syrup in a bottle, light golden liquid' },
  { name: 'Kakaopulver',          slug: 'kakaopulver',         category: 'Backzutaten',   subject: 'cocoa powder in a small bowl, dark brown fine powder' },
  { name: 'Zartbitterschokolade', slug: 'zartbitter',          category: 'Backzutaten',   subject: 'dark chocolate bar broken into chunks, 70% cocoa' },
  { name: 'Natron',               slug: 'natron',              category: 'Backzutaten',   subject: 'baking soda in a small bowl, white powder' },
  { name: 'Gelatine',             slug: 'gelatine',            category: 'Backzutaten',   subject: 'gelatin sheets and powder in a small bowl, transparent' },
  { name: 'Mandelmehl',           slug: 'mandelmehl',          category: 'Backzutaten',   subject: 'almond flour in a small bowl, fine pale cream powder' },

  // ── Konserven ─────────────────────────────────────────────────────────────────
  { name: 'Mais (Dose)',          slug: 'mais-dose',           category: 'Konserven',     subject: 'opened canned sweetcorn tin with yellow kernels' },
  { name: 'Bohnen (Dose)',        slug: 'bohnen-dose',         category: 'Konserven',     subject: 'opened can of baked beans in tomato sauce' },
  { name: 'Kichererbsen (Dose)',  slug: 'kichererbsen-dose',   category: 'Konserven',     subject: 'opened can of chickpeas in water, pale beige' },
  { name: 'Thunfisch (Dose)',     slug: 'thunfisch-dose',      category: 'Konserven',     subject: 'opened tuna fish can with flaked tuna in water' },
  { name: 'Artischockenherzen',   slug: 'artischockenherzen',  category: 'Konserven',     subject: 'marinated artichoke hearts in a jar, pale green' },
  { name: 'Rote Bete (Glas)',     slug: 'rote-bete-glas',      category: 'Konserven',     subject: 'pickled beetroot slices in a glass jar, dark red' },
  { name: 'Sauerkraut (Dose)',    slug: 'sauerkraut-dose',     category: 'Konserven',     subject: 'opened can of sauerkraut, pale fermented cabbage' },
  { name: 'Linsen (Dose)',        slug: 'linsen-dose',         category: 'Konserven',     subject: 'opened can of green lentils in water' },

  // ── Kochwein & Flüssigkeiten ─────────────────────────────────────────────────
  { name: 'Weißwein',             slug: 'weisswein',           category: 'Sonstiges',     subject: 'glass of white wine, pale golden, wine glass' },
  { name: 'Rotwein',              slug: 'rotwein',             category: 'Sonstiges',     subject: 'glass of red wine, deep red, wine glass' },
  { name: 'Bier',                 slug: 'bier',                category: 'Sonstiges',     subject: 'glass of beer with foam, golden amber, tall glass' },
  { name: 'Kokoswasser',          slug: 'kokoswasser',         category: 'Sonstiges',     subject: 'glass of coconut water, clear with slight hint, fresh coconut' },
  { name: 'Orangensaft',          slug: 'orangensaft',         category: 'Sonstiges',     subject: 'glass of fresh orange juice, bright orange, pulpy' },
  { name: 'Zitronensaft',         slug: 'zitronensaft',        category: 'Sonstiges',     subject: 'small jug of fresh lemon juice, pale yellow, with lemon' },

  // ── Sonstiges ─────────────────────────────────────────────────────────────────
  { name: 'Meerrettich',          slug: 'meerrettich',         category: 'Sonstiges',     subject: 'fresh horseradish root, grated white in a small bowl' },
  { name: 'Wasabi',               slug: 'wasabi',              category: 'Sonstiges',     subject: 'wasabi paste in a small bowl, bright green spicy' },
  { name: 'Sauerrahm',            slug: 'sauerrahm',           category: 'Milchprodukte', subject: 'sour cream in a bowl, thick white with a spoon' },
  { name: 'Tamarinde',            slug: 'tamarinde',           category: 'Sonstiges',     subject: 'tamarind pod and paste in a bowl, dark brown sour' },
  { name: 'Jackfrucht',           slug: 'jackfrucht',          category: 'Obst',          subject: 'jackfruit pieces, yellow fibrous tropical fruit flesh' },
];

// ── Prompt-Vorlage ────────────────────────────────────────────────────────────
const makePrompt = (subject) =>
  `Professional food photography of ${subject} on a pure white background. ` +
  `Studio lighting, vibrant natural colors, clean and fresh, centered, no text, no labels, no packaging.`;

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const timer = setTimeout(() => { file.destroy(); reject(new Error('Timeout')); }, TIMEOUT_MS);

    const doRequest = (targetUrl, redirects = 0) => {
      if (redirects > 5) { clearTimeout(timer); reject(new Error('Zu viele Redirects')); return; }
      https.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Keepr/1.0)' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) {
          clearTimeout(timer);
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => { clearTimeout(timer); file.close(); resolve(); });
        file.on('error', (e) => { clearTimeout(timer); reject(e); });
      }).on('error', (e) => { clearTimeout(timer); reject(e); });
    };

    doRequest(url);
  });
}

// ── SQL generieren ────────────────────────────────────────────────────────────
function generateSql(ingredients) {
  const lines = ['-- Neue Zutaten für keepr DB', '-- Ausführen mit: sqlite3 speisekammer.db < insert_ingredients.sql', ''];
  for (const ing of ingredients) {
    const name = ing.name.replace(/'/g, "''");
    const slug = ing.slug.replace(/'/g, "''");
    const cat  = ing.category.replace(/'/g, "''");
    lines.push(`INSERT OR IGNORE INTO ingredients (name, slug, category) VALUES ('${name}', '${slug}', '${cat}');`);
  }
  return lines.join('\n') + '\n';
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const existingFiles = new Set(
    fs.readdirSync(OUTPUT_DIR).map(f => path.basename(f, path.extname(f)))
  );

  let todo = NEW_INGREDIENTS.filter(i =>
    !EXISTING_SLUGS.has(i.slug) && !existingFiles.has(i.slug)
  );

  if (TEST_RUN) {
    todo = todo.slice(0, 10);
  }

  const modeLabel = TEST_RUN ? '🧪 TEST-MODUS (erste 10)' : '🚀 Vollständiger Lauf';
  console.log(`\n🥦  keepr Zutaten-Bilder — Pollinations.ai`);
  console.log(`   ${modeLabel}`);
  console.log(`   ${NEW_INGREDIENTS.length} neue Zutaten definiert`);
  console.log(`   ${existingFiles.size} Bilder bereits in output-Ordner`);
  console.log(`   ${todo.length} Bilder werden jetzt generiert`);
  if (TEST_RUN) console.log(`\n   ➡️  Zum vollständigen Lauf: TEST_RUN = false setzen\n`);
  else console.log('');

  if (todo.length === 0) { console.log('✅ Alle Bilder vorhanden!'); }

  let ok = 0, fail = 0;
  for (let i = 0; i < todo.length; i++) {
    const ing = todo[i];
    const num = `[${String(i + 1).padStart(3)}/${todo.length}]`;
    process.stdout.write(`  ${num} ${ing.name.padEnd(26)} `);

    const prompt = makePrompt(ing.subject);
    const encoded = encodeURIComponent(prompt);
    const destPath = path.join(OUTPUT_DIR, `${ing.slug}.png`);

    let succeeded = false;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=256&height=256&nologo=true&enhance=false&seed=${Date.now() + i + attempt}`;
      try {
        await downloadImage(url, destPath);
        const size = fs.statSync(destPath).size;
        if (size < 2000) {
          fs.unlinkSync(destPath);
          throw new Error(`Bild zu klein (${size} Bytes)`);
        }
        console.log(`✅ (${Math.round(size / 1024)} KB)${attempt > 1 ? ` [Versuch ${attempt}]` : ''}`);
        ok++;
        succeeded = true;
        break;
      } catch (e) {
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        if (attempt < MAX_RETRIES) {
          process.stdout.write(`⏳ ${e.message} → warte ${RETRY_DELAY / 1000}s... `);
          await sleep(RETRY_DELAY);
        } else {
          console.log(`❌ ${e.message}`);
          fail++;
        }
      }
    }

    if (i < todo.length - 1) await sleep(succeeded ? DELAY_MS : 5000);
  }

  console.log(`\n  ✅ ${ok} generiert   ❌ ${fail} Fehler`);

  if (!TEST_RUN) {
    const newForDb = NEW_INGREDIENTS.filter(i => !EXISTING_SLUGS.has(i.slug));
    fs.writeFileSync(SQL_FILE, generateSql(newForDb));
    console.log(`\n📄 SQL-Datei geschrieben: insert_ingredients.sql (${newForDb.length} Einträge)`);
    console.log('\n📋 Nächster Schritt: bash scripts/upload_ingredients.sh\n');
  } else {
    console.log('\n📋 Bilder prüfen, dann TEST_RUN = false setzen und neu starten.\n');
  }
}

main().catch(e => { console.error('Fehler:', e.message); process.exit(1); });
