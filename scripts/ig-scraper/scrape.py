"""Scraper @stvarois83 : grid -> shortcodes -> post pages -> HD images.

Strategie en 2 etapes (anonyme, sans login) :
  1. Charge le profil + scroll infini -> recolte tous les shortcodes /p/<id>/
  2. Pour chaque shortcode, fetch la page du post et extrait :
       - og:image (URL HD du visuel)
       - og:description (legende)
       - <time datetime=...> (date publication)
  3. Telecharge chaque image dans assets/instagram-export/
  4. Ecrit un manifest.json avec tout (shortcode, url HD, legende, date, fichier local)
"""
from __future__ import annotations
from pathlib import Path
import json
import re
import sys
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from scrapling.fetchers import StealthyFetcher

PROFILE = "https://www.instagram.com/stvarois83/"
PROFILE_URL = "https://www.instagram.com"
EXPORT_DIR = Path("/Users/lucas/dev/stv/assets/instagram-export")
EXPORT_DIR.mkdir(parents=True, exist_ok=True)
MANIFEST = EXPORT_DIR / "manifest.json"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)


def scroll_to_bottom(page):
    """Page-action : scroll jusqu'a ne plus charger de nouveau contenu."""
    print("[scroll] starting infinite scroll loop", flush=True)
    last_count = 0
    stable_rounds = 0
    for i in range(40):  # plafond dur
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(2200)
        try:
            count = page.evaluate("document.querySelectorAll('a[href*=\"/p/\"]').length")
        except Exception:
            count = -1
        print(f"[scroll] round {i+1:2d} -> {count} post-links", flush=True)
        if count == last_count:
            stable_rounds += 1
            if stable_rounds >= 3:
                print("[scroll] stable for 3 rounds, stopping", flush=True)
                break
        else:
            stable_rounds = 0
            last_count = count


def collect_shortcodes() -> list[str]:
    print(f"[1/3] fetching {PROFILE} with infinite scroll", flush=True)
    resp = StealthyFetcher.fetch(
        PROFILE,
        headless=True,
        network_idle=True,
        wait=3000,
        google_search=True,
        block_ads=True,
        page_action=scroll_to_bottom,
        timeout=120000,
    )
    print(f"[1/3] status={resp.status}  bytes={len(resp.body)}", flush=True)
    text = resp.body.decode("utf-8", errors="replace")
    shortcodes = sorted(set(re.findall(r'/p/([A-Za-z0-9_-]{5,})/', text)))
    print(f"[1/3] collected {len(shortcodes)} unique shortcodes", flush=True)
    return shortcodes


def fetch_post_meta(shortcode: str) -> dict | None:
    url = f"https://www.instagram.com/p/{shortcode}/"
    try:
        resp = StealthyFetcher.fetch(
            url,
            headless=True,
            network_idle=False,
            wait=1500,
            google_search=True,
            block_ads=True,
            timeout=45000,
        )
    except Exception as e:
        print(f"  ! fetch failed: {e}", flush=True)
        return None
    if resp.status != 200:
        print(f"  ! status {resp.status}", flush=True)
        return None
    text = resp.body.decode("utf-8", errors="replace")

    og_image = re.search(r'<meta property="og:image" content="([^"]+)"', text)
    og_desc = re.search(r'<meta property="og:description" content="([^"]+)"', text)
    og_title = re.search(r'<meta property="og:title" content="([^"]+)"', text)
    dt = re.search(r'<meta property="article:published_time" content="([^"]+)"', text)

    if not og_image:
        # parfois og:image est dans un script JSON-LD
        ld = re.search(r'"contentUrl":\s*"([^"]+)"', text)
        og_image_url = ld.group(1) if ld else None
    else:
        og_image_url = og_image.group(1).replace("&amp;", "&")

    return {
        "shortcode": shortcode,
        "post_url": url,
        "image_url": og_image_url,
        "caption": (og_desc.group(1) if og_desc else "")[:2000],
        "title": og_title.group(1) if og_title else "",
        "published_at": dt.group(1) if dt else None,
    }


def download(image_url: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 1000:
        return True
    req = Request(image_url, headers={"User-Agent": USER_AGENT, "Referer": "https://www.instagram.com/"})
    try:
        with urlopen(req, timeout=30) as r:
            data = r.read()
        dest.write_bytes(data)
        return True
    except Exception as e:
        print(f"    ! download failed: {e}", flush=True)
        return False


def main():
    shortcodes = collect_shortcodes()
    if not shortcodes:
        print("aborting: no shortcodes found", flush=True)
        sys.exit(1)

    manifest = []
    for i, sc in enumerate(shortcodes, 1):
        print(f"[2/3] {i:3d}/{len(shortcodes)}  {sc}", flush=True)
        meta = fetch_post_meta(sc)
        if not meta or not meta["image_url"]:
            print("  skipped (no image url)", flush=True)
            continue

        ext = Path(urlparse(meta["image_url"]).path).suffix or ".jpg"
        if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            ext = ".jpg"
        local = EXPORT_DIR / f"{sc}{ext}"
        print(f"  -> {meta['image_url'][:100]}...", flush=True)
        if download(meta["image_url"], local):
            meta["local_file"] = str(local.relative_to(EXPORT_DIR.parent.parent))
            print(f"  saved {local.name} ({local.stat().st_size//1024} KB)", flush=True)
        manifest.append(meta)
        time.sleep(1.5)  # politesse

    print(f"[3/3] writing manifest -> {MANIFEST}", flush=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"DONE  posts={len(manifest)}  dir={EXPORT_DIR}", flush=True)


if __name__ == "__main__":
    main()
