# Datenschutzerklärung — KEEPR

> **ENTWURF — vor Veröffentlichung prüfen (idealerweise anwaltlich) und alle `[PLATZHALTER]` ersetzen.**
> Stand: 2026-07-01

## Verantwortlicher (Impressum)

Verantwortlich für die Datenverarbeitung im Sinne der DSGVO:

- **Name:** [PLATZHALTER: Vor- und Nachname]
- **Anschrift:** [PLATZHALTER: Straße, Hausnr., PLZ, Ort] *(in Deutschland Pflichtangabe — auch für App-Betreiber)*
- **E-Mail:** support@keepr-app.de
- **Website:** https://keepr-app.de

*(Hinweis: Für die Veröffentlichung im App Store und den Betrieb einer Website ist in Deutschland ein
Impressum mit ladungsfähiger Anschrift gesetzlich vorgeschrieben. Eine reine E-Mail-Adresse genügt nicht.)*

---

## 1. Überblick

KEEPR ist eine App für Ernährungs-, Trainings- und Körpertracking. Für die Kernfunktionen verarbeiten
wir personenbezogene Daten, darunter **Gesundheitsdaten** (besondere Kategorie nach Art. 9 DSGVO).
Die Verarbeitung erfolgt ausschließlich zur Bereitstellung der von dir genutzten Funktionen.

Deine Daten werden auf einem von uns betriebenen Server (Standort: [PLATZHALTER: Deutschland /
Standort des Raspberry-Pi-Servers]) gespeichert und nicht zu Werbezwecken verkauft oder weitergegeben.

## 2. Welche Daten wir verarbeiten

**a) Kontodaten**
- E-Mail-Adresse / Benutzername
- Passwort (nur als kryptografischer Hash — wir sehen dein Klartext-Passwort nie)

**b) Profil- & Sportdaten**
- Alter, Geschlecht, Größe, Gewicht, Trainingsziele, Hauptsportarten, Aktivitätslevel

**c) Gesundheits- & Fitnessdaten (Art. 9 DSGVO)**
- Gewichts-/Körperfett-/Muskelmasse-Verlauf
- Schlaf, Stress, Energie, Muskelkater, Erholung (Check-in)
- Ruhepuls / Readiness aus verbundenen Geräten (sofern verbunden)
- Mobility-Testergebnisse
- **Fortschrittsfotos** (optional, nur wenn du sie aufnimmst)

**d) Ernährungsdaten**
- Kalorien-/Mahlzeiten-Logs, Lebensmittel-Inventar, Einkaufsliste, Rezepte

**e) Trainingsdaten**
- Trainingspläne, absolvierte Workouts, Kraft-Sätze, persönliche Rekorde

**f) Daten aus verbundenen Diensten** (nur wenn du sie aktiv verbindest)
- Strava, Intervals.icu, Oura (und ggf. künftig Garmin): Aktivitäten, Trainingslast, Schlaf-/Erholungswerte

**g) Technische Daten**
- IP-Adresse (serverseitig temporär zur Absicherung/Rate-Limiting), Zeitpunkt von Zugriffen

## 3. Zwecke & Rechtsgrundlagen

| Zweck | Rechtsgrundlage |
|---|---|
| Bereitstellung der App-Funktionen (Konto, Tracking, Pläne) | Art. 6 Abs. 1 lit. b DSGVO (Vertrag) |
| Verarbeitung von Gesundheitsdaten | Art. 9 Abs. 2 lit. a DSGVO (**ausdrückliche Einwilligung**) |
| KI-gestützte Ernährungs-/Trainingsplanung & Fotoanalyse | Art. 6 Abs. 1 lit. b + Art. 9 Abs. 2 lit. a DSGVO |
| Absicherung des Servers (Rate-Limiting, Logs) | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) |

Deine Einwilligung in die Verarbeitung von Gesundheitsdaten und in die KI-Analyse kannst du jederzeit
mit Wirkung für die Zukunft widerrufen (z. B. durch Deaktivieren der Funktion oder Löschen des Kontos).

## 4. Empfänger / Auftragsverarbeiter & Drittdienste

Bei bestimmten Funktionen werden Daten an folgende Dienste übermittelt:

- **Google (Gemini API):** KI-Erstellung von Mahlzeiten-/Trainingsplänen und **Analyse von Fortschrittsfotos**.
  Übermittelt werden die für die jeweilige Funktion nötigen Eingaben (z. B. Profil-Eckdaten, Fotos).
  → *Datenübermittlung ggf. in Drittländer (USA); Grundlage: Standardvertragsklauseln.*
- **OpenFoodFacts:** Nachschlagen von Lebensmitteln/Barcodes (es wird nur der Suchbegriff/Barcode übermittelt).
- **Strava / Intervals.icu / Oura / (Garmin):** nur bei aktiver Verbindung durch dich; Austausch von Trainings-/Gesundheitsdaten.
- **Cloudflare:** Bereitstellung/Absicherung der Serververbindung (Proxy/Tunnel); verarbeitet dabei Verbindungsdaten/IP.
- **Apple (App Store):** Bereitstellung der App; Apple verarbeitet eigene Daten gemäß Apple-Datenschutz.

Wir verkaufen keine Daten und setzen **keine Werbe-/Tracking-SDKs** ein.

## 5. Speicherdauer

Wir speichern deine Daten, solange dein Konto besteht. Bei **Löschung des Kontos** werden alle
zugehörigen Daten (inkl. Fortschrittsfotos) unverzüglich und vollständig serverseitig gelöscht.
Technische Server-Logs werden nach [PLATZHALTER: z. B. 7–14] Tagen automatisch entfernt.

## 6. Deine Rechte

Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung
(Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) sowie das Recht, eine erteilte
Einwilligung zu widerrufen (Art. 7 Abs. 3). Zudem kannst du dich bei einer Datenschutz-Aufsichtsbehörde
beschweren (Art. 77).

**Konto & Daten löschen:** In der App unter *Einstellungen → Konto endgültig löschen*. Dies entfernt
alle deine Daten unwiderruflich vom Server.

Anfragen richte bitte an: support@keepr-app.de

## 7. Datensicherheit

Übertragung verschlüsselt via HTTPS; Passwörter nur als Hash (bcrypt); Zugriff auf deine Daten nur mit
gültigem Authentifizierungs-Token; sensible Tokens auf dem Gerät im Schlüsselbund (Keychain/Keystore).
Der Server ist gehärtet (u. a. Rate-Limiting, strikte Zugriffskontrollen, keine Weitergabe von API-Schlüsseln an Clients).

## 8. Kinder

Die App richtet sich nicht an Personen unter 16 Jahren.

## 9. Änderungen

Wir passen diese Erklärung an, wenn sich Funktionen oder Rechtslage ändern. Die jeweils aktuelle Version
ist in der App und unter https://keepr-app.de/datenschutz abrufbar.
