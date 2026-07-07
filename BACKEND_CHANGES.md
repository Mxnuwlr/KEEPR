# Backend-Änderungen (Raspberry Pi) — keepr

Backend: **ein** `server.js` (better-sqlite3) unter `/home/manuel/speisekammer-backend/`,
läuft als systemd-Service `speisekammer.service`. DB: `speisekammer.db`.

## ✅ DEPLOYED (auf dem Pi live, end-to-end getestet)

Stand: alle App-Features sind serverseitig umgesetzt, der Service läuft. Vor jeder
Änderung wurde `server.js` gesichert (`server.js.bak.*`).

1. **Freie Aktivitäten** — `POST /api/training/complete` akzeptiert jetzt `sessionId:null`
   plus `sportType, title, calories, distance, avgHr, manualActivity`. Neue Spalten in
   `completed_workouts`: `title, calories, distance, avg_hr, manual_activity`.
   `GET /api/calendar/day` gibt sie in `training.completedAll` zurück (focus = `COALESCE(ts.focus, cw.title)`).
2. **Account löschen** — `DELETE /api/account` (löscht alle user-bezogenen Tabellen + users-Zeile).
3. **Passwort ändern** — `POST /api/account/password` `{ currentPassword, newPassword }` (bcryptjs).
4. **Einheit bearbeiten/verschieben** — `PATCH /api/training/session/:id`
   (`focus, sport_type, duration, intensity, day_index, is_rest, steps`).
5. **Strukturierte Workouts** — neue Spalte `steps` (JSON) in `training_sessions`;
   Gemini-Prompt in `/api/training/generate` fordert `steps` an; `plan/save`, `generate`,
   `GET /api/training/plan` und `calendar/day` reichen `steps` durch (round-trip getestet).
6. **Härtung** — Rate-Limit auf `POST /api/join-household` (max 8/min → 429);
   SSRF-Schutz in `POST /api/recipes/import-url` (blockt private IPs/localhost/non-http(s)).

Migrationen laufen idempotent beim Service-Start (ALTER TABLE in try/catch).

## ⏳ Bewusst NICHT umgesetzt (Begründung)

- **Gemini-Key-Proxy** — bleibt vorerst: Der Client holt den Key (`GET /api/config/gemini`)
  und ruft Gemini an 9 Stellen direkt auf. Ein Proxy (`POST /api/ai/generate`) wäre ein
  größerer, risikoreicher Umbau über alle KI-Funktionen. Für den aktuellen privaten/LAN-
  Betrieb unkritisch. **Vor einem öffentlichen App-Store-Launch nachziehen.**
- **HTTPS-Default** — Server läuft per HTTP im LAN (`http://192.168.2.40:3001`).
  Für öffentlichen Betrieb: festen HTTPS-Endpunkt (z.B. Cloudflare Tunnel) als Default
  setzen. Organisatorische Entscheidung.
