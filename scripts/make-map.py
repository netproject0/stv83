#!/usr/bin/env python3
"""Génère la carte statique de la page contact (public/images/map-atelier.{jpg,webp}).

Assemble les tuiles CARTO Voyager (données OpenStreetMap) autour de l'atelier,
trace l'itinéraire d'accès réel (OSRM) depuis l'avenue Robert Brun, ajoute
l'épingle STV et l'étiquette adresse.

Usage :
    scripts/ig-scraper/.venv/bin/python3 scripts/make-map.py

⚠️ Après régénération, bumper CACHE_VERSION dans sw.js (remplacement in-place
d'une image mise en cache cache-first par le service worker).
"""

import io
import json
import math
import subprocess
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

# Atelier STV — 177 Montée batterie de la Montagne, La Seyne-sur-Mer
LAT, LON = 43.118065, 5.873483
ZOOM = 16
W, H = 1200, 800  # affichée en 600x400 (Retina 2x)
ROUTE_START = (5.8660, 43.1163)  # avenue Robert Brun, côté nord de la voie ferrée
TILES = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
OUT = Path(__file__).resolve().parent.parent / 'public' / 'images' / 'map-atelier.jpg'
UA = 'STV83-website-static-map/1.0 (contact.stv83@gmail.com) one-time generation'
ORANGE, ORANGE_DARK = '#E5620B', '#C05200'


def merc(lat: float, lon: float) -> tuple[float, float]:
    n = 2.0 ** ZOOM
    return ((lon + 180.0) / 360.0 * n * 256,
            (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n * 256)


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    return urllib.request.urlopen(req, timeout=20).read()


def main() -> None:
    xc, yc = merc(LAT, LON)
    x0, y0 = xc - W / 2, yc - H / 2

    canvas = Image.new('RGB', (W, H), '#FBF8F3')
    for tx in range(int(x0 // 256), int((x0 + W) // 256) + 1):
        for ty in range(int(y0 // 256), int((y0 + H) // 256) + 1):
            tile = Image.open(io.BytesIO(fetch(TILES.format(z=ZOOM, x=tx, y=ty)))).convert('RGB')
            canvas.paste(tile, (int(tx * 256 - x0), int(ty * 256 - y0)))

    canvas = ImageEnhance.Color(canvas).enhance(1.25)
    canvas = ImageEnhance.Contrast(canvas).enhance(1.08)
    d = ImageDraw.Draw(canvas)

    # Itinéraire réel via OSRM
    osrm = (f'https://router.project-osrm.org/route/v1/driving/'
            f'{ROUTE_START[0]},{ROUTE_START[1]};{LON},{LAT}?geometries=geojson&overview=full')
    coords = json.loads(fetch(osrm))['routes'][0]['geometry']['coordinates']
    pts = []
    for lon, lat in coords:
        px, py = merc(lat, lon)
        pts.append((px - x0, py - y0))
    d.line(pts, fill='white', width=13, joint='curve')
    d.line(pts, fill=ORANGE, width=8, joint='curve')
    sx, sy = pts[0]
    d.ellipse([sx - 11, sy - 11, sx + 11, sy + 11], fill='white', outline=ORANGE, width=4)

    try:
        font_b = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 26)
        font_s = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 17)
        font_t = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 15)
    except OSError:
        font_b = font_s = font_t = ImageFont.load_default()

    d.rounded_rectangle([sx - 128, sy + 16, sx + 128, sy + 44], radius=6, fill='white', outline=ORANGE, width=2)
    d.text((sx - 118, sy + 20), 'Depuis l’avenue Robert Brun', fill='#444444', font=font_t)

    # Épingle + étiquette adresse
    cx, cy = W // 2, H // 2
    pin_h, pin_w = 70, 52
    d.polygon([(cx, cy), (cx - pin_w // 2, cy - pin_h + 20), (cx + pin_w // 2, cy - pin_h + 20)], fill=ORANGE_DARK)
    d.ellipse([cx - pin_w // 2, cy - pin_h, cx + pin_w // 2, cy - pin_h + 40], fill=ORANGE_DARK, outline='white', width=3)
    d.ellipse([cx - 10, cy - pin_h + 10, cx + 10, cy - pin_h + 30], fill='white')
    bx, by = cx + 38, cy - pin_h - 4
    d.rounded_rectangle([bx, by, bx + 360, by + 70], radius=10, fill='white', outline=ORANGE_DARK, width=2)
    d.text((bx + 16, by + 9), 'STV 83', fill='#222222', font=font_b)
    d.text((bx + 16, by + 43), '177 Montée batterie de la Montagne', fill='#555555', font=font_s)

    # Attribution (obligation de licence OSM/CARTO)
    attr = '© OpenStreetMap contributors © CARTO'
    tw = d.textlength(attr, font=font_s)
    d.rectangle([W - tw - 18, H - 28, W, H], fill='white')
    d.text((W - tw - 10, H - 25), attr, fill='#555555', font=font_s)

    canvas.save(OUT, quality=84)
    subprocess.run(['cwebp', '-quiet', '-q', '80', str(OUT), '-o', str(OUT.with_suffix('.webp'))], check=True)
    print(f'OK → {OUT} + .webp — pensez à bumper CACHE_VERSION dans sw.js')


if __name__ == '__main__':
    main()
