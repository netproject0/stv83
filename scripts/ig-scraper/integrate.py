"""Copie + renomme les 7 photos selectionnees vers preprod/public/images/
et genere les .webp correspondants.
"""
from pathlib import Path
from PIL import Image

SRC = Path("/Users/lucas/dev/stv/assets/instagram-export")
DST = Path("/Users/lucas/dev/stv/preprod/public/images")

# (shortcode_ig, nom_final_sans_ext, categorie)
SELECTION = [
    ("Cq8coqMosS0", "etageres-1",       "autres"),
    ("CrS2q2poZcd", "panneau-decoupe-1","autres"),
    ("DC1uUJ9Id5g", "atelier-1",        "autres"),
    ("DHBSnhgIDIx", "garde-corps-4",    "garde-corps"),
    ("DQGxLGuDD60", "garde-corps-5",    "garde-corps"),
    ("CpxllNTI2_h", "jante-1",          "autres"),
    ("C7Tk4nVo1we", "atelier-2",        "autres"),
]

for sc, name, _cat in SELECTION:
    src = SRC / f"{sc}.jpg"
    if not src.exists():
        print(f"!! missing {src}")
        continue
    img = Image.open(src).convert("RGB")
    w, h = img.size
    # JPEG (re-encode pour proprete + EXIF strip)
    jpg = DST / f"{name}.jpg"
    img.save(jpg, "JPEG", quality=88, optimize=True, progressive=True)
    # WebP
    webp = DST / f"{name}.webp"
    img.save(webp, "WEBP", quality=85, method=6)
    print(f"  {name:22} {w}x{h}  jpg={jpg.stat().st_size//1024}KB  webp={webp.stat().st_size//1024}KB")

print("done")
