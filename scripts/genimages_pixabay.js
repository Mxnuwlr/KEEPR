/**
 * genimages_pixabay.js — Zutaten-Bilder via Pixabay API
 *
 * Pixabay-Lizenz: kostenlos für kommerzielle Nutzung, kein Attribution nötig.
 * https://pixabay.com/api/docs/
 *
 * node scripts/genimages_pixabay.js
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const PIXABAY_KEY = '56123246-a6392a4637fed8ab58fa0a873';
const PEXELS_KEY  = 'Bq5ZdOiQQWylcjLmfTSl0AGhKSO0c4VZGkrkEfH9elrntCOTi0ns3Pci';
const OUTPUT_DIR  = path.join(__dirname, 'ingredient_images_pixabay');
const SQL_FILE    = path.join(__dirname, 'insert_ingredients.sql');
const DELAY_MS    = 400; // etwas mehr Pause wegen zwei APIs

// Slugs die bereits im Raspi sind — werden übersprungen
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

// Kurze, präzise Suchbegriffe — 1-3 Wörter, kein "isolated white background"
// Pixabay's populärste Ergebnisse für einfache Begriffe sind fast immer korrekt
const INGREDIENTS = [
  // Fleisch
  { name: 'Rindfleisch',          slug: 'rindfleisch',         category: 'Fleisch',       search: 'raw beef' },
  { name: 'Schweinefleisch',      slug: 'schweinefleisch',     category: 'Fleisch',       search: 'raw pork' },
  { name: 'Putenbrustfilet',      slug: 'putenbrustfilet',     category: 'Fleisch',       search: 'turkey breast raw' },
  { name: 'Lammfleisch',          slug: 'lammfleisch',         category: 'Fleisch',       search: 'lamb meat raw' },
  { name: 'Entenbrust',           slug: 'entenbrust',          category: 'Fleisch',       search: 'duck breast raw' },
  { name: 'Kalbfleisch',          slug: 'kalbfleisch',         category: 'Fleisch',       search: 'veal meat raw' },
  { name: 'Wildfleisch',          slug: 'wildfleisch',         category: 'Fleisch',       search: 'venison raw' },
  { name: 'Kaninchen',            slug: 'kaninchen',           category: 'Fleisch',       search: 'rabbit meat raw' },
  { name: 'Bratwurst',            slug: 'bratwurst',           category: 'Fleisch',       search: 'bratwurst raw' },
  { name: 'Würstchen',            slug: 'wuestchen',           category: 'Fleisch',       search: 'frankfurter sausage' },
  { name: 'Salami',               slug: 'salami',              category: 'Fleisch',       search: 'salami' },
  { name: 'Chorizo',              slug: 'chorizo',             category: 'Fleisch',       search: 'chorizo' },
  { name: 'Schweinebauch',        slug: 'schweinebauch',       category: 'Fleisch',       search: 'pork belly raw' },
  { name: 'Rindersteak',          slug: 'rindersteak',         category: 'Fleisch',       search: 'beef steak raw' },
  { name: 'Schweinekotelett',     slug: 'schweinekotelett',    category: 'Fleisch',       search: 'pork chop raw' },
  { name: 'Mortadella',           slug: 'mortadella',          category: 'Fleisch',       search: 'mortadella' },
  { name: 'Leberwurst',           slug: 'leberwurst',          category: 'Fleisch',       search: 'liverwurst' },
  { name: 'Hühnerleber',          slug: 'huehnerleber',        category: 'Fleisch',       search: 'chicken liver raw' },
  { name: 'Rindergulasch',        slug: 'rindergulasch',       category: 'Fleisch',       search: 'beef cubes raw' },
  // Fisch
  { name: 'Kabeljau',             slug: 'kabeljau',            category: 'Fisch',         search: 'cod fish raw' },
  { name: 'Forelle',              slug: 'forelle',             category: 'Fisch',         search: 'trout fish' },
  { name: 'Hering',               slug: 'hering',              category: 'Fisch',         search: 'herring fish' },
  { name: 'Makrele',              slug: 'makrele',             category: 'Fisch',         search: 'mackerel fish' },
  { name: 'Räucherlachs',         slug: 'raeucherlachs',       category: 'Fisch',         search: 'smoked salmon' },
  { name: 'Sardinen',             slug: 'sardinen',            category: 'Fisch',         search: 'sardines raw' },
  { name: 'Miesmuscheln',         slug: 'miesmuscheln',        category: 'Fisch',         search: 'mussels raw' },
  { name: 'Calamari',             slug: 'calamari',            category: 'Fisch',         search: 'squid raw' },
  { name: 'Scholle',              slug: 'scholle',             category: 'Fisch',         search: 'plaice fish' },
  { name: 'Rotbarsch',            slug: 'rotbarsch',           category: 'Fisch',         search: 'redfish fillet' },
  { name: 'Seelachs',             slug: 'seelachs',            category: 'Fisch',         search: 'pollock fish' },
  { name: 'Dorade',               slug: 'dorade',              category: 'Fisch',         search: 'sea bream fish' },
  { name: 'Wolfsbarsch',          slug: 'wolfsbarsch',         category: 'Fisch',         search: 'sea bass fish' },
  { name: 'Jakobsmuscheln',       slug: 'jakobsmuscheln',      category: 'Fisch',         search: 'scallops raw' },
  // Gemüse
  { name: 'Fenchel',              slug: 'fenchel',             category: 'Gemüse',        search: 'fennel bulb' },
  { name: 'Rote Bete',            slug: 'rote-bete',           category: 'Gemüse',        search: 'beetroot' },
  { name: 'Spargel weiß',         slug: 'spargel-weiss',       category: 'Gemüse',        search: 'white asparagus' },
  { name: 'Spargel grün',         slug: 'spargel-gruen',       category: 'Gemüse',        search: 'green asparagus' },
  { name: 'Kohlrabi',             slug: 'kohlrabi',            category: 'Gemüse',        search: 'kohlrabi' },
  { name: 'Rosenkohl',            slug: 'rosenkohl',           category: 'Gemüse',        search: 'brussels sprouts' },
  { name: 'Mangold',              slug: 'mangold',             category: 'Gemüse',        search: 'swiss chard' },
  { name: 'Pak Choi',             slug: 'pak-choi',            category: 'Gemüse',        search: 'bok choy' },
  { name: 'Rucola',               slug: 'rucola',              category: 'Gemüse',        search: 'arugula' },
  { name: 'Feldsalat',            slug: 'feldsalat',           category: 'Gemüse',        search: 'lamb lettuce' },
  { name: 'Eisbergsalat',         slug: 'eisbergsalat',        category: 'Gemüse',        search: 'iceberg lettuce' },
  { name: 'Radicchio',            slug: 'radicchio',           category: 'Gemüse',        search: 'radicchio' },
  { name: 'Endivie',              slug: 'endivie',             category: 'Gemüse',        search: 'endive' },
  { name: 'Frühlingszwiebeln',    slug: 'fruehlungszwiebeln',  category: 'Gemüse',        search: 'spring onions' },
  { name: 'Schalotten',           slug: 'schalotten',          category: 'Gemüse',        search: 'shallots' },
  { name: 'Rhabarber',            slug: 'rhabarber',           category: 'Gemüse',        search: 'rhubarb' },
  { name: 'Radieschen',           slug: 'radieschen',          category: 'Gemüse',        search: 'radish' },
  { name: 'Pastinaken',           slug: 'pastinaken',          category: 'Gemüse',        search: 'parsnip' },
  { name: 'Zuckererbsen',         slug: 'zuckererbsen',        category: 'Gemüse',        search: 'snap peas' },
  { name: 'Shiitake-Pilze',       slug: 'shiitake',            category: 'Gemüse',        search: 'shiitake mushrooms' },
  { name: 'Pfifferlinge',         slug: 'pfifferlinge',        category: 'Gemüse',        search: 'chanterelle mushrooms' },
  { name: 'Steinpilze',           slug: 'steinpilze',          category: 'Gemüse',        search: 'porcini mushrooms' },
  { name: 'Austernpilze',         slug: 'austernpilze',        category: 'Gemüse',        search: 'oyster mushrooms' },
  { name: 'Artischocken',         slug: 'artischocken',        category: 'Gemüse',        search: 'artichoke' },
  { name: 'Jalapeños',            slug: 'jalapenos',           category: 'Gemüse',        search: 'jalapeno' },
  { name: 'Getrocknete Tomaten',  slug: 'getrocknete-tomaten', category: 'Gemüse',        search: 'sun dried tomatoes' },
  { name: 'Oliven',               slug: 'oliven',              category: 'Gemüse',        search: 'olives' },
  { name: 'Kapern',               slug: 'kapern',              category: 'Gemüse',        search: 'capers' },
  { name: 'Bambussprossen',       slug: 'bambussprossen',      category: 'Gemüse',        search: 'bamboo shoots' },
  { name: 'Blattspinat',          slug: 'blattspinat',         category: 'Gemüse',        search: 'baby spinach' },
  { name: 'Topinambur',           slug: 'topinambur',          category: 'Gemüse',        search: 'jerusalem artichoke' },
  { name: 'Kresse',               slug: 'kresse',              category: 'Gemüse',        search: 'garden cress' },
  { name: 'Bärlauch',             slug: 'baerlauch',           category: 'Gemüse',        search: 'wild garlic leaves' },
  { name: 'Sauerkraut',           slug: 'sauerkraut',          category: 'Gemüse',        search: 'sauerkraut' },
  { name: 'Cornichons',           slug: 'cornichons',          category: 'Gemüse',        search: 'cornichons' },
  { name: 'Saure Gurken',         slug: 'saure-gurken',        category: 'Gemüse',        search: 'pickled cucumber' },
  { name: 'Kochbananen',          slug: 'kochbananen',         category: 'Gemüse',        search: 'plantain' },
  // Obst
  { name: 'Birnen',               slug: 'birnen',              category: 'Obst',          search: 'pear' },
  { name: 'Kirschen',             slug: 'kirschen',            category: 'Obst',          search: 'cherries' },
  { name: 'Pflaumen',             slug: 'pflaumen',            category: 'Obst',          search: 'plums' },
  { name: 'Kiwi',                 slug: 'kiwi',                category: 'Obst',          search: 'kiwi fruit' },
  { name: 'Grapefruit',           slug: 'grapefruit',          category: 'Obst',          search: 'grapefruit' },
  { name: 'Wassermelone',         slug: 'wassermelone',        category: 'Obst',          search: 'watermelon' },
  { name: 'Honigmelone',          slug: 'honigmelone',         category: 'Obst',          search: 'honeydew melon' },
  { name: 'Papaya',               slug: 'papaya',              category: 'Obst',          search: 'papaya' },
  { name: 'Granatapfel',          slug: 'granatapfel',         category: 'Obst',          search: 'pomegranate' },
  { name: 'Feigen',               slug: 'feigen',              category: 'Obst',          search: 'figs' },
  { name: 'Datteln',              slug: 'datteln',             category: 'Obst',          search: 'dates fruit' },
  { name: 'Aprikosen',            slug: 'aprikosen',           category: 'Obst',          search: 'apricots' },
  { name: 'Pfirsiche',            slug: 'pfirsiche',           category: 'Obst',          search: 'peaches' },
  { name: 'Limette',              slug: 'limette',             category: 'Obst',          search: 'lime fruit' },
  { name: 'Cranberries',          slug: 'cranberries',         category: 'Obst',          search: 'cranberries' },
  { name: 'Johannisbeeren',       slug: 'johannisbeeren',      category: 'Obst',          search: 'redcurrant' },
  { name: 'Maracuja',             slug: 'maracuja',            category: 'Obst',          search: 'passion fruit' },
  { name: 'Physalis',             slug: 'physalis',            category: 'Obst',          search: 'physalis' },
  { name: 'Stachelbeeren',        slug: 'stachelbeeren',       category: 'Obst',          search: 'gooseberries' },
  { name: 'Brombeeren',           slug: 'brombeeren',          category: 'Obst',          search: 'blackberries' },
  { name: 'Kokosnuss',            slug: 'kokosnuss',           category: 'Obst',          search: 'coconut' },
  { name: 'Kumquats',             slug: 'kumquats',            category: 'Obst',          search: 'kumquat' },
  { name: 'Jackfrucht',           slug: 'jackfrucht',          category: 'Obst',          search: 'jackfruit' },
  // Milchprodukte
  { name: 'Mascarpone',           slug: 'mascarpone',          category: 'Milchprodukte', search: 'mascarpone' },
  { name: 'Ricotta',              slug: 'ricotta',             category: 'Milchprodukte', search: 'ricotta' },
  { name: 'Camembert',            slug: 'camembert',           category: 'Milchprodukte', search: 'camembert cheese' },
  { name: 'Brie',                 slug: 'brie',                category: 'Milchprodukte', search: 'brie cheese' },
  { name: 'Emmentaler',           slug: 'emmentaler',          category: 'Milchprodukte', search: 'emmental cheese' },
  { name: 'Bergkäse',             slug: 'bergkaese',           category: 'Milchprodukte', search: 'alpine cheese' },
  { name: 'Halloumi',             slug: 'halloumi',            category: 'Milchprodukte', search: 'halloumi' },
  { name: 'Ziegenkäse',           slug: 'ziegenkaese',         category: 'Milchprodukte', search: 'goat cheese' },
  { name: 'Gruyère',              slug: 'gruyere',             category: 'Milchprodukte', search: 'gruyere cheese' },
  { name: 'Buttermilch',          slug: 'buttermilch',         category: 'Milchprodukte', search: 'buttermilk' },
  { name: 'Kefir',                slug: 'kefir',               category: 'Milchprodukte', search: 'kefir' },
  { name: 'Schlagsahne',          slug: 'schlagsahne',         category: 'Milchprodukte', search: 'heavy cream' },
  { name: 'Saure Sahne',          slug: 'saure-sahne',         category: 'Milchprodukte', search: 'sour cream' },
  { name: 'Hüttenkäse',           slug: 'huettenkaese',        category: 'Milchprodukte', search: 'cottage cheese' },
  { name: 'Kondensmilch',         slug: 'kondensmilch',        category: 'Milchprodukte', search: 'condensed milk' },
  { name: 'Sauerrahm',            slug: 'sauerrahm',           category: 'Milchprodukte', search: 'creme fraiche' },
  // Getreide & Nudeln
  { name: 'Fusilli',              slug: 'fusilli',             category: 'Getreide',      search: 'fusilli pasta' },
  { name: 'Tagliatelle',          slug: 'tagliatelle',         category: 'Getreide',      search: 'tagliatelle pasta' },
  { name: 'Rigatoni',             slug: 'rigatoni',            category: 'Getreide',      search: 'rigatoni pasta' },
  { name: 'Lasagneblätter',       slug: 'lasagneblaetter',     category: 'Getreide',      search: 'lasagne sheets' },
  { name: 'Gnocchi',              slug: 'gnocchi',             category: 'Getreide',      search: 'gnocchi raw' },
  { name: 'Spätzle',              slug: 'spaetzle',            category: 'Getreide',      search: 'spaetzle' },
  { name: 'Couscous',             slug: 'couscous',            category: 'Getreide',      search: 'couscous' },
  { name: 'Bulgur',               slug: 'bulgur',              category: 'Getreide',      search: 'bulgur wheat' },
  { name: 'Polenta',              slug: 'polenta',             category: 'Getreide',      search: 'polenta' },
  { name: 'Hirse',                slug: 'hirse',               category: 'Getreide',      search: 'millet' },
  { name: 'Dinkelmehl',           slug: 'dinkelmehl',          category: 'Getreide',      search: 'spelt flour' },
  { name: 'Vollkornmehl',         slug: 'vollkornmehl',        category: 'Getreide',      search: 'whole wheat flour' },
  { name: 'Speisestärke',         slug: 'speisestaerke',       category: 'Getreide',      search: 'corn starch' },
  { name: 'Paniermehl',           slug: 'paniermehl',          category: 'Getreide',      search: 'breadcrumbs' },
  { name: 'Glasnudeln',           slug: 'glasnudeln',          category: 'Getreide',      search: 'glass noodles' },
  { name: 'Reisnudeln',           slug: 'reisnudeln',          category: 'Getreide',      search: 'rice noodles' },
  { name: 'Basmati-Reis',         slug: 'basmati-reis',        category: 'Getreide',      search: 'basmati rice' },
  { name: 'Wildreis',             slug: 'wildreis',            category: 'Getreide',      search: 'wild rice' },
  { name: 'Amaranth',             slug: 'amaranth',            category: 'Getreide',      search: 'amaranth grain' },
  { name: 'Tortellini',           slug: 'tortellini',          category: 'Getreide',      search: 'tortellini' },
  // Hülsenfrüchte
  { name: 'Kidneybohnen',         slug: 'kidneybohnen',        category: 'Hülsenfrüchte', search: 'kidney beans' },
  { name: 'Schwarze Bohnen',      slug: 'schwarze-bohnen',     category: 'Hülsenfrüchte', search: 'black beans' },
  { name: 'Weißbohnen',           slug: 'weissbohnen',         category: 'Hülsenfrüchte', search: 'white beans' },
  { name: 'Rote Linsen',          slug: 'rote-linsen',         category: 'Hülsenfrüchte', search: 'red lentils' },
  { name: 'Edamame',              slug: 'edamame',             category: 'Hülsenfrüchte', search: 'edamame' },
  { name: 'Tofu',                 slug: 'tofu',                category: 'Hülsenfrüchte', search: 'tofu block' },
  { name: 'Tempeh',               slug: 'tempeh',              category: 'Hülsenfrüchte', search: 'tempeh' },
  { name: 'Sojasprossen',         slug: 'sojasprossen',        category: 'Hülsenfrüchte', search: 'bean sprouts' },
  { name: 'Mungobohnen',          slug: 'mungobohnen',         category: 'Hülsenfrüchte', search: 'mung beans' },
  // Backwaren
  { name: 'Vollkornbrot',         slug: 'vollkornbrot',        category: 'Backwaren',     search: 'whole grain bread' },
  { name: 'Ciabatta',             slug: 'ciabatta',            category: 'Backwaren',     search: 'ciabatta bread' },
  { name: 'Baguette',             slug: 'baguette',            category: 'Backwaren',     search: 'baguette' },
  { name: 'Brötchen',             slug: 'broetchen',           category: 'Backwaren',     search: 'bread roll' },
  { name: 'Laugengebäck',         slug: 'laugengebaeck',       category: 'Backwaren',     search: 'pretzel' },
  { name: 'Pita-Brot',            slug: 'pita-brot',           category: 'Backwaren',     search: 'pita bread' },
  { name: 'Wrap',                 slug: 'wrap',                category: 'Backwaren',     search: 'tortilla wrap' },
  { name: 'Knäckebrot',           slug: 'knaeckebrot',         category: 'Backwaren',     search: 'crispbread' },
  { name: 'Croissant',            slug: 'croissant',           category: 'Backwaren',     search: 'croissant' },
  { name: 'Pumpernickel',         slug: 'pumpernickel',        category: 'Backwaren',     search: 'pumpernickel' },
  { name: 'Naan',                 slug: 'naan',                category: 'Backwaren',     search: 'naan bread' },
  { name: 'Blätterteig',          slug: 'blaetterteig',        category: 'Backwaren',     search: 'puff pastry' },
  // Gewürze & Kräuter
  { name: 'Kreuzkümmel',          slug: 'kreuzkuemmel',        category: 'Gewürze',       search: 'cumin seeds' },
  { name: 'Koriandersamen',       slug: 'koriandersamen',      category: 'Gewürze',       search: 'coriander seeds' },
  { name: 'Thymian',              slug: 'thymian',             category: 'Gewürze',       search: 'thyme herb' },
  { name: 'Majoran',              slug: 'majoran',             category: 'Gewürze',       search: 'marjoram herb' },
  { name: 'Salbei',               slug: 'salbei',              category: 'Gewürze',       search: 'sage herb' },
  { name: 'Lorbeer',              slug: 'lorbeer',             category: 'Gewürze',       search: 'bay leaves' },
  { name: 'Muskatnuss',           slug: 'muskatnuss',          category: 'Gewürze',       search: 'nutmeg' },
  { name: 'Kurkuma',              slug: 'kurkuma',             category: 'Gewürze',       search: 'turmeric' },
  { name: 'Dill',                 slug: 'dill',                category: 'Gewürze',       search: 'dill herb' },
  { name: 'Schnittlauch',         slug: 'schnittlauch',        category: 'Gewürze',       search: 'chives' },
  { name: 'Minze',                slug: 'minze',               category: 'Gewürze',       search: 'mint herb' },
  { name: 'Koriander frisch',     slug: 'koriander-frisch',    category: 'Gewürze',       search: 'cilantro fresh' },
  { name: 'Chiliflocken',         slug: 'chiliflocken',        category: 'Gewürze',       search: 'chili flakes' },
  { name: 'Sesam',                slug: 'sesam',               category: 'Gewürze',       search: 'sesame seeds' },
  { name: 'Mohn',                 slug: 'mohn',                category: 'Gewürze',       search: 'poppy seeds' },
  { name: 'Vanille',              slug: 'vanille',             category: 'Gewürze',       search: 'vanilla bean' },
  { name: 'Kardamom',             slug: 'kardamom',            category: 'Gewürze',       search: 'cardamom' },
  { name: 'Sternanis',            slug: 'sternanis',           category: 'Gewürze',       search: 'star anise' },
  { name: 'Kümmel',               slug: 'kuemmel',             category: 'Gewürze',       search: 'caraway seeds' },
  { name: 'Estragon',             slug: 'estragon',            category: 'Gewürze',       search: 'tarragon herb' },
  { name: 'Zitronengras',         slug: 'zitronengras',        category: 'Gewürze',       search: 'lemongrass' },
  { name: 'Schwarzkümmel',        slug: 'schwarzkuemmel',      category: 'Gewürze',       search: 'nigella seeds' },
  { name: 'Sumach',               slug: 'sumach',              category: 'Gewürze',       search: 'sumac spice' },
  { name: 'Garam Masala',         slug: 'garam-masala',        category: 'Gewürze',       search: 'garam masala' },
  { name: 'Wacholderbeeren',      slug: 'wacholderbeeren',     category: 'Gewürze',       search: 'juniper berries' },
  { name: 'Piment',               slug: 'piment',              category: 'Gewürze',       search: 'allspice' },
  { name: 'Liebstöckel',          slug: 'liebstoeckel',        category: 'Gewürze',       search: 'lovage herb' },
  // Öle & Fette
  { name: 'Kokosöl',              slug: 'kokosoel',            category: 'Öle & Fette',   search: 'coconut oil' },
  { name: 'Rapsöl',               slug: 'rapsoel',             category: 'Öle & Fette',   search: 'canola oil bottle' },
  { name: 'Sonnenblumenöl',       slug: 'sonnenblumenoel',     category: 'Öle & Fette',   search: 'sunflower oil' },
  { name: 'Sesamöl',              slug: 'sesamoel',            category: 'Öle & Fette',   search: 'sesame oil' },
  { name: 'Ghee',                 slug: 'ghee',                category: 'Öle & Fette',   search: 'ghee' },
  { name: 'Avocadoöl',            slug: 'avocadooel',          category: 'Öle & Fette',   search: 'avocado oil' },
  { name: 'Kürbiskernöl',         slug: 'kuerbiskernoel',      category: 'Öle & Fette',   search: 'pumpkin seed oil' },
  // Nüsse & Samen
  { name: 'Cashewkerne',          slug: 'cashewkerne',         category: 'Nüsse',         search: 'cashew nuts' },
  { name: 'Haselnüsse',           slug: 'haselnuesse',         category: 'Nüsse',         search: 'hazelnuts' },
  { name: 'Pinienkerne',          slug: 'pinienkerne',         category: 'Nüsse',         search: 'pine nuts' },
  { name: 'Sonnenblumenkerne',    slug: 'sonnenblumenkerne',   category: 'Nüsse',         search: 'sunflower seeds' },
  { name: 'Kürbiskerne',          slug: 'kuerbiskerne',        category: 'Nüsse',         search: 'pumpkin seeds' },
  { name: 'Leinsamen',            slug: 'leinsamen',           category: 'Nüsse',         search: 'flax seeds' },
  { name: 'Chiasamen',            slug: 'chiasamen',           category: 'Nüsse',         search: 'chia seeds' },
  { name: 'Pistazien',            slug: 'pistazien',           category: 'Nüsse',         search: 'pistachios' },
  { name: 'Kokosflocken',         slug: 'kokosflocken',        category: 'Nüsse',         search: 'coconut flakes' },
  { name: 'Erdnüsse',             slug: 'erdnuesse',           category: 'Nüsse',         search: 'peanuts' },
  { name: 'Pekannüsse',           slug: 'pekannuesse',         category: 'Nüsse',         search: 'pecan nuts' },
  { name: 'Macadamia',            slug: 'macadamia',           category: 'Nüsse',         search: 'macadamia nuts' },
  { name: 'Maronen',              slug: 'maronen',             category: 'Nüsse',         search: 'chestnuts' },
  // Saucen & Condiments
  { name: 'Ketchup',              slug: 'ketchup',             category: 'Saucen',        search: 'ketchup bottle' },
  { name: 'Mayonnaise',           slug: 'mayonnaise',          category: 'Saucen',        search: 'mayonnaise' },
  { name: 'Balsamico',            slug: 'balsamico',           category: 'Saucen',        search: 'balsamic vinegar' },
  { name: 'Apfelessig',           slug: 'apfelessig',          category: 'Saucen',        search: 'apple cider vinegar' },
  { name: 'Sriracha',             slug: 'sriracha',            category: 'Saucen',        search: 'sriracha sauce' },
  { name: 'Tabasco',              slug: 'tabasco',             category: 'Saucen',        search: 'tabasco sauce' },
  { name: 'Pesto',                slug: 'pesto',               category: 'Saucen',        search: 'pesto' },
  { name: 'Tahini',               slug: 'tahini',              category: 'Saucen',        search: 'tahini' },
  { name: 'Hoisin-Sauce',         slug: 'hoisin',              category: 'Saucen',        search: 'hoisin sauce' },
  { name: 'Fischsauce',           slug: 'fischsauce',          category: 'Saucen',        search: 'fish sauce' },
  { name: 'Teriyaki-Sauce',       slug: 'teriyaki',            category: 'Saucen',        search: 'teriyaki sauce' },
  { name: 'Worcestershire',       slug: 'worcestershire',      category: 'Saucen',        search: 'worcestershire sauce' },
  { name: 'Tomatensoße',          slug: 'tomatensauce',        category: 'Saucen',        search: 'tomato sauce' },
  { name: 'Gemüsebrühe',          slug: 'gemuesebruehe',       category: 'Saucen',        search: 'vegetable broth' },
  { name: 'Hühnerbrühe',          slug: 'huehnerbrue',         category: 'Saucen',        search: 'chicken broth' },
  { name: 'Miso-Paste',           slug: 'miso',                category: 'Saucen',        search: 'miso paste' },
  { name: 'Sambal Oelek',         slug: 'sambal-oelek',        category: 'Saucen',        search: 'sambal oelek' },
  { name: 'Rote Currypaste',      slug: 'rote-currypaste',     category: 'Saucen',        search: 'red curry paste' },
  { name: 'Ajvar',                slug: 'ajvar',               category: 'Saucen',        search: 'ajvar' },
  { name: 'Hummus',               slug: 'hummus',              category: 'Saucen',        search: 'hummus' },
  // Backzutaten
  { name: 'Backpulver',           slug: 'backpulver',          category: 'Backzutaten',   search: 'baking powder' },
  { name: 'Trockenhefe',          slug: 'trockenhefe',         category: 'Backzutaten',   search: 'dry yeast' },
  { name: 'Frischhefe',           slug: 'frischhefe',          category: 'Backzutaten',   search: 'fresh yeast' },
  { name: 'Puderzucker',          slug: 'puderzucker',         category: 'Backzutaten',   search: 'powdered sugar' },
  { name: 'Brauner Zucker',       slug: 'brauner-zucker',      category: 'Backzutaten',   search: 'brown sugar' },
  { name: 'Ahornsirup',           slug: 'ahornsirup',          category: 'Backzutaten',   search: 'maple syrup' },
  { name: 'Agavensirup',          slug: 'agavensirup',         category: 'Backzutaten',   search: 'agave syrup' },
  { name: 'Kakaopulver',          slug: 'kakaopulver',         category: 'Backzutaten',   search: 'cocoa powder' },
  { name: 'Zartbitterschokolade', slug: 'zartbitter',          category: 'Backzutaten',   search: 'dark chocolate' },
  { name: 'Natron',               slug: 'natron',              category: 'Backzutaten',   search: 'baking soda' },
  { name: 'Gelatine',             slug: 'gelatine',            category: 'Backzutaten',   search: 'gelatin sheets' },
  { name: 'Mandelmehl',           slug: 'mandelmehl',          category: 'Backzutaten',   search: 'almond flour' },
  // Konserven
  { name: 'Mais (Dose)',          slug: 'mais-dose',           category: 'Konserven',     search: 'canned corn' },
  { name: 'Bohnen (Dose)',        slug: 'bohnen-dose',         category: 'Konserven',     search: 'canned beans' },
  { name: 'Kichererbsen (Dose)',  slug: 'kichererbsen-dose',   category: 'Konserven',     search: 'canned chickpeas' },
  { name: 'Thunfisch (Dose)',     slug: 'thunfisch-dose',      category: 'Konserven',     search: 'tuna can' },
  { name: 'Artischockenherzen',   slug: 'artischockenherzen',  category: 'Konserven',     search: 'artichoke hearts' },
  { name: 'Rote Bete (Glas)',     slug: 'rote-bete-glas',      category: 'Konserven',     search: 'pickled beetroot' },
  { name: 'Sauerkraut (Dose)',    slug: 'sauerkraut-dose',     category: 'Konserven',     search: 'sauerkraut jar' },
  { name: 'Linsen (Dose)',        slug: 'linsen-dose',         category: 'Konserven',     search: 'canned lentils' },
  // Getränke / Kochwein
  { name: 'Weißwein',             slug: 'weisswein',           category: 'Sonstiges',     search: 'white wine bottle' },
  { name: 'Rotwein',              slug: 'rotwein',             category: 'Sonstiges',     search: 'red wine bottle' },
  { name: 'Bier',                 slug: 'bier',                category: 'Sonstiges',     search: 'beer bottle' },
  { name: 'Orangensaft',          slug: 'orangensaft',         category: 'Sonstiges',     search: 'orange juice' },
  { name: 'Zitronensaft',         slug: 'zitronensaft',        category: 'Sonstiges',     search: 'lemon juice' },
  { name: 'Kokoswasser',          slug: 'kokoswasser',         category: 'Sonstiges',     search: 'coconut water' },
  // Sonstiges
  { name: 'Meerrettich',          slug: 'meerrettich',         category: 'Sonstiges',     search: 'horseradish' },
  { name: 'Wasabi',               slug: 'wasabi',              category: 'Sonstiges',     search: 'wasabi' },
  { name: 'Tamarinde',            slug: 'tamarinde',           category: 'Sonstiges',     search: 'tamarind' },
];

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'keepr-app/1.0', ...headers }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const doRequest = (targetUrl, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Zu viele Redirects'));
      const mod = targetUrl.startsWith('https') ? https : require('http');
      mod.get(targetUrl, { headers: { 'User-Agent': 'keepr-app/1.0' } }, res => {
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

async function getPixabayImageUrl(searchTerm) {
  const q = encodeURIComponent(searchTerm);
  // Kein category=food — das verwirrt den Algorithmus und bringt Duplikate
  const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${q}&image_type=photo&per_page=3&safesearch=true&order=popular`;
  const data = await fetchJson(url);
  return data?.hits?.[0]?.webformatURL || null;
}

async function getPexelsImageUrl(searchTerm) {
  const q = encodeURIComponent(searchTerm);
  const url = `https://api.pexels.com/v1/search?query=${q}&per_page=5&orientation=square`;
  const data = await fetchJson(url, { 'Authorization': PEXELS_KEY });
  return data?.photos?.[0]?.src?.medium || null;
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

  console.log(`\n🥦  keepr Zutaten-Bilder — Pixabay API`);
  console.log(`   ${INGREDIENTS.length} Zutaten definiert`);
  console.log(`   ${existingFiles.size} Bilder bereits vorhanden`);
  console.log(`   ${todo.length} Bilder werden jetzt geladen`);
  const minuten = Math.ceil((todo.length * (DELAY_MS + 1000)) / 60000);
  console.log(`   Geschätzte Dauer: ~${minuten} Minuten\n`);

  let ok = 0, okPexels = 0, fail = 0;
  for (let i = 0; i < todo.length; i++) {
    const ing = todo[i];
    const num = `[${String(i + 1).padStart(3)}/${todo.length}]`;
    process.stdout.write(`  ${num} ${ing.name.padEnd(26)} `);

    const destPath = path.join(OUTPUT_DIR, `${ing.slug}.jpg`);
    let downloaded = false;

    // 1. Versuch: Pixabay (category=food)
    try {
      const imgUrl = await getPixabayImageUrl(ing.search);
      if (imgUrl) {
        await downloadFile(imgUrl, destPath);
        const size = fs.statSync(destPath).size;
        if (size >= 5000) {
          console.log(`✅ Pixabay (${Math.round(size / 1024)} KB)`);
          ok++;
          downloaded = true;
        } else {
          fs.unlinkSync(destPath);
        }
      }
    } catch (_) {}

    // 2. Fallback: Pexels
    if (!downloaded) {
      try {
        const imgUrl = await getPexelsImageUrl(ing.search);
        if (!imgUrl) throw new Error('Kein Treffer');
        await downloadFile(imgUrl, destPath);
        const size = fs.statSync(destPath).size;
        if (size < 5000) { fs.unlinkSync(destPath); throw new Error('Bild zu klein'); }
        console.log(`🔄 Pexels  (${Math.round(size / 1024)} KB)`);
        okPexels++;
        downloaded = true;
      } catch (e) {
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        console.log(`❌ ${e.message}`);
        fail++;
      }
    }

    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n  ✅ ${ok} Pixabay   🔄 ${okPexels} Pexels   ❌ ${fail} nicht gefunden`);

  fs.writeFileSync(SQL_FILE, generateSql(INGREDIENTS));
  console.log(`\n📄 SQL: insert_ingredients.sql (${INGREDIENTS.length} Einträge)`);
  console.log('📋 Nächster Schritt: bash scripts/upload_ingredients.sh\n');
}

main().catch(e => { console.error('Fehler:', e.message); process.exit(1); });
