#!/bin/bash
# upload_ingredients.sh — Bilder + SQL auf den Pi laden
#
# Voraussetzung: scripts/genimages_pollinations.js wurde ausgeführt
# Ausführen:     bash scripts/upload_ingredients.sh

PI_USER="manuel"
PI_HOST="192.168.2.40"
PI_IMG_DIR="/home/manuel/speisekammer-backend/uploads/ingredients"
PI_DB="/home/manuel/speisekammer-backend/speisekammer.db"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Pixabay-Ordner (JPG) bevorzugen, Pollinations-Ordner (PNG) als Fallback
if [ -d "$SCRIPT_DIR/ingredient_images_pixabay" ] && [ "$(ls "$SCRIPT_DIR/ingredient_images_pixabay"/*.jpg 2>/dev/null | wc -l | tr -d ' ')" -gt 0 ]; then
  IMG_DIR="$SCRIPT_DIR/ingredient_images_pixabay"
  IMG_EXT="jpg"
else
  IMG_DIR="$SCRIPT_DIR/ingredient_images_pollinations"
  IMG_EXT="png"
fi
SQL_FILE="$SCRIPT_DIR/insert_ingredients.sql"

echo ""
echo "🚀 keepr Zutaten-Upload"
echo ""

# Bilder zählen
IMG_COUNT=$(ls "$IMG_DIR"/*."$IMG_EXT" 2>/dev/null | wc -l | tr -d ' ')
if [ "$IMG_COUNT" -eq 0 ]; then
  echo "❌ Keine Bilder in $IMG_DIR gefunden."
  echo "   Erst ausführen: node scripts/genimages_pixabay.js"
  exit 1
fi
echo "📷 $IMG_COUNT Bilder ($IMG_EXT) aus $IMG_DIR → werden hochgeladen..."

# Bilder auf Pi kopieren
scp -o StrictHostKeyChecking=no "$IMG_DIR"/*."$IMG_EXT" "$PI_USER@$PI_HOST:$PI_IMG_DIR/"
if [ $? -ne 0 ]; then
  echo "❌ SCP fehlgeschlagen"
  exit 1
fi
echo "✅ Bilder hochgeladen"

# SQL auf Pi ausführen
if [ -f "$SQL_FILE" ]; then
  echo "🗄️  Datenbank aktualisieren..."
  scp -o StrictHostKeyChecking=no "$SQL_FILE" "$PI_USER@$PI_HOST:/tmp/insert_ingredients.sql"
  ssh -o StrictHostKeyChecking=no "$PI_USER@$PI_HOST" \
    "sqlite3 $PI_DB < /tmp/insert_ingredients.sql && echo '✅ DB aktualisiert' || echo '❌ DB-Fehler'"
else
  echo "⚠️  SQL-Datei nicht gefunden — nur Bilder wurden hochgeladen"
fi

echo ""
echo "✅ Fertig! Bilder sind jetzt im Pi verfügbar."
echo ""
