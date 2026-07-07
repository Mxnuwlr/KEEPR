/**
 * data/exercises.js — Lokale Übungsdatenbank (~150 Übungen)
 *
 * Wird sowohl client-seitig (Filter, MuscleMap, Picker) als auch
 * als Backend-Seed verwendet.
 *
 * Datenstruktur pro Übung:
 *   id             {number}  — Eindeutige ID (stimmt mit Backend-ID überein)
 *   name_de        {string}  — Deutscher Übungsname (Anzeige + Suche)
 *   muscle_group   {string}  — Hauptgruppe als Badge (z.B. 'Brust', 'Rücken')
 *   worked_muscles {object}  — Anatomische Aufteilung: { [muscle]: 'primary'|'secondary' }
 *   equipment      {string}  — Ausrüstungstyp (z.B. 'Langhantel', 'Körpergewicht')
 *   instructions_de{string}  — Nummerierte Schritt-für-Schritt-Anleitung (Zeilenumbrüche mit \n)
 *
 * Exports:
 *   EXERCISES            — Übungs-Array
 *   MUSCLE_GROUPS        — Sortierte Liste aller Muskelgruppen (+ 'Alle')
 *   EQUIPMENT_TYPES      — Sortierte Liste aller Ausrüstungstypen (+ 'Alle')
 *   MUSCLE_COLORS        — Farb-Map { [muscle_group]: hexColor }
 *   getExerciseImageUrl  — Gibt Bild-URL für eine Übung zurück (aus WGER_IMAGE_URLS)
 */

// ~150 Übungen auf Deutsch — wird auch als Backend-Seed verwendet
// muscle_group = Anzeige-Badge (Hauptgruppe), worked_muscles = anatomische Aufteilung
export const EXERCISES = [
  // ── BRUST ──────────────────────────────────────────────────
  { id: 1, name_de: 'Bankdrücken (Langhantel)', muscle_group: 'Brust', worked_muscles: { BrustMitte: 'primary', BrustOben: 'secondary', BrustUnten: 'secondary', Schultern: 'secondary', Trizeps: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Lege dich flach auf die Bank, Augen unter der Stange.\n2. Greife die Stange etwas schulterbreiter als hüftbreit.\n3. Hebe die Stange aus der Ablage, Ellbogen leicht gebeugt.\n4. Senke die Stange kontrolliert zur Brust.\n5. Drücke die Stange explosiv zurück in die Ausgangsposition.' },
  { id: 2, name_de: 'Bankdrücken (Kurzhantel)', muscle_group: 'Brust', worked_muscles: { BrustMitte: 'primary', BrustOben: 'secondary', BrustUnten: 'secondary', Schultern: 'secondary', Trizeps: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Lege dich auf die Bank, Kurzhanteln über der Brust.\n2. Senke die Hanteln kontrolliert seitlich ab.\n3. Drücke sie zurück nach oben und halte eine leichte Beugung in den Ellbogen.' },
  { id: 3, name_de: 'Schrägbankdrücken (Langhantel)', muscle_group: 'Brust', worked_muscles: { BrustOben: 'primary', BrustMitte: 'secondary', BrustUnten: 'secondary', Schultern: 'secondary', Trizeps: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stelle die Bank auf 30–45° ein.\n2. Greife die Stange etwas schulterbreiter.\n3. Senke die Stange zur Oberbrust und drücke zurück.' },
  { id: 4, name_de: 'Schrägbankdrücken (Kurzhantel)', muscle_group: 'Brust', worked_muscles: { BrustOben: 'primary', BrustMitte: 'secondary', BrustUnten: 'secondary', Schultern: 'secondary', Trizeps: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Bank auf 30–45° einstellen.\n2. Kurzhanteln über der Brust halten.\n3. Kontrolliert senken und zurück drücken.' },
  { id: 5, name_de: 'Fliegende (Kurzhantel)', muscle_group: 'Brust', worked_muscles: { BrustMitte: 'primary', Schultern: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Flach auf die Bank legen, Kurzhanteln über der Brust.\n2. Arme leicht gebeugt nach unten/außen absenken.\n3. Zurück zur Ausgangsposition führen, als würdest du einen Baum umarmen.' },
  { id: 6, name_de: 'Kabelzug Fliegende', muscle_group: 'Brust', worked_muscles: { BrustMitte: 'primary', Schultern: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Zwei Kabelzüge auf Schulterhöhe einstellen.\n2. Mit gestreckten Armen nach vorne führen.\n3. Kontrolliert zurück.' },
  { id: 7, name_de: 'Dips (Brust)', muscle_group: 'Brust', worked_muscles: { BrustUnten: 'primary', BrustMitte: 'secondary', Trizeps: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. An den Ringen oder Parallelstangen aufstützen.\n2. Körper leicht nach vorne lehnen.\n3. Absenken bis 90° in den Ellbogen.\n4. Zurückdrücken.' },
  { id: 8, name_de: 'Liegestütze', muscle_group: 'Brust', worked_muscles: { BrustMitte: 'primary', Schultern: 'secondary', Trizeps: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Plank-Position, Hände schulterbreit.\n2. Brust bis kurz über den Boden absenken.\n3. Körper gerade halten und zurückdrücken.' },

  // ── RÜCKEN ─────────────────────────────────────────────────
  { id: 9, name_de: 'Kreuzheben (Langhantel)', muscle_group: 'Rücken', worked_muscles: { LowerBack: 'primary', Rücken: 'secondary', Gesäß: 'secondary', Hamstrings: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stange über Mittelfuß, schulterbreiter Stand.\n2. Hüfte nach hinten, Rücken gerade.\n3. Stange nah am Körper nach oben führen.\n4. Hüfte vorschicken, Schultern hinten.\n5. Kontrolliert absenken.' },
  { id: 10, name_de: 'Klimmzüge', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Bizeps: 'secondary', TeresMajor: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Overhand-Griff, schulterbreit.\n2. Schulterblätter zusammenziehen.\n3. Kinn über die Stange ziehen.\n4. Kontrolliert absenken.' },
  { id: 11, name_de: 'Latzug (weiter Griff)', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Bizeps: 'secondary', Trapez: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Breiten Griff über Schulterbreite wählen.\n2. Aufrecht sitzen, leicht zurücklehnen.\n3. Stange zur Oberbrust ziehen.\n4. Ellbogen weit nach außen und unten führen.' },
  { id: 12, name_de: 'Latzug (enger Griff)', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Bizeps: 'secondary', Rhomboiden: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Engen V-Griff wählen.\n2. Stange zur Brust ziehen, Ellbogen zur Seite.' },
  { id: 13, name_de: 'Rudern (Langhantel)', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Trapez: 'secondary', Rhomboiden: 'secondary', Bizeps: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Hüftbreiter Stand, Oberkörper 45° vorgebeugt.\n2. Stange zum Nabel ziehen.\n3. Ellbogen nah am Körper nach hinten führen.\n4. Schulterblätter hinten zusammendrücken.' },
  { id: 14, name_de: 'Rudern (Kurzhantel, einarmig)', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Trapez: 'secondary', Bizeps: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Knie und Hand auf der Bank abstützen.\n2. Kurzhantel zur Hüfte ziehen.\n3. Ellbogen nah am Körper.' },
  { id: 15, name_de: 'Kabelzug Rudern (sitzend)', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Rhomboiden: 'secondary', Bizeps: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Aufrecht sitzen, Füße auf den Stützen.\n2. Griff zum Bauch ziehen.\n3. Schulterblätter zusammenpressen.' },
  { id: 16, name_de: 'T-Bar Rudern', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Trapez: 'secondary', Rhomboiden: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stange in Ecke, V-Griff drunter.\n2. Rücken gerade, Oberkörper geneigt.\n3. Zur Brust ziehen.' },
  { id: 17, name_de: 'Hyperextensions', muscle_group: 'Rücken', worked_muscles: { LowerBack: 'primary', Gesäß: 'secondary', Hamstrings: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Auf dem Rückenstrecker ablegen.\n2. Oberkörper bis zur Waagerechten absenken.\n3. Zurück strecken.' },

  // ── SCHULTERN ──────────────────────────────────────────────
  { id: 18, name_de: 'Schulterdrücken (Langhantel)', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Trizeps: 'secondary', Trapez: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stehend oder sitzend, Stange vor der Brust.\n2. Senkrecht nach oben drücken.\n3. Kontrolliert absenken.' },
  { id: 19, name_de: 'Schulterdrücken (Kurzhantel)', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Trizeps: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Sitzend, Kurzhanteln auf Schulterhöhe.\n2. Nach oben drücken.\n3. Kontrolliert zurück.' },
  { id: 20, name_de: 'Seitheben (Kurzhantel)', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Trapez: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Stehend, Kurzhanteln seitlich am Körper.\n2. Arme seitlich bis Schulterhöhe heben.\n3. Ellbogen leicht gebeugt, kontrolliert absenken.' },
  { id: 21, name_de: 'Einarmiges Seitheben (Kabelzug)', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary' }, equipment: 'Kabelzug', instructions_de: '1. Kabel auf unterste Position.\n2. Mit gegenüberliegender Hand Griff fassen.\n3. Arm seitlich bis Schulterhöhe heben.' },
  { id: 22, name_de: 'Vorgebeugtes Seitheben', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Trapez: 'secondary', Rhomboiden: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Oberkörper 90° vorgebeugt.\n2. Arme seitlich bis Schulterhöhe heben.\n3. Hintere Schulter trainieren.' },
  { id: 23, name_de: 'Arnold Press', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Trizeps: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Sitzend, Kurzhanteln vor der Brust (Handflächen zu dir).\n2. Beim Drücken nach oben nach außen rotieren.\n3. Am oberen Punkt Handflächen von dir weg.' },
  { id: 24, name_de: 'Face Pulls', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Trapez: 'secondary', Rhomboiden: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Kabel auf Kopfhöhe, Seil-Griff.\n2. Zum Gesicht ziehen, Ellbogen hoch.\n3. Externe Rotation.' },
  { id: 25, name_de: 'Frontales Heben (Kurzhantel)', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', BrustMitte: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Stehend, Kurzhanteln vor dem Körper.\n2. Arme abwechselnd nach vorne bis Schulterhöhe heben.' },

  // ── BIZEPS ─────────────────────────────────────────────────
  { id: 26, name_de: 'Bizepscurl (Kurzhantel)', muscle_group: 'Bizeps', worked_muscles: { Bizeps: 'primary', BizepsLang: 'secondary', BizepsKurz: 'secondary', Brachialis: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Stehend, Kurzhanteln seitlich.\n2. Supinationsgriff (Handfläche nach oben).\n3. Kontrolliert nach oben curlen.\n4. Langsam absenken.' },
  { id: 27, name_de: 'Bizepscurl (Langhantel)', muscle_group: 'Bizeps', worked_muscles: { Bizeps: 'primary', BizepsLang: 'secondary', BizepsKurz: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Schulterbreiter Stand, Stange im Untergriff.\n2. Ellbogen nah am Körper.\n3. Stange zur Schulter curlen.\n4. Kontrolliert absenken.' },
  { id: 28, name_de: 'Hammer Curls', muscle_group: 'Bizeps', worked_muscles: { Brachialis: 'primary', Bizeps: 'secondary', Unterarme: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Neutralgriff (Daumen zeigt nach oben).\n2. Alternierend oder gleichzeitig curlen.' },
  { id: 29, name_de: 'Konzentrationscurl (Kurzhantel)', muscle_group: 'Bizeps', worked_muscles: { BizepsKurz: 'primary', Bizeps: 'secondary', Brachialis: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Sitzend, Ellbogen auf dem Oberschenkel.\n2. Kontrolliert curlen.' },
  { id: 30, name_de: 'Kabelzug Curl', muscle_group: 'Bizeps', worked_muscles: { Bizeps: 'primary', Brachialis: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Kabel auf unterster Position.\n2. Gleichmäßige Spannung durch den gesamten Bewegungsbereich.' },
  { id: 31, name_de: 'Scottcurl (Kurzhantel)', muscle_group: 'Bizeps', worked_muscles: { BizepsKurz: 'primary', Bizeps: 'secondary', Brachialis: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Oberarme auf dem Schrägbrett ablegen.\n2. Kontrolliert curlen — isolierter Bewegungsablauf.' },
  { id: 32, name_de: 'Chin-Ups', muscle_group: 'Bizeps', worked_muscles: { Bizeps: 'primary', Rücken: 'secondary', Brachialis: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Untergriff, schulterbreit.\n2. Kinn über die Stange ziehen.\n3. Kontroliert absenken.' },

  // ── TRIZEPS ────────────────────────────────────────────────
  { id: 33, name_de: 'Trizepsdrücken (Kabelzug)', muscle_group: 'Trizeps', worked_muscles: { TrizepsLateral: 'primary', Trizeps: 'secondary', TrizepsLang: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Kabel oben, Stab oder Seil.\n2. Ellbogen am Körper fixiert.\n3. Nach unten drücken bis Arme gestreckt.\n4. Kontrolliert zurück.' },
  { id: 34, name_de: 'Trizeps-Dips', muscle_group: 'Trizeps', worked_muscles: { Trizeps: 'primary', TrizepsLang: 'secondary', Schultern: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Hände auf Bank, Beine ausgestreckt.\n2. Absenken bis 90° Ellbogen.\n3. Zurück drücken.' },
  { id: 35, name_de: 'Skull Crushers (Langhantel)', muscle_group: 'Trizeps', worked_muscles: { TrizepsLang: 'primary', Trizeps: 'secondary', TrizepsLateral: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Flach auf Bank, Stange über Kopf.\n2. Ellbogen nach oben gerichtet halten.\n3. Stange zur Stirn absenken.\n4. Zurück strecken.' },
  { id: 36, name_de: 'Overhead Trizeps (Kurzhantel)', muscle_group: 'Trizeps', worked_muscles: { TrizepsLang: 'primary', Trizeps: 'secondary', TrizepsLateral: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Kurzhantel über den Kopf halten (beide Hände).\n2. Ellbogen nah am Kopf.\n3. Absenken hinter den Kopf.\n4. Strecken.' },
  { id: 37, name_de: 'Nahgriff-Bankdrücken', muscle_group: 'Trizeps', worked_muscles: { Trizeps: 'primary', BrustMitte: 'secondary', Schultern: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Schulterbreiter oder engerer Griff.\n2. Ellbogen nah am Körper halten.\n3. Stange senken und drücken.' },
  { id: 38, name_de: 'Diamond Push-Ups', muscle_group: 'Trizeps', worked_muscles: { Trizeps: 'primary', BrustMitte: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Hände nah zusammen, Daumen und Zeigefinger bilden Diamant.\n2. Ellbogen nah am Körper.\n3. Absenken und drücken.' },

  // ── BEINE ──────────────────────────────────────────────────
  { id: 39, name_de: 'Kniebeuge (Langhantel)', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', Hamstrings: 'secondary', LowerBack: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stange auf den Schultern.\n2. Füße schulterbreit, Zehen leicht nach außen.\n3. Hüfte nach hinten und unten.\n4. Oberschenkel parallel oder tiefer.\n5. Knie über die Zehen.\n6. Aufstehen.' },
  { id: 40, name_de: 'Frontkniebeuge', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', LowerBack: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stange vor dem Körper auf den Schultern.\n2. Aufrechter Oberkörper.\n3. Tief squatten.' },
  { id: 41, name_de: 'Beinpresse', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', Hamstrings: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Füße schulterbreit auf der Plattform.\n2. Knie 90° beugen.\n3. Plattform wegdrücken.\n4. Nicht ganz strecken.' },
  { id: 42, name_de: 'Ausfallschritte (Kurzhantel)', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', Hamstrings: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Schulterbreiter Stand, Kurzhanteln seitlich.\n2. Schritt nach vorne.\n3. Hinteres Knie fast bis zum Boden.\n4. Zurück und Seite wechseln.' },
  { id: 43, name_de: 'Bulgarischer Split Squat', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', Hamstrings: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Hinterer Fuß auf Bank.\n2. Hinteres Knie senkrecht absenken.\n3. Vorderes Knie über dem Fuß halten.' },
  { id: 44, name_de: 'Beinbeuger (liegend)', muscle_group: 'Hamstrings', worked_muscles: { Hamstrings: 'primary', Gesäß: 'secondary', Waden: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Bauch auf der Maschine, Knöchel unter der Rolle.\n2. Fersen zur Gesäß curlen.\n3. Kontrolliert absenken.' },
  { id: 45, name_de: 'Beinstrecker', muscle_group: 'Beine', worked_muscles: { Beine: 'primary' }, equipment: 'Maschine', instructions_de: '1. Sitzend, Knöchel auf der Rolle.\n2. Beine strecken.\n3. Langsam absenken.' },
  { id: 46, name_de: 'Romanian Deadlift (Langhantel)', muscle_group: 'Hamstrings', worked_muscles: { Hamstrings: 'primary', Gesäß: 'secondary', LowerBack: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Schulterbreiter Stand, Stange vor dem Körper.\n2. Hüfte nach hinten, Rücken gerade.\n3. Stange an den Beinen entlang absenken.\n4. Aufstehen, Hüfte vorschicken.' },
  { id: 47, name_de: 'Hackenschmidt-Kniebeuge', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Schultern unter den Pads, Füße vorne.\n2. Tief squatten.\n3. Aufstehen.' },
  { id: 48, name_de: 'Step-Ups (Kurzhantel)', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', Hamstrings: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Kurzhanteln seitlich halten.\n2. Einen Fuß auf die Box setzen.\n3. Hochsteigen, nachziehen.\n4. Zurück.' },
  { id: 49, name_de: 'Goblet Squat (Kettlebell)', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', Adduktoren: 'secondary' }, equipment: 'Kettlebell', instructions_de: '1. Kettlebell vor der Brust halten.\n2. Aufrechter Oberkörper.\n3. Tief squatten.' },

  // ── GESÄSS ─────────────────────────────────────────────────
  { id: 50, name_de: 'Hip Thrust (Langhantel)', muscle_group: 'Gesäß', worked_muscles: { Gesäß: 'primary', Hamstrings: 'secondary', LowerBack: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Schultern auf Bank, Stange auf Hüfte.\n2. Füße schulterbreit.\n3. Hüfte nach oben drücken.\n4. Gesäß oben anspannen.\n5. Kontrolliert absenken.' },
  { id: 51, name_de: 'Glute Bridge', muscle_group: 'Gesäß', worked_muscles: { Gesäß: 'primary', Hamstrings: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Auf dem Rücken legen, Knie gebeugt.\n2. Hüfte nach oben drücken.\n3. Gesäß anspannen.' },
  { id: 52, name_de: 'Donkey Kicks', muscle_group: 'Gesäß', worked_muscles: { Gesäß: 'primary', Hamstrings: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Vierfüßlerstand.\n2. Bein nach oben hinten kicken.\n3. Gesäß anspannen, Rücken gerade.' },
  { id: 53, name_de: 'Kabelzug Glute Kickback', muscle_group: 'Gesäß', worked_muscles: { Gesäß: 'primary', Hamstrings: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Fußfessel ans Kabel.\n2. Am Rahmen festhalten.\n3. Bein nach hinten strecken.' },
  { id: 54, name_de: 'Romanian Split Squat', muscle_group: 'Gesäß', worked_muscles: { Gesäß: 'primary', Beine: 'secondary', Hamstrings: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Hinterer Fuß auf Bank, Rumpf aufrecht.\n2. Tiefer absenken als Standard Ausfallschritt.\n3. Hüfte nach vorne schieben beim Aufstehen.' },

  // ── BAUCH ──────────────────────────────────────────────────
  { id: 55, name_de: 'Crunch', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary' }, equipment: 'Körpergewicht', instructions_de: '1. Rückenlage, Knie gebeugt, Hände hinter Kopf.\n2. Schulterblätter anheben.\n3. Langsam absenken.' },
  { id: 56, name_de: 'Plank', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary', LowerBack: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Unterarme und Zehen auf dem Boden.\n2. Körper gerade halten.\n3. Bauch anspannen.' },
  { id: 57, name_de: 'Beinheben (liegend)', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary', Hüftbeuger: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Rückenlage, Beine gestreckt.\n2. Beine senkrecht anheben.\n3. Kontrolliert absenken.' },
  { id: 58, name_de: 'Russian Twist', muscle_group: 'Bauch', worked_muscles: { Obliques: 'primary', Bauch: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Sitzend, Oberkörper 45° zurück.\n2. Beine leicht angehoben.\n3. Hände oder Gewicht seitlich hin und her.' },
  { id: 59, name_de: 'Kabelzug Crunch', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary', Obliques: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Knie auf dem Boden, Seil über den Kopf.\n2. Nach unten beugen.\n3. Bauch kontrahieren.' },
  { id: 60, name_de: 'Ab Wheel Rollout', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary', LowerBack: 'secondary', Schultern: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Knie auf dem Boden, Rad vor sich.\n2. Nach vorne rollen bis fast flach.\n3. Bauch anspannen und zurückziehen.' },
  { id: 61, name_de: 'Hanging Knee Raises', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary', Hüftbeuger: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. An der Stange hängen.\n2. Knie zur Brust anheben.\n3. Kontrolliert absenken.' },
  { id: 62, name_de: 'Dragon Flag', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary', LowerBack: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Auf Bank legen, Stange hinter Kopf festhalten.\n2. Körper gestreckt hochheben.\n3. Kontrolliert absenken, nur Schulterblätter auf Bank.' },

  // ── GANZKÖRPER ─────────────────────────────────────────────
  { id: 63, name_de: 'Burpees', muscle_group: 'Ganzkörper', equipment: 'Körpergewicht', instructions_de: '1. Stehend, Hände auf Boden.\n2. Beine nach hinten springen (Plank).\n3. Liegestütz.\n4. Beine zurückspringen.\n5. Aufspringen und klatschen.' },
  { id: 64, name_de: 'Kettlebell Swing', muscle_group: 'Gesäß', worked_muscles: { Gesäß: 'primary', Hamstrings: 'secondary', LowerBack: 'secondary', Beine: 'secondary' }, equipment: 'Kettlebell', instructions_de: '1. Schulterbreiter Stand, Kettlebell vor dir.\n2. Hüfte nach hinten (Hinge-Bewegung).\n3. Kettlebell zwischen Beinen hindurch.\n4. Hüfte nach vorne schnellen, Kettlebell bis Schulterhöhe.' },
  { id: 65, name_de: 'Clean & Press', muscle_group: 'Ganzkörper', equipment: 'Langhantel', instructions_de: '1. Stange vom Boden hochziehen (Clean).\n2. Auf Schultern auffangen.\n3. Über Kopf drücken.\n4. Zurück auf Schultern und ablegen.' },
  { id: 66, name_de: 'Thrusters', muscle_group: 'Ganzkörper', equipment: 'Langhantel', instructions_de: '1. Stange auf Schultern.\n2. Tief in die Kniebeuge.\n3. Aufstehen und gleichzeitig über Kopf drücken.' },
  { id: 67, name_de: 'Farmer Walk', muscle_group: 'Trapez', worked_muscles: { Trapez: 'primary', Unterarme: 'secondary', LowerBack: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Schwere Kurzhanteln seitlich halten.\n2. Aufrecht gehen.\n3. Schultern zurück, Bauch angespannt.' },

  // ── OBERER RÜCKEN / TRAPEZ ─────────────────────────────────
  { id: 68, name_de: 'Shrugs (Langhantel)', muscle_group: 'Trapez', worked_muscles: { TrapezOben: 'primary', Trapez: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stange vor dem Körper halten.\n2. Schultern so hoch wie möglich heben.\n3. Kurz halten.\n4. Absenken.' },
  { id: 69, name_de: 'Shrugs (Kurzhantel)', muscle_group: 'Trapez', worked_muscles: { TrapezOben: 'primary', Trapez: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Kurzhanteln seitlich.\n2. Schultern hochziehen.\n3. Baucheinziehen ist falsch — nur Schultern.' },
  { id: 70, name_de: 'Reverse Fliegende', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Trapez: 'secondary', Rhomboiden: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Oberkörper 90° vorgebeugt.\n2. Arme seitlich bis Schulterhöhe heben.\n3. Hintere Schulter und Trapez.' },

  // ── WADEN ──────────────────────────────────────────────────
  { id: 71, name_de: 'Wadenheben (stehend)', muscle_group: 'Waden', worked_muscles: { Waden: 'primary' }, equipment: 'Maschine', instructions_de: '1. Schultern unter Pads.\n2. Fersen anheben, auf Zehenspitzen stellen.\n3. Kurz halten.\n4. Kontrolliert absenken.' },
  { id: 72, name_de: 'Wadenheben (sitzend)', muscle_group: 'Waden', worked_muscles: { Waden: 'primary' }, equipment: 'Maschine', instructions_de: '1. Knie unter Pads.\n2. Fersen heben.\n3. Sitzende Variante trainiert vor allem den Soleus.' },
  { id: 73, name_de: 'Einbeiniges Wadenheben', muscle_group: 'Waden', worked_muscles: { Waden: 'primary' }, equipment: 'Körpergewicht', instructions_de: '1. Auf einer Treppenstufe stehen.\n2. Auf einem Fuß heben und senken.' },

  // ── WEITERE RÜCKEN ─────────────────────────────────────────
  { id: 74, name_de: 'Seated Cable Row', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Rhomboiden: 'secondary', Bizeps: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Aufrecht sitzen, Kabel vorne.\n2. Zum Bauch ziehen.\n3. Schulterblätter zusammen.\n4. Kontrolliert ausstrecken.' },
  { id: 75, name_de: 'Rack Pulls', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', LowerBack: 'secondary', Trapez: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stange auf halber Schienenhöhe.\n2. Wie Kreuzheben, aber nur obere Hälfte der Bewegung.\n3. Gut für Rückenentwicklung.' },
  { id: 76, name_de: 'Good Mornings', muscle_group: 'Rücken', worked_muscles: { LowerBack: 'primary', Hamstrings: 'secondary', Gesäß: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stange auf Schultern.\n2. Hüfte nach hinten, Oberkörper bis parallel.\n3. Rücken gerade halten.\n4. Aufstehen.' },
  { id: 77, name_de: 'Wide-Grip Klimmzüge', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', TeresMajor: 'secondary', Bizeps: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Breiter Overhand-Griff.\n2. Brust zur Stange.\n3. Breiter Griff = mehr Latissimus.' },
  { id: 78, name_de: 'Inverted Row', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Rhomboiden: 'secondary', Bizeps: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Stange auf Hüfthöhe.\n2. Darunter hängen, Körper gerade.\n3. Brust zur Stange ziehen.' },

  // ── WEITERE SCHULTERN ──────────────────────────────────────
  { id: 79, name_de: 'Upright Row (Langhantel)', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Trapez: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Enger Griff, Stange vor dem Körper.\n2. Stange zum Kinn ziehen.\n3. Ellbogen höher als die Stange.' },
  { id: 80, name_de: 'Landmine Press', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', BrustMitte: 'secondary', Trizeps: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stange in Ecke oder Landmine-Halterung.\n2. Stange auf Schulter, Einbein-Stance.\n3. Von Schulter nach oben drücken.' },

  // ── WEITERE BRUST ──────────────────────────────────────────
  { id: 81, name_de: 'Cable Crossover', muscle_group: 'Brust', worked_muscles: { BrustUnten: 'primary', BrustMitte: 'secondary', BrustOben: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Zwei Kabel oben, in der Mitte stehen.\n2. Arme schräg nach unten zusammenführen.\n3. Brust kontrahieren.' },
  { id: 82, name_de: 'Enge Liegestütze', muscle_group: 'Brust', worked_muscles: { BrustMitte: 'primary', Trizeps: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Hände schulterbreit oder enger.\n2. Ellbogen nah am Körper.\n3. Fokus auf innere Brust und Trizeps.' },
  { id: 83, name_de: 'Schrägbank Fliegende', muscle_group: 'Brust', worked_muscles: { BrustOben: 'primary', BrustMitte: 'secondary', Schultern: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Bank 30–45°.\n2. Kurzhanteln oben, Arme leicht gebeugt.\n3. Nach unten öffnen.\n4. Zusammenführen.' },

  // ── WEITERE BIZEPS ─────────────────────────────────────────
  { id: 84, name_de: 'Reverse Curl', muscle_group: 'Unterarme', worked_muscles: { Unterarme: 'primary', Brachialis: 'secondary', Bizeps: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Übergriff (Handrücken nach oben).\n2. Curlen wie normal.\n3. Trainiert Unterarme und Bizeps.' },
  { id: 85, name_de: 'Zottman Curl', muscle_group: 'Unterarme', worked_muscles: { Unterarme: 'primary', Bizeps: 'secondary', Brachialis: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Mit Untergriff hoch curlen.\n2. Oben zum Übergriff rotieren.\n3. Langsam absenken.\n4. Trainiert Bizeps + Unterarme.' },
  { id: 86, name_de: 'Cable Hammer Curl', muscle_group: 'Bizeps', worked_muscles: { Brachialis: 'primary', Bizeps: 'secondary', Unterarme: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Seil am unteren Kabelzug.\n2. Neutralgriff.\n3. Curlen.' },

  // ── WEITERE TRIZEPS ────────────────────────────────────────
  { id: 87, name_de: 'Overhead Cable Extension', muscle_group: 'Trizeps', worked_muscles: { TrizepsLang: 'primary', Trizeps: 'secondary', TrizepsLateral: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Seil oben, Rücken zum Gerät.\n2. Nach vorne lehnen.\n3. Arme über Kopf, Seil nach vorne/unten strecken.' },
  { id: 88, name_de: 'Trizeps Kickback', muscle_group: 'Trizeps', worked_muscles: { TrizepsLateral: 'primary', Trizeps: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Oberkörper geneigt, Ellbogen oben fixiert.\n2. Unterarm nach hinten strecken.\n3. Langsam zurück.' },
  { id: 89, name_de: 'JM Press', muscle_group: 'Trizeps', worked_muscles: { TrizepsLang: 'primary', Trizeps: 'secondary', TrizepsLateral: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Wie Skull Crusher, aber Stange etwas zum Gesicht führen.\n2. Trizeps-Fokus.' },

  // ── WEITERE BEINE ──────────────────────────────────────────
  { id: 90, name_de: 'Sumo Deadlift', muscle_group: 'Beine', worked_muscles: { Adduktoren: 'primary', Beine: 'secondary', LowerBack: 'secondary', Hamstrings: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Breiter Stand, Zehen weit nach außen.\n2. Enger Griff in der Mitte.\n3. Wie normales Kreuzheben, aber breitere Beinstellung trainiert Adduktoren mehr.' },
  { id: 91, name_de: 'Pistol Squat', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Ein Bein gestreckt nach vorne.\n2. Auf dem anderen tief squatten.\n3. Aufstehen.' },
  { id: 92, name_de: 'Sissy Squat', muscle_group: 'Beine', worked_muscles: { Beine: 'primary' }, equipment: 'Körpergewicht', instructions_de: '1. Fersen erhöht, Festhalten.\n2. Knie weit nach vorne.\n3. Oberkörper zurück neigen.' },
  { id: 93, name_de: 'Nordic Curl', muscle_group: 'Hamstrings', worked_muscles: { Hamstrings: 'primary', Gesäß: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Knie auf Matte, Füße fixiert.\n2. Kontrolliert nach vorne fallen.\n3. Mit Händen auffangen, zurückdrücken.' },
  { id: 94, name_de: 'Beinpresse (einbeinig)', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Ein Fuß auf der Plattform.\n2. Einbeinig drücken und absenken.' },
  { id: 95, name_de: 'Kniebeuge (Körpergewicht)', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Schulterbreiter Stand.\n2. Hüfte nach hinten und unten.\n3. Oberschenkel parallel.\n4. Aufstehen.' },
  { id: 96, name_de: 'Jump Squat', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Kniebeuge ausführen.\n2. Explosiv nach oben springen.\n3. Weich landen.' },
  { id: 97, name_de: 'Romanian Deadlift (Kurzhantel)', muscle_group: 'Hamstrings', worked_muscles: { Hamstrings: 'primary', Gesäß: 'secondary', LowerBack: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Kurzhanteln vor dem Körper.\n2. Hüfte nach hinten.\n3. Strecken.' },

  // ── KETTLEBELL ─────────────────────────────────────────────
  { id: 98, name_de: 'Kettlebell Clean', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Schultern: 'secondary', Gesäß: 'secondary' }, equipment: 'Kettlebell', instructions_de: '1. Kettlebell zwischen Beinen.\n2. Hochziehen und auf der Schulter auffangen.\n3. Ellbogen zeigt nach vorne.' },
  { id: 99, name_de: 'Kettlebell Snatch', muscle_group: 'Ganzkörper', equipment: 'Kettlebell', instructions_de: '1. Kettlebell zwischen Beinen.\n2. Explosiv hochziehen.\n3. Über Kopf in eine Hand gestoßen.' },
  { id: 100, name_de: 'Türkisches Aufstehen (KB)', muscle_group: 'Ganzkörper', equipment: 'Kettlebell', instructions_de: '1. Rücken auf Matte, KB in einer Hand über Kopf.\n2. Schrittweise aufstehen während KB oben bleibt.\n3. Zurück ablegen.' },
  { id: 101, name_de: 'Goblet Squat (Kurzhantel)', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', Adduktoren: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Kurzhantel vor der Brust.\n2. Tief squatten.\n3. Aufrecht bleiben.' },

  // ── CORE / BAUCH EXTRA ─────────────────────────────────────
  { id: 102, name_de: 'Side Plank', muscle_group: 'Bauch', worked_muscles: { Obliques: 'primary', Bauch: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Auf einem Unterarm abstützen.\n2. Körper gerade halten.\n3. Seitliche Rumpfmuskulatur.' },
  { id: 103, name_de: 'Mountain Climbers', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary', Obliques: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Plank-Position.\n2. Knie abwechselnd zur Brust ziehen.\n3. Schnell oder langsam ausführen.' },
  { id: 104, name_de: 'V-Ups', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary' }, equipment: 'Körpergewicht', instructions_de: '1. Rückenlage, Beine und Arme gestreckt.\n2. Gleichzeitig Beine und Oberkörper anheben.\n3. Hände zu Füßen führen.' },
  { id: 105, name_de: 'Dead Bug', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary', LowerBack: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Rückenlage, Arme senkrecht hoch, Beine 90°.\n2. Gleichzeitig gegenüberliegendes Arm + Bein absenken.\n3. Unterer Rücken am Boden halten.' },
  { id: 106, name_de: 'Kabelzug Woodchopper', muscle_group: 'Bauch', worked_muscles: { Obliques: 'primary', Bauch: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Kabel seitlich oben.\n2. Diagonal nach unten/innen ziehen.\n3. Rotation im Rumpf.' },

  // ── RÜCKEN EXTRA ───────────────────────────────────────────
  { id: 107, name_de: 'Straight-Arm Pulldown', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', TeresMajor: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Kabel oben, Stange oder Seil.\n2. Arme gestreckt nach unten drücken.\n3. Latissimus dehnen und kontrahieren.' },
  { id: 108, name_de: 'Meadows Row', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', TeresMajor: 'secondary', Bizeps: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stange in Landmine, seitlich stehen.\n2. Einarmig zur Hüfte ziehen.\n3. Schulterblatt bewegen.' },
  { id: 109, name_de: 'Chest Supported Row', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Rhomboiden: 'secondary', Trapez: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Brust auf geneigter Bank ablegen.\n2. Griffe zur Brust ziehen.\n3. Schulterblätter zusammen.' },

  // ── FUNKTIONELL ────────────────────────────────────────────
  { id: 110, name_de: 'Box Jump', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', Waden: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Vor der Box stehen.\n2. Explosiv auf die Box springen.\n3. Weich landen, aufstehen.\n4. Kontrolliert hinunterspringen.' },
  { id: 111, name_de: 'Sled Push', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', LowerBack: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Schlitten mit Gewicht beladen.\n2. Griffe nah am Körper.\n3. Aus Hüfte schieben.\n4. Kurze schnelle Schritte.' },
  { id: 112, name_de: 'Battle Rope', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Trapez: 'secondary', Bauch: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Seil in beiden Händen.\n2. Abwechselnd oder gleichzeitig Wellen schlagen.\n3. Knie leicht gebeugt.' },

  // ── WEITERE ────────────────────────────────────────────────
  { id: 113, name_de: 'Pull Apart (Band)', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Trapez: 'secondary', Rhomboiden: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Band vor der Brust in beiden Händen.\n2. Seitlich auseinanderziehen.\n3. Hintere Schulter und Trapez.' },
  { id: 114, name_de: 'Glute Ham Raise', muscle_group: 'Gesäß', worked_muscles: { Gesäß: 'primary', Hamstrings: 'secondary', LowerBack: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Knie auf Pad, Füße fixiert.\n2. Oberkörper nach unten absenken.\n3. Mit Hamstrings und Gesäß zurück.' },
  { id: 115, name_de: 'Preacher Curl (Maschine)', muscle_group: 'Bizeps', worked_muscles: { BizepsKurz: 'primary', Bizeps: 'secondary', Brachialis: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Oberarme auf Pads ablegen.\n2. Curlen.\n3. Gut isoliert.' },
  { id: 116, name_de: 'Pec Deck (Fliegende Maschine)', muscle_group: 'Brust', worked_muscles: { BrustMitte: 'primary', BrustOben: 'secondary', BrustUnten: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Sitzend, Arme auf Pads.\n2. Zusammenführen.\n3. Kontrolliert öffnen.' },
  { id: 117, name_de: 'Smith Machine Squat', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Füße leicht vor der Stange.\n2. Squatten.\n3. Geführte Bewegung.' },
  { id: 118, name_de: 'Smith Machine Bankdrücken', muscle_group: 'Brust', worked_muscles: { BrustMitte: 'primary', BrustOben: 'secondary', BrustUnten: 'secondary', Schultern: 'secondary', Trizeps: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Bank unter Smith Machine.\n2. Stange zur Brust führen.\n3. Drücken.' },
  { id: 119, name_de: 'Abduktor Maschine', muscle_group: 'Beine', worked_muscles: { Abduktoren: 'primary', GesäßMed: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Sitzend, Knie gegen Pads.\n2. Beine auseinander drücken.\n3. Gesäß und Abduktoren.' },
  { id: 120, name_de: 'Adduktor Maschine', muscle_group: 'Beine', worked_muscles: { Adduktoren: 'primary' }, equipment: 'Maschine', instructions_de: '1. Sitzend, Knie gegen Pads.\n2. Beine zusammen drücken.\n3. Innenschenkel.' },
  { id: 121, name_de: 'Rope Face Pull', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Trapez: 'secondary', Rhomboiden: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Seil auf Kopfhöhe.\n2. Zum Gesicht ziehen, Daumen zu den Ohren.\n3. Externe Rotation der Schulter.' },
  { id: 122, name_de: 'Low Cable Row (einarmig)', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Bizeps: 'secondary', TeresMajor: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Kabel unten, einarmig ziehen.\n2. Drehen zur Arbeitsseite.\n3. Schulterblatt bewegen.' },
  { id: 123, name_de: 'High Cable Row', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Trapez: 'secondary', Rhomboiden: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Kabel oben, zurückziehen.\n2. Ellbogen nach hinten unten führen.' },
  { id: 124, name_de: 'Hanging Leg Raise', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary', Hüftbeuger: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. An Stange hängen.\n2. Gerade Beine bis parallel heben.\n3. Kontrolliert absenken.' },
  { id: 125, name_de: 'Windshield Wiper', muscle_group: 'Bauch', worked_muscles: { Obliques: 'primary', Bauch: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Rückenlage, Arme seitlich.\n2. Beine senkrecht.\n3. Seitlich absenken, zurück.' },
  { id: 126, name_de: 'Pallof Press', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary', Obliques: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Seitwärts zum Kabel stehen.\n2. Griff vor die Brust, dann nach vorne strecken.\n3. Anti-Rotationskraft des Core.' },
  { id: 127, name_de: 'Zercher Squat', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', LowerBack: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stange in Ellbogenbeuge.\n2. Arme vor Brust.\n3. Aufrecht squatten.' },
  { id: 128, name_de: 'Trap Bar Deadlift', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', LowerBack: 'secondary', Hamstrings: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. In der Trap Bar stehen.\n2. Griffe seitlich.\n3. Aufstehen wie Kniebeuge/Kreuzheben-Mix.' },
  { id: 129, name_de: 'Single Leg Deadlift', muscle_group: 'Gesäß', worked_muscles: { Gesäß: 'primary', Hamstrings: 'secondary', LowerBack: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Einbeinig stehen.\n2. Oberkörper nach vorne neigen, freies Bein nach hinten.\n3. Kurzhantel absenken, aufstehen.' },
  { id: 130, name_de: 'Hip Abduction (Kabelzug)', muscle_group: 'Gesäß', worked_muscles: { Abduktoren: 'primary', GesäßMed: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Fußfessel am Kabel.\n2. Bein seitlich wegführen.\n3. Gesäß und Abduktoren.' },
  { id: 131, name_de: 'Cable Lateral Raise', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary' }, equipment: 'Kabelzug', instructions_de: '1. Kabel unten, seitlich zum Gerät stehen.\n2. Arm seitlich bis Schulterhöhe heben.' },
  { id: 132, name_de: 'Rear Delt Fly (Maschine)', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Rhomboiden: 'secondary', Trapez: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Sitzend, Brust gegen Pad.\n2. Griffe nach hinten führen.\n3. Hintere Schulter.' },
  { id: 133, name_de: 'Incline Dumbbell Curl', muscle_group: 'Bizeps', worked_muscles: { BizepsLang: 'primary', Bizeps: 'secondary', Brachialis: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Bank auf 60° einstellen.\n2. Arme hängen frei.\n3. Curlen — gute Dehnung am unteren Punkt.' },
  { id: 134, name_de: 'Tate Press', muscle_group: 'Trizeps', worked_muscles: { Trizeps: 'primary', TrizepsLang: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Flach auf Bank, Kurzhanteln über Brust.\n2. Ellbogen weit öffnen.\n3. Kurzhanteln zur Brust senken (Spitze berührt fast Brust).\n4. Strecken.' },
  { id: 135, name_de: 'Cable Crunch (kniend)', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary', Obliques: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Seil über den Kopf halten.\n2. Knie auf Boden.\n3. Nach unten beugen, Ellbogen zu Knien.' },
  { id: 136, name_de: 'Reverse Hyper', muscle_group: 'Gesäß', worked_muscles: { Gesäß: 'primary', LowerBack: 'secondary', Hamstrings: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Bauch auf Hyperextension-Bank.\n2. Beine hängen.\n3. Beine nach oben schwingen.\n4. Gesäß und unterer Rücken.' },
  { id: 137, name_de: 'Sumo Squat (Kurzhantel)', muscle_group: 'Beine', worked_muscles: { Adduktoren: 'primary', Beine: 'secondary', Gesäß: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Breiter Stand, Kurzhantel zwischen Beinen.\n2. Tief squatten.\n3. Innenschenkel betont.' },
  { id: 138, name_de: 'Dragon Flag', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary', LowerBack: 'secondary' }, equipment: 'Körpergewicht', instructions_de: '1. Auf Bank legen, Stange oder Beine hinter Kopf festhalten.\n2. Körper gestreckt hochheben.\n3. Kontrolliert absenken.' },
  { id: 139, name_de: 'Kabelzug Bizeps Curl (sitzend)', muscle_group: 'Bizeps', worked_muscles: { Bizeps: 'primary', BizepsKurz: 'secondary', Brachialis: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Sitzend auf Bank, Kabel auf Bodenhöhe.\n2. Curlen mit konstantem Widerstand.' },
  { id: 140, name_de: 'Lat Pullover (Kurzhantel)', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', TeresMajor: 'secondary', BrustMitte: 'secondary' }, equipment: 'Kurzhantel', instructions_de: '1. Schulterblätter auf Bank, Hüfte hängt.\n2. Kurzhantel über den Kopf absenken.\n3. Zurück über die Brust führen.' },
  { id: 141, name_de: 'Lat Pullover (Kabelzug)', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', TeresMajor: 'secondary', BrustMitte: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Auf Bank legen, Kabelzug über dem Kopf.\n2. Arme gestreckt zur Brust führen.' },
  { id: 142, name_de: 'Cable Hip Extension', muscle_group: 'Gesäß', worked_muscles: { Gesäß: 'primary', Hamstrings: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Fußfessel, am Rahmen festhalten.\n2. Bein nach hinten strecken.' },
  { id: 143, name_de: 'Serratus Crunch', muscle_group: 'Bauch', worked_muscles: { Bauch: 'primary' }, equipment: 'Körpergewicht', instructions_de: '1. Rückenlage, Arme senkrecht.\n2. Schulterblätter aktiv nach oben drücken (Protraktion).\n3. Serratus anterior.' },
  { id: 144, name_de: 'Kabelzug Shrug', muscle_group: 'Trapez', worked_muscles: { TrapezOben: 'primary', Trapez: 'secondary' }, equipment: 'Kabelzug', instructions_de: '1. Kabel auf unterste Position, hinter dem Körper.\n2. Schultern hochziehen.' },
  { id: 145, name_de: 'Push Press', muscle_group: 'Schultern', worked_muscles: { Schultern: 'primary', Trizeps: 'secondary', Beine: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Stange auf Schultern.\n2. Kurze Kniebeuge.\n3. Explosiv strecken und Stange drücken.' },
  { id: 146, name_de: 'Z-Bar Curl', muscle_group: 'Bizeps', worked_muscles: { Bizeps: 'primary', BizepsLang: 'secondary', BizepsKurz: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Z-Bar oder EZ-Curl-Stange.\n2. Supinierter Griff.\n3. Curlen — weniger Belastung auf Handgelenke.' },
  { id: 147, name_de: 'Unterarme Curls (sitzend)', muscle_group: 'Unterarme', worked_muscles: { Unterarme: 'primary' }, equipment: 'Langhantel', instructions_de: '1. Unterarme auf Oberschenkeln.\n2. Handgelenke beugen und strecken.' },
  { id: 148, name_de: 'Box Squat', muscle_group: 'Beine', worked_muscles: { Beine: 'primary', Gesäß: 'secondary', Hamstrings: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Box hinter dir.\n2. Auf Box absenken, kurz setzen.\n3. Explosiv aufstehen.' },
  { id: 149, name_de: 'Close-Grip Lat Pulldown', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Bizeps: 'secondary' }, equipment: 'Maschine', instructions_de: '1. Enger V-Griff.\n2. Zur Brust ziehen.\n3. Ellbogen nah am Körper.' },
  { id: 150, name_de: 'Pendlay Row', muscle_group: 'Rücken', worked_muscles: { Rücken: 'primary', Trapez: 'secondary', Rhomboiden: 'secondary' }, equipment: 'Langhantel', instructions_de: '1. Oberkörper parallel zum Boden.\n2. Stange vom Boden explosiv hochziehen.\n3. Zurück auf Boden ablegen.' },
];

export const MUSCLE_GROUPS = ['Alle', 'Brust', 'Rücken', 'Trapez', 'Schultern', 'Bizeps', 'Trizeps', 'Unterarme', 'Beine', 'Hamstrings', 'Waden', 'Gesäß', 'Bauch', 'Ganzkörper'];
export const EQUIPMENT_TYPES = ['Alle', 'Langhantel', 'Kurzhantel', 'Kabelzug', 'Maschine', 'Körpergewicht', 'Kettlebell'];

// MaterialCommunityIcons-Name pro Muskelgruppe (ersetzt frühere Emojis)
const MUSCLE_ICON = {
  Brust: 'arm-flex', BrustOben: 'arm-flex', BrustMitte: 'arm-flex', BrustUnten: 'arm-flex',
  Rücken: 'weight-lifter', LowerBack: 'weight-lifter', Trapez: 'arm-flex', TrapezOben: 'arm-flex', Rhomboiden: 'arm-flex', TeresMajor: 'arm-flex',
  Schultern: 'arm-flex',
  Bizeps: 'arm-flex', BizepsLang: 'arm-flex', BizepsKurz: 'arm-flex', Brachialis: 'arm-flex',
  Trizeps: 'arm-flex', TrizepsLang: 'arm-flex', TrizepsLateral: 'arm-flex',
  Unterarme: 'arm-flex',
  Beine: 'run', Hamstrings: 'run', Waden: 'run', Adduktoren: 'run', Abduktoren: 'run',
  Gesäß: 'run', GesäßMed: 'run',
  Bauch: 'dumbbell', Obliques: 'dumbbell',
  Nacken: 'arm-flex', Hüftbeuger: 'run', Ganzkörper: 'human-handsup',
};
export const muscleIcon = (group) => MUSCLE_ICON[group] || 'dumbbell';

export const MUSCLE_COLORS = {
  // Brust
  Brust: '#E8C547', BrustOben: '#F0C030', BrustMitte: '#E8C547', BrustUnten: '#D4A820',
  // Rücken
  Rücken: '#4CAF50', LowerBack: '#2E7D32', Trapez: '#06B6D4', TrapezOben: '#0891B2',
  Rhomboiden: '#0E7490', TeresMajor: '#0D9488',
  // Schultern
  Schultern: '#2196F3',
  // Arme
  Bizeps: '#FF9800', BizepsLang: '#FB8C00', BizepsKurz: '#E65100', Brachialis: '#F57C00',
  Trizeps: '#F44336', TrizepsLang: '#E53935', TrizepsLateral: '#C62828',
  Unterarme: '#F59E0B',
  // Beine
  Beine: '#9C27B0', Hamstrings: '#8B5CF6', Waden: '#7C3AED',
  Adduktoren: '#7B1FA2', Abduktoren: '#AB47BC', Hüftbeuger: '#9C27B0',
  // Gesäß + Core
  Gesäß: '#E91E63', GesäßMed: '#C2185B',
  Bauch: '#00BCD4', Obliques: '#00838F',
  // Sonstiges
  Nacken: '#78909C', Ganzkörper: '#FF5722',
};

// Mapping von deutschen Übungsnamen → muscles.wiki Slug
const GIF_SLUGS = {
  'Bankdrücken (Langhantel)': 'barbell-bench-press',
  'Bankdrücken (Kurzhantel)': 'dumbbell-bench-press',
  'Schrägbankdrücken (Langhantel)': 'incline-barbell-bench-press',
  'Schrägbankdrücken (Kurzhantel)': 'incline-dumbbell-press',
  'Fliegende (Kurzhantel)': 'dumbbell-fly',
  'Kabelzug Fliegende': 'cable-fly',
  'Dips (Brust)': 'chest-dip',
  'Liegestütze': 'push-up',
  'Klimmzüge (Überhand)': 'pull-up',
  'Klimmzüge (Unterhand)': 'chin-up',
  'Latzug (breiter Griff)': 'lat-pulldown',
  'Latzug (enger Griff)': 'close-grip-lat-pulldown',
  'Rudern (Langhantel)': 'barbell-row',
  'Rudern (Kurzhantel)': 'dumbbell-row',
  'Kabelzug Rudern (sitzend)': 'seated-cable-row',
  'Hyperextension': 'back-extension',
  'Kreuzheben (konventionell)': 'deadlift',
  'Kreuzheben (Rumänisch)': 'romanian-deadlift',
  'Schulterdrücken (Langhantel)': 'barbell-overhead-press',
  'Schulterdrücken (Kurzhantel)': 'dumbbell-shoulder-press',
  'Seitheben': 'dumbbell-lateral-raise',
  'Frontheben': 'dumbbell-front-raise',
  'Kniebeugen (Langhantel)': 'barbell-squat',
  'Front Squat': 'front-squat',
  'Beinpresse': 'leg-press',
  'Ausfallschritte (Kurzhantel)': 'dumbbell-lunge',
  'Beinstrecker (Maschine)': 'leg-extension',
  'Beinbeuger (Maschine)': 'leg-curl',
  'Wadenheben (stehend)': 'standing-calf-raise',
  'Bizepscurl (Langhantel)': 'barbell-curl',
  'Bizepscurl (Kurzhantel)': 'dumbbell-curl',
  'Hammercurl': 'hammer-curl',
  'Trizepsdrücken (Kabelzug)': 'cable-tricep-pushdown',
  'Trizepsdrücken (Kurzhantel, einarmig)': 'tricep-pushdown',
  'Skull Crusher (Langhantel)': 'skull-crusher',
  'Dips (Trizeps)': 'tricep-dip',
  'Crunches': 'crunch',
  'Sit-Ups': 'sit-up',
  'Plank': 'plank',
  'Russian Twist': 'russian-twist',
  'Beinheben (liegend)': 'leg-raise',
  'Hip Thrust': 'barbell-hip-thrust',
  'Glute Bridge': 'glute-bridge',
  'Donkey Kicks': 'donkey-kick',
};

// Bestätigte Bild-URLs von wger.de (Everkinetic-Illustrationen, PNG)
export const WGER_IMAGE_URLS = {
  'Bankdrücken (Langhantel)': 'https://wger.de/media/exercise-images/192/Bench-press-1.png',
  'Bankdrücken (Kurzhantel)': 'https://wger.de/media/exercise-images/97/Dumbbell-bench-press-1.png',
  'Schrägbankdrücken (Langhantel)': 'https://wger.de/media/exercise-images/41/Incline-bench-press-1.png',
  'Schrägbankdrücken (Kurzhantel)': 'https://wger.de/media/exercise-images/16/Incline-press-1.png',
  'Fliegende (Kurzhantel)': 'https://wger.de/media/exercise-images/238/2fc242d3-5bdd-4f97-99bd-678adb8c96fc.png',
  'Kabelzug Fliegende': 'https://wger.de/media/exercise-images/122/Incline-cable-flyes-1.png',
  'Dips (Brust)': 'https://wger.de/media/exercise-images/83/Bench-dips-1.png',
  'Dips (Trizeps)': 'https://wger.de/media/exercise-images/83/Bench-dips-1.png',
  'Hyperextension': 'https://wger.de/media/exercise-images/128/Hyperextensions-1.png',
  'Kreuzheben (konventionell)': 'https://wger.de/media/exercise-images/161/Dead-lifts-2.png',
  'Front Squat': 'https://wger.de/media/exercise-images/191/Front-squat-1-857x1024.png',
  'Ausfallschritte (Kurzhantel)': 'https://wger.de/media/exercise-images/113/Walking-lunges-1.png',
  'Beinbeuger (Maschine)': 'https://wger.de/media/exercise-images/154/lying-leg-curl-machine-large-1.png',
  'Beinstrecker (Maschine)': 'https://wger.de/media/exercise-images/369/78c915d1-e46d-4d30-8124-65d68664c3ef.png',
  'Beinpresse': 'https://wger.de/media/exercise-images/371/d2136f96-3a43-4d4c-9944-1919c4ca1ce1.webp',
  'Wadenheben (stehend)': 'https://wger.de/media/exercise-images/622/9a429bd0-afd3-4ad0-8043-e9beec901c81.jpeg',
  'Schulterdrücken (Langhantel)': 'https://wger.de/media/exercise-images/119/seated-barbell-shoulder-press-large-1.png',
  'Schulterdrücken (Kurzhantel)': 'https://wger.de/media/exercise-images/123/dumbbell-shoulder-press-large-1.png',
  'Schulterdrücken (Maschine)': 'https://wger.de/media/exercise-images/53/Shoulder-press-machine-2.png',
  'Seitheben': 'https://wger.de/media/exercise-images/148/lateral-dumbbell-raises-large-2.png',
  'Frontheben': 'https://wger.de/media/exercise-images/256/b7def5bc-2352-499b-b9e5-fff741003831.png',
  'Plank': 'https://wger.de/media/exercise-images/458/b7bd9c28-9f1d-4647-bd17-ab6a3adf5770.png',
  'Crunches': 'https://wger.de/media/exercise-images/91/Crunches-1.png',
  'Beinheben (liegend)': 'https://wger.de/media/exercise-images/125/Leg-raises-2.png',
  'Russian Twist': 'https://wger.de/media/exercise-images/176/Cross-body-crunch-1.png',
  'Bizepscurl (Langhantel)': 'https://wger.de/media/exercise-images/74/Bicep-curls-1.png',
  'Bizepscurl (Kurzhantel)': 'https://wger.de/media/exercise-images/81/Biceps-curl-1.png',
  'Hammercurl': 'https://wger.de/media/exercise-images/86/Bicep-hammer-curl-1.png',
  'Preacher Curl (Maschine)': 'https://wger.de/media/exercise-images/193/Preacher-curl-3-1.png',
  'Trizepsdrücken (Kabelzug)': 'https://wger.de/media/exercise-images/84/Lying-close-grip-triceps-press-to-chin-1.png',
  'Skull Crusher (Langhantel)': 'https://wger.de/media/exercise-images/84/Lying-close-grip-triceps-press-to-chin-1.png',
  'Klimmzüge (Überhand)': 'https://wger.de/media/exercise-images/475/b0554016-16fd-4dbe-be47-a2a17d16ae0e.jpg',
  'Klimmzüge (Unterhand)': 'https://wger.de/media/exercise-images/475/b0554016-16fd-4dbe-be47-a2a17d16ae0e.jpg',
  'Latzug (breiter Griff)': 'https://wger.de/media/exercise-images/158/02e8a7c3-dc67-434e-a4bc-77fdecf84b49.webp',
  'Latzug (enger Griff)': 'https://wger.de/media/exercise-images/158/02e8a7c3-dc67-434e-a4bc-77fdecf84b49.webp',
  'Rudern (Langhantel)': 'https://wger.de/media/exercise-images/109/Barbell-rear-delt-row-1.png',
  'Rudern (Kurzhantel)': 'https://wger.de/media/exercise-images/109/Barbell-rear-delt-row-1.png',
  'Kabelzug Rudern (sitzend)': 'https://wger.de/media/exercise-images/143/Cable-seated-rows-2.png',
  'Push Press': 'https://wger.de/media/exercise-images/478/70a2d72c-a822-45f3-8de2-54ea85951b84.jpg',
  'Sumo Deadlift': 'https://wger.de/media/exercise-images/630/b0f0c7d8-5878-4d9e-b820-21acc013741d.webp',
};

export function getExerciseImageUrl(exercise) {
  return WGER_IMAGE_URLS[exercise.name_de] || null;
}

export default EXERCISES;
