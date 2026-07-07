# App Store „Privacy Nutrition Label" — KEEPR

Vorlage für die Angaben in App Store Connect (*App Privacy*). Basierend auf dem tatsächlichen
Datenmodell der App. **Wichtig:** Keine Werbe-/Tracking-SDKs → bei allem „**Used for Tracking: No**".

## Data used to track you
**Keine.** Die App verfolgt Nutzer nicht über Apps/Websites anderer Firmen hinweg.

## Data linked to you
(mit dem Konto verknüpft, NICHT für Tracking, sondern für App-Funktion & Analyse)

| Apple-Kategorie | Konkret | Zweck |
|---|---|---|
| **Contact Info → Email Address** | Konto-E-Mail | App Functionality |
| **Health & Fitness → Health** | Gewicht, Körperfett, Schlaf, Stress, Erholung, Ruhepuls, Mobility, Fortschrittsfotos | App Functionality |
| **Health & Fitness → Fitness** | Trainingspläne, Workouts, Kraft-Sätze, Aktivitäten | App Functionality |
| **User Content → Photos or Videos** | Fortschrittsfotos, Rezeptbilder | App Functionality |
| **User Content → Other User Content** | Rezepte, Notizen, Ernährungs-/Inventardaten | App Functionality |
| **Identifiers → User ID** | interne Konto-ID | App Functionality |
| **Sensitive Info** | Gesundheitsdaten gelten als sensibel | App Functionality |

## Data not linked to you
| Apple-Kategorie | Konkret | Zweck |
|---|---|---|
| **Diagnostics / Usage** *(nur falls zutreffend)* | Server-Logs/IP zur Absicherung | App Functionality / Analytics (Security) |

## Wichtige Hinweise für die Einreichung
- **Account Deletion:** Apple verlangt eine In-App-Löschfunktion → ✅ vorhanden (*Einstellungen → Konto endgültig löschen*, `DELETE /api/account`).
- **Health-Daten & Drittanbieter:** Fotos/Profildaten gehen zur KI-Analyse an Google (Gemini). Das ist in der Datenschutzerklärung offengelegt; im Label bleibt es „linked, not tracking".
- **HealthKit:** Aktuell NICHT integriert (erst mit bezahltem Apple-Konto). Solange kein HealthKit → keine HealthKit-spezifischen Angaben nötig.
- **Datenschutz-URL:** In App Store Connect Pflichtfeld → https://keepr-app.de/datenschutz (muss vor Einreichung online sein).
