# KEEPR — Claude Code Projektdokumentation

## Was ist KEEPR?
Eine React Native / Expo App für deutschsprachige Ausdauer- und Kraftsportler.
Kombiniert KI-gestützte Ernährungsplanung, Inventarverwaltung, Trainingsplanung und Körpertracking in einer App.

## Tech Stack
- **Frontend:** React Native (Expo ~55), React 19
- **State:** Zustand (zwei Stores: `src/store/index.js` + `src/store/kraftStore.js`)
- **Navigation:** React Navigation v7 (Bottom Tabs + Native Stack)
- **KI:** Google Gemini (Key wird vom User in der App eingegeben, liegt in AsyncStorage)
- **Styling:** Custom Theme-System (`src/theme/index.js`) mit Light/Dark Mode
- **Persistenz:** AsyncStorage für lokale Daten + eigenes Backend

## Backend
- Läuft auf einem Raspberry Pi, ist von überall erreichbar
- API Base URL ist aktuell hardcoded in `src/api/client.js`
- Muss auf die externe Adresse des Pi umgestellt werden (Phase 1 Task)

## Git Branch
- Feature-Branch: `claude/continue-app-development-HE6dd`
- Alle Änderungen auf diesen Branch pushen

## Aktueller App-Status: ~75-80% fertig

### Was läuft gut:
- Kalorienzählung + KI-Mahlzeitenplan
- Inventar mit MHD-Tracking + Barcode-Scanner
- KI-Trainingsplan mit Wochenstruktur
- Kraft-Modul (Routinen, Live-Workout, PRs)
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

### Phase 1 — Critical Fixes
- [ ] 1.1 API Base URL konfigurierbar machen
- [ ] 1.2 Exercise-Picker Modal im Live-Workout
- [ ] 1.3 Einstellungen-Screen fertigstellen
- [ ] 1.4 Timer Pause/Resume im Live-Workout

### Phase 2 — UX Polish
- [ ] 2.1 Weight-Trend Grafik
- [ ] 2.2 Routine Folders
- [ ] 2.3 1RM Visualisierung in KraftStats
- [ ] 2.4 Rezept-Bilder hochladen
- [ ] 2.5 Globales Error-Handling

### Phase 3 — Neue Features
- [ ] 3.1 Household-Ansicht
- [ ] 3.2 Push Notifications
- [ ] 3.3 Strava/Garmin Sync
- [ ] 3.4 Export (PDF/CSV)

### Phase 4 — Production Readiness
- [ ] 4.1 Gemini Key in Expo SecureStore
- [ ] 4.2 Performance-Optimierung
- [ ] 4.3 Error Boundaries
- [ ] 4.4 EAS Build für App Store

---

## Architektur-Notizen

### Stores
- `useStore()` — Auth, Inventar, Rezepte, Kalorien, Training, Gewicht, Wasser
- `useKraftStore()` — Routinen, Sessions, Übungen, PRs, aktives Workout

### Theme
- `useTheme()` Hook aus `src/theme/index.js`
- `colors` (C), `spacing` (S), `radius` (R), `typography` (T)
- Immer C.bg, C.text, C.accent verwenden — nie hardcoded Farben
