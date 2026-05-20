#!/usr/bin/env bash
# ============================================================
# STV 83 — Monitoring externe automatisé
# ============================================================
# Vérifie chaque exécution :
#   1. Disponibilité du site (HTTP 200)
#   2. Validité du certificat SSL + jours restants
#   3. Score securityheaders.com
#   4. Score Mozilla Observatory
#   5. Headers HTTP critiques (HSTS, CSP, COOP, etc.)
#   6. Présence des sitemap.xml et robots.txt
#   7. JSON-LD valide sur la homepage
#
# Usage :
#   ./scripts/monitor.sh                  # rapport console
#   ./scripts/monitor.sh > rapport.txt    # rapport fichier
#   ./scripts/monitor.sh --json           # sortie JSON brute
#
# Programmation cron (1× / semaine, lundi 9h) :
#   0 9 * * 1 cd /Users/lucas/dev/stv && ./scripts/monitor.sh > /tmp/stv83-monitor.log 2>&1
#
# Dépendances : curl, jq, openssl
# ============================================================

set -u

# CONFIG
SITE_URL="${SITE_URL:-https://stv-83.fr}"
DOMAIN="${DOMAIN:-stv-83.fr}"
TIMEOUT=10
OUTPUT_FORMAT="${1:-console}"

# COULEURS (désactivées si pas tty ou en sortie JSON)
if [[ -t 1 && "$OUTPUT_FORMAT" != "--json" ]]; then
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[0;33m'
  RED=$'\033[0;31m'
  BLUE=$'\033[0;34m'
  BOLD=$'\033[1m'
  NC=$'\033[0m'
else
  GREEN=""
  YELLOW=""
  RED=""
  BLUE=""
  BOLD=""
  NC=""
fi

# RÉSULTATS (pour JSON)
declare -A RESULTS

# ──────────────────────────────────────────────────────────────
# 1. HTTP availability
# ──────────────────────────────────────────────────────────────
check_http() {
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$SITE_URL" 2>/dev/null || echo "000")
  RESULTS["http_code"]="$code"
  if [[ "$code" == "200" ]]; then
    echo "${GREEN}✓${NC} HTTP $code — site joignable"
    return 0
  else
    echo "${RED}✗${NC} HTTP $code — site INJOIGNABLE"
    return 1
  fi
}

# ──────────────────────────────────────────────────────────────
# 2. Certificat SSL
# ──────────────────────────────────────────────────────────────
check_ssl() {
  local expiry
  expiry=$(echo | openssl s_client -servername "$DOMAIN" -connect "${DOMAIN}:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null \
    | cut -d= -f2)

  if [[ -z "$expiry" ]]; then
    echo "${RED}✗${NC} SSL — impossible de récupérer le certificat"
    RESULTS["ssl_days_left"]="-1"
    return 1
  fi

  local expiry_ts
  expiry_ts=$(date -j -f "%b %d %T %Y %Z" "$expiry" "+%s" 2>/dev/null \
    || date -d "$expiry" "+%s" 2>/dev/null \
    || echo "0")
  local now_ts
  now_ts=$(date "+%s")
  local days_left=$(( (expiry_ts - now_ts) / 86400 ))

  RESULTS["ssl_days_left"]="$days_left"
  RESULTS["ssl_expiry"]="$expiry"

  if [[ $days_left -gt 30 ]]; then
    echo "${GREEN}✓${NC} SSL — expire dans $days_left jours ($expiry)"
  elif [[ $days_left -gt 7 ]]; then
    echo "${YELLOW}!${NC} SSL — expire dans $days_left jours ⚠️"
  else
    echo "${RED}✗${NC} SSL — expire dans $days_left jours ‼️"
  fi
}

# ──────────────────────────────────────────────────────────────
# 3. Headers HTTP critiques
# ──────────────────────────────────────────────────────────────
check_headers() {
  local headers
  headers=$(curl -sSI --max-time "$TIMEOUT" "$SITE_URL" 2>/dev/null)

  local required=(
    "strict-transport-security"
    "content-security-policy"
    "x-content-type-options"
    "x-frame-options"
    "referrer-policy"
    "permissions-policy"
  )

  echo ""
  echo "${BOLD}Headers HTTP critiques :${NC}"
  local missing=0
  for h in "${required[@]}"; do
    if echo "$headers" | grep -qi "^$h:"; then
      echo "  ${GREEN}✓${NC} $h"
      RESULTS["header_$h"]="present"
    else
      echo "  ${RED}✗${NC} $h MANQUANT"
      RESULTS["header_$h"]="missing"
      missing=$((missing+1))
    fi
  done

  RESULTS["headers_missing"]="$missing"
  return $missing
}

# ──────────────────────────────────────────────────────────────
# 4. securityheaders.com (API publique gratuite)
# ──────────────────────────────────────────────────────────────
check_securityheaders() {
  local response grade
  response=$(curl -sSI --max-time 20 "https://securityheaders.com/?q=${SITE_URL}&followRedirects=on&hide=on" 2>/dev/null)
  grade=$(echo "$response" | grep -i '^x-grade:' | head -1 | awk '{print $2}' | tr -d '\r\n')

  if [[ -n "$grade" ]]; then
    RESULTS["securityheaders_grade"]="$grade"
    case "$grade" in
      A+|A) echo "${GREEN}✓${NC} securityheaders.com — Grade $grade" ;;
      B|C)  echo "${YELLOW}!${NC} securityheaders.com — Grade $grade (à améliorer)" ;;
      *)    echo "${RED}✗${NC} securityheaders.com — Grade $grade (problème)" ;;
    esac
  else
    echo "${YELLOW}!${NC} securityheaders.com — API non joignable"
    RESULTS["securityheaders_grade"]="unknown"
  fi
}

# ──────────────────────────────────────────────────────────────
# 5. Mozilla Observatory (API publique gratuite)
# ──────────────────────────────────────────────────────────────
check_observatory() {
  # Note: l'API HTTP Observatory de Mozilla nécessite un POST pour lancer
  # le scan puis un GET pour récupérer le résultat. Implémentation simple :
  local response score grade
  response=$(curl -sS -X POST "https://http-observatory.security.mozilla.org/api/v1/analyze?host=${DOMAIN}" --max-time 30 2>/dev/null)
  score=$(echo "$response" | grep -oE '"score"[[:space:]]*:[[:space:]]*-?[0-9]+' | head -1 | grep -oE '[-0-9]+$')
  grade=$(echo "$response" | grep -oE '"grade"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | grep -oE '"[^"]+"$' | tr -d '"')

  if [[ -n "${score:-}" && -n "${grade:-}" ]]; then
    RESULTS["observatory_score"]="$score"
    RESULTS["observatory_grade"]="$grade"
    case "$grade" in
      A+|A|A-) echo "${GREEN}✓${NC} Mozilla Observatory — Grade $grade ($score/100)" ;;
      B*|C*)   echo "${YELLOW}!${NC} Mozilla Observatory — Grade $grade ($score/100)" ;;
      *)       echo "${RED}✗${NC} Mozilla Observatory — Grade $grade ($score/100)" ;;
    esac
  else
    echo "${YELLOW}!${NC} Mozilla Observatory — résultat indisponible (peut prendre quelques minutes après 1er scan)"
    RESULTS["observatory_grade"]="pending"
  fi
}

# ──────────────────────────────────────────────────────────────
# 6. robots.txt et sitemap.xml
# ──────────────────────────────────────────────────────────────
check_robots_sitemap() {
  echo ""
  echo "${BOLD}Indexation :${NC}"
  for f in "/robots.txt" "/sitemap.xml"; do
    local code
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${SITE_URL}${f}" 2>/dev/null || echo "000")
    if [[ "$code" == "200" ]]; then
      echo "  ${GREEN}✓${NC} ${f} (HTTP 200)"
      RESULTS["file${f//\//_}"]="present"
    else
      echo "  ${RED}✗${NC} ${f} (HTTP $code)"
      RESULTS["file${f//\//_}"]="missing"
    fi
  done
}

# ──────────────────────────────────────────────────────────────
# 7. JSON-LD présent sur homepage
# ──────────────────────────────────────────────────────────────
check_jsonld() {
  local count
  count=$(curl -sS --max-time "$TIMEOUT" "$SITE_URL" 2>/dev/null \
    | grep -c 'application/ld+json' || true)
  RESULTS["jsonld_blocks"]="$count"
  echo ""
  if [[ $count -gt 0 ]]; then
    echo "${GREEN}✓${NC} JSON-LD : $count bloc(s) trouvé(s) sur la homepage"
  else
    echo "${RED}✗${NC} JSON-LD : aucun bloc sur la homepage"
  fi
}

# ──────────────────────────────────────────────────────────────
# 8. Durée TTFB (Time to First Byte)
# ──────────────────────────────────────────────────────────────
check_ttfb() {
  local ttfb
  ttfb=$(curl -sS -o /dev/null --max-time "$TIMEOUT" -w "%{time_starttransfer}" "$SITE_URL" 2>/dev/null || echo "0")
  local ttfb_ms
  ttfb_ms=$(awk "BEGIN {printf \"%.0f\", $ttfb * 1000}")
  RESULTS["ttfb_ms"]="$ttfb_ms"

  if [[ $ttfb_ms -lt 500 ]]; then
    echo "${GREEN}✓${NC} TTFB : ${ttfb_ms} ms"
  elif [[ $ttfb_ms -lt 1000 ]]; then
    echo "${YELLOW}!${NC} TTFB : ${ttfb_ms} ms (à optimiser)"
  else
    echo "${RED}✗${NC} TTFB : ${ttfb_ms} ms (lent)"
  fi
}

# ──────────────────────────────────────────────────────────────
# JSON OUTPUT
# ──────────────────────────────────────────────────────────────
output_json() {
  echo "{"
  echo "  \"timestamp\": \"$(date -u +%FT%TZ)\","
  echo "  \"site\": \"$SITE_URL\","
  local first=1
  for k in "${!RESULTS[@]}"; do
    if [[ $first -eq 1 ]]; then first=0; else echo ","; fi
    echo -n "  \"$k\": \"${RESULTS[$k]}\""
  done
  echo ""
  echo "}"
}

# ──────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────
if [[ "$OUTPUT_FORMAT" == "--json" ]]; then
  check_http >/dev/null
  check_ssl >/dev/null
  check_headers >/dev/null
  check_securityheaders >/dev/null
  check_observatory >/dev/null
  check_robots_sitemap >/dev/null
  check_jsonld >/dev/null
  check_ttfb >/dev/null
  output_json
else
  echo ""
  echo "${BOLD}${BLUE}════════════════════════════════════════════════════${NC}"
  echo "${BOLD}  STV 83 — Monitoring externe${NC}"
  echo "${BOLD}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
  echo "${BOLD}  $SITE_URL${NC}"
  echo "${BOLD}${BLUE}════════════════════════════════════════════════════${NC}"
  echo ""
  check_http
  check_ssl
  check_ttfb
  check_headers
  check_robots_sitemap
  check_jsonld
  echo ""
  echo "${BOLD}Scores externes (peut prendre 10-30 s) :${NC}"
  check_securityheaders
  check_observatory
  echo ""
  echo "${BOLD}${BLUE}════════════════════════════════════════════════════${NC}"
  echo ""
fi
