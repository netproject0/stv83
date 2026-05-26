"""Genere une planche-contact 4x3 des 12 photos IG pour visualisation."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

EXPORT = Path("/Users/lucas/dev/stv/assets/instagram-export")
manifest = json.loads((EXPORT / "manifest.json").read_text())

THUMB = 320
PAD = 10
LABEL_H = 28
COLS, ROWS = 4, 3
W = COLS * THUMB + (COLS + 1) * PAD
H = ROWS * (THUMB + LABEL_H) + (ROWS + 1) * PAD

sheet = Image.new("RGB", (W, H), (245, 245, 245))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
except Exception:
    font = ImageFont.load_default()

for i, post in enumerate(manifest):
    row, col = divmod(i, COLS)
    x = PAD + col * (THUMB + PAD)
    y = PAD + row * (THUMB + LABEL_H + PAD)

    img_path = EXPORT / f"{post['shortcode']}.jpg"
    img = Image.open(img_path).convert("RGB")
    img.thumbnail((THUMB, THUMB), Image.LANCZOS)
    # center-crop into THUMB x THUMB
    canvas = Image.new("RGB", (THUMB, THUMB), (220, 220, 220))
    cx = (THUMB - img.width) // 2
    cy = (THUMB - img.height) // 2
    canvas.paste(img, (cx, cy))
    sheet.paste(canvas, (x, y))

    # label
    import re
    cap = post["caption"]
    mauth = re.match(r"\d+\s+likes?,\s+\d+\s+comments?\s+-\s+([a-z0-9._]+)", cap)
    auth = mauth.group(1) if mauth else "?"
    label = f"{i+1:02d}  @{auth}  {post['shortcode']}"
    draw.rectangle([x, y + THUMB, x + THUMB, y + THUMB + LABEL_H], fill=(30, 30, 30))
    draw.text((x + 6, y + THUMB + 6), label, fill=(255, 255, 255), font=font)

out = EXPORT / "contact-sheet.jpg"
sheet.save(out, "JPEG", quality=88)
print(f"saved {out}  {sheet.size}")
