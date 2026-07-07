#!/usr/bin/env bash
# brand_and_upload_mobility.sh — keepr-Wortmarke dezent auf alle Mobility-Medien + Upload.
# Einfach & schnell: flaches, zentriertes Wasserzeichen (kein Matting). Video + Poster gleich.
#
# Quelle: assets/keepr-wordmark.png (scripts/make_wordmark.py). Liest scripts/mobility_media/,
# schreibt scripts/mobility_media_branded/, lädt auf den Pi.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)/.."
SRC="$ROOT/scripts/mobility_media"
OUT="$ROOT/scripts/mobility_media_branded"
WM="$ROOT/assets/keepr-wordmark.png"
DEST="raspi:/home/manuel/speisekammer-backend/uploads/mobility/"

AA=0.13          # Deckkraft Wasserzeichen
VFRAC=0.70       # Wortmarken-Breite Video
PFRAC=0.42       # Wortmarken-Breite Poster

[ -f "$WM" ] || { echo "Wortmarke fehlt — erst: python3 scripts/make_wordmark.py"; exit 1; }
mkdir -p "$OUT"
ssh raspi "mkdir -p /home/manuel/speisekammer-backend/uploads/mobility"
shopt -s nullglob

brand() {  # $1 in  $2 out  $3 frac  $4 isvideo
  local W; W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$1")
  local wmw; wmw=$(python3 -c "print(max(60,int($W*$3)))")
  local fc="[1:v]format=rgba,scale=${wmw}:-1,colorchannelmixer=aa=${AA}[wm];[0:v][wm]overlay=(W-w)/2:(H-h)/2"
  if [ "$4" = 1 ]; then
    ffmpeg -loglevel error -y -i "$1" -i "$WM" -filter_complex "$fc" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "$2"
  else
    ffmpeg -loglevel error -y -i "$1" -i "$WM" -filter_complex "$fc" -frames:v 1 "$2"
  fi
}

n=0
for f in "$SRC"/*.mp4; do b=$(basename "$f"); brand "$f" "$OUT/$b" "$VFRAC" 1; echo "🎬 $b"; n=$((n+1)); done
for f in "$SRC"/*.png; do b=$(basename "$f"); brand "$f" "$OUT/$b" "$PFRAC" 0; echo "🖼️  $b"; n=$((n+1)); done

if [ "$n" -eq 0 ]; then echo "Nichts in $SRC."; exit 0; fi
files=("$OUT"/*.mp4 "$OUT"/*.png)
scp "${files[@]}" "$DEST"
echo "✅ $n Datei(en) gebrandet (einfach) + hochgeladen."
