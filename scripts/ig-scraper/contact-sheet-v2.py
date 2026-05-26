"""Planche-contact dynamique : auto-adapte COLS/ROWS au nombre de posts."""
from pathlib import Path
import json
import math
import re
from PIL import Image, ImageDraw, ImageFont

EXPORT = Path("/Users/lucas/dev/stv/assets/instagram-export")
manifest = json.loads((EXPORT / "manifest.json").read_text())
N = len(manifest)
print(f"manifest contient {N} posts")

THUMB = 280
PAD = 8
LABEL_H = 24
COLS = 5
ROWS = math.ceil(N / COLS)
W = COLS * THUMB + (COLS + 1) * PAD
H = ROWS * (THUMB + LABEL_H) + (ROWS + 1) * PAD

sheet = Image.new("RGB", (W, H), (245, 245, 245))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
except Exception:
    font = ImageFont.load_default()

for i, post in enumerate(manifest):
    row, col = divmod(i, COLS)
    x = PAD + col * (THUMB + PAD)
    y = PAD + row * (THUMB + LABEL_H + PAD)

    img_path = EXPORT / f"{post['shortcode']}.jpg"
    if not img_path.exists():
        # tente .jpeg/.png/.webp
        for ext in (".jpeg", ".png", ".webp"):
            alt = EXPORT / f"{post['shortcode']}{ext}"
            if alt.exists():
                img_path = alt
                break
    if not img_path.exists():
        draw.rectangle([x, y, x + THUMB, y + THUMB], fill=(180, 60, 60))
        draw.text((x + 6, y + 6), "MISSING", fill=(255, 255, 255), font=font)
    else:
        img = Image.open(img_path).convert("RGB")
        img.thumbnail((THUMB, THUMB), Image.LANCZOS)
        canvas = Image.new("RGB", (THUMB, THUMB), (220, 220, 220))
        canvas.paste(img, ((THUMB - img.width) // 2, (THUMB - img.height) // 2))
        sheet.paste(canvas, (x, y))

    cap = post.get("caption", "")
    mauth = re.match(r"\d+\s+likes?,\s+\d+\s+comments?\s+-\s+([a-z0-9._]+)\s+on\s+([A-Z][a-z]+\s+\d+,\s+\d+)", cap)
    auth = mauth.group(1) if mauth else "?"
    date = mauth.group(2)[:12] if mauth else ""
    label = f"{i+1:03d} @{auth[:11]} {date}"
    draw.rectangle([x, y + THUMB, x + THUMB, y + THUMB + LABEL_H], fill=(30, 30, 30))
    draw.text((x + 4, y + THUMB + 5), label, fill=(255, 255, 255), font=font)

out = EXPORT / "contact-sheet-v2.jpg"
sheet.save(out, "JPEG", quality=85)
print(f"saved {out}  size={sheet.size}  ({out.stat().st_size//1024} KB)")
