#!/usr/bin/env bash
# upload_mobility.sh — Mobility-Medien (Standbilder/Videos) auf den Pi hochladen
#
# Lädt scripts/mobility_media/*.png und *.mp4 nach
#   raspi:/home/manuel/speisekammer-backend/uploads/mobility/
# (vom Backend statisch unter /uploads/mobility/<slug>.(png|mp4) ausgeliefert).
#
# Voraussetzung: SSH-Host "raspi" konfiguriert (siehe ~/.ssh/config).
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)/mobility_media"
DEST="raspi:/home/manuel/speisekammer-backend/uploads/mobility/"

if [ ! -d "$SRC" ]; then echo "Kein Quellordner: $SRC"; exit 1; fi

echo "📂 Lege Zielordner an…"
ssh raspi "mkdir -p /home/manuel/speisekammer-backend/uploads/mobility"

echo "⬆️  Lade Medien hoch…"
shopt -s nullglob
files=("$SRC"/*.png "$SRC"/*.mp4)
if [ ${#files[@]} -eq 0 ]; then echo "Keine .png/.mp4 in $SRC"; exit 0; fi
scp "${files[@]}" "$DEST"

echo "✅ Fertig — $(ls "$SRC"/*.png "$SRC"/*.mp4 2>/dev/null | wc -l | tr -d ' ') Dateien hochgeladen."
echo "   Der Player zeigt Medien automatisch, sobald die Datei zum slug existiert."
