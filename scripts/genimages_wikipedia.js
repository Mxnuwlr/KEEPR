/**
 * genimages_wikipedia.js — Zutaten-Bilder via Wikipedia API
 *
 * Kein API-Key, kein Rate-Limit, ~1-2s pro Bild.
 * Wikipedia-Bilder sind CC-lizenziert (kostenlos verwendbar).
 *
 * node scripts/genimages_wikipedia.js
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR  = path.join(__dirname, 'ingredient_images_pollinations'); // gleicher Ordner
const SQL_FILE    = path.join(__dirname, 'insert_ingredients.sql');
const DELAY_MS    = 500; // 0.5s zwischen Requests — Wikipedia ist sehr permissiv

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

// Wikipedia-Artikel-Titel pro Zutat (Englisch)
// Format: { name, slug, category, wiki }
const INGREDIENTS = [
  // Fleisch
  { name: 'Rindfleisch',          slug: 'rindfleisch',         category: 'Fleisch',       wiki: 'Beef' },
  { name: 'Schweinefleisch',      slug: 'schweinefleisch',     category: 'Fleisch',       wiki: 'Pork' },
  { name: 'Putenbrustfilet',      slug: 'putenbrustfilet',     category: 'Fleisch',       wiki: 'Turkey meat' },
  { name: 'Lammfleisch',          slug: 'lammfleisch',         category: 'Fleisch',       wiki: 'Lamb and mutton' },
  { name: 'Entenbrust',           slug: 'entenbrust',          category: 'Fleisch',       wiki: 'Duck as food' },
  { name: 'Kalbfleisch',          slug: 'kalbfleisch',         category: 'Fleisch',       wiki: 'Veal' },
  { name: 'Wildfleisch',          slug: 'wildfleisch',         category: 'Fleisch',       wiki: 'Venison' },
  { name: 'Kaninchen',            slug: 'kaninchen',           category: 'Fleisch',       wiki: 'Rabbit as food' },
  { name: 'Bratwurst',            slug: 'bratwurst',           category: 'Fleisch',       wiki: 'Bratwurst' },
  { name: 'Würstchen',            slug: 'wuestchen',           category: 'Fleisch',       wiki: 'Frankfurter Würstchen' },
  { name: 'Salami',               slug: 'salami',              category: 'Fleisch',       wiki: 'Salami' },
  { name: 'Chorizo',              slug: 'chorizo',             category: 'Fleisch',       wiki: 'Chorizo' },
  { name: 'Schweinebauch',        slug: 'schweinebauch',       category: 'Fleisch',       wiki: 'Pork belly' },
  { name: 'Rindersteak',          slug: 'rindersteak',         category: 'Fleisch',       wiki: 'Steak' },
  { name: 'Schweinekotelett',     slug: 'schweinekotelett',    category: 'Fleisch',       wiki: 'Pork chop' },
  { name: 'Mortadella',           slug: 'mortadella',          category: 'Fleisch',       wiki: 'Mortadella' },
  { name: 'Leberwurst',           slug: 'leberwurst',          category: 'Fleisch',       wiki: 'Liverwurst' },
  { name: 'Hühnerleber',          slug: 'huehnerleber',        category: 'Fleisch',       wiki: 'Chicken liver' },
  { name: 'Rindergulasch',        slug: 'rindergulasch',       category: 'Fleisch',       wiki: 'Goulash' },
  // Fisch
  { name: 'Kabeljau',             slug: 'kabeljau',            category: 'Fisch',         wiki: 'Cod' },
  { name: 'Forelle',              slug: 'forelle',             category: 'Fisch',         wiki: 'Trout' },
  { name: 'Hering',               slug: 'hering',              category: 'Fisch',         wiki: 'Herring' },
  { name: 'Makrele',              slug: 'makrele',             category: 'Fisch',         wiki: 'Mackerel' },
  { name: 'Räucherlachs',         slug: 'raeucherlachs',       category: 'Fisch',         wiki: 'Smoked salmon' },
  { name: 'Sardinen',             slug: 'sardinen',            category: 'Fisch',         wiki: 'Sardine' },
  { name: 'Miesmuscheln',         slug: 'miesmuscheln',        category: 'Fisch',         wiki: 'Mytilus edulis' },
  { name: 'Calamari',             slug: 'calamari',            category: 'Fisch',         wiki: 'Calamari' },
  { name: 'Scholle',              slug: 'scholle',             category: 'Fisch',         wiki: 'European plaice' },
  { name: 'Rotbarsch',            slug: 'rotbarsch',           category: 'Fisch',         wiki: 'Redfish' },
  { name: 'Seelachs',             slug: 'seelachs',            category: 'Fisch',         wiki: 'Pollock' },
  { name: 'Dorade',               slug: 'dorade',              category: 'Fisch',         wiki: 'Sea bream' },
  { name: 'Wolfsbarsch',          slug: 'wolfsbarsch',         category: 'Fisch',         wiki: 'European bass' },
  { name: 'Jakobsmuscheln',       slug: 'jakobsmuscheln',      category: 'Fisch',         wiki: 'Scallop' },
  // Gemüse
  { name: 'Fenchel',              slug: 'fenchel',             category: 'Gemüse',        wiki: 'Fennel' },
  { name: 'Rote Bete',            slug: 'rote-bete',           category: 'Gemüse',        wiki: 'Beetroot' },
  { name: 'Spargel weiß',         slug: 'spargel-weiss',       category: 'Gemüse',        wiki: 'Asparagus' },
  { name: 'Spargel grün',         slug: 'spargel-gruen',       category: 'Gemüse',        wiki: 'Asparagus' },
  { name: 'Kohlrabi',             slug: 'kohlrabi',            category: 'Gemüse',        wiki: 'Kohlrabi' },
  { name: 'Rosenkohl',            slug: 'rosenkohl',           category: 'Gemüse',        wiki: 'Brussels sprout' },
  { name: 'Mangold',              slug: 'mangold',             category: 'Gemüse',        wiki: 'Chard' },
  { name: 'Pak Choi',             slug: 'pak-choi',            category: 'Gemüse',        wiki: 'Bok choy' },
  { name: 'Rucola',               slug: 'rucola',              category: 'Gemüse',        wiki: 'Arugula' },
  { name: 'Feldsalat',            slug: 'feldsalat',           category: 'Gemüse',        wiki: 'Valerianella locusta' },
  { name: 'Eisbergsalat',         slug: 'eisbergsalat',        category: 'Gemüse',        wiki: 'Iceberg lettuce' },
  { name: 'Radicchio',            slug: 'radicchio',           category: 'Gemüse',        wiki: 'Radicchio' },
  { name: 'Endivie',              slug: 'endivie',             category: 'Gemüse',        wiki: 'Endive' },
  { name: 'Frühlingszwiebeln',    slug: 'fruehlungszwiebeln',  category: 'Gemüse',        wiki: 'Scallion' },
  { name: 'Schalotten',           slug: 'schalotten',          category: 'Gemüse',        wiki: 'Shallot' },
  { name: 'Rhabarber',            slug: 'rhabarber',           category: 'Gemüse',        wiki: 'Rhubarb' },
  { name: 'Radieschen',           slug: 'radieschen',          category: 'Gemüse',        wiki: 'Radish' },
  { name: 'Pastinaken',           slug: 'pastinaken',          category: 'Gemüse',        wiki: 'Parsnip' },
  { name: 'Zuckererbsen',         slug: 'zuckererbsen',        category: 'Gemüse',        wiki: 'Snap pea' },
  { name: 'Shiitake-Pilze',       slug: 'shiitake',            category: 'Gemüse',        wiki: 'Shiitake' },
  { name: 'Pfifferlinge',         slug: 'pfifferlinge',        category: 'Gemüse',        wiki: 'Chanterelle' },
  { name: 'Steinpilze',           slug: 'steinpilze',          category: 'Gemüse',        wiki: 'Boletus edulis' },
  { name: 'Austernpilze',         slug: 'austernpilze',        category: 'Gemüse',        wiki: 'Pleurotus ostreatus' },
  { name: 'Artischocken',         slug: 'artischocken',        category: 'Gemüse',        wiki: 'Artichoke' },
  { name: 'Jalapeños',            slug: 'jalapenos',           category: 'Gemüse',        wiki: 'Jalapeño' },
  { name: 'Getrocknete Tomaten',  slug: 'getrocknete-tomaten', category: 'Gemüse',        wiki: 'Sun-dried tomato' },
  { name: 'Oliven',               slug: 'oliven',              category: 'Gemüse',        wiki: 'Olive' },
  { name: 'Kapern',               slug: 'kapern',              category: 'Gemüse',        wiki: 'Caper' },
  { name: 'Bambussprossen',       slug: 'bambussprossen',      category: 'Gemüse',        wiki: 'Bamboo shoot' },
  { name: 'Blattspinat',          slug: 'blattspinat',         category: 'Gemüse',        wiki: 'Spinach' },
  { name: 'Topinambur',           slug: 'topinambur',          category: 'Gemüse',        wiki: 'Jerusalem artichoke' },
  { name: 'Kresse',               slug: 'kresse',              category: 'Gemüse',        wiki: 'Garden cress' },
  { name: 'Bärlauch',             slug: 'baerlauch',           category: 'Gemüse',        wiki: 'Allium ursinum' },
  { name: 'Sauerkraut',           slug: 'sauerkraut',          category: 'Gemüse',        wiki: 'Sauerkraut' },
  { name: 'Cornichons',           slug: 'cornichons',          category: 'Gemüse',        wiki: 'Pickled cucumber' },
  { name: 'Saure Gurken',         slug: 'saure-gurken',        category: 'Gemüse',        wiki: 'Pickled cucumber' },
  { name: 'Kochbananen',          slug: 'kochbananen',         category: 'Gemüse',        wiki: 'Cooking banana' },
  // Obst
  { name: 'Birnen',               slug: 'birnen',              category: 'Obst',          wiki: 'Pear' },
  { name: 'Kirschen',             slug: 'kirschen',            category: 'Obst',          wiki: 'Cherry' },
  { name: 'Pflaumen',             slug: 'pflaumen',            category: 'Obst',          wiki: 'Plum' },
  { name: 'Kiwi',                 slug: 'kiwi',                category: 'Obst',          wiki: 'Kiwifruit' },
  { name: 'Grapefruit',           slug: 'grapefruit',          category: 'Obst',          wiki: 'Grapefruit' },
  { name: 'Wassermelone',         slug: 'wassermelone',        category: 'Obst',          wiki: 'Watermelon' },
  { name: 'Honigmelone',          slug: 'honigmelone',         category: 'Obst',          wiki: 'Honeydew melon' },
  { name: 'Papaya',               slug: 'papaya',              category: 'Obst',          wiki: 'Papaya' },
  { name: 'Granatapfel',          slug: 'granatapfel',         category: 'Obst',          wiki: 'Pomegranate' },
  { name: 'Feigen',               slug: 'feigen',              category: 'Obst',          wiki: 'Common fig' },
  { name: 'Datteln',              slug: 'datteln',             category: 'Obst',          wiki: 'Date palm' },
  { name: 'Aprikosen',            slug: 'aprikosen',           category: 'Obst',          wiki: 'Apricot' },
  { name: 'Pfirsiche',            slug: 'pfirsiche',           category: 'Obst',          wiki: 'Peach' },
  { name: 'Limette',              slug: 'limette',             category: 'Obst',          wiki: 'Lime (fruit)' },
  { name: 'Cranberries',          slug: 'cranberries',         category: 'Obst',          wiki: 'Cranberry' },
  { name: 'Johannisbeeren',       slug: 'johannisbeeren',      category: 'Obst',          wiki: 'Redcurrant' },
  { name: 'Maracuja',             slug: 'maracuja',            category: 'Obst',          wiki: 'Passion fruit' },
  { name: 'Physalis',             slug: 'physalis',            category: 'Obst',          wiki: 'Physalis peruviana' },
  { name: 'Stachelbeeren',        slug: 'stachelbeeren',       category: 'Obst',          wiki: 'Gooseberry' },
  { name: 'Brombeeren',           slug: 'brombeeren',          category: 'Obst',          wiki: 'Blackberry' },
  { name: 'Kokosnuss',            slug: 'kokosnuss',           category: 'Obst',          wiki: 'Coconut' },
  { name: 'Kumquats',             slug: 'kumquats',            category: 'Obst',          wiki: 'Kumquat' },
  { name: 'Jackfrucht',           slug: 'jackfrucht',          category: 'Obst',          wiki: 'Jackfruit' },
  // Milchprodukte
  { name: 'Mascarpone',           slug: 'mascarpone',          category: 'Milchprodukte', wiki: 'Mascarpone' },
  { name: 'Ricotta',              slug: 'ricotta',             category: 'Milchprodukte', wiki: 'Ricotta' },
  { name: 'Camembert',            slug: 'camembert',           category: 'Milchprodukte', wiki: 'Camembert' },
  { name: 'Brie',                 slug: 'brie',                category: 'Milchprodukte', wiki: 'Brie' },
  { name: 'Emmentaler',           slug: 'emmentaler',          category: 'Milchprodukte', wiki: 'Emmental cheese' },
  { name: 'Bergkäse',             slug: 'bergkaese',           category: 'Milchprodukte', wiki: 'Bergkäse' },
  { name: 'Halloumi',             slug: 'halloumi',            category: 'Milchprodukte', wiki: 'Halloumi' },
  { name: 'Ziegenkäse',           slug: 'ziegenkaese',         category: 'Milchprodukte', wiki: 'Chèvre' },
  { name: 'Gruyère',              slug: 'gruyere',             category: 'Milchprodukte', wiki: 'Gruyère cheese' },
  { name: 'Buttermilch',          slug: 'buttermilch',         category: 'Milchprodukte', wiki: 'Buttermilk' },
  { name: 'Kefir',                slug: 'kefir',               category: 'Milchprodukte', wiki: 'Kefir' },
  { name: 'Schlagsahne',          slug: 'schlagsahne',         category: 'Milchprodukte', wiki: 'Whipped cream' },
  { name: 'Saure Sahne',          slug: 'saure-sahne',         category: 'Milchprodukte', wiki: 'Sour cream' },
  { name: 'Hüttenkäse',           slug: 'huettenkaese',        category: 'Milchprodukte', wiki: 'Cottage cheese' },
  { name: 'Kondensmilch',         slug: 'kondensmilch',        category: 'Milchprodukte', wiki: 'Condensed milk' },
  { name: 'Sauerrahm',            slug: 'sauerrahm',           category: 'Milchprodukte', wiki: 'Sour cream' },
  // Getreide & Nudeln
  { name: 'Fusilli',              slug: 'fusilli',             category: 'Getreide',      wiki: 'Fusilli' },
  { name: 'Tagliatelle',          slug: 'tagliatelle',         category: 'Getreide',      wiki: 'Tagliatelle' },
  { name: 'Rigatoni',             slug: 'rigatoni',            category: 'Getreide',      wiki: 'Rigatoni' },
  { name: 'Lasagneblätter',       slug: 'lasagneblaetter',     category: 'Getreide',      wiki: 'Lasagne' },
  { name: 'Gnocchi',              slug: 'gnocchi',             category: 'Getreide',      wiki: 'Gnocchi' },
  { name: 'Spätzle',              slug: 'spaetzle',            category: 'Getreide',      wiki: 'Spätzle' },
  { name: 'Couscous',             slug: 'couscous',            category: 'Getreide',      wiki: 'Couscous' },
  { name: 'Bulgur',               slug: 'bulgur',              category: 'Getreide',      wiki: 'Bulgur' },
  { name: 'Polenta',              slug: 'polenta',             category: 'Getreide',      wiki: 'Polenta' },
  { name: 'Hirse',                slug: 'hirse',               category: 'Getreide',      wiki: 'Millet' },
  { name: 'Dinkelmehl',           slug: 'dinkelmehl',          category: 'Getreide',      wiki: 'Spelt' },
  { name: 'Vollkornmehl',         slug: 'vollkornmehl',        category: 'Getreide',      wiki: 'Whole-wheat flour' },
  { name: 'Speisestärke',         slug: 'speisestaerke',       category: 'Getreide',      wiki: 'Corn starch' },
  { name: 'Paniermehl',           slug: 'paniermehl',          category: 'Getreide',      wiki: 'Bread crumbs' },
  { name: 'Glasnudeln',           slug: 'glasnudeln',          category: 'Getreide',      wiki: 'Glass noodles' },
  { name: 'Reisnudeln',           slug: 'reisnudeln',          category: 'Getreide',      wiki: 'Rice noodles' },
  { name: 'Basmati-Reis',         slug: 'basmati-reis',        category: 'Getreide',      wiki: 'Basmati' },
  { name: 'Wildreis',             slug: 'wildreis',            category: 'Getreide',      wiki: 'Wild rice' },
  { name: 'Amaranth',             slug: 'amaranth',            category: 'Getreide',      wiki: 'Amaranth grain' },
  { name: 'Tortellini',           slug: 'tortellini',          category: 'Getreide',      wiki: 'Tortellini' },
  // Hülsenfrüchte
  { name: 'Kidneybohnen',         slug: 'kidneybohnen',        category: 'Hülsenfrüchte', wiki: 'Kidney bean' },
  { name: 'Schwarze Bohnen',      slug: 'schwarze-bohnen',     category: 'Hülsenfrüchte', wiki: 'Black turtle bean' },
  { name: 'Weißbohnen',           slug: 'weissbohnen',         category: 'Hülsenfrüchte', wiki: 'Cannellini bean' },
  { name: 'Rote Linsen',          slug: 'rote-linsen',         category: 'Hülsenfrüchte', wiki: 'Lentil' },
  { name: 'Edamame',              slug: 'edamame',             category: 'Hülsenfrüchte', wiki: 'Edamame' },
  { name: 'Tofu',                 slug: 'tofu',                category: 'Hülsenfrüchte', wiki: 'Tofu' },
  { name: 'Tempeh',               slug: 'tempeh',              category: 'Hülsenfrüchte', wiki: 'Tempeh' },
  { name: 'Sojasprossen',         slug: 'sojasprossen',        category: 'Hülsenfrüchte', wiki: 'Soybean sprout' },
  { name: 'Mungobohnen',          slug: 'mungobohnen',         category: 'Hülsenfrüchte', wiki: 'Mung bean' },
  // Backwaren
  { name: 'Vollkornbrot',         slug: 'vollkornbrot',        category: 'Backwaren',     wiki: 'Whole grain bread' },
  { name: 'Ciabatta',             slug: 'ciabatta',            category: 'Backwaren',     wiki: 'Ciabatta' },
  { name: 'Baguette',             slug: 'baguette',            category: 'Backwaren',     wiki: 'Baguette' },
  { name: 'Brötchen',             slug: 'broetchen',           category: 'Backwaren',     wiki: 'Brötchen' },
  { name: 'Laugengebäck',         slug: 'laugengebaeck',       category: 'Backwaren',     wiki: 'Pretzel' },
  { name: 'Pita-Brot',            slug: 'pita-brot',           category: 'Backwaren',     wiki: 'Pita' },
  { name: 'Wrap',                 slug: 'wrap',                category: 'Backwaren',     wiki: 'Wrap sandwich' },
  { name: 'Knäckebrot',           slug: 'knaeckebrot',         category: 'Backwaren',     wiki: 'Crispbread' },
  { name: 'Croissant',            slug: 'croissant',           category: 'Backwaren',     wiki: 'Croissant' },
  { name: 'Pumpernickel',         slug: 'pumpernickel',        category: 'Backwaren',     wiki: 'Pumpernickel' },
  { name: 'Naan',                 slug: 'naan',                category: 'Backwaren',     wiki: 'Naan' },
  { name: 'Blätterteig',          slug: 'blaetterteig',        category: 'Backwaren',     wiki: 'Puff pastry' },
  // Gewürze & Kräuter
  { name: 'Kreuzkümmel',          slug: 'kreuzkuemmel',        category: 'Gewürze',       wiki: 'Cumin' },
  { name: 'Koriandersamen',       slug: 'koriandersamen',      category: 'Gewürze',       wiki: 'Coriander' },
  { name: 'Thymian',              slug: 'thymian',             category: 'Gewürze',       wiki: 'Thyme' },
  { name: 'Majoran',              slug: 'majoran',             category: 'Gewürze',       wiki: 'Marjoram' },
  { name: 'Salbei',               slug: 'salbei',              category: 'Gewürze',       wiki: 'Salvia officinalis' },
  { name: 'Lorbeer',              slug: 'lorbeer',             category: 'Gewürze',       wiki: 'Bay leaf' },
  { name: 'Muskatnuss',           slug: 'muskatnuss',          category: 'Gewürze',       wiki: 'Nutmeg' },
  { name: 'Kurkuma',              slug: 'kurkuma',             category: 'Gewürze',       wiki: 'Turmeric' },
  { name: 'Dill',                 slug: 'dill',                category: 'Gewürze',       wiki: 'Dill' },
  { name: 'Schnittlauch',         slug: 'schnittlauch',        category: 'Gewürze',       wiki: 'Chives' },
  { name: 'Minze',                slug: 'minze',               category: 'Gewürze',       wiki: 'Mentha' },
  { name: 'Koriander frisch',     slug: 'koriander-frisch',    category: 'Gewürze',       wiki: 'Coriander' },
  { name: 'Chiliflocken',         slug: 'chiliflocken',        category: 'Gewürze',       wiki: 'Crushed red pepper' },
  { name: 'Sesam',                slug: 'sesam',               category: 'Gewürze',       wiki: 'Sesame' },
  { name: 'Mohn',                 slug: 'mohn',                category: 'Gewürze',       wiki: 'Poppy seed' },
  { name: 'Vanille',              slug: 'vanille',             category: 'Gewürze',       wiki: 'Vanilla' },
  { name: 'Kardamom',             slug: 'kardamom',            category: 'Gewürze',       wiki: 'Cardamom' },
  { name: 'Sternanis',            slug: 'sternanis',           category: 'Gewürze',       wiki: 'Star anise' },
  { name: 'Kümmel',               slug: 'kuemmel',             category: 'Gewürze',       wiki: 'Caraway' },
  { name: 'Estragon',             slug: 'estragon',            category: 'Gewürze',       wiki: 'Tarragon' },
  { name: 'Zitronengras',         slug: 'zitronengras',        category: 'Gewürze',       wiki: 'Lemongrass' },
  { name: 'Schwarzkümmel',        slug: 'schwarzkuemmel',      category: 'Gewürze',       wiki: 'Nigella sativa' },
  { name: 'Sumach',               slug: 'sumach',              category: 'Gewürze',       wiki: 'Sumac' },
  { name: 'Garam Masala',         slug: 'garam-masala',        category: 'Gewürze',       wiki: 'Garam masala' },
  { name: 'Wacholderbeeren',      slug: 'wacholderbeeren',     category: 'Gewürze',       wiki: 'Juniper berry' },
  { name: 'Piment',               slug: 'piment',              category: 'Gewürze',       wiki: 'Allspice' },
  { name: 'Liebstöckel',          slug: 'liebstoeckel',        category: 'Gewürze',       wiki: 'Lovage' },
  // Öle & Fette
  { name: 'Kokosöl',              slug: 'kokosoel',            category: 'Öle & Fette',   wiki: 'Coconut oil' },
  { name: 'Rapsöl',               slug: 'rapsoel',             category: 'Öle & Fette',   wiki: 'Rapeseed oil' },
  { name: 'Sonnenblumenöl',       slug: 'sonnenblumenoel',     category: 'Öle & Fette',   wiki: 'Sunflower oil' },
  { name: 'Sesamöl',              slug: 'sesamoel',            category: 'Öle & Fette',   wiki: 'Sesame oil' },
  { name: 'Ghee',                 slug: 'ghee',                category: 'Öle & Fette',   wiki: 'Ghee' },
  { name: 'Avocadoöl',            slug: 'avocadooel',          category: 'Öle & Fette',   wiki: 'Avocado oil' },
  { name: 'Kürbiskernöl',         slug: 'kuerbiskernoel',      category: 'Öle & Fette',   wiki: 'Pumpkin seed oil' },
  // Nüsse & Samen
  { name: 'Cashewkerne',          slug: 'cashewkerne',         category: 'Nüsse',         wiki: 'Cashew' },
  { name: 'Haselnüsse',           slug: 'haselnuesse',         category: 'Nüsse',         wiki: 'Hazelnut' },
  { name: 'Pinienkerne',          slug: 'pinienkerne',         category: 'Nüsse',         wiki: 'Pine nut' },
  { name: 'Sonnenblumenkerne',    slug: 'sonnenblumenkerne',   category: 'Nüsse',         wiki: 'Sunflower seed' },
  { name: 'Kürbiskerne',          slug: 'kuerbiskerne',        category: 'Nüsse',         wiki: 'Pumpkin seed' },
  { name: 'Leinsamen',            slug: 'leinsamen',           category: 'Nüsse',         wiki: 'Flaxseed' },
  { name: 'Chiasamen',            slug: 'chiasamen',           category: 'Nüsse',         wiki: 'Chia seed' },
  { name: 'Pistazien',            slug: 'pistazien',           category: 'Nüsse',         wiki: 'Pistachio' },
  { name: 'Kokosflocken',         slug: 'kokosflocken',        category: 'Nüsse',         wiki: 'Coconut' },
  { name: 'Erdnüsse',             slug: 'erdnuesse',           category: 'Nüsse',         wiki: 'Peanut' },
  { name: 'Pekannüsse',           slug: 'pekannuesse',         category: 'Nüsse',         wiki: 'Pecan' },
  { name: 'Macadamia',            slug: 'macadamia',           category: 'Nüsse',         wiki: 'Macadamia' },
  { name: 'Maronen',              slug: 'maronen',             category: 'Nüsse',         wiki: 'Chestnut' },
  // Saucen & Condiments
  { name: 'Ketchup',              slug: 'ketchup',             category: 'Saucen',        wiki: 'Ketchup' },
  { name: 'Mayonnaise',           slug: 'mayonnaise',          category: 'Saucen',        wiki: 'Mayonnaise' },
  { name: 'Balsamico',            slug: 'balsamico',           category: 'Saucen',        wiki: 'Balsamic vinegar' },
  { name: 'Apfelessig',           slug: 'apfelessig',          category: 'Saucen',        wiki: 'Apple cider vinegar' },
  { name: 'Sriracha',             slug: 'sriracha',            category: 'Saucen',        wiki: 'Sriracha sauce' },
  { name: 'Tabasco',              slug: 'tabasco',             category: 'Saucen',        wiki: 'Tabasco sauce' },
  { name: 'Pesto',                slug: 'pesto',               category: 'Saucen',        wiki: 'Pesto' },
  { name: 'Tahini',               slug: 'tahini',              category: 'Saucen',        wiki: 'Tahini' },
  { name: 'Hoisin-Sauce',         slug: 'hoisin',              category: 'Saucen',        wiki: 'Hoisin sauce' },
  { name: 'Fischsauce',           slug: 'fischsauce',          category: 'Saucen',        wiki: 'Fish sauce' },
  { name: 'Teriyaki-Sauce',       slug: 'teriyaki',            category: 'Saucen',        wiki: 'Teriyaki' },
  { name: 'Worcestershire',       slug: 'worcestershire',      category: 'Saucen',        wiki: 'Worcestershire sauce' },
  { name: 'Tomatensoße',          slug: 'tomatensauce',        category: 'Saucen',        wiki: 'Tomato sauce' },
  { name: 'Gemüsebrühe',          slug: 'gemuesebruehe',       category: 'Saucen',        wiki: 'Vegetable broth' },
  { name: 'Hühnerbrühe',          slug: 'huehnerbrue',         category: 'Saucen',        wiki: 'Chicken soup' },
  { name: 'Miso-Paste',           slug: 'miso',                category: 'Saucen',        wiki: 'Miso' },
  { name: 'Sambal Oelek',         slug: 'sambal-oelek',        category: 'Saucen',        wiki: 'Sambal' },
  { name: 'Rote Currypaste',      slug: 'rote-currypaste',     category: 'Saucen',        wiki: 'Red curry paste' },
  { name: 'Ajvar',                slug: 'ajvar',               category: 'Saucen',        wiki: 'Ajvar' },
  { name: 'Hummus',               slug: 'hummus',              category: 'Saucen',        wiki: 'Hummus' },
  // Backzutaten
  { name: 'Backpulver',           slug: 'backpulver',          category: 'Backzutaten',   wiki: 'Baking powder' },
  { name: 'Trockenhefe',          slug: 'trockenhefe',         category: 'Backzutaten',   wiki: 'Yeast' },
  { name: 'Frischhefe',           slug: 'frischhefe',          category: 'Backzutaten',   wiki: 'Yeast' },
  { name: 'Puderzucker',          slug: 'puderzucker',         category: 'Backzutaten',   wiki: 'Powdered sugar' },
  { name: 'Brauner Zucker',       slug: 'brauner-zucker',      category: 'Backzutaten',   wiki: 'Brown sugar' },
  { name: 'Ahornsirup',           slug: 'ahornsirup',          category: 'Backzutaten',   wiki: 'Maple syrup' },
  { name: 'Agavensirup',          slug: 'agavensirup',         category: 'Backzutaten',   wiki: 'Agave syrup' },
  { name: 'Kakaopulver',          slug: 'kakaopulver',         category: 'Backzutaten',   wiki: 'Cocoa solids' },
  { name: 'Zartbitterschokolade', slug: 'zartbitter',          category: 'Backzutaten',   wiki: 'Dark chocolate' },
  { name: 'Natron',               slug: 'natron',              category: 'Backzutaten',   wiki: 'Sodium bicarbonate' },
  { name: 'Gelatine',             slug: 'gelatine',            category: 'Backzutaten',   wiki: 'Gelatin' },
  { name: 'Mandelmehl',           slug: 'mandelmehl',          category: 'Backzutaten',   wiki: 'Almond meal' },
  // Konserven
  { name: 'Mais (Dose)',          slug: 'mais-dose',           category: 'Konserven',     wiki: 'Corn' },
  { name: 'Bohnen (Dose)',        slug: 'bohnen-dose',         category: 'Konserven',     wiki: 'Baked beans' },
  { name: 'Kichererbsen (Dose)',  slug: 'kichererbsen-dose',   category: 'Konserven',     wiki: 'Chickpea' },
  { name: 'Thunfisch (Dose)',     slug: 'thunfisch-dose',      category: 'Konserven',     wiki: 'Canned tuna' },
  { name: 'Artischockenherzen',   slug: 'artischockenherzen',  category: 'Konserven',     wiki: 'Artichoke' },
  { name: 'Rote Bete (Glas)',     slug: 'rote-bete-glas',      category: 'Konserven',     wiki: 'Beetroot' },
  { name: 'Sauerkraut (Dose)',    slug: 'sauerkraut-dose',     category: 'Konserven',     wiki: 'Sauerkraut' },
  { name: 'Linsen (Dose)',        slug: 'linsen-dose',         category: 'Konserven',     wiki: 'Lentil' },
  // Getränke / Kochwein
  { name: 'Weißwein',             slug: 'weisswein',           category: 'Sonstiges',     wiki: 'White wine' },
  { name: 'Rotwein',              slug: 'rotwein',             category: 'Sonstiges',     wiki: 'Red wine' },
  { name: 'Bier',                 slug: 'bier',                category: 'Sonstiges',     wiki: 'Beer' },
  { name: 'Orangensaft',          slug: 'orangensaft',         category: 'Sonstiges',     wiki: 'Orange juice' },
  { name: 'Zitronensaft',         slug: 'zitronensaft',        category: 'Sonstiges',     wiki: 'Lemon juice' },
  { name: 'Kokoswasser',          slug: 'kokoswasser',         category: 'Sonstiges',     wiki: 'Coconut water' },
  // Sonstiges
  { name: 'Meerrettich',          slug: 'meerrettich',         category: 'Sonstiges',     wiki: 'Horseradish' },
  { name: 'Wasabi',               slug: 'wasabi',              category: 'Sonstiges',     wiki: 'Wasabi' },
  { name: 'Tamarinde',            slug: 'tamarinde',           category: 'Sonstiges',     wiki: 'Tamarind' },
];

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'keepr-app/1.0 (ingredient image fetcher; contact@keepr.app)' }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const doRequest = (targetUrl, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Zu viele Redirects'));
      const mod = targetUrl.startsWith('https') ? https : require('http');
      mod.get(targetUrl, {
        headers: { 'User-Agent': 'keepr-app/1.0' }
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doRequest(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
      }).on('error', reject);
    };
    doRequest(url);
  });
}

async function getWikipediaImageUrl(wikiTitle) {
  const encoded = encodeURIComponent(wikiTitle);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
  const data = await fetchJson(url);
  return data?.thumbnail?.source || data?.originalimage?.source || null;
}

function generateSql(ingredients) {
  const lines = ['-- Neue Zutaten für keepr DB', '-- sqlite3 speisekammer.db < insert_ingredients.sql', ''];
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

  const todo = INGREDIENTS.filter(i =>
    !EXISTING_SLUGS.has(i.slug) && !existingFiles.has(i.slug)
  );

  console.log(`\n🥦  keepr Zutaten-Bilder — Wikipedia API`);
  console.log(`   ${INGREDIENTS.length} Zutaten definiert`);
  console.log(`   ${existingFiles.size} Bilder bereits vorhanden`);
  console.log(`   ${todo.length} Bilder werden jetzt geladen\n`);

  let ok = 0, fail = 0;
  for (let i = 0; i < todo.length; i++) {
    const ing = todo[i];
    const num = `[${String(i + 1).padStart(3)}/${todo.length}]`;
    process.stdout.write(`  ${num} ${ing.name.padEnd(26)} `);

    const destPath = path.join(OUTPUT_DIR, `${ing.slug}.jpg`);
    try {
      const imgUrl = await getWikipediaImageUrl(ing.wiki);
      if (!imgUrl) throw new Error('Kein Bild auf Wikipedia');
      await downloadFile(imgUrl, destPath);
      const size = fs.statSync(destPath).size;
      if (size < 2000) { fs.unlinkSync(destPath); throw new Error('Bild zu klein'); }
      console.log(`✅ (${Math.round(size / 1024)} KB)`);
      ok++;
    } catch (e) {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      console.log(`❌ ${e.message}`);
      fail++;
    }

    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n  ✅ ${ok} geladen   ❌ ${fail} nicht gefunden`);

  fs.writeFileSync(SQL_FILE, generateSql(INGREDIENTS));
  console.log(`\n📄 SQL: insert_ingredients.sql (${INGREDIENTS.length} Einträge)`);
  console.log('📋 Nächster Schritt: bash scripts/upload_ingredients.sh\n');
}

main().catch(e => { console.error('Fehler:', e.message); process.exit(1); });
