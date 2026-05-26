# Scraper Instagram — @stvarois83

Outillage pour exporter les posts du compte Instagram public **@stvarois83**
(et autres comptes), puis sélectionner les visuels à intégrer dans la galerie
du site `preprod/`.

## Pourquoi ce dossier existe

STV n'avait que **6 photos** sur le site et le brief client demande **18-24
visuels**. Comme la majorité de leur production photo vit sur Instagram,
on récupère directement depuis là — en attendant que le client pousse
l'export Meta officiel ou ses photos téléphone.

## Limitation découverte

Le compte @stvarois83 n'a publié que **14 posts** sur ~3 ans (mai 2023 →
mars 2026). Sur ces 14, ~6 sont des Reels avec un bouton play en plein milieu
de la vignette, donc inutilisables. **Solde exploitable : 7 photos.** Pour
étoffer la galerie au-delà, il faut absolument que STV fournisse ses
photos téléphone (questions Q1-Q2 du brief client).

## Stack

- **uv** pour la gestion Python (auto-télécharge CPython 3.12)
- **Scrapling 0.4.x** + **patchright** (Chromium furtif via Playwright patché)
- **Pillow** pour les conversions WebP et la planche-contact

## Fichiers

| Fichier | Rôle |
|---|---|
| `probe.py` | Sonde simple : récupère le HTML profil + cherche les shortcodes visibles |
| `scrape.py` | Scraper anonyme — limité à 12 posts à cause du login wall IG |
| `scrape_auth.py` | Scraper authentifié — lit `.env` (cookie sessionid), scroll infini, récupère tout l'historique |
| `integrate.py` | Sélection → copie/renomme/WebP vers `preprod/public/images/` |
| `contact-sheet.py` | Planche-contact 4×3 (12 posts) |
| `contact-sheet-v2.py` | Planche-contact dynamique N posts |
| `.env.example` | Template pour le cookie IG (la vraie clé va dans `.env`, gitignoré) |

## Comment relancer (futur)

```bash
cd scripts/ig-scraper
uv sync                          # installe deps si pas déjà fait
uv run scrapling install         # télécharge Chromium si pas déjà fait

# 1. Récupérer le cookie sessionid IG (procédure dans .env.example)
cp .env.example .env             # puis éditer .env

# 2. Lancer le scrape auth (incrémental — saute les posts déjà dans le manifest)
uv run python scrape_auth.py

# 3. Visualiser le résultat
uv run python contact-sheet-v2.py
open /Users/lucas/dev/stv/assets/instagram-export/contact-sheet-v2.jpg

# 4. Éditer integrate.py (liste SELECTION) puis intégrer dans le site
uv run python integrate.py
```

## Sécurité

- `.env` (cookie sessionid) est **gitignoré** par la règle globale `.env`.
  Ne JAMAIS le commit, ne JAMAIS l'envoyer ailleurs.
- Le cookie peut être révoqué côté Instagram : *Paramètres → Sécurité →
  Se déconnecter de toutes les sessions*.
- Le scraper est **incrémental** : il charge `manifest.json` existant et
  saute les shortcodes déjà téléchargés.

## Limite de résolution

Les URL `og:image` d'Instagram renvoient des visuels en **640×640** max
(ou variantes équivalentes). Pour de la vraie HD (originaux), il n'y a
qu'une voie : l'**export Meta officiel** que le client doit déclencher
depuis ses paramètres Instagram (procédure dans le doc client
`instructions-export-meta-client.md`).
