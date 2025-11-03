#!/usr/bin/env bash

# scripts/security-check.sh
# Executa o checklist de segurança da Sprint 00-PRE:
# 1. Exercita rate-limiting de /api/login (ou endpoint configurado).
# 2. Captura cabeçalhos de segurança em /login.
# 3. Opcionalmente executa o seed de administrador.
# Resultados gravados em um relatório Markdown.

set -euo pipefail

BASE_URL=${1:-${CHECK_BASE_URL:-http://127.0.0.1:3001}}
LOGIN_ENDPOINT=${CHECK_LOGIN_ENDPOINT:-/api/login}
HEADERS_ENDPOINT=${CHECK_HEADERS_ENDPOINT:-/login}
ATTEMPTS=${CHECK_RATE_ATTEMPTS:-25}
REPORT_PATH=${CHECK_REPORT_PATH:-security-check-$(date +%Y%m%d-%H%M%S).md}

mkdir -p "$(dirname "$REPORT_PATH")" 2>/dev/null || true

exec > >(tee "$REPORT_PATH")
exec 2>&1

echo "# Security Check Report"
echo
echo "- Data/Horário: $(date -Iseconds)"
echo "- Base URL: ${BASE_URL}"
echo "- Endpoint de login (rate-limit): ${LOGIN_ENDPOINT}"
echo "- Endpoint para headers: ${HEADERS_ENDPOINT}"
echo "- Tentativas de rate-limit: ${ATTEMPTS}"
echo

echo "## 1. Rate limit em ${LOGIN_ENDPOINT}"
for i in $(seq 1 "$ATTEMPTS"); do
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H 'Content-Type: application/json' \
    -d '{"email":"rate-limit-check@late.dev","password":"invalid-password"}' \
    "${BASE_URL}${LOGIN_ENDPOINT}" || echo "000")
  printf "Tentativa %02d → HTTP %s\n" "$i" "$status"
done
echo

echo "## 2. Cabeçalhos de segurança em ${HEADERS_ENDPOINT}"
curl -s -D - -o /dev/null "${BASE_URL}${HEADERS_ENDPOINT}" | \
  grep -Ei 'content-security-policy|strict-transport-security|x-content-type-options|x-frame-options|referrer-policy|permissions-policy|cross-origin-embedder-policy|cross-origin-opener-policy|cross-origin-resource-policy' \
  || echo "⚠️ Nenhum cabeçalho relevante encontrado no filtro."
echo

echo "## 3. Seed de administrador"
if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
  echo "- ADMIN_EMAIL: ${ADMIN_EMAIL}"
  echo "- ADMIN_PASSWORD: ******"
  node scripts/seed-admin.js || echo "❌ seed-admin retornou erro (ver logs acima)."
else
  echo "⚠️ Variáveis ADMIN_EMAIL/ADMIN_PASSWORD não definidas — seed não executado."
  echo "    Exemplo: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='Senha!' $0"
fi
echo

echo "✅ Checklist concluído. Relatório salvo em: ${REPORT_PATH}"
