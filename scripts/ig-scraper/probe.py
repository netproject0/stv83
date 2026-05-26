"""Etape 1 : sonde le profil @stvarois83 sans authentification.

Objectif : voir ce qu'on recupere reellement (HTML, JSON embarque, login wall).
On ne telecharge rien, on ecrit juste le HTML brut + un resume.
"""
from pathlib import Path
import re
import json

from scrapling.fetchers import StealthyFetcher

PROFILE = "https://www.instagram.com/stvarois83/"
OUT = Path(__file__).parent / "probe-out"
OUT.mkdir(exist_ok=True)


def main():
    print(f"[probe] GET {PROFILE}")
    resp = StealthyFetcher.fetch(
        PROFILE,
        headless=True,
        network_idle=True,
        wait=2000,
        google_search=True,
        block_ads=True,
    )
    print(f"[probe] status={resp.status}  bytes={len(resp.body)}")

    html_path = OUT / "profile.html"
    html_path.write_bytes(resp.body)
    print(f"[probe] HTML saved -> {html_path}")

    text = resp.body.decode("utf-8", errors="replace")

    # 1) Login wall ?
    if "loginForm" in text or "Sign up" in text and "Log in" in text:
        print("[probe] login-wall words present (Log in / Sign up)")
    if "PolarisLoggedOutHomepageContentContainer" in text:
        print("[probe] !! redirected to logged-out homepage (no profile data)")

    # 2) OG image (profile pic) ?
    og = re.search(r'<meta property="og:image" content="([^"]+)"', text)
    print(f"[probe] og:image = {og.group(1)[:120] if og else None!r}")

    # 3) Combien de URLs /p/<shortcode>/ vues dans le HTML ?
    shortcodes = sorted(set(re.findall(r'/p/([A-Za-z0-9_-]{5,})/', text)))
    print(f"[probe] shortcodes vus dans HTML: {len(shortcodes)}")
    for sc in shortcodes[:10]:
        print(f"        - {sc}")

    # 4) Recherche JSON embarque (pattern habituel IG)
    candidates = []
    for m in re.finditer(r'<script type="application/json"[^>]*>(.*?)</script>', text, re.DOTALL):
        blob = m.group(1)
        if "stvarois83" in blob or "ProfilePage" in blob or "shortcode" in blob:
            candidates.append(blob)
    print(f"[probe] JSON blobs avec user/shortcode: {len(candidates)}")
    if candidates:
        biggest = max(candidates, key=len)
        (OUT / "embedded.json").write_text(biggest, encoding="utf-8")
        print(f"[probe] plus gros blob ({len(biggest)} chars) -> probe-out/embedded.json")


if __name__ == "__main__":
    main()
