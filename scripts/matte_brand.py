#!/usr/bin/env python3
"""
matte_brand.py — keepr-Wortmarke MITTIG auf die Wand, Person läuft davor (echtes Matting).

Pro Frame: Person mit rembg (u2net_human_seg) freistellen → Logo auf den Hintergrund →
freigestellte Person wieder davor. So verdeckt die Person das Logo wie bei GOWOD.

  python3 scripts/matte_brand.py <input.mp4> <output.mp4> [opacity] [width_frac]

Beispiel: python3 scripts/matte_brand.py in.mp4 out.mp4 0.22 0.72
"""
import os, sys, subprocess, tempfile, shutil
from PIL import Image
from rembg import remove, new_session

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WM_PATH = os.path.join(ROOT, "assets", "keepr-wordmark.png")

def fps_of(path):
    r = subprocess.check_output(["ffprobe","-v","error","-select_streams","v:0",
        "-show_entries","stream=r_frame_rate","-of","default=nw=1:nk=1",path]).decode().strip()
    n,d = (r.split("/")+["1"])[:2]
    return float(n)/float(d or 1)

def main():
    if len(sys.argv) < 3:
        print("usage: matte_brand.py <in.mp4> <out.mp4> [opacity] [width_frac]"); sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    opacity = float(sys.argv[3]) if len(sys.argv) > 3 else 0.22
    wfrac   = float(sys.argv[4]) if len(sys.argv) > 4 else 0.72

    fps = fps_of(src)
    tmp = tempfile.mkdtemp(prefix="matte_")
    fin, fout = os.path.join(tmp,"in"), os.path.join(tmp,"out")
    os.makedirs(fin); os.makedirs(fout)
    subprocess.run(["ffmpeg","-loglevel","error","-y","-i",src,os.path.join(fin,"f%05d.png")], check=True)

    frames = sorted(os.listdir(fin))
    if not frames: print("keine Frames"); sys.exit(1)
    first = Image.open(os.path.join(fin,frames[0])); W,H = first.size

    # Wortmarke vorbereiten (einmal)
    wm = Image.open(WM_PATH).convert("RGBA")
    sc = int(W*wfrac)/wm.width
    wm = wm.resize((int(wm.width*sc), int(wm.height*sc)), Image.LANCZOS)
    a = wm.split()[3].point(lambda v:int(v*opacity)); wm.putalpha(a)
    wx, wy = (W-wm.width)//2, (H-wm.height)//2

    sess = new_session("u2net_human_seg")
    n = len(frames)
    for i,fn in enumerate(frames):
        frame = Image.open(os.path.join(fin,fn)).convert("RGBA")
        bg = frame.copy()
        bg.alpha_composite(wm,(wx,wy))
        person = remove(frame, session=sess)   # RGBA, BG transparent
        bg.alpha_composite(person)
        bg.convert("RGB").save(os.path.join(fout,fn))
        if i % 30 == 0: print(f"  {i+1}/{n}", flush=True)

    subprocess.run(["ffmpeg","-loglevel","error","-y","-framerate",f"{fps}",
        "-i",os.path.join(fout,"f%05d.png"),"-c:v","libx264","-pix_fmt","yuv420p",
        "-movflags","+faststart",dst], check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    print("✅ fertig:", dst)

if __name__ == "__main__":
    main()
