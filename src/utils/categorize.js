/**
 * utils/categorize.js
 *
 * Kategorisiert Einkaufsartikel per Keyword-Matching (kein KI-Aufruf).
 * Rundet Mengen auf praxisübliche Kaufgrößen.
 */

// ── Matching-Funktion ────────────────────────────────────────────────────────
// Kurze Keywords (≤3 Zeichen) werden nur als ganzes Wort gematcht,
// damit "ei" nicht in "Weißwein" matcht.

function matches(itemLower, kw) {
  if (kw.length <= 3) {
    return (
      itemLower === kw ||
      itemLower.startsWith(kw + ' ') ||
      itemLower.endsWith(' ' + kw) ||
      itemLower.includes(' ' + kw + ' ')
    );
  }
  return itemLower.includes(kw);
}

// ── Kategorie-Regeln ─────────────────────────────────────────────────────────
// Reihenfolge ist entscheidend — erste Übereinstimmung gewinnt.
// Spezifische Kategorien stehen VOR allgemeinen.

const RULES = [

  // 1. Tiefkühl — zuerst, damit "TK-Erbsen" nicht als Gemüse landet
  {
    category: 'Tiefkühl',
    keywords: [
      'tiefkühl', 'tk-', 'tk gemüse', 'tk fisch', 'tk pizza',
      'gefroren', 'gefrorene', 'gefrorener',
      'pommes', 'kroketten', 'rösti', 'hash brown',
      'fischstäbchen',
      'speiseeis', 'softeis', 'sorbet', 'gelato', 'eiscreme',
      'frozen berries', 'tiefkühlbeere', 'aufbackbrötchen',
    ],
  },

  // 2. Gewürze & Öle — vor Getränke, damit "Weißweinessig" nicht zu Getränken geht
  {
    category: 'Gewürze & Öle',
    keywords: [
      // Essig (compound words zuerst, spezifisch vor allgemein)
      'weißweinessig', 'rotweinessig', 'apfelessig', 'balsamicoessig',
      'reisessig', 'himbeeressig', 'estragonessig', 'sherryessig',
      'aceto balsamico', 'balsamico', 'essig',
      // Öle
      'olivenöl', 'sonnenblumenöl', 'rapsöl', 'kokosöl', 'erdnussöl',
      'sesamöl', 'trüffelöl', 'walnussöl', 'haselnussöl', 'avocadoöl',
      'leinöl', 'hanföl', 'distelöl', 'maiskeimöl', 'frittierfett',
      'butterschmalz', 'schmalz',
      // Salz
      'meersalz', 'himalayasalz', 'fleur de sel', 'kräutersalz',
      'selleriesalz', 'knoblauchsalz', 'rauchsalz', 'jodsalz',
      // Pfeffer
      'schwarzer pfeffer', 'weißer pfeffer', 'bunter pfeffer',
      'szechuan pfeffer', 'langer pfeffer',
      // Gewürze gemahlen
      'paprikapulver', 'geräucherte paprika', 'pimenton',
      'currypulver', 'garam masala', 'ras el hanout', 'baharat', 'za\'atar',
      'kurkuma', 'safran', 'kreuzkümmel', 'koriandersamen', 'senfkörner',
      'fenchelsamen', 'kümmel samen', 'anis samen',
      'zimtstange', 'zimt', 'muskat', 'muskatblüte', 'nelken', 'kardamom',
      'piment', 'sternanis', 'lorbeerblatt', 'lorbeer',
      'chilipulver', 'cayennepfeffer', 'cayenne',
      'vanilleschote', 'vanillepulver', 'vanilleextrakt', 'tonkabohne',
      // Kräuter getrocknet
      'getrockneter oregano', 'getrockneter thymian', 'getrockneter rosmarin',
      'getrocknetes basilikum', 'getrocknete petersilie', 'getrockneter dill',
      'herbes de provence', 'italienische kräuter', 'kräuter der provence',
      // Senf & Saucen
      'dijonsenf', 'körniger senf', 'tafelsenf', 'senf',
      'ketchup', 'mayonnaise',
      'sojasoße', 'sojasauce', 'tamari',
      'worcester', 'fischsauce', 'fish sauce', 'austernsoße', 'hoisin',
      'mirin', 'sake kochen',
      'tabasco', 'sriracha', 'sambal oelek', 'harissa', 'gochujang',
      'bbq sauce', 'barbecue sauce',
      'tahini', 'sesampaste', 'miso', 'misopaste',
      'tomatenmark', 'tomatenpassata', 'passata', 'tomatensugo',
      'pesto', 'tomatensauce', 'pasta sauce', 'bolognese sauce',
      // Süßungsmittel
      'honig', 'ahornsirup', 'agavendicksaft', 'agavensirup',
      'zuckerrübensirup', 'melasse', 'golden syrup',
      'puderzucker', 'hagelzucker', 'rohrzucker', 'muscovado', 'demerara',
      'stevia', 'erythrit', 'xylitol', 'birkenzucker',
      // Backhilfsmittel
      'gelatine', 'agar agar', 'pektin', 'lebensmittelfarbe',
      'backpulver', 'natron', 'hefe', 'trockenhefe',
      'vanillezucker', 'vanille zucker',
      // Generisch (kurze Wörter am Ende)
      'curry', 'senf', 'pesto',
    ],
  },

  // 3. Getränke — vor Milch & Eier, damit "Weißwein" nicht zu Milch & Eier geht
  {
    category: 'Getränke',
    keywords: [
      // Wasser
      'mineralwasser', 'sprudelwasser', 'tafelwasser', 'quellwasser',
      'stilles wasser', 'leitungswasser',
      // Säfte
      'orangensaft', 'apfelsaft', 'traubensaft', 'multivitaminsaft',
      'tomatensaft', 'karottensaft', 'mangosaft', 'ananassaft',
      'grapefruitsaft', 'kirschsaft', 'johannisbeersaft',
      'direktsaft', 'fruchtnektar', 'nektar',
      // Smoothies
      'smoothie', 'cold pressed', 'ingwershot',
      // Softdrinks
      'limonade', 'spezi', 'mezzo mix', 'bionade', 'viva con agua',
      'tonic water', 'bitter lemon', 'ginger beer', 'ginger ale',
      'kokoswasser', 'aloe vera drink',
      'energy drink', 'red bull', 'monster',
      'eistee', 'ice tea', 'fuze tea',
      // Bier
      'pils', 'pilsner', 'hefeweizen', 'weißbier', 'weizenbier',
      'lager bier', 'craft beer', 'pale ale', 'stout', 'porter',
      'radler', 'shandy', 'malzbier',
      // Wein & Sekt
      'rotwein', 'weißwein', 'rosewein', 'roséwein', 'grauburgunder',
      'riesling', 'chardonnay', 'sauvignon blanc', 'merlot', 'cabernet',
      'pinot noir', 'spätburgunder', 'dornfelder', 'silvaner',
      'sekt', 'champagner', 'prosecco', 'cava', 'cremant',
      'weinschorle',
      // Spirituosen
      'gin', 'vodka', 'wodka', 'rum', 'whisky', 'whiskey', 'bourbon',
      'tequila', 'mezcal', 'cognac', 'brandy', 'grappa',
      'likör', 'aperol', 'campari', 'vermouth', 'amaretto', 'baileys',
      // Heißgetränke
      'kaffeebohnen', 'kaffeepads', 'kaffeekapseln', 'instantkaffee',
      'espresso bohnen', 'filterkaffee',
      'kräutertee', 'früchtetee', 'grüntee', 'schwarztee',
      'kamillentee', 'pfefferminztee', 'ingwertee', 'matcha pulver',
      'trinkschokoladenpulver', 'kakao pulver zum trinken', 'ovomaltine',
      // Generisch — kurze Wörter ans Ende (nach spezifischen)
      'bier', 'wein', 'saft',
    ],
  },

  // 4. Fleisch & Fisch — vor Milch & Eier
  {
    category: 'Fleisch & Fisch',
    keywords: [
      // Hack
      'hackfleisch', 'rinderhack', 'schweinehack', 'gemischtes hack',
      'burger patty', 'bulette', 'frikadelle',
      // Geflügel
      'hähnchenbrust', 'hähnchenkeule', 'hähnchenflügel', 'hähnchenfilet',
      'hähnchen', 'hühnerbrust', 'hühnchen', 'poulet',
      'putenbrust', 'putenfilet', 'putenschnitzel', 'pute', 'truthahn',
      'entenbrust', 'entenkeule', 'ente',
      'gänsekeule', 'gänsebrust', 'gans',
      // Rind
      'rinderfilet', 'rindersteak', 'rinderrippe', 'rinderlende',
      'rindfleisch', 'roastbeef', 'tafelspitz', 'brisket', 'gulasch',
      'ribeye', 'entrecote', 't-bone', 'sirloin',
      // Schwein
      'schweinebauch', 'schweinelende', 'schweinefilet', 'schweinebraten',
      'schweinekotelett', 'schweineschulter', 'schweinehaxe', 'schweinefleisch',
      'schnitzel', 'kotelett', 'spareribs', 'kassler', 'leberkäse', 'fleischkäse',
      // Lamm & Wild
      'lammkotelett', 'lammkeule', 'lammrücken', 'lammfleisch', 'lamm',
      'kalbsschnitzel', 'kalbsfilet', 'kalbsleber', 'kalbfleisch', 'kalb',
      'hirsch', 'wildschwein', 'hase', 'kaninchen',
      // Wurst & Aufschnitt
      'bratwurst', 'bockwurst', 'wiener würstchen', 'frankfurter',
      'weißwurst', 'nürnberger',
      'salami', 'chorizo', 'mortadella', 'lyoner', 'fleischwurst',
      'bierschinken', 'jagdwurst', 'leberwurst', 'pastete',
      'aufschnitt', 'wurstaufschnitt', 'wurst',
      // Schinken & Speck
      'kochschinken', 'rohschinken', 'schwarzwälder schinken',
      'serrano', 'prosciutto', 'parmaschinken', 'bresaola', 'coppa',
      'frühstücksspeck', 'bauchspeck', 'pancetta', 'lardo', 'bacon', 'speck',
      // Fisch
      'lachsfilet', 'räucherlachs', 'gravlax', 'lachs',
      'geräucherte forelle', 'forelle', 'saibling',
      'thunfisch', 'schwertfisch',
      'matjes', 'bismarckhering', 'hering',
      'geräucherte makrele', 'makrele',
      'kabeljau', 'dorsch', 'skrei', 'seelachs', 'scholle', 'heilbutt',
      'rotbarsch', 'tilapia', 'pangasius', 'barsch', 'zander', 'hecht',
      'dorade', 'wolfsbarsch', 'branzino',
      'sardine', 'sardelle', 'anchovis',
      // Meeresfrüchte
      'riesengarnele', 'garnele', 'shrimp', 'scampi', 'langustine',
      'miesmuschel', 'jakobsmuschel', 'venusmuschel', 'auster',
      'calamari', 'tintenfisch', 'oktopus', 'sepia',
      'hummer', 'languste', 'taschenkrabbe', 'krebs',
      'meeresfrüchte', 'seafood',
      // Generisch
      'fischfilet', 'fisch', 'huhn', 'rind', 'schwein',
      'steak', 'schinken',
    ],
  },

  // 5. Milch & Eier
  {
    category: 'Milch & Eier',
    keywords: [
      // Pflanzliche Milch (vor "milch" damit sie auch erwischt werden)
      'hafermilch', 'haferdrink', 'sojamilch', 'sojadrink', 'mandelmilch',
      'mandeldrink', 'reismilch', 'reisdrink', 'cashewmilch', 'erbsendrink',
      'macadamiamilch', 'hanfmilch',
      // Milch
      'vollmilch', 'halbfettmilch', 'magermilch', 'weidemilch', 'frischmilch',
      'haltbarmilch', 'h-milch', 'laktosefreie milch', 'biomilch', 'kuhmilch',
      // Butter & Fette
      'süßrahmbutter', 'sauerrahmbutter', 'weidebutter', 'landbutter',
      'pflanzenmargarine', 'margarine', 'butter', 'ghee',
      // Sahne
      'schlagsahne', 'kochsahne', 'kaffeesahne', 'saure sahne',
      'creme fraiche', 'crème fraîche', 'schmand', 'smetana', 'sahne',
      // Joghurt & Fermentiertes
      'griechischer joghurt', 'trinkjoghurt', 'fruchtjoghurt', 'joghurt',
      'skyr', 'kefir', 'buttermilch',
      // Quark & Frischkäse
      'magerquark', 'speisequark', 'quark', 'topfen', 'hüttenkäse',
      'cottage cheese', 'ricotta', 'mascarpone',
      'doppelrahmfrischkäse', 'frischkäse',
      // Käse
      'büffelmozzarella', 'mozzarella',
      'parmigiano reggiano', 'parmesan', 'pecorino', 'grana padano',
      'emmentaler', 'bergkäse', 'allgäuer', 'greyerzer', 'comte',
      'brie', 'camembert', 'limburger', 'romadur',
      'schafskäse', 'feta', 'ziegenkäse', 'halloumi', 'manchego',
      'cheddar', 'gorgonzola', 'roquefort', 'blauschimmelkäse',
      'raclette käse', 'appenzeller', 'vacherin',
      'schmelzkäse', 'scheibletten', 'streichkäse',
      'gouda', 'edamer', 'tilsiter', 'edam',
      // Eier (kein "ei" als Einzelwort — matcht sonst Weißwein etc.)
      'hühnereier', 'hühnerei', 'freilandeier', 'bioeier', 'eier',
      'wachtelei', 'entenei',
      // Kondensmilch
      'kondensmilch', 'gezuckerte kondensmilch',
      // Generisch
      'milch', 'käse',
    ],
  },

  // 6. Brot & Backwaren
  {
    category: 'Brot & Backwaren',
    keywords: [
      // Brot (compound words zuerst)
      'vollkornbrot', 'roggenbrot', 'sauerteigbrot', 'dinkelbrot',
      'mischbrot', 'weißbrot', 'toastbrot', 'sandwichbrot', 'mehrkornbrot',
      'körner brot', 'leinsamenbrot', 'pumpernickel', 'schwarzbrot',
      'baguette', 'ciabatta', 'focaccia', 'pita', 'naan', 'chapati',
      'tortilla', 'wrap', 'fladenbrot', 'lavash', 'bagel',
      // Brötchen
      'dinkelbrötchen', 'körnerbrötchen', 'vollkornbrötchen', 'kaisersemmel',
      'brötchen', 'semmel', 'schrippe',
      // Laugengebäck
      'laugenbrezel', 'laugenbrötchen', 'laugenstange', 'brezel',
      // Süßes Gebäck
      'croissant', 'pain au chocolat', 'plunder',
      'streuselkuchen', 'hefezopf', 'hefekranz',
      'lebkuchen', 'stollen', 'christstollen', 'spekulatius',
      'donut', 'berliner', 'krapfen',
      'muffin', 'cupcake', 'brownie', 'waffel',
      'butterkeks', 'haferkeks', 'keks', 'cookie',
      'zwieback', 'knäckebrot',
      // Mehl & Backen
      'weizenmehl', 'roggenmehl', 'dinkelmehl', 'mandelmehl', 'vollkornmehl',
      '00-mehl', 'tipo mehl',
      'puddingpulver', 'vanillepuddingpulver', 'backaroma',
      // Paniermehl
      'semmelbrösel', 'paniermehl', 'panko', 'breadcrumbs',
      // Generisch (kurze erst ganz am Ende!)
      'brot', 'kuchen', 'torte', 'mehl',
    ],
  },

  // 7. Obst & Gemüse
  {
    category: 'Obst & Gemüse',
    keywords: [
      // Kernobst
      'braeburn', 'gala apfel', 'golden delicious', 'boskop',
      // Zitrus
      'mandarine', 'clementine', 'satsuma', 'grapefruit', 'pomelo',
      'orange', 'zitrone', 'limette',
      // Steinobst
      'sauerkirsche', 'süßkirsche', 'kirsche',
      'zwetschge', 'zwetsche', 'mirabelle', 'pflaume',
      'nektarine', 'pfirsich', 'aprikose', 'marille',
      // Exotisch
      'ananas', 'mango', 'papaya', 'kiwi', 'guave', 'passionsfrucht',
      'maracuja', 'physalis', 'lychee', 'litchi', 'longan', 'rambutan',
      'drachenfrucht', 'jackfrucht', 'sternfrucht',
      'kokosnuss', 'kokosraspeln',
      // Melonen
      'wassermelone', 'honigmelone', 'cantaloupe', 'melone',
      // Trauben
      'weintraube', 'tafeltraube',
      // Beeren
      'erdbeere', 'himbeere', 'heidelbeere', 'blaubeere', 'brombeere',
      'stachelbeere', 'johannisbeere', 'preiselbeere', 'cranberry',
      'holunderbeere', 'sanddorn', 'aronia',
      // Trockenfrüchte
      'getrocknete feige', 'getrocknete aprikose', 'getrocknete mango',
      'dörrpflaume', 'trockenobst', 'dörrfrucht',
      // Avocado, Banane, Apfel, Birne
      'avocado', 'banane', 'birne', 'apfel', 'feige', 'dattel',
      // Tomaten (frisch)
      'rispentomaten', 'cherrytomaten', 'fleischtomaten', 'flaschentomaten',
      'tomate', 'tomaten',
      // Gurken & Paprika (frisch)
      'salatgurke', 'snackgurke', 'einlegegurke', 'gurke',
      'spitzpaprika', 'paprikaschote', 'paprika',
      'peperoncino', 'peperoni frisch',
      // Zucchini, Aubergine, Kürbis
      'zucchini', 'aubergine', 'butternusskürbis', 'hokkaido', 'kürbis',
      // Zwiebeln & Knoblauch
      'rote zwiebel', 'frühlingszwiebel', 'schalotte', 'zwiebel',
      'bärlauch', 'knoblauchzehe', 'knoblauchknolle', 'knoblauch',
      'lauch', 'porree',
      // Wurzelgemüse
      'pastinake', 'petersilienwurzel', 'schwarzwurzel', 'topinambur',
      'steckrübe', 'kohlrübe', 'rote beete', 'rote bete',
      'rettich', 'radieschen', 'meerrettich wasabi',
      'karotte', 'möhre',
      // Kartoffeln
      'drillinge', 'süßkartoffel', 'batate', 'yam',
      'festkochende kartoffel', 'mehligkochend', 'kartoffel',
      // Staudensellerie & Fenchel
      'staudensellerie', 'bleichsellerie', 'knollensellerie', 'sellerie',
      'fenchelknolle', 'fenchelsamen frisch', 'fenchel',
      // Blattsalat & Spinat
      'eisbergsalat', 'kopfsalat', 'romanasalat', 'lollo rosso', 'lollo bianco',
      'feldsalat', 'rucola', 'babyspinat', 'blattspinat', 'spinat',
      'mangold', 'radicchio', 'chicoree', 'endivie', 'pak choi',
      // Kohl
      'rotkohl', 'blaukraut', 'weißkohl', 'weißkraut', 'wirsing',
      'spitzkohl', 'grünkohl', 'chinakohl',
      'brokkoli', 'blumenkohl', 'romanesco', 'rosenkohl', 'kohlrabi',
      // Hülsenfrüchte frisch
      'zuckerschote', 'erbsenschote', 'dicke bohne', 'saubohne', 'edamame',
      // Spargel & Artischocke
      'weißer spargel', 'grüner spargel', 'spargel', 'artischocke',
      // Mais frisch
      'maiskolben', 'zuckermais',
      // Pilze
      'champignon', 'steinpilz', 'pfifferling', 'shiitake', 'austernpilz',
      'kräuterseitling', 'trüffel', 'morchel', 'enoki', 'pilz',
      // Kräuter frisch
      'frischer basilikum', 'frische petersilie', 'frischer dill',
      'frischer koriander', 'frische minze', 'frischer schnittlauch',
      'petersilie', 'basilikum', 'schnittlauch', 'dill', 'koriander',
      'minze', 'pfefferminze', 'salbei', 'thymian', 'rosmarin',
      'oregano', 'majoran', 'liebstöckel', 'estragon', 'bohnenkraut',
      'zitronenmelisse', 'kapuzinerkresse', 'brunnenkresse',
      // Ingwer & Chili frisch
      'ingwerwurzel', 'ingwer frisch', 'galgant', 'kurkumawurzel',
      'chilischote', 'jalapeño', 'habanero', 'peperoncini',
      // Sprossen
      'microgreens', 'keimsprossen', 'bambussprossen', 'sprossen',
      // Generisch am Ende
      'obst', 'gemüse', 'kräuter', 'beere', 'frucht', 'salat',
      'ingwer', 'chili',
    ],
  },

  // 8. Konserven & Trockenware
  {
    category: 'Konserven & Trockenware',
    keywords: [
      // Nudeln
      'spaghetti', 'linguine', 'tagliatelle', 'fettuccine', 'pappardelle',
      'rigatoni', 'tortiglioni', 'paccheri', 'fusilli', 'farfalle',
      'conchiglie', 'orecchiette', 'cavatappi',
      'lasagneblätter', 'cannelloni',
      'tortellini', 'ravioli', 'mezzelune', 'cappelletti',
      'vollkornnudel', 'dinkelnudel', 'linsennudel', 'erbsennudel',
      'kichererbsennudel', 'glasnudeln', 'reisnudeln', 'udon', 'soba',
      'ramen', 'mie-nudeln', 'pad thai',
      'nudel', 'pasta', 'penne',
      // Reis
      'basmatireis', 'jasminreis', 'vollkornreis', 'risottoreis', 'arborio',
      'carnaroli', 'wildreis', 'parboiled', 'klebreis', 'sushireis',
      'brauner reis', 'schwarzer reis', 'basmati',
      // Andere Körner
      'couscous', 'bulgur', 'polenta', 'grieß', 'weizengrieß',
      'quinoa', 'amaranth', 'hirse', 'buchweizen', 'gerste', 'grünkern',
      // Hülsenfrüchte trocken & Dose
      'rote linsen', 'grüne linsen', 'belugalinsen', 'puy linsen', 'berglinsen',
      'kichererbsen dose', 'kidneybohnen dose', 'cannellinibohnen',
      'weiße bohnen dose', 'schwarze bohnen',
      'mungobohnen', 'adzukibohnen', 'sojabohnen',
      'kichererbsen', 'kidneybohnen', 'linsendose',
      'tofu', 'tempeh', 'seitan',
      // Konserven & Gläser
      'dosentomaten', 'pizzatomaten', 'tomatenstücke', 'tomaten dose',
      'mais dose', 'dosenerbsen', 'dosenlinsen', 'dosenbohnen',
      'dosenmandarinen', 'ananas dose', 'pfirsich dose',
      'thunfisch dose', 'sardinen dose', 'lachs dose',
      // Kokosmilch für kochen
      'kokosmilch', 'kokosnussmilch', 'kokosnusscreme', 'coconut milk', 'kokoscreme',
      // Frühstück
      'zarte haferflocken', 'kernige haferflocken', 'haferflocken',
      'overnight oats', 'birchermüsli', 'granola', 'müsli', 'cornflakes', 'cerealien',
      // Nüsse & Samen
      'erdnussbutter', 'erdnussmus', 'mandelmus', 'cashewmus', 'nussbutter',
      'peanut butter', 'walnüsse', 'pekannuss', 'macadamia', 'paranuss',
      'cashewkerne', 'erdnüsse', 'pistazien', 'mandeln', 'haselnüsse',
      'pinienkerne', 'sesam', 'mohnsamen', 'leinsamen', 'chiasamen',
      'hanfsamen', 'sonnenblumenkerne', 'kürbiskerne',
      // Aufstriche süß
      'fruchtaufstrich', 'nuss-nougat-creme', 'nutella',
      'marmelade', 'konfitüre', 'gelee', 'brotaufstrich',
      // Schokolade
      'vollmilchschokolade', 'zartbitterschokolade', 'weiße schokolade',
      'kuvertüre', 'backkakao', 'schokochips', 'schokolade',
      // Suppen & Brühe
      'rinderbrühe', 'gemüsebrühe', 'hühnerbrühe', 'bouillon',
      'suppenwürfel', 'instantsuppe', 'nudelsuppe',
      // Backen trocken
      'speisestärke', 'maisstärke', 'kartoffelstärke', 'stärke',
      'puddingpulver', 'götterspeise',
      // Proteinpulver
      'proteinpulver', 'protein powder', 'whey', 'casein',
      // Snacks
      'chips', 'kartoffelchips', 'popcorn', 'salzstangen', 'erdnussflips',
      // Generisch (kurze/allgemeine am Ende)
      'dose', 'konserve', 'reis', 'linsen', 'brühe',
    ],
  },

];

// ── Kategorisierung ──────────────────────────────────────────────────────────

export function categorizeItem(name) {
  if (!name) return 'Sonstiges';
  const lower = name.toLowerCase().trim();

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (matches(lower, kw)) return rule.category;
    }
  }
  return 'Sonstiges';
}

// ── Mengen-Normalisierung ────────────────────────────────────────────────────

const GRAM_STEPS = [50, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000];
const ML_STEPS   = [100, 150, 200, 250, 330, 500, 750, 1000, 1500, 2000];

function roundUp(value, steps) {
  for (const step of steps) {
    if (value <= step) return step;
  }
  return Math.ceil(value / 500) * 500;
}

export function roundToPracticalAmount(amount, unit) {
  const num = parseFloat(amount);
  if (!num || isNaN(num)) return { amount, unit };

  const u = (unit || '').toLowerCase().trim();

  if (u === 'g' || u === 'gramm') {
    if (num >= 1000) return { amount: Math.ceil(num / 500) * 0.5, unit: 'kg' };
    return { amount: roundUp(num, GRAM_STEPS), unit: 'g' };
  }
  if (u === 'kg' || u === 'kilogramm') {
    const inG = num * 1000;
    if (inG < 1000) return { amount: roundUp(inG, GRAM_STEPS), unit: 'g' };
    return { amount: Math.ceil(num * 2) / 2, unit: 'kg' };
  }
  if (u === 'ml' || u === 'milliliter') {
    if (num >= 1000) return { amount: Math.ceil(num / 250) * 0.25, unit: 'L' };
    return { amount: roundUp(num, ML_STEPS), unit: 'ml' };
  }
  if (u === 'l' || u === 'liter') {
    return { amount: Math.ceil(num * 4) / 4, unit: 'L' };
  }
  if (num < 1) return { amount: 1, unit };
  return { amount: Math.ceil(num), unit };
}
