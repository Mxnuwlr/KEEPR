/**
 * data/legal.js — Rechtstexte (Datenschutzerklärung + Nutzungsbedingungen)
 *
 * Wird von LegalScreen (Einstellungen → Rechtliches) und dem
 * Registrierungs-Consent im AuthScreen verwendet.
 * Struktur: Array von Abschnitten { title, text } — Nummerierung macht das UI.
 *
 * HINWEIS: Vorlage ohne Rechtsberatung — vor App-Store-Launch von einem
 * Anwalt oder Datenschutz-Generator (z.B. eRecht24) gegenprüfen lassen.
 */

export const LEGAL_STAND = '7. Juli 2026';

export const LEGAL_CONTACT = 'manuwilli12@gmail.com';

export const PRIVACY_SECTIONS = [
  {
    title: 'Verantwortlicher',
    text: `Verantwortlich für die Datenverarbeitung in der App keepr ist:\n\nManuel (privater App-Betreiber)\nKontakt: ${LEGAL_CONTACT}\n\nBei Fragen zum Datenschutz kannst du dich jederzeit an diese Adresse wenden.`,
  },
  {
    title: 'Welche Daten wir verarbeiten',
    text: 'Kontodaten: Username, Anzeigename und dein Passwort (ausschließlich als sicherer Hash gespeichert).\n\nGesundheits- und Fitnessdaten: Körperdaten (Gewicht, Größe, Körperfett, Muskelmasse), Trainings- und Ernährungseinträge, Mobility-Ergebnisse, tägliche Check-ins (Schlaf, Stress, Energie, Muskelkater) sowie — nur wenn du die Funktion aktiv nutzt — Fortschrittsfotos.\n\nHaushaltsdaten: Inventar, Rezepte und Einkaufsliste, geteilt mit Mitgliedern deines Haushalts.\n\nEs werden keine Werbe-Tracker und keine Analyse-Dienste (z.B. Google Analytics) eingesetzt.',
  },
  {
    title: 'Zwecke und Rechtsgrundlagen',
    text: 'Wir verarbeiten deine Daten ausschließlich, um die Funktionen der App bereitzustellen: Kalorien- und Trainingsplanung, Inventarverwaltung, Fortschritts-Tracking und Coaching-Empfehlungen (Art. 6 Abs. 1 lit. b DSGVO — Vertragserfüllung).\n\nGesundheitsdaten (z.B. Gewicht, Trainingsdaten, Fortschrittsfotos) verarbeiten wir nur auf Grundlage deiner ausdrücklichen Einwilligung bei der Registrierung (Art. 9 Abs. 2 lit. a DSGVO). Du kannst diese Einwilligung jederzeit widerrufen, indem du dein Konto löschst.',
  },
  {
    title: 'KI-Funktionen (Google Gemini)',
    text: 'Für KI-Funktionen (Rezeptvorschläge, Trainingsplan-Erstellung, Foto-Analysen wie Kassenzettel-, Kühlschrank- oder Fortschrittsfoto-Auswertung) werden die dafür nötigen Daten — z.B. dein Sportprofil, Ernährungseinträge oder das jeweilige Foto — an die Google Gemini API übermittelt und dort verarbeitet.\n\nDie Übermittlung erfolgt über unseren Server; dein Name und deine Zugangsdaten werden dabei nicht mitgesendet. Google kann die Daten auf Servern außerhalb der EU (u.a. USA) verarbeiten. KI-Funktionen sind optional — sie laufen nur, wenn du sie aktiv auslöst.',
  },
  {
    title: 'Verbundene Dienste (optional)',
    text: 'Nur wenn du sie selbst verbindest, tauscht die App Daten mit Drittdiensten aus:\n\n• Strava (Aktivitäten-Import)\n• Intervals.icu (Trainingsbelastung)\n• Oura (Schlaf- und Readiness-Daten)\n• Open Food Facts (Produktdatenbank für Barcode-Scans — dabei wird nur der Barcode übermittelt)\n\nFür diese Dienste gelten zusätzlich deren eigene Datenschutzerklärungen. Du kannst Verbindungen jederzeit in der App trennen.',
  },
  {
    title: 'Speicherung und Sicherheit',
    text: 'Deine Daten werden auf einem privat betriebenen keepr-Server gespeichert. Die Übertragung erfolgt verschlüsselt (HTTPS/TLS).\n\nZugangsdaten auf deinem Gerät (Login-Token, API-Schlüssel verbundener Dienste) werden verschlüsselt im Schlüsselbund deines Geräts (iOS Keychain bzw. Android Keystore) abgelegt.',
  },
  {
    title: 'Speicherdauer und Löschung',
    text: 'Deine Daten bleiben gespeichert, solange dein Konto besteht.\n\nDu kannst dein Konto samt aller serverseitig gespeicherten Daten jederzeit selbst löschen: Einstellungen → „Konto endgültig löschen". Die Löschung ist unwiderruflich und wirkt sofort. Zusätzlich kannst du mit „Alle Daten löschen" die lokalen Daten auf deinem Gerät entfernen.',
  },
  {
    title: 'Deine Rechte',
    text: 'Nach der DSGVO hast du das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21).\n\nDeine Trainings- und Ernährungsdaten kannst du direkt in der App als CSV exportieren. Für alle weiteren Anliegen genügt eine formlose Nachricht an die oben genannte Kontaktadresse. Außerdem hast du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.',
  },
  {
    title: 'Änderungen dieser Erklärung',
    text: 'Wir passen diese Datenschutzerklärung an, wenn sich Funktionen der App oder rechtliche Anforderungen ändern. Die jeweils aktuelle Fassung findest du jederzeit in der App unter Einstellungen → Rechtliches.',
  },
];

export const TERMS_SECTIONS = [
  {
    title: 'Geltungsbereich',
    text: 'Diese Nutzungsbedingungen gelten für die Nutzung der App keepr. Mit der Registrierung erklärst du dich mit ihnen einverstanden.',
  },
  {
    title: 'Leistungsbeschreibung',
    text: 'keepr ist eine App für Ernährungs-, Trainings- und Haushaltsplanung mit KI-Unterstützung. Die App befindet sich in aktiver Entwicklung; ein Anspruch auf ständige Verfügbarkeit, Fehlerfreiheit oder den Fortbestand einzelner Funktionen besteht nicht.',
  },
  {
    title: 'Konto und Pflichten',
    text: 'Du bist für die Geheimhaltung deiner Zugangsdaten selbst verantwortlich. Pro Person ist ein Konto vorgesehen. Es ist untersagt, die App zu missbrauchen, insbesondere durch Manipulationsversuche, automatisierte Massenzugriffe oder das Einstellen rechtswidriger Inhalte.',
  },
  {
    title: 'Kein medizinischer Rat',
    text: 'Alle Inhalte der App — insbesondere Kalorienziele, Trainingspläne, Coaching-Hinweise und KI-Analysen (z.B. Körperfett-Schätzungen) — dienen ausschließlich der allgemeinen Information und Motivation. Sie sind keine medizinische, ernährungswissenschaftliche oder therapeutische Beratung und ersetzen keinen Arztbesuch.\n\nSprich Ernährungsumstellungen und intensives Training bei gesundheitlichen Einschränkungen, Schwangerschaft oder Essstörungen vorab mit einer Ärztin oder einem Arzt ab. Bei Schmerzen oder Warnsignalen: Training abbrechen.',
  },
  {
    title: 'KI-generierte Inhalte',
    text: 'Teile der App-Inhalte (Rezepte, Trainingspläne, Analysen) werden durch künstliche Intelligenz erzeugt. KI-Ausgaben können ungenau oder fehlerhaft sein — prüfe sie mit gesundem Menschenverstand, insbesondere Angaben zu Zutaten (Allergien!), Nährwerten und Belastungsempfehlungen.',
  },
  {
    title: 'Haftung',
    text: 'Die App wird privat und unentgeltlich bereitgestellt. Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper und Gesundheit. Im Übrigen ist die Haftung auf die Verletzung wesentlicher Vertragspflichten beschränkt und der Höhe nach auf den vorhersehbaren, vertragstypischen Schaden begrenzt.',
  },
  {
    title: 'Beendigung',
    text: 'Du kannst die Nutzung jederzeit beenden und dein Konto in den Einstellungen unwiderruflich löschen. Wir können Konten bei Missbrauch sperren oder löschen.',
  },
  {
    title: 'Änderungen und Schlussbestimmungen',
    text: 'Wir können diese Bedingungen mit Wirkung für die Zukunft anpassen; über wesentliche Änderungen informieren wir in der App. Es gilt deutsches Recht. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.',
  },
];
