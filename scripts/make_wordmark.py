#!/usr/bin/env python3
"""
make_wordmark.py — Erzeugt die keepr-Wortmarke: Logo-Glyph (als "K") + "eepr".
Weiß wird transparent gestanzt. Ergebnis: assets/keepr-wordmark.png (transparent).
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON = os.path.join(ROOT, "assets", "icon.png")
OUT = os.path.join(ROOT, "assets", "keepr-wordmark.png")
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

GLYPH_H = 240          # Höhe des Logo-Glyphs
GAP = 24               # Abstand Glyph ↔ Text
FONT_SIZE = 200        # "eepr"

# 1) Glyph laden, Weiß → transparent
img = Image.open(ICON).convert("RGBA")
px = img.getdata()
out = []
for r, g, b, a in px:
    if r > 232 and g > 232 and b > 232:
        out.append((r, g, b, 0))
    else:
        out.append((r, g, b, a))
img.putdata(out)
# auf Inhalt zuschneiden
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)
# skalieren auf GLYPH_H
gw = int(img.width * GLYPH_H / img.height)
glyph = img.resize((gw, GLYPH_H), Image.LANCZOS)

# 2) Text "eepr" rendern (schwarz)
font = ImageFont.truetype(FONT, FONT_SIZE)
tmp = Image.new("RGBA", (10, 10))
d = ImageDraw.Draw(tmp)
tb = d.textbbox((0, 0), "eepr", font=font)
tw, th = tb[2] - tb[0], tb[3] - tb[1]

# 3) Canvas zusammensetzen
H = max(GLYPH_H, th + 20)
W = gw + GAP + tw + 10
canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
canvas.paste(glyph, (0, (H - GLYPH_H) // 2), glyph)
d = ImageDraw.Draw(canvas)
# Text vertikal an Glyph-Mitte, leicht abgesenkt für Grundlinien-Optik
ty = (H - th) // 2 - tb[1]
d.text((gw + GAP, ty), "eepr", font=font, fill=(0, 0, 0, 255))

canvas.save(OUT)
print("✅ Wortmarke:", OUT, canvas.size)
