# KEEPR — Claude Code Projektdokumentation

## Was ist KEEPR?
Eine React Native / Expo App für deutschsprachige Ausdauer- und Kraftsportler.
Kombiniert KI-gestützte Ernährungsplanung, Inventarverwaltung, Trainingsplanung und Körpertracking in einer App.

## Tech Stack
- **Frontend:** React Native (Expo ~55), React 19
- **State:** Zustand (zwei Stores: `src/store/index.js` + `src/store/kraftStore.js`)
- **Navigation:** React Navigation v7 (Bottom Tabs + Native Stack)
- **KI:** Google Gemini (Key liegt in AsyncStorage im Backend auf dem Raspi)
- **Styling:** Custom Theme-System (`src/theme/index.js`) mit Light/Dark Mode
- **Persistenz:** AsyncStorage für lokale Daten + eigenes Backend

## Backend
- Läuft auf einem Raspberry Pi, ist von überall erreichbar
- API Base URL ist aktuell hardcoded in `src/api/client.js`
- Muss auf die externe Adresse des Pi umgestellt werden (Phase 1 Task)

## Git Branch
- Feature-Branch: `claude/continue-app-development-HE6dd`
- Alle Änderungen auf diesen Branch pushen

## Coaching-Engine (`src/utils/coaching.js`)
Personalisierte Tagesziele — täglich neu berechnet aus:
- **Schlaf** (sleepHours → Multiplikator ±3%)
- **Stress** (stressLevel 1–5 → bis +160 kcal Cortisol-Puffer)
- **Trainingsintensität** (rest/easy/medium/hard/race → bis +660 kcal + Carb-Loading-Split)
- **Gewichts-Trend** (zu schnell abnehmen → +300 kcal; Plateau bei Abnehm-Ziel → -150 kcal)
- **Makro-Split** dynamisch: Ruhetag 30/35/35, Trainingstag bis 45/28/27 (Carbs/P/F)
- Mindest-Protein: 1.9g/kg Körpergewicht

**Daily Check-in** — einmal täglich auf HomeScreen (Schlaf + Stress + Energie)
- Persistiert in AsyncStorage + via `api.saveDailyLog()` ans Backend
- `store.dailyContext` State — wird in HomeScreen + CaloriesScreen genutzt
- Meal Plan (`generateMealPlanWithGemini`) bekommt `coachingContext` String (neuer optionaler Parameter)

## Trainingsstatus-Analyse (`src/utils/trainingStatus.js`)
`analyzeTrainingStatus({ kraftSessions, externalData, manualOverride })` — bewertet die jüngste
Trainingshistorie, damit Plan & Kalorien sich an die reale Belastung anpassen ("perfekter Personal Coach").
- **Pausenerkennung**: `isReturningFromBreak` = letztes Training (Kraft-Session ODER Intervals.icu-Aktivität)
  ≥14 Tage her, ODER manueller Override aktiv. `breakWeeks` für UI/Prompt.
- **Volumen-Trend**: `volumeTrendPct` vergleicht Kraft-Volumen der letzten 14 Tage mit den 14 Tagen davor.
- **Belastungslevel** (`loadLevel`): `unbekannt|sehr_niedrig|niedrig|normal|hoch`, abgeleitet aus
  Pausenstatus + `recentSessionsCount14d`.
- **TSB** (Intervals.icu `tsb`): `tsbStatus` `ermuedet`(<-10) / `ausgeglichen` / `erholt`(>5).
- `summaryDe` — kurzer Status-Text fürs UI (z.B. "Wiedereinstieg nach 6 Wochen Pause").
- `promptContext` — wird in `store.generateTrainingPlan()` **vor** allem anderen Kontext in den
  Gemini-Prompt eingefügt (höchste Priorität, z.B. "Volumen diese Woche um 50-60% reduzieren").
- `getTrainingStatusIcon()`/`getTrainingStatusColor()` — Feather-Icon + Theme-Farbe fürs Status-Badge.

**Manueller Override** — Checkbox "Ich starte nach einer Pause neu" in TrainingScreen
(Generieren-Modal) → `store.setReturnFromBreak(active)`, persistiert in AsyncStorage
(`training_return_override`), läuft nach 21 Tagen automatisch ab.

**Integration**:
- `calculateDailyTargets(user, dailyCtx, weightTrend, trainingType, trainingStatus)` — 5. Param (optional,
  backward-compatible). Deckelt Trainingsbonus + Regenerations-Zuschlag bei Wiedereinstieg, reduziert Bonus
  bei geringem Volumen, Erholungs-Zuschlag bei Ermüdung. Neuer `statusNote` in `adjustmentReasons`.
- HomeScreen + CaloriesScreen: `trainingStatus` via `useMemo`, HomeScreen zeigt Status-Badge in der
  "DEIN TAG"-Karte.
- TrainingScreen: Status-Hinweis + Override-Checkbox im Generieren-Modal, `trainingStatus` als 5. Argument
  an `generateTrainingPlan()`.

## Aktueller App-Status: ~88-90% fertig

### Was läuft gut:
- Kalorienzählung + KI-Mahlzeitenplan (jetzt coaching-aware)
- Inventar mit MHD-Tracking + Barcode-Scanner
- KI-Trainingsplan mit Wochenstruktur
- Kraft-Modul (Routinen, Live-Workout, PRs)
- Personalisierter Tagesplan (Coaching-Engine)
- Ziele & Kalender, Profil, Onboarding, Auth
- Dark Mode + deutsches UI

### Bekannte Lücken:
- Exercise-Picker Modal im Live-Workout fehlt
- API Base URL hardcoded
- Household geteilte Ansicht fehlt
- Strava/Garmin Sync fehlt
- Timer Pause/Resume im Live-Workout fehlt
- Einstellungen-Screen unvollständig

---

## ROADMAP

### Phase 1 — Critical Fixes ✅
- [x] 1.1 API Base URL konfigurierbar machen (EinstellungenScreen + AsyncStorage, `getBaseUrl()`/`setBaseUrl()` in client.js)
- [x] 1.2 Exercise-Picker Modal im Live-Workout (war bereits implementiert)
- [x] 1.3 Einstellungen-Screen fertigstellen (Verbindung-Sektion mit Server-URL hinzugefügt)
- [x] 1.4 Timer Pause/Resume im Live-Workout (war bereits implementiert via `togglePause`)

### Phase 2 — UX Polish
- [x] 2.1 Weight-Trend Grafik (LineChart in KoerperScreen, Min/Max/Trend-Anzeige)
- [x] 2.2 Routine Folders (war bereits implementiert)
- [x] 2.3 1RM Visualisierung in KraftStats (war bereits implementiert)
- [x] 2.4 Rezept-Bilder hochladen (war bereits implementiert via expo-image-picker)
- [x] 2.5 Globales Error-Handling (ErrorBoundary in `src/components/ErrorBoundary.js`, wraps App root)

### Phase 3 — Neue Features
- [x] 3.1 Household-Ansicht (HouseholdScreen.js: Mitglieder, geteilte Einkaufsliste, Invite-Code teilen)
- [x] 3.2 Push Notifications (lokale Notifications in `src/notifications.js`, Toggle in EinstellungenScreen)
  - ⚠️ Expo Go SDK 55: `ExpoPushTokenManager` fehlt → Notifications silently deaktiviert + Hinweis-Alert
  - Funktioniert erst nach EAS Build / Dev Client
- [x] 3.3 Strava Sync (war bereits implementiert; Garmin/Apple Health/Polar als "Bald" markiert)
- [x] 3.4 Export (CSV) — Training + Kalorien via `Share` API in EinstellungenScreen

### Phase 4 — Production Readiness
- [x] 4.1 Gemini Key sicher speichern — bleibt AsyncStorage (SecureStore braucht native Module, nicht in Expo Go verfügbar)
- [x] 4.2 Performance-Optimierung (useMemo für `filtered`/`expiring`/`FILTERS` in InventoryScreen, `grouped`/`macros` in CaloriesScreen)
- [x] 4.3 Error Boundaries (via ErrorBoundary in App.js)
- [ ] 4.4 EAS Build für App Store

### Strava API — Fristen & To-Dos
- **Bis 30. Juni 2026:** Strava-Abo für Entwickler-Zugang aktivieren (3 Monate gratis, Code: `a7c08db1b5` — in API-Einstellungen einlösen)
- **Ab 30. Juni 2026:** Strava-Abo (~6€/Monat) nötig für Standard Tier (bis zu 10 Nutzer)
- **Wenn App Store Launch + >10 Nutzer:** Extended Access beantragen (kostenlos, aber Review nötig) auf strava.com/settings/api
- **Bis 1. Juni 2027:** API-URL im Pi-Backend anpassen:
  - Alt: `https://www.strava.com/api/v3`
  - Neu: `https://www.api-v3.strava.com`
  - Auth-Token muss in Request-Header (nicht mehr Form-Params)
- keepr ist eine **direkte Integration** → nicht von Intermediary-Beschränkungen betroffen ✅

### Phase 5 — Rezept-Overhaul (Choosy-inspiriert)

Ziel: Rezepte erstellen/bearbeiten so gut wie Choosy — aufgeteilt in Schritte, Zutaten mit Fotos, strukturierte Zubereitung, Kategorisierung.

#### 5.1 Backend-Vorbereitung (Raspi) ✅
- [x] 5.1a `ingredients`-Tabelle: id, name, slug, image_path, category — auf Raspi angelegt
  - ~300 häufige deutsche Lebensmittel vorbelegt
  - Bilder: Gemini-generierte PNGs in `/uploads/ingredients/<slug>.png`
  - `GET /api/ingredients/search?q=` → JSON mit name + image_url
- [x] 5.1b `recipes`-Tabelle erweitert: meal_type, recipe_category, source_url, slug auf ingredients
  - steps als JSON-Array: `[{type:'vorbereitung'|'zubereitung', text:'...'}]`
  - collections + collection_recipes Tabellen angelegt
  - Collection-Endpoints: GET/POST/DELETE /api/collections, GET/POST/DELETE /api/collections/:id/recipes

#### 5.2 Zutaten-Datenbank + Bilder
- [x] 5.2a Gemini-generierte Bilder für 91 Zutaten generiert und auf Raspi hochgeladen (`/uploads/ingredients/<slug>.png`)
  - `MAX_PER_CHAT=1` in `scripts/genimages.js` → kein Context-Bleed mehr
- [x] 5.2b `src/components/IngredientSearch.js` — Modal mit Grid + Bottom Sheet für Menge/Einheit + Freitext-Fallback

#### 5.3 Multi-Step Recipe Wizard ✅
- [x] `src/screens/RecipeWizardScreen.js` — 5-Schritte-Wizard mit Fortschrittsbalken
  - Schritt 1: Allgemein (Titel, Beschreibung, Portionen, Zeit)
  - Schritt 2: Zutaten (IngredientSearch Modal, ↑/↓ sortieren)
  - Schritt 3: Zubereitung (Vorbereitung + Zubereitung Tabs, nummerierte Schritte)
  - Schritt 4: Kategorie (Mahlzeittyp + Rezept-Kategorie Chips)
  - Schritt 5: Rezeptbild + Zusammenfassung
  - Bottom Bar: Verwerfen (Trash) + Weiter/Speichern (theme-aware Farben)
- [x] `presentation: 'fullScreenModal'` in App.js → Tab-Bar versteckt, Bottom Bar korrekt über Home Indicator

#### 5.4 RecipesScreen — Sammlungen + Filter ✅
- [x] Sammlungen-Tab mit 2-Spalten Grid
- [x] 3 Thumbnail-Vorschau pro Sammlung (keepr-Logo als Fallback)
- [x] Sammlung erstellen (Modal), Long-Press zum Löschen
- [x] `src/screens/CollectionDetailScreen.js` — Rezepte einer Sammlung mit großen Cover-Bildern
- [x] Tab-Leiste als `ScrollView horizontal` (kein Overflow mehr)
- [x] Filter-Button (Feather "sliders") neben Tab-Leiste — Badge zeigt Anzahl aktiver Filter
- [x] Filter-Modal (Bottom Sheet): Mahlzeittyp, Kategorie, Zeit (≤15/30/60 Min)
  - `parsePrepTimeMinutes()` für flexible Zeitformate (z.B. "30 Min", "1 Std 30 Min")
  - "Zurücksetzen" Button wenn Filter aktiv

#### 5.5 RecipeDetailScreen — Verbesserungen ✅
- [x] Tags (meal_type + recipe_category) als Chips unter dem Titel
- [x] "Original ansehen" Button wenn source_url vorhanden (Linking.openURL)
- [x] Zutaten mit Foto-Thumbnails (36×36, weiße Hintergrund-View für transparente PNGs)
- [x] Zubereitung: Vorbereitung-Tab + Zubereitung-Tab (nur wenn beide vorhanden), nummerierte Schritte
- [x] Nährwerte pro Portion (total ÷ servings) als kleiner Subtext unter jedem Makro
- [x] Bookmark-Icon im Header → "Zu Sammlung hinzufügen" Bottom Sheet
  - Vorhandene Sammlungen anklicken → direkt hinzufügen
  - Neue Sammlung inline erstellen + sofort zuweisen

#### 5.6 Noch offen
- [ ] RecipeWizard Schritt 5: Sammlung zuweisen beim Erstellen
- [ ] EAS Build für App Store (Phase 4.4)

**Stand: ~92% fertig — Rezept-Overhaul vollständig abgeschlossen**

---

### Nach EAS Build / Dev Client — Drag & Drop
Aktuell überall ↑/↓ Buttons (funktioniert in Expo Go). Sobald EAS Build oder `npx expo run:ios` verfügbar:
- [ ] D.1 Drag & Drop in RoutineEditScreen (Übungen umsortieren)
- [ ] D.2 Drag & Drop in LiveWorkoutScreen (Übungen während Workout umsortieren)
- [ ] D.3 Drag & Drop in KraftScreen (Routinen-Liste umsortieren)

**Implementierung:** `react-native-gesture-handler` v2.30.0 ist bereits installiert (`expo install --fix` bestätigt).
`LongPressGestureHandler` + `PanGestureHandler` aus RNGH, `GestureHandlerRootView` in `App.js` als Root-Wrapper.
RNGH funktioniert **nicht** in Expo Go SDK 55 — native Module fehlen → TurboModuleRegistry-Crash.

---

---

## Security-Härtung + Pentest (2026-07-01)
Vor öffentlicher Erreichbarkeit gehärtet + von einem Red-Team-Subagenten getestet.
- **Gehärtet:** helmet-Header, starkes JWT_SECRET (96 Z., schwaches aus systemd-Unit entfernt),
  `trust proxy`, Rate-Limits (global 600/15min, auth 12/15min, KI 40/h) mit Key auf
  `CF-Connecting-IP` (XFF-Spoof-sicher), CORS `origin:false`, Passwort-Policy (≥8) serverseitig,
  keine Login-User-Enumeration, Hardcoded-Fallback-Keys raus, Body-Limit 15mb.
- **Pentest-Funde gefixt + verifiziert:** Collections-IDOR (CRITICAL, Rezept-Exfiltration über
  fremde `recipeId`/Collection) → household-Ownership-Checks; SSRF via Redirect/og:image
  (`_safeFetch` validiert jede Hop-URL); IDOR bei `generate-image` (household-Filter) und
  `training/complete` (session/plan müssen dem Nutzer gehören).
- **Sicher bestätigt:** SQL (parametrisiert), JWT-Fälschung/alg:none, Mass-Assignment `PUT /api/profile`
  (Whitelist), IDOR bei allen übrigen Ressourcen (user_id/household_id-Filter), SSRF-Direktzugriffe.
- **Runde 2 (alles gefixt + verifiziert):**
  - **Gemini-Proxy** `POST /api/ai/gemini` (auth+rate-limit): Key wird NIE mehr an Clients
    geschickt (`/api/config/gemini` → `{"key":"proxy"}`); alle ~9 Client-Gemini-Calls laufen über
    `geminiFetch()` → Backend. maxOutputTokens serverseitig gedeckelt, Modell fix. Verifiziert.
  - **JWT-Revocation** via `users.token_version`: auth prüft User-Existenz + tv → Token nach
    PW-Änderung (gibt neues Token zurück, KontoScreen speichert es) und nach Account-Löschung
    sofort ungültig. Verifiziert (alt→401, neu→200, gelöscht→401). alg:none/Tampering→401.
  - **XFF-Rate-Limit-Bypass** geschlossen: `keyGenerator` nutzt nur `CF-Connecting-IP`
    (in Prod von Cloudflare gesetzt/unfälschbar), sonst ein gemeinsamer Bucket — rotierende
    `X-Forwarded-For` greift nicht mehr (verifiziert: 429 ab 12).
  - **npm audit: 0 vulnerabilities** (Deps aktualisiert).
- **Rest (LOW):** Upload-Magic-Byte-Prüfung, Error-Message-Sanitisierung. Unabhängiger Full-Re-Pentest
  steht noch aus (Subagent lief ins Session-Limit) — die Einzelfunde sind aber manuell verifiziert.

### Runde 3 — Erweiterter Pentest + LOW-Fixes (2026-07-01, abends)
Kompletter automatisierter HTTP-Pentest (nur Status-Codes, keine PII) + LOW-Punkte geschlossen.
- **Pentest-Verdikt: keine echten Lücken.** Auth (14 Endpunkte ohne Token → alle 401), IDOR auf
  alle `:id`-Endpunkte (besitzergefiltert; die HTTP-200 bei DELETE/PUT fremder IDs sind Fehlalarme —
  `WHERE id=? AND household_id/user_id=?` trifft 0 Zeilen, **keine Fremddaten verändert**), SQLi
  (kein String-Concat), SSRF (interne/Metadaten-URLs → 400), Mass-Assignment (household/id
  unveränderbar), Gemini-Key (`"proxy"`, nie ausgeliefert), JWT-Fälschung (401). Verifiziert.
- **LOW-Fixes umgesetzt (server.js, deployed + verifiziert, Backup `server.js.bak.*` auf Pi):**
  1. **Upload-Magic-Bytes:** `isRealImage()` (JPEG/PNG/GIF/WebP/HEIC-Signatur) + Middleware
     `validateImageUpload` nach `upload.single(...)` an allen 3 Upload-Routen (recipes/:id/image,
     progress/photo, profile/avatar). Fake-PNG (Textdatei) → 400, echtes PNG → 200.
  2. **Error-Sanitisierung:** 33× `res.status(500/502).json({error:e.message})` → generisch
     `'Serverfehler'` + serverseitiges `console.error`. (Die 400er-SSRF-Validierungsmeldung bleibt
     bewusst, da hilfreich.)
- **Funktions-Bug gefunden + gefixt (kein Security):** `GET /api/food/search` gab 500, weil
  OpenFoodFacts Anfragen OHNE `User-Agent` mit 503+HTML beantwortet → `response.json()` crasht.
  Fix: `User-Agent: KEEPR/1.0 (keepr-app.de; ...)` + 1 Retry bei 503/Nicht-JSON + graceful `[]`
  statt 500. Verifiziert (Apfel/Banane/Milch → je 20 Treffer). **Gleicher Fix im Client**
  (`client.js lookupBarcode`, Zeile ~626) — Barcode-Scan nutzte OFF ebenfalls ohne UA.
- Unabhängiger Red-Team-Subagent (frischer Kontext, kein Code-Vorwissen) fand **3 echte Funde**
  (alle gefixt + verifiziert, deployed):
  1. **IDOR `PUT /api/recipes/:id` (HIGH):** Parent-UPDATE war household-scoped, aber der Kind-Block
     (`DELETE recipe_ingredients` + INSERT) NICHT → fremde Rezept-Zutaten haushaltsübergreifend
     löschbar/vergiftbar (Recipe-IDs sequentiell). Fix: Ownership-Check am Handler-Anfang
     (`SELECT ... WHERE id=? AND household_id=?` → sonst 404). Verifiziert: Angreifer-PUT → 404.
  2. **SSRF via IPv4-mapped IPv6 (MED-HIGH):** `_isPrivateIp` erkannte `::ffff:127.0.0.1` nicht
     (Node normalisiert zu Hex `::ffff:7f00:1`) → interner Loopback/LAN erreichbar. Fix: Regex raus,
     jetzt **`ipaddr.js`** (Default-Deny: alles außer `range()==='unicast'` blockiert; v4-mapped
     wird via `toIPv4Address()` aufgelöst). Verifiziert: alle Vektoren (dotted/hex-mapped/decimal/::1/
     metadata) → „Adresse nicht erlaubt"; echte Public-URLs laufen weiter.
  3. **Account-Löschung bricht (MED + App-Store-Blocker):** `recipes.created_by`/`inventory.added_by`
     (FK→users) wurden nicht behandelt → bei `foreign_keys=ON` FK-Fehler → 500, Konto blieb bestehen.
     Fix: geteilte Haushaltsdaten NICHT löschen, aber `created_by`/`added_by` auf NULL setzen (+ fehlende
     `mobility_results`-Löschung ergänzt). Verifiziert: Löschung mit Rezept+Inventar → 200, Token → 401.
  - **PASS (vom Red-Team bestätigt):** JWT (alg:none/wrong-secret/revocation), Gemini-Key-Proxy,
    Mass-Assignment, SQLi, alle übrigen IDOR, File-Upload (jetzt inkl. Magic-Bytes), Redirect-SSRF.
  - **Residual (LOW, offen):** (a) Rate-Limit-Key `CF-Connecting-IP` nur sicher, solange Origin NUR
    über den Cloudflare-Tunnel erreichbar ist (kein direkter Port am Pi) — via Tunnel gegeben.
    (b) `parse-document` mammoth/docx = mögliche Zip-Decompression-Bomb (DoS) → Größen-/Komplexitäts-
    limit sinnvoll. (c) DNS-Rebinding-TOCTOU in `_safeFetch` (validiert + fetch lösen DNS getrennt auf)
    → für Vollhärte validierte IP pinnen. (d) verwaiste `households`-Zeilen (kosmetisch).

## Kühlschrank-Scan (2026-07-07) ERLEDIGT
Foto vom Kühlschrank/Vorratsschrank → KI erkennt alle Lebensmittel MIT Bounding-Boxen →
geführter Schritt-für-Schritt-Review → Speisekammer.
- **API:** `analyzeFridgePhoto(base64, mimeType)` in client.js — Gemini (via Proxy) liefert
  JSON-Array `{name, box:[ymin,xmin,ymax,xmax] 0–1000, qty, count, category, mhd,
  caloriesPer100g, …, unsicher}`. Boxen werden client-seitig geclampt/sortiert, Einträge
  ohne gültige Box verworfen. Kategorien = feste Inventar-Liste.
- **Screen:** `src/screens/FridgeScanScreen.js` (Route `FridgeScan`, fullScreenModal im
  SpeisekammerStack). Phasen: start → analyzing → review → summary.
  - **Review:** Foto im schwarzen Container (contain-fit via onLayout), Wrapper-Animated.View
    mit translateX/Y + scale (native driver). Übersicht (index −1) zeigt alle Boxen nummeriert
    (grün=übernommen, grau=übersprungen); pro Artikel zoomt die App animiert auf die Box
    (Padding 1.7, max 6×, an Bildränder geclampt; Transform-Mathe: t = −boxCenter·s).
    BorderWidth wird durch den Zoom-Faktor geteilt (bleibt optisch dünn).
  - Artikel-Karte: Name + Menge editierbar (TextInput), Anzahl-Stepper, Kategorie/MHD/kcal,
    Überspringen/Übernehmen (auto-advance), Zurück-Chevron. Übersicht bietet zusätzlich
    „Alle direkt übernehmen". Summary → `bulkAddItems` (Menge × count wie ScanScreen).
- **Einstieg:** dritter Tab „Kühlschrank" im ScanScreen (receipt | fridge | barcode).
- **Getestet (Wegwerf-User, echtes Kühlschrankfoto):** 5 Produkte, alle Boxen visuell korrekt
  (Zitrone/Hummus/Pesto/Gläser), Kategorien/MHD plausibel, Account-Cleanup 200.

## Körper-Vergleich mit Region-Zoom (2026-07-07) ERLEDIGT
Fortschrittsfoto-Analyse um **Körperregionen mit Bounding-Boxen** erweitert — gleiche
Zoom-Mechanik wie der Kühlschrank-Scan, aber als Früher/Aktuell-Vergleich nebeneinander.
- **Backend (deployed, Backup `server.js.bak.*`):** `POST /api/progress/analyze` Prompt liefert
  zusätzlich `regionen: [{pose, name, box_alt?, box_neu, befund, trend}]` — 4–8 markante
  Regionen (Schultern/Brust/Bauch/…), Boxen 0–1000 **pro Foto separat** (box_alt = FRÜHER,
  box_neu = AKTUELL; Person kann anders stehen). Erster Check-in: nur box_neu, trend "start".
  maxOutputTokens 1800→4096. Persistiert wie gehabt in `progress_analyses`.
- **`src/components/RegionZoomImage.js`** — wiederverwendbare Zoom-Komponente: remotes Bild
  (Image.getSize), contain-Fit, Boxen, animierter Fokus-Zoom (focus-Index, −1 = Übersicht).
  Aus der FridgeScan-Mathe extrahiert (t = −boxCenter·s, Rand-Clamp, Border/scale).
- **`src/screens/ProgressCompareScreen.js`** (Route `ProgressCompare`, fullScreenModal im
  ProfilStack): Früher/Aktuell nebeneinander mit Datums-Labels, beide zoomen **synchron**
  auf die jeweilige Region (jedes Bild seine eigene Box). Ablauf: Übersicht (nummerierte
  Boxen, trend-farbig) → Region-Karten (Name, Pose, Trend-Badge besser/gleich/schlechter/
  start, Befund, Zurück/Weiter) → Fazit (summary + KF-Schätzung + Disclaimer). Wechselt die
  Pose zwischen Regionen, wechseln die Fotos mit. Einzelbild-Modus beim ersten Check-in.
  Fotos kommen aus `store.progressPhotos` (ältestes/neuestes je Pose), kein eigener API-Call.
- **Einstieg:** Button „Regionen-Vergleich mit Zoom ansehen" in der „Letzte Analyse"-Karte
  + im Analyse-Bottom-Sheet (nur wenn `regionen` vorhanden — alte gespeicherte Analysen
  haben keine → erst „KI-Analyse aktualisieren").
- **Getestet (Wegwerf-User, 2 Physique-Fotos an 2 Daten):** 4 Regionen (Bizeps/Schultern/
  Brust/Trizeps), alle Boxen gültig + visuell plausibel auf beiden Bildern, Trend + Befunde
  sinnvoll, Account-Cleanup 200.

## UI-Vereinheitlichung Scanner + Profil (2026-07-07) ERLEDIGT
Scanner-Screens + Profil-Tab ans UI-Kit (`components/ui.js`) angeglichen — Nutzer-Feedback:
„passt nicht zum Rest der App".
- **Regel für neue Screens:** IMMER `ScreenHeader` (statt eigenem paddingTop-60-Header),
  `Surface`, `PrimaryButton` (accent/schwarz) + `GhostButton` verwenden. C.tint (gelb) NUR
  als kleiner Akzent (Badges, Marker-Boxen auf Fotos) — nie für große Flächen/Buttons.
- **ScanScreen:** ScreenHeader + Modus-Chips (accent-Pille wie InventoryScreen-Filter statt
  gelbem Segmented-Control), Hero-Karten als Surface mit 56px-Icon-Quadrat (bgSecondary),
  PrimaryButton/GhostButton. **FridgeScanScreen + ProgressCompareScreen:** ScreenHeader mit
  Zähler als rightLabel, alle Buttons aufs Kit umgestellt; gelbe Box-Marker auf Fotos bleiben.
  ui.js GhostButton rendert Label nur wenn nicht leer (Icon-only-Buttons).
- **ProfilScreen** neu geschrieben: bg = C.bg (vorher bgSecondary — wich vom Rest ab),
  insets-basiertes Padding, ui.js MenuRow/SectionLabel/Surface statt Eigenbau-Duplikate,
  toter Sparkline-Code raus, „Über keepr"-Fake-Row raus (Version als Footer-Text).
  Struktur: Hero (neutraler Avatar, Ziel-Badge in tint) → Quick Stats →
  **Fortschrittsfotos-Karte** (prominent: neuestes Foto je Pose als Thumbnail-Reihe,
  „Letztes Check-in vor X", Sub-Row „Körper-Vergleich ansehen" wenn regionen vorhanden)
  → Mein Profil / Verbindungen / App (Abmelden als danger-Row in App-Sektion).

## Rechtliches + Auto-Sync + Sportprofil-Konditionalität (2026-07-08) ERLEDIGT
- **Rechtstexte:** `src/data/legal.js` (PRIVACY_SECTIONS/TERMS_SECTIONS, LEGAL_STAND —
  Vorlage, vor Store-Launch anwaltlich prüfen). `src/screens/LegalScreen.js` (Route `Legal`,
  param `{type:'privacy'|'terms'}`), exportiert `LegalBody` (nummerierte Abschnitte) —
  wiederverwendet im AuthScreen-Consent-Modal.
- **Registrierung:** Pflicht-Checkbox „Nutzungsbedingungen akzeptieren + Einwilligung
  Gesundheitsdaten (Art. 9 DSGVO)" mit tappbaren Links (Modal, ohne Navigation, da vor Login).
  handleRegister blockt ohne Consent.
- **Einstellungen:** Sektion „Rechtliches" (Datenschutz/AGB → LegalScreen) + „Konto & Daten"
  (destruktive Aktionen). **„Verbindung" (Server-URL) versteckt**: 5× auf „Version" tippen
  → Entwickler-Sektion erscheint (devTaps-State).
- **Auto-Sync** (`src/utils/autoSync.js`): `autoSyncConnectedApps()` synct Strava (Server),
  Intervals.icu + Oura (Client, Keys aus Keychain) — still, Fehler je Dienst geschluckt,
  Drosselung 10 min (`auto_sync_last`), FTP/maxHF-Auto-Übernahme wie manueller Sync.
  Verdrahtet in App.js: bei Login/Start + AppState→'active' (App in Vordergrund = frisch
  beendete Strava-Einheit wird sofort geholt). Hinweis-Banner in ConnectedAppsScreen.
  Echte Push-Webhooks (Strava) bewusst NICHT — bräuchte Remote-Push (APNs, Paid-Account).
- **Sportprofil konditional:** Sektionen richten sich nach gewählten Sportarten —
  Kraft-Einstellungen (Volumen/Übungen) nur bei strength/hyrox/calisthenics; Leistungswerte
  nur bei Ausdauer (FTP nur bike/tri, Schwimm-Pace nur swim/tri, Lauf-Pace nur run/tri/hyrox);
  Bestleistungen nur run (5k–Marathon) bzw. swim (1 km).

## KI-Athleten-Analyse + Strava-Detaildaten (2026-07-08) ERLEDIGT
„Perfekter individueller Coach": jede Einheit wird automatisch analysiert, Profil korrigiert
sich selbst, Plan rudert bei Überlastung zurück — alles transparent kommuniziert.
- **Strava-Sync erweitert (Backend, deployed):** pro NEUER Aktivität Detail-Abruf
  (`/activities/:id` + `/laps`, max. 10/Sync) → exercises_completed-JSON enthält jetzt
  max_hr, Ø/max-Speed, Watt (avg/NP), Cadence, Höhenmeter, Suffer Score, Kalorien,
  **splits** (km/Zeit/Pace/HF/hm) + **laps**. Spalten title/calories/distance/avg_hr
  werden befüllt. Response enthält `activities:[{name,sportType,distanceKm,durationMin}]`
  (für Benachrichtigung). KEINE Streams (sekündliche Daten) — bewusst.
- **`POST /api/athlete/analyze`** (auth+aiLimiter): Gemini prüft Profil vs. echte Leistung
  (21 Tage Einheiten inkl. Splits + Check-ins). JSON: fitness_level, profil_updates
  (run_pace_s_km/swim_pace_s_100m/ftp_w/max_hr), belastung (zu_hoch/passend/zu_niedrig),
  plan_anpassung, nachricht, begruendung. **Server-Guardrails:** Werte geclampt, maxHF nie
  unter beobachtete HF + nur erhöhen, Level nur aus erlaubter Liste. Updates direkt in
  users-Tabelle. Persistiert in `athlete_insights` (max. 20/User). `GET /api/athlete/insight`.
  **Getestet:** Elite-Profil + 17 km/h bei HF 170 → beginner, FTP 350→150, belastung
  zu_hoch + konkrete Rückruder-Anweisung; maxHF-Senkung korrekt blockiert.
- **Plan-Generierung:** `insightSection` (letzte Analyse ≤14 Tage) im Prompt — bei
  zu_hoch explizit „Volumen/Intensität 20-30% reduzieren" + plan_anpassung.
- **Client:** `api.analyzeAthlete/getAthleteInsight`, Store `athleteInsight` +
  `analyzeAthlete()` (lädt danach Profil neu → UI zeigt korrigierte Werte),
  `completeWorkout` triggert Analyse fire-and-forget. autoSync: neue Strava-Einheiten →
  **lokale Notification** („X neue Einheiten … KI-Coach analysiert") + Analyse + zweite
  Notification mit KI-Nachricht (nur bei Änderungen/auffälliger Belastung).
  `notifyNow(title, body)` in notifications.js. **TrainingScreen:** „DEIN KI-COACH"-Karte
  (Nachricht, Belastungs-Badge, „Automatisch angepasst: …").

## Strava inaktiv → intervals.icu-Voll-Import (2026-07-08) ERLEDIGT
**Strava-API seit 30.06.2026 deaktiviert** (`Application Status: Inactive`, Client-ID 182009) —
Entwickler-Abo-Pflicht, Nutzer will NICHT zahlen. Verifiziert: selbst der persönliche Token
von strava.com/settings/api bekommt 403. Sync-Endpoint gibt jetzt klare Meldung statt 500.
- **Kostenloser Ersatzweg: Garmin → intervals.icu → keepr** (Garmin ist mit Nutzers Strava/
  intervals verbindbar; intervals.icu-API ist gratis).
- Backend `POST /api/workouts/import` `{source, workouts:[{externalId,date,name,sportType,
  durationMin,summary}]}` → completed_workouts; Dedupe via Tag `[intervals:<id>]` in notes
  UND Fuzzy (gleicher Tag+Sportart, Dauer ±3 min — verhindert Doppel mit Alt-Strava-Importen).
  Getestet (Wegwerf-User): Import 1, Re-Post 0.
- Client `syncIntervalsIcu`: normalisiert ALLE Aktivitäten (30 Tage) inkl. HF/Watt/NP/Speed/
  Höhenmeter/Kalorien/training_load + **Intervalle/Runden** (`/activity/:id/intervals`, letzte
  7 Tage, max. 8 Abrufe) → `api.importWorkouts('intervals', …)`. Rückgabe +`imported`/
  `importedActivities`. autoSync: zählt intervals-Importe wie Strava → Notification +
  KI-Athleten-Analyse. ConnectedApps: Beschreibung + Sync-Alert erwähnen Import.
- Nutzer-Setup nötig: intervals.icu-Konto → Garmin dort verbinden → Athlete-ID + API-Key
  in keepr eintragen.

## Emoji-freie UI (2026-07-01)
Alle pictographischen Emojis aus der UI entfernt → durch Feather / MaterialCommunityIcons
ersetzt (professioneller Look). Shared Helper `muscleIcon(group)` in `data/exercises.js`
(MCI-Name pro Muskelgruppe, ersetzt `MUSCLE_EMOJIS`). Sport-Icons über `getSportMci()`.
Rezept-/Meal-`emoji`-Felder werden nicht mehr generiert (aus KI-Prompts entfernt) noch
angezeigt (Icon statt Emoji). Onboarding/Ziele/Einkauf/Kraft/Kalender etc. umgestellt.
Nur typografische ✓-Häkchen bleiben (bewusst). Verifiziert: 0 Emojis, alle 70 src-JS parsen sauber.
Legacy AlertsScreen (unreachable) referenziert noch `item.emoji` — nicht sichtbar, gelassen.

## Architektur-Notizen

### Stores
- `useStore()` — Auth, Inventar, Rezepte, Kalorien, Training, Gewicht, Wasser
- `useKraftStore()` — Routinen, Sessions, Übungen, PRs, aktives Workout

### Theme
- `useTheme()` Hook aus `src/theme/index.js`
- `colors` (C), `spacing` (S), `radius` (R), `typography` (T)
- Immer C.bg, C.text, C.accent verwenden — nie hardcoded Farben

### MuscleMap (`src/components/MuscleMap.js`)
- PNG-Overlays pro Muskelgruppe (Vorder-/Rückseite), zusammengesetzt über absolute Positionierung
- **Tier-System:** effectiveSets = primarySets × 1.0 + secondarySets × 0.33
- Opacity-Stufen: 0–1 Sets → 0.25, 2–3 → 0.5, 4–5 → 0.7, 6+ → 1.0
- muscleCounts Format: `{ [muscle]: { primary: n, secondary: m } }` ODER `{ [muscle]: number }`
- MUSCLE_PARENT-Mapping: Sub-Muskeln (z.B. "Hamstrings") → Elterngruppe ("Beine") für Overlay-Auflösung

### LineChart (`src/components/LineChart.js`)
- Keine SVG-Abhängigkeit — verwendet rotierte View-Rechtecke als Liniensegmente
- Winkelberechnung: `Math.atan2(dy, dx) * (180 / Math.PI)` für Segment-Rotation

### Reihenfolge ändern (↑/↓ Buttons)
Aktuell in allen drei Screens per ↑/↓ Chevron-Buttons umgesetzt — kein Drag & Drop in Expo Go möglich.
- `RoutineEditScreen`: `moveExercise(from, to)` via `setExercises`
- `LiveWorkoutScreen`: `moveExercise(from, to)` via `kraftStore`
- `KraftScreen` (Routinen-Liste): `reorderRoutines(from, to)` via `kraftStore`, Reihenfolge in AsyncStorage (`kraft_routine_order`)
- iOS UIScrollView-Geste stiehlt Touches nach ~10px — JS PanResponder/setNativeProps nicht zuverlässig in RN 0.83 New Arch

### Workout State Machine (`src/store/kraftStore.js`)
- Zustände: idle → active → finished
- Epley-Formel für 1RM: `weight × (1 + reps / 30)`
- PR-Erkennung in `checkAndNotifyPR()`: vergleicht estimated1RM mit gespeichertem PR
- Set-Kaskade in `updateSetWithFill()`: Gewicht/Wiederholungen werden an nachfolgende leere Sets vererbt

### Hinweise zu Legacy-Screens
Folgende Screens verwenden noch hardcodierte Farbpaletten (C = {...}) statt useTheme():
- `AlertsScreen.js`, `MehrScreen.js`, `SettingsScreen.js`
(`RecipeEditScreen.js` wurde migriert)
Diese sind im aktuellen Routing nicht erreichbar und können bei Bedarf migriert werden.

---

## Phase 6 — „Perfect Coach" + Security-Härtung (in Arbeit)

### Security (client-seitig erledigt)
- `src/utils/secureStorage.js` — Keychain/Keystore-Wrapper (expo-secure-store) mit
  Auto-Migration aus AsyncStorage. `auth_token`, Intervals.icu-Key, Oura-Token liegen
  jetzt verschlüsselt. „Alle Daten löschen" leert auch den Keychain.
- ErrorBoundary-Details nur in `__DEV__`, Datenschutz-Text korrigiert, PW-Minlänge 8.
- Offene Punkte (brauchen Backend): siehe `BACKEND_CHANGES.md` (Account-Löschen,
  Gemini-Proxy, Rate-Limit join-household, SSRF-Schutz import-url, PW ändern/reset).
  HTTPS-Default bleibt vorerst LAN (Nutzer-Entscheidung).

### Sport-Katalog (`src/data/sports.js`)
~70 Sportarten in 8 Kategorien mit Icon (MCI), Farbe, MET (kcal-Schätzung), Distanz-Flag,
Such-Synonymen. `getSportColor()` in client.js nutzt jetzt den Katalog.

### Freie Aktivitäten (`src/components/ActivityLogModal.js`)
Beliebige Sportart eintragen (z.B. Beachvolleyball) → `completeWorkout` mit `sessionId:null`
+ `sportType`/`title`. Verdrahtet im CalendarScreen (Button „Aktivität" + im Tagesdetail).
Braucht Backend-Anpassung (BACKEND_CHANGES.md §1).

### Einheit bearbeiten & verschieben (TrainingScreen `SessionEditModal`)
Fokus/Sportart/Dauer/Intensität/Ruhetag editieren + Wochentag-Wähler (verschieben).
Store: `updateSessionAt`/`moveSessionAt` (local-first + best-effort `api.updateTrainingSession`
PATCH). Ruhetag-Logik: Tag ist nur Ruhetag, wenn ALLE Sessions Ruhe sind. Backend: §3.

### Einzelne Einheit per KI neu erstellen
- Backend: `POST /api/training/session/:id/regenerate` `{ instruction? }` — Gemini erzeugt
  EINE Einheit (focus/sport_type/duration/intensity/steps/exercises) mit Athletenprofil,
  aktualisiert die Session, gibt sie zurück. Deployed + getestet.
- Client: `api.regenerateSession`, Store `regenerateSessionAt(index, instruction)`,
  `RegenerateModal` + Button „KI neu erstellen" an jeder Einheit (TrainingScreen).

### Strukturierte Workouts (intervals.icu-Stil)
- `src/utils/workoutStructure.js` — Zonen Z1–Z5, `getSessionSteps()` nutzt `session.steps`
  (von Gemini) ODER synthetisiert ein Profil aus duration+intensity (sieht immer gut aus).
- `src/components/WorkoutProfileChart.js` — Balken-Profil. Eingebaut in TrainingScreen
  (Tagesdetail + SessionInfoModal). Gemini-Prompt liefert jetzt `steps` (Backend §4).

### Coaching: Carb-Loading + Volumen-Kalorien (`src/utils/coaching.js`)
- `planDayType(plan, dayIndex)` + `getCarbLoadingStatus(today, tomorrow)`.
- `calcCalorieGoalFromProfile(user)` — Basis-Kalorienziel LIVE aus Gewicht/Größe/Alter/
  Geschlecht/Aktivität/Ziel (Harris-Benedict + Ziel-Adjust). `calculateDailyTargets` nutzt
  das als Basis (Fallback: gespeichertes Ziel). KoerperScreen zeigt es read-only/„auto".
- `getRaceContext(user, date)` — erkennt Wettkampf-Termine aus `competitionGoals`
  (robust gegen Doppel-JSON). CaloriesScreen: Wettkampf heute → trainingType 'race';
  Wettkampf in ≤2 Tagen → Carb-Loading-Banner + 6 g/kg KH.
- Carb-Loading setzt eine KH-Untergrenze von 6 g/kg (Kalorien ziehen entsprechend mit).
- `calculateDailyTargets(..., activityCalories)` — 6. Param: tatsächlich verbrannte
  Trainings-kcal des Tages haben Vorrang vor der groben Bonus-Schätzung.
- CaloriesScreen: Trainingstyp = intensivste Belastung des Tages (Kraft ODER geplante
  Einheit) → Kalorien/Makros volumenabhängig. Lädt verbrannte kcal des Tages via
  `api.getCalendarDay()` (Summe `completedAll[].calories`). Carb-Loading-Banner.

### Account-Verwaltung (Security)
- `api.deleteAccount()` + Button „Konto endgültig löschen" in EinstellungenScreen
  (löscht serverseitig, dann lokal + Keychain + logout). Apple-Pflicht 5.1.1(v).
- `api.changePassword()` + Passwort-ändern-Modal in KontoScreen (min. 8 Zeichen).
- Beide brauchen die Backend-Endpoints aus BACKEND_CHANGES.md §2/§5.

### Wochen-Review (`src/components/WeeklyReviewModal.js`)
Soll vs. Ist + Aufschlüsselung nach Sportart, aus den im CalendarScreen geladenen
Wochendaten (planned vs. completedAll). Nur was geplant war oder gemacht wurde. Button
„Review" in der Kalender-Kopfzeile.

### Backend — DEPLOYED auf dem Pi (getestet, `speisekammer.service`)
Alle Client-Features haben jetzt ihr Gegenstück im `server.js` (better-sqlite3):
freie Aktivitäten (`completed_workouts` +title/calories/distance/avg_hr/manual_activity),
`DELETE /api/account`, `POST /api/account/password`, `PATCH /api/training/session/:id`,
`steps`-Spalte + Gemini-Prompt, Rate-Limit join-household, SSRF-Schutz import-url.
Details + Begründungen in `BACKEND_CHANGES.md`. Zugang: `ssh raspi`,
Backend unter `/home/manuel/speisekammer-backend/`, Neustart: `sudo systemctl restart speisekammer.service`.

### Coach-Audit — Welle 1 (Konsistenz/Bugs) ERLEDIGT
1. KI-Plan → Kraft-Tab: `handleStartFromAI` übernimmt jetzt `sets`/`reps` als echtes
   Sätze-Array (vorher immer nur 1 leerer Satz).
2. Wettkämpfe → KI: Backend-generate parst `competition_goals` robust (Doppel-JSON),
   PUT /api/profile speichert nicht mehr doppelt, DB einmalig normalisiert. (deployed)
3. Home = Kalorien-Tab: HomeScreen nutzt jetzt dieselbe trainingType-Logik
   (planDayType + Wettkampf), verbrannte Aktivitäts-kcal und Carb-Loading.
4. Gewicht: `store.addWeight` aktualisiert auch das Profilgewicht → TDEE/g-kg live korrekt.

### Coach-Audit — Welle 2 + 3 ERLEDIGT
- Oura-Readiness + Check-in-Energie → Kalorien (Erholungs-Bonus) + Trainingsstatus-Prompt;
  Oura-Schlaf befüllt den Check-in automatisch (coaching.js, trainingStatus.js, Home/Calories).
- Kraft-Leistung → KI: generate-Prompt bekommt e1RM-Summary (workout_sets, 6 Wochen) für
  progressive Overload. (Backend)
- Periodisierung: generate berechnet Wochen bis nächstem Wettkampf + Makrozyklus-Phase
  (Base/Build/Peak/Taper/Wettkampfwoche) + Vorwoche Soll/Ist + Deload-Regel. (Backend, getestet)
- FTP/maxHF Auto-Schätzung aus Intervals-Sync (`syncIntervalsIcu` → estFtp/estMaxHr →
  Profil-Update in ConnectedAppsScreen) → fließt in die KI.
- Live-Workout: Gewichte/Reps werden aus der letzten Session vorbefüllt
  (`POST /api/kraft/last-sets` + `kraftStore.startWorkout`, namensbasiert, auch für KI-Übungen).
- Hydration: dynamisches Wasserziel (`calcWaterGoal`, ml/kg + Trainingszuschlag) im Kalorien-Tab.

### Sinnvolle Verteilung / Überlastungsschutz (muskel-/systemspezifisch)
- Plan-Generierung + `KI neu`: Prompt denkt in belasteter **Muskelgruppe/System**, nicht
  pauschal hart/leicht. Dieselbe Gruppe nicht 2 Tage hart hintereinander (~48h). Nach
  Bein-/Stoss-Tag (Legday, harter/langer Lauf, Intervalle) am Folgetag KEINE beinlastige/
  stossbelastende harte Einheit (kein harter Lauf) — harte SCHWIMMEINHEIT, Oberkörper,
  Z2-Rad, Mobility sind dagegen ok. Keine zwei ZNS-/Maximaltage hintereinander.
- Zwei klar getrennte Einheit-Aktionen: **Austauschen** (Regenerate, best-fit: KI wählt die
  Einheit, die an dem Tag am besten in die Woche passt, darf Sportart ändern, wochenkontext-
  bewusst, **behält Dauer/Pensum** bei) und **Woche optimal verteilen** (Rebalance, reine
  Tag-Verteilung, immer verfügbar, nichts gestrichen/abgeschwächt).
- Periodisierung/Progression bleibt bei Generierung aktiv (Wochen bis Wettkampf, Makrozyklus,
  Vorwoche Soll/Ist, e1RM-Overload) → Plan baut Woche für Woche aufeinander auf.
- **Konflikt-Warnung**: `detectTrainingConflicts()` (coaching.js) erkennt zwei aufeinander-
  folgende Bein-/Stoß-harte Tage → orange Warnbanner im TrainingScreen.
- **Plan ausbalancieren (KI)**: Button im Banner → `POST /api/training/plan/rebalance`
  (`{weekKey, lockedSessionId}`). **Reine Tag-Neuverteilung**: jede Einheit bleibt
  INHALTLICH unverändert (Sportart/Dauer/Intensität/steps) — die KI gibt nur eine
  Tag-Zuweisung (`{assignments:[{i,day}]}`) zurück, der Server aktualisiert nur `day_index`.
  Keine Einheit wird gelöscht oder abgeschwächt (Pensum bleibt voll), `lockedSessionId`
  behält ihren Tag, leere Tage werden Ruhetage. Getestet: 5 Einheiten inkl. selbst
  eingebauter → alle erhalten, nur Tage optimiert (Di nach Legday frei, Intervalle auf Mi).

## Profil-Hauptsportarten (Onboarding + Sportprofil)
Auswählbare Sportarten: run, bike, swim, strength, triathlon, **hyrox**, **calisthenics**,
**row** (Rudern), **hike** (Wandern), **climbing** (Klettern), **pilates**, mobility.
(Yoga entfernt.) Onboarding-Step 5 + SportprofilScreen als 2-Spalten-Raster (`width:'48%'`,
flexWrap). Alle Keys = Katalog-Keys → Mobility-Zonen (`mobilityZonesForSport`), Plan-Gen
(sportTypes-Text) und Farben greifen automatisch. TrainingScreen-Label-Map ergänzt.

## Mobility-Modul (GOWOD-inspiriert) — Phase 1 ERLEDIGT
Neuer Sub-Tab **„Mobility"** unter Training (App.js `TrainingKraftTabs`: Plan/Kraft/Mobility).
- `src/data/mobility.js` — 8 Zonen (inkl. Handgelenke, Stabilität/Balance), 12 Tests:
  Winkel-Tests (`type:'angle'`, refDeg) + Balance-Test (`type:'time'`, refSec, Einbeinstand).
  `testsForProfile(sports)` wählt sportartspezifisch aus über die **Zonen jeder Sportart**:
  `mobilityZonesForSport(key)` in sports.js (Kategorie-Defaults + Overrides) deckt ALLE
  Katalog-Sportarten + Kombinationen ab (Climber→Schulter/Handgelenk, Golf→BWS/Handgelenk,
  Ski→Knöchel/Balance, Schwimmen→Schultern …). Flow-Prompt-Ziel: Körper für die Sportart
  STABILISIEREN + Verletzungsstellen (Knie/Sprunggelenk/Schulter) schützen.
  `scoreTest` (Winkel ODER Zeit), `computeMobilityScore`, `weakestZones`.
- `src/utils/goniometer.js` — `useGoniometer()` Hook (Winkelmessung via `expo-sensors`
  DeviceMotion; misst max. Bewegungswinkel ab Start; guarded → Fallback wenn Modul fehlt).
  **Braucht `npx expo install expo-sensors` + Dev-Build-Rebuild** (nicht Expo Go).
- `src/screens/mobility/MobilityScreen.js` — Score-Übersicht (gesamt + Zonen-Balken) + Start.
- `src/screens/mobility/MobilityAssessmentScreen.js` — Test-Durchlauf je Seite mit Sensor
  + manuellem Grad-Fallback → Score berechnen + speichern.
- Backend: `mobility_results`-Tabelle + `GET/POST /api/mobility/result`, `GET /api/mobility/history` (deployed, getestet).
- Store: `mobilityResult` + `fetchMobilityResult`/`saveMobilityResult` (in `fetchAll`).

### Mobility — Phase 2 ERLEDIGT (KI-Flows + Player + Plan-Verzahnung)
- Backend `POST /api/mobility/flow` — Gemini baut Flow aus minutes/equipment/focusZones +
  ALLEN Sportarten des Profils + Wochenkontext (weekKey/dayIndex → Vortag regenerieren /
  Folgetag vorbereiten; sonst letzte Einheit). JSON: name, exercises[{name,zone,durationSec,side,cues}].
  Getestet: Flow zwischen Legday & Long-Run wurde „Post-Legday & Pre-Longrun" mit passenden Übungen.
- Plan-Generierung bekommt `mobilitySection` (schwächste Mobility-Zonen) → Mobility-Einheiten
  im Wochenplan zielen auf Schwächen.
- `MobilityFlowScreen` — geführter Player (Countdown je Übung/Seite, Pause/Vor/Zurück,
  Fortschritt) → loggt am Ende via `completeWorkout` (sport_type 'mobility' → zählt in
  Kalender/Kalorien; markiert Plan-Session als erledigt via sessionId).
- `MobilityScreen` — „Personalisierten Flow starten" (Zeit/Equipment-Modal → KI → Player).
- TrainingScreen: Mobility-Einheit im Plan → Button „Mobility-Flow starten" öffnet den Player.

### Mobility — gezieltes Targeting + Fortschritt
- Flow-Generierung lädt das letzte Assessment und gibt der KI die **schwächsten Einzeltests**
  (<60%) + **Seiten-Asymmetrien** (L/R ≥10° → schwächere Seite gezielt mehr, unilateral).
  Getestet: Knöchel-Asymmetrie → Flow „Ankle Focus" mit linksseitiger Übung.
- MobilityScreen: „Letzter Check vor X Tagen", **Fälligkeits-Reminder ab 7 Tagen**,
  **Delta seit letztem Check** + **Verlaufs-LineChart** (overall über Zeit, `/api/mobility/history`).

### Mobility — Schnell-/Voll-Check + neue Sportarten ERLEDIGT
- Test-Set entschlackt: `shoulder_flexion` + `neck_rotation` (+ `neck`-Zone) raus,
  `single_leg_squat` (type `rating`, 1–5 Selbstbewertung, Knie-Kontrolle) dazu. `scoreTest`
  versteht `rating` (refRating 5). Assessment-Screen: 1–5-Chip-Branch (kein Sensor/Manuell).
- **Zwei Modi** (`route.params.mode`): **Schnell-Check** (`quickTestsForProfile`, 4 Kern-Tests
  = 7 Schritte/~3 Min, wöchentlich) + **Voll-Check** (`testsForProfile`, alle Profil-Zonen,
  ~19 Schritte, alle 4–6 Wochen). Quick **mischt** neue Messungen in den letzten Voll-Check
  (`results.__meta.fullDate`, kein Backend-Feld nötig) → Score bleibt umfassend/vergleichbar.
  MobilityScreen: zwei Buttons + Reminder (Quick ≥7 Tage, Voll ≥35 Tage).
- Sportarten: Yoga raus; hyrox/calisthenics/row/hike/climbing/pilates rein (Onboarding +
  Sportprofil als 2-Spalten-Raster). `mobilityZonesForSport` deckt alle ab → jede Zone hat
  ≥1 Test, jede Sportart sinnvolle Auswahl (verifiziert).

### Mobility — Phase 3: Video/Bild-Pipeline ERLEDIGT (Medien-Generierung offen)
- **Fester Übungs-Katalog** `src/data/mobilityCatalog.json` (**120 Übungen**) = einzige
  Wahrheitsquelle für App (`src/data/mobilityExercises.js`), Backend + Generator.
  slug → Medien `/uploads/mobility/<slug>.(mp4|png)`. Felder: slug/name/zone/sides/**level**
  (easy/normal/hard)/defaultSec/equipment/cues/prompt/**tags**.
- Deckt jetzt ALLES ab, nicht nur Mobility: **tags** = `mobilize|stretch|stabilize|release|
  dynamic|recovery|breath`. Neue Inhalte: dynamisches Aufwärmen, Recovery/Entspannung
  (Beine-hoch, Kindshaltung, Happy Baby), **Atmung** (Box/4-7-8/Bauchatmung), **Nacken**,
  Ganzkörper-Flows (Sonnengruß). Zusatz-Zonen `neck/fullbody/recovery/breath` (nur Labels via
  `EXTRA_ZONES`/`getZone` in mobility.js — NICHT bewertet, keine Score-Bar/kein Test).
- **Ziel-Wähler** im Flow-Modal: Mobility / Stretching / Recovery / Aufwärmen (`goal`-Param).
  Backend filtert Pool per tags je Ziel (Fallback wenn <8), passt Haltedauer + Prompt-Framing/
  Reihenfolge an. Getestet (run): stretch→12/12 Dehnungen, recovery→recovery+breath, warmup→
  dynamic+mobilize, mobility→Mix. Alle slugs gültig.

### Mobility-Assessment: Scrub-Regler (Video) ERLEDIGT
- Neue Test-Art `type: 'range'` in `data/mobility.js`: Score = Reglerposition 0–100 % (scoreTest
  ref 100). Umgestellt: hip_extension, hip_internal_rotation, shoulder_external_rotation,
  overhead_wall, wrist_extension, single_leg_squat (vorher angle/rating) → je mit `videoSlug`
  (`test-*`). **Sensor bleibt** bei ankle_dorsiflexion, hip_flexion, forward_bend, tspine_rotation;
  Stoppuhr bei single_leg_balance.
- `MobilityAssessmentScreen`: bei range-Tests **Scrub-Regler** — eigener Touch-`RangeSlider`
  (PanResponder, kein natives Modul) + **`ScrubVideo`** (guarded `expo-video`, spult per
  `player.currentTime` zur Reglerposition). Reglerposition (0–100 %) = Ergebnis. Fallback ohne
  Video/Modul = reiner Regler. Asymmetrie L/R per % wie gehabt.
- Backend `GET /api/mobility/media` → `{ video:[], image:[] }` (welche slugs existieren);
  Client `api.getMobilityMedia()` → Screen weiß, ob Scrub-Video zeigbar.
- Scrub-Videos brauchen `test-*.mp4` mit **0→100-Bewegung** (eine langsame Bewegung, kein Loop).
  `scripts/genmobility.js`: `SET='assessment'` → 6 `ASSESSMENT_CLIPS` mit dedizierten 0→100-Prompts;
  Video-Prompt erzwingt eine durchgehende Vorwärtsbewegung, feste Kamera, kein Loop.

### Mobility-Medien: Generierung + Branding-Pipeline
- **Poster (Bilder, gratis):** `scripts/genmobility.js` mit `MODE='poster'`, `SET='catalog'` →
  Playwright fängt Bild-Blobs aus der Gemini-Web-App ab (funktioniert; Video-Blobs NICHT, weil
  Veo streamt). Erzeugt die 120 Katalog-Poster → `scripts/mobility_media/`. Überspringt
  Vorhandenes (resume-fähig).
- **Scrub-Videos (6, manuell):** Veo-Web-App-Download geht nicht per Skript → Nutzer generiert
  manuell mit den STRIKTEN Prompts (eine Bewegung neutral→Maximum, kein Loop), legt Datei in
  `scripts/mobility_media_incoming/`. Claude schneidet Querformat→Hochformat 3:4
  (`ffmpeg crop`, zentriert auf Person), speichert als `test-<slug>.mp4`. `test-single-leg-squat`
  ist fertig & live.
- **Branding (Wortmarke „keepr"):** `scripts/make_wordmark.py` baut `assets/keepr-wordmark.png`
  (Logo-Glyph als „K" + „eepr", Weiß transparent). `scripts/brand_and_upload_mobility.sh` legt
  sie **flach & zentriert, dezent** (~13%) auf alle `mobility_media/*.{mp4,png}` → branded →
  Pi. Einfach & schnell (kein Matting). Tuning: `AA`, `VFRAC`/`PFRAC`.
  - Optional/ungenutzt: `scripts/matte_brand.py` (echtes Matting per rembg, Logo hinter Person/
    GOWOD-Look) — funktioniert, aber ~10–15 min/Clip → bewusst NICHT im Standard (zu komplex).
- **Stand:** `test-single-leg-squat.mp4` (gebrandet) + erste Poster auf dem Pi. Offen: 5 Scrub-
  Videos + restliche Poster (Gemini-/Claude-Limit war erschöpft → pausiert). Später: Weg C =
  Video für jede Übung (manuell oder via Bezahl-API).
- **App:** `expo-video ~55.0.17` ist installiert (Config-Plugin in app.json) → Scrub-/Flow-Video
  spielt nach dem nächsten **Dev-Build-Rebuild** (in Expo Go Fallback auf reinen Regler). Poster
  zeigt RN Image sofort. (`require('expo-video')` ist in beiden Screens guarded.)

### Fortschrittsfotos (Physique-Tracking) — Phase A ERLEDIGT, KI offen
- **Zweck:** alle 4 Wochen 4 Posen fotografieren (front_relaxed, front_flexed, side, back_flexed),
  Vergleich über die Zeit. Beim Aufnehmen wird das letzte Foto derselben Pose halbtransparent
  als „Geist" über die Live-Kamera gelegt (gleiche Position → vergleichbar).
- **Backend (deployed/getestet):** Tabelle `progress_photos` (user_id, date, pose, image_path),
  `POST /api/progress/photo` (multer `upload.single('image')`, ersetzt gleiche Pose/Datum),
  `GET /api/progress/photos` (mit absoluter `imageUrl`), `DELETE /api/progress/photo/:id`.
  Account-Löschung räumt `progress_photos` mit. Speicher account-gebunden auf Pi → geräteübergreifend.
- **Client:** `api.getProgressPhotos/uploadProgressPhoto/deleteProgressPhoto`, Store
  `progressPhotos`+`fetch/upload/deleteProgressPhoto`. `src/screens/ProgressPhotosScreen.js`
  (expo-camera `CameraView` guarded, Geist-Overlay, 4-Posen-Durchlauf, Verlauf je Pose als
  horizontale Scrolls, Großansicht, Löschen per Long-Press, 4-Wochen-Reminder). Eingang:
  Karte „Fortschrittsfotos" im KoerperScreen → Stack `ProgressPhotos` (ProfilStack).
- **Posen-Konstante:** `PROGRESS_POSES` (export im Screen). Aufnahme mit `quality:0.5` (kleinere
  Payloads für die KI-Analyse).
- **An/Aus-Schalter (Switch im Screen):** `progress_photos_enabled` in AsyncStorage; Default =
  Körperziel (`user.goal` enthält `lose`/`gain`/`muscle`), sonst aus. Reminder erscheint nur wenn
  Schalter AN; manuelles Einschalten → Anfragen kommen wieder. Manueller Zugang bleibt immer.
- **KI-Analyse ERLEDIGT (Phase B, via Gemini-API, getestet):** `POST /api/progress/analyze` —
  vergleicht ältestes vs. neuestes Foto je Pose mit **Gemini Vision** (`gemini-3.1-flash-lite-preview`,
  inlineData-Bilder) → JSON `{summary, changes[], focus[], estimates{koerperfett,muskel}, disclaimer}`.
  Qualitativ + motivierend; estimates ausdrücklich als grobe, evtl. falsche visuelle Eindrücke
  markiert (Disclaimer + „UNGENAU"-Badge im UI). Läuft über die API (nicht vom Web-App-Limit
  betroffen). Client: `api.analyzeProgress`, Store `analyzeProgress`, Button „KI-Analyse (Vergleich)"
  + Ergebnis-Bottom-Sheet (ab 2 Check-ins aktiv). Getestet mit Wegwerf-User + 2 Bildern.
- **Numerische Schätzwerte:** estimates = `koerperfett_aktuell` (z.B. „ca. 18-20 %"), `koerperfett_vorher`,
  `koerperfett_trend`, `muskelmasse_trend` — im UI als Werte mit „UNGENAU"-Badge + Disclaimer.
- **Analyse persistiert:** Tabelle `progress_analyses` (1 Zeile/User, upsert), `GET /api/progress/analysis`,
  Store `progressAnalysis`/`fetchProgressAnalysis`. Screen zeigt „Letzte Analyse"-Karte (Summary +
  KF-Schätzung) ohne neuen Call; Button „KI-Analyse aktualisieren" rechnet neu. Konto-Löschung räumt mit.

### Körperzusammensetzung + KF-Verlauf (Renpho-ready) ERLEDIGT
- `weight_log` um `body_fat`/`muscle_mass` erweitert (ALTER ADD COLUMN, guarded). `POST /api/weight`
  nimmt `bodyFat`/`muscleMass`; da die Live-Tabelle KEINEN Unique-Index auf (user_id,date) hat
  (+ Altlast-Dubletten), wird pro Datum **gelöscht & neu eingefügt** (vorhandene KF/Muskel werden
  via Lesen+COALESCE erhalten). Profil-`body_fat`/`muscle_mass` werden mitgesetzt. Getestet.
- Client: `api.addWeight` nimmt jetzt `{weight,date,bodyFat,muscleMass}`; Store `addWeight(w,date,{bodyFat,
  muscleMass})` + `weightHistory`/`fetchWeightHistory`. KoerperScreen: Sektion „Körperzusammensetzung
  (z.B. Renpho)" mit KF-%- und Muskel-kg-Feld (optional) + **Körperfett-Verlauf-LineChart** (aus
  `body_fat` der Einträge, Min/Max/Trend). Hinweis: alter `api.logWeight?.()`-Aufruf (existierte nicht)
  durch echtes `api.addWeight` ersetzt → Gewicht landet jetzt wirklich im Log.
- **Renpho-Auto-Sync — AUFGESCHOBEN (Entscheidung 2026-06-24):** Renpho hat keine offene API;
  einziger sauberer Weg = Apple Health (Renpho schreibt dort hin → App liest via HealthKit).
  HealthKit-Entitlement braucht ein **bezahltes Apple-Developer-Konto** ($99/J) — mit der aktuellen
  kostenlosen Apple ID würde der Build fehlschlagen. Nutzer holt das Konto erst zum Launch.
  **HealthKit-Code/Config NICHT vorab einbauen** (würde Free-Account-Dev-Builds brechen). Bis dahin:
  Renpho-Werte manuell eintragen. Danach: HealthKit-Lib + Entitlement + Rebuild.

### Gerätedaten-Vorrang im Check-in + Muskelkater ERLEDIGT
- `src/utils/connectedData.js` `resolveConnectedMetrics(externalData)` — Geräte-Fakten schlagen
  manuelle Eingabe: ermittelt Schlaf/Stress/Readiness/Ruhepuls aus verbundenen Quellen,
  **Priorität Garmin > Oura**. Garmin-Felder vorbereitet (`sleepHours`, `stress` 0-100→1-5,
  `bodyBattery`, `restingHr`) — greift automatisch, sobald Garmin-Sync live ist; aktuell liefert
  nur Oura (Schlaf).
- **DailyCheckin (HomeScreen):** liefert eine Quelle den Wert → Feld wird **gesperrt angezeigt**
  („7,5 h · von Oura/Garmin · automatisch"), kein manuelles Auswählen mehr. Sonst manuell.
  Gilt für Schlaf + Stress. Energie bleibt manuell (subjektiv).
- **Muskelkater** neu im Check-in (1–5, immer manuell — misst kein Gerät) → `dailyContext.soreness`
  → fließt ins Recovery-Coaching (`assessRecovery`) + Backend `daily_log.soreness` (via saveDailyLog).
- Save nutzt `metrics.sleepHours ?? sleep`, `metrics.stressLevel ?? stress` + `readiness`.

### Recovery-Coaching ERLEDIGT (vollständig integriert, kein Backend nötig)
- `src/utils/recovery.js` — `assessRecovery({ dailyContext, externalData, trainingStatus })`
  bündelt Schlaf, Oura-Readiness, Energie (Check-in), Muskelkater, Stress, TSB-Ermüdung zu
  einem Status: `level` good/moderate/poor, `easeFactor` 1.0/0.8/0.6, `reasons`, `summaryDe`,
  `suggestRecoveryFlow`. Logik-getestet (6 Szenarien). `EASE_INSTRUCTION` = KI-Prompt fürs
  Leichter-Machen.
- **TrainingScreen**: Banner (orange/rot) bei schlechter Erholung → „Einheit leichter"
  (`regenerateSessionAt(todayIdx, EASE_INSTRUCTION)` für alle heutigen Nicht-Ruhe-Sessions,
  behält Sportart, reduziert Intensität/Umfang) + „Recovery-Flow" (`generateMobilityFlow
  goal:'recovery'` → MobilityFlow).
- **MobilityScreen**: Banner → öffnet Flow-Modal mit vorgewähltem Ziel Recovery.
- **HomeScreen**: Recovery-Statuszeile in der „DEIN TAG"-Karte (Aktion liegt im Training/Mobility).
- Kalorien werden weiterhin separat in coaching.js (Readiness/Energie/Ermüdung) angepasst.
- **9 Hilfsmittel** (Mehrfachauswahl im Flow-Modal, leer = Körpergewicht): foam_roller,
  massage_ball, massage_gun, band, mini_band, stick, block, strap, bar. Backend mappt die
  deutschen Labels per Keyword auf Tokens (mini- vs. langes Band unterschieden), filtert den
  Katalog → KI bekommt nur machbare Übungen. `level` steht im Prompt (Schwierigkeit passend).
  Getestet: ohne Equipment nur Körpergewicht, mit Auswahl exakt die passenden, 0 ungültige slugs.
- Backend `POST /api/mobility/flow` umgebaut: Gemini wählt NUR aus dem Katalog (per slug, keine
  erfundenen Übungen), Equipment-gefiltert; Server löst slug→volle Übung + Medien-URLs auf
  (`videoUrl`/`posterUrl` NUR wenn Datei auf dem Pi existiert, sonst null) + Zonen-Fallback.
  Getestet (Wegwerf-User): nur gültige slugs, Band→Band-Übungen, Fokus-Zonen priorisiert.
  Katalog liegt auf Pi (`mobilityCatalog.json`), in server.js als `MOBILITY_CATALOG`/`MOB_BY_SLUG`.
- Player `MobilityFlowScreen`: Medien-Box (Video wenn `expo-video`+Datei da, sonst Standbild,
  sonst Cues+Ring-Countdown). `expo-video`-Import **guarded** → kein Crash ohne Modul/Video.
- Generator `scripts/genmobility.js` (spiegelt `genimages.js`, Gemini-Web-App via Playwright):
  `MODE='poster'` (.png, bewährt, sofort nutzbar OHNE Rebuild) | `MODE='video'` (.mp4 Loop,
  EXPERIMENTELL, braucht Veo-Zugang; Veo streamt evtl. via MediaSource → ggf. manuell laden).
  Upload: `scripts/upload_mobility.sh` → Pi `/uploads/mobility/`.
- **TODO (Nutzer, hands-on):** Medien generieren (`node scripts/genmobility.js`) → sichten →
  `bash scripts/upload_mobility.sh`. Für echte Videos im Player: `npx expo install expo-video`
  + Dev-Build-Rebuild. Standbilder zeigt der Player sofort (nur RN Image).
- Recovery-Coaching → ERLEDIGT (eigener Abschnitt oben).

### Noch offen (Phase 6) — nur Infrastruktur/Organisation
- Gemini-Key-Proxy (größerer Umbau, vor öffentlichem Launch) — Begründung in BACKEND_CHANGES.md.
- HTTPS-Default + Datenschutz-URL + App-Store-Privacy-Label.
- EAS Production Build (Phase 4.4).
- Logged-Aktivitäts-kcal sind im Tagesziel verrechnet (Client erledigt).
