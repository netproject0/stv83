"""Scraper IG authentifie (avec cookie sessionid) -> historique complet @stvarois83.

Lit le cookie depuis .env (variable IG_SESSIONID).
Reutilise les fonctions de scrape.py pour la partie fetch des posts.
"""
from __future__ import annotations
from pathlib import Path
import json
import os
import re
import sys
import time

from scrapling.fetchers import StealthyFetcher

# reuse helpers
sys.path.insert(0, str(Path(__file__).parent))
from scrape import fetch_post_meta, download, EXPORT_DIR, MANIFEST  # noqa: E402

PROFILE = "https://www.instagram.com/stvarois83/"


def load_env():
    env = {}
    p = Path(__file__).parent / ".env"
    if not p.exists():
        print(f"!! missing {p} -- copie .env.example vers .env et remplis IG_SESSIONID")
        sys.exit(1)
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    if not env.get("IG_SESSIONID"):
        print("!! IG_SESSIONID vide dans .env")
        sys.exit(1)
    return env


def scroll_to_bottom_authed(page):
    """Scroll plus agressif puisque IG charge davantage en logged-in."""
    print("[scroll] authed scroll loop", flush=True)
    last_count = 0
    stable_rounds = 0
    for i in range(120):  # jusqu'a ~200 posts
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(2500)
        try:
            count = page.evaluate("document.querySelectorAll('a[href*=\"/p/\"]').length")
        except Exception:
            count = -1
        print(f"[scroll] round {i+1:3d} -> {count} post-links", flush=True)
        if count == last_count:
            stable_rounds += 1
            if stable_rounds >= 4:
                print("[scroll] stable for 4 rounds, stopping", flush=True)
                break
        else:
            stable_rounds = 0
            last_count = count


def collect_shortcodes_authed(env):
    cookies = [
        {"name": "sessionid", "value": env["IG_SESSIONID"], "domain": ".instagram.com", "path": "/"},
    ]
    if env.get("IG_CSRFTOKEN"):
        cookies.append({"name": "csrftoken", "value": env["IG_CSRFTOKEN"], "domain": ".instagram.com", "path": "/"})
    if env.get("IG_DS_USER_ID"):
        cookies.append({"name": "ds_user_id", "value": env["IG_DS_USER_ID"], "domain": ".instagram.com", "path": "/"})

    print(f"[1/3] fetching {PROFILE} (authed)", flush=True)
    resp = StealthyFetcher.fetch(
        PROFILE,
        headless=True,
        network_idle=True,
        wait=3000,
        cookies=cookies,
        google_search=False,  # on est connecte, pas besoin de venir de google
        block_ads=True,
        page_action=scroll_to_bottom_authed,
        timeout=240000,
    )
    print(f"[1/3] status={resp.status}  bytes={len(resp.body)}", flush=True)
    text = resp.body.decode("utf-8", errors="replace")

    # Si on s'est fait jeter, la page va contenir un login form
    if "PolarisLoggedOut" in text and "PolarisLoggedIn" not in text:
        print("!! session cookie REFUSED by Instagram -- check sessionid value")
        # save HTML for debug
        (Path(__file__).parent / "probe-out" / "authed-rejected.html").write_text(text, encoding="utf-8")
        sys.exit(2)

    shortcodes = sorted(set(re.findall(r'/p/([A-Za-z0-9_-]{5,})/', text)))
    print(f"[1/3] collected {len(shortcodes)} unique shortcodes", flush=True)
    return shortcodes


def main():
    env = load_env()
    shortcodes = collect_shortcodes_authed(env)
    if not shortcodes:
        print("aborting: no shortcodes")
        sys.exit(1)

    # Charge le manifest existant pour ne pas re-fetch les posts deja recuperes
    existing = {}
    if MANIFEST.exists():
        existing = {p["shortcode"]: p for p in json.loads(MANIFEST.read_text())}
        print(f"[loaded] {len(existing)} posts deja dans manifest")

    manifest = list(existing.values())
    new_codes = [sc for sc in shortcodes if sc not in existing]
    print(f"[2/3] new shortcodes to fetch: {len(new_codes)}/{len(shortcodes)}")

    for i, sc in enumerate(new_codes, 1):
        print(f"[2/3] {i:3d}/{len(new_codes)}  {sc}", flush=True)
        meta = fetch_post_meta(sc)
        if not meta or not meta["image_url"]:
            print("  skipped (no image url)")
            continue
        from urllib.parse import urlparse
        ext = Path(urlparse(meta["image_url"]).path).suffix or ".jpg"
        if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            ext = ".jpg"
        local = EXPORT_DIR / f"{sc}{ext}"
        print(f"  -> {meta['image_url'][:90]}...")
        if download(meta["image_url"], local):
            meta["local_file"] = str(local.relative_to(EXPORT_DIR.parent.parent))
            print(f"  saved {local.name} ({local.stat().st_size//1024} KB)")
        manifest.append(meta)
        time.sleep(1.2)

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"DONE  total={len(manifest)}  added={len(manifest)-len(existing)}  dir={EXPORT_DIR}")


if __name__ == "__main__":
    main()
