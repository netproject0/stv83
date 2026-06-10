# STV 83 — stv-83.fr

Site vitrine de **Sablage Thermolaquage Varois** (La Seyne-sur-Mer, Var).
Site statique (HTML/CSS/JS sans build), **en production à la racine depuis le 10 juin 2026**.
Réalisé par Tech It Real.

## Déploiement

`git push origin main` → OVH déploie automatiquement (~20 s). **Le repo EST la racine web** :
tout fichier commité est servi publiquement, sauf exceptions du `.htaccess`
(`scripts/`, `*.md`, dotfiles, backups). `analyse-*/` et `assets/` sont gitignorés, donc jamais déployés.

Toujours vérifier après push : `curl -s https://stv-83.fr/<fichier> | grep <marqueur>`.

## ⚠️ Règle service worker (piège récurrent)

`sw.js` met en cache **cache-first** tous les assets statiques (css/js/images/fonts).
**Toute modification in-place d'un fichier existant** (même nom) doit s'accompagner d'un
bump de `CACHE_VERSION` dans `sw.js`, sinon les visiteurs récurrents gardent l'ancienne
version indéfiniment. Les fichiers *nouveaux* n'en ont pas besoin.

## Structure

| Chemin | Rôle |
|---|---|
| `index.html` | Home : héro, services, galerie 24 photos, nuancier RAL, avis Google, FAQ courte |
| `services/` | Hub + 3 pages : thermolaquage-portail, thermolaquage-aluminium, sablage-grenaillage |
| `faq.html`, `a-propos.html`, `contact.html`, `mentions-legales.html` | Pages secondaires |
| `css/style.css` | Styles (chaque page a aussi son CSS critique inline dans `<head>`) |
| `js/main.js` | Nav, filtres galerie, lightbox, nuancier RAL, formulaire mailto |
| `sw.js` | Service worker (cache-first assets, network-first HTML) |
| `public/images/` | Images optimisées servies (voir conventions) |
| `assets/images-sources*/` | Photos brutes client — **gitignorées, jamais commiter** |
| `scripts/monitor.sh` | Monitoring uptime/headers (cible la prod) |
| `scripts/make-map.py` | Régénère la carte OSM de contact.html (tuiles CARTO + itinéraire OSRM) |
| `scripts/ig-scraper/` | Scraper Instagram @stvarois83 (voir son README) |
| `llms.txt` | Résumé du site pour les moteurs IA |

## Conventions images

- Toujours la paire **`.jpg` + `.webp`** dans un `<picture>` (`cwebp -q 78`).
- Galerie : `<categorie>-N.jpg`, 1200 px bord long (`sips -Z 1200 -s formatOptions 78`),
  vignette `-600` + `srcset/sizes` pour les images > 700 px.
- Alt SEO : `"<sujet> thermolaqué <couleur> — STV 83 La Seyne-sur-Mer"` (varier les suffixes).
- Pièges vécus : photos client souvent **pivotées 90° sans EXIF** (`sips -r 90` avant resize),
  et vérifier l'espace colorimétrique (`sips -g space`, convertir CMJN → sRGB).

## SEO / contenus

- Canonicals → URLs racine ; sitemap avec extension image (24 photos) soumis en Search Console.
- JSON-LD : LocalBusiness (note 4,8/12 = vraie fiche Google, cid 3659100389396240980),
  Service, FAQPage, BreadcrumbList. Les avis affichés sont de **vrais avis Google** — ne
  jamais en inventer.
- Les redirections 301 `/preprod/*` → `/*` doivent rester en place (anciens liens).
