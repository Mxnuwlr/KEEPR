# KEEPR öffentlich erreichbar machen — Cloudflare Tunnel

Macht den Pi-Backend (`http://localhost:3001`) als **`https://api.keepr-app.de`** erreichbar —
ohne Portfreigabe im Router, mit automatischem HTTPS. Kein offener Port am Anschluss.

**Status: ✅ LIVE seit 2026-07-02.** `https://api.keepr-app.de` erreichbar (extern getestet: 401 ohne Token,
HTTP/2, Cloudflare-TLS). App `DEFAULT_BASE_URL` steht auf `https://api.keepr-app.de`.
- Tunnel-Name: `keepr` · UUID: `2351f575-aec1-4a82-ac0f-1c7b3f4aa0ee`
- systemd-Dienst: `cloudflared-keepr.service` (User `manuel`, Autostart, Restart=always)
- Config: `/home/manuel/.cloudflared/config.yml` · Credentials: `~/.cloudflared/<UUID>.json`
- Verwaltung: `sudo systemctl {status,restart} cloudflared-keepr.service`

Die folgenden Schritte sind bereits ausgeführt (Doku zur Nachvollziehbarkeit):

## Schritte (auf dem Pi, `ssh raspi`)

```bash
# 1. Tunnel anlegen (erzeugt UUID + Credentials-Datei in ~/.cloudflared/<UUID>.json)
cloudflared tunnel create keepr

# 2. DNS-Route setzen (legt CNAME api.keepr-app.de -> Tunnel in Cloudflare an)
cloudflared tunnel route dns keepr api.keepr-app.de

# 3. Config schreiben  (UUID aus Schritt 1 einsetzen)
cat > ~/.cloudflared/config.yml <<'YAML'
tunnel: <UUID>
credentials-file: /home/manuel/.cloudflared/<UUID>.json
ingress:
  - hostname: api.keepr-app.de
    service: http://localhost:3001
  - service: http_status:404
YAML

# 4. Als Systemdienst installieren (Autostart nach Reboot)
sudo cloudflared service install
sudo systemctl enable --now cloudflared
systemctl is-active cloudflared
```

## Test

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.keepr-app.de/api/config/gemini   # erwartet 401 (kein Token) = erreichbar
```

## App auf HTTPS umstellen

In `src/api/client.js`:
```js
export const DEFAULT_BASE_URL = 'https://api.keepr-app.de';   // vorher: http://192.168.2.40:3001
```
Danach EAS/Expo-Neustart. Bereits eingeloggte Geräte: ggf. in *Einstellungen → Server-URL* neu setzen
(oder App-Daten zurücksetzen), da die alte LAN-URL in AsyncStorage liegen kann.

## Wichtig für die Server-Härtung
- Der Rate-Limiter nutzt `CF-Connecting-IP` (von Cloudflare gesetzt) → durch den Tunnel korrekt.
- `trust proxy` ist im Backend bereits gesetzt.
- Nur `api.keepr-app.de` wird geroutet; alles andere → 404 (kein direkter Port am Pi offen).
