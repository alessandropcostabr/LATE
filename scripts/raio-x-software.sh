#!/usr/bin/env bash
# scripts/raio-x-software.sh
# Inventário de software sem prompts interativos (refatorado)
# Atualizado: DRY, robustez, detecta ferramentas globais/local, exit on error, safer pipes

set -euo pipefail

OUTPUT="inventario_software.txt"
# Redireciona stdout e stderr para console e arquivo
exec > >(tee -a "$OUTPUT") 2>&1

function info_section() {
  echo
  echo "=== $1 ==="
}

function check_version() {
  local name="$1" cmd="$2" local_bin="$3"
  if command -v "$cmd" &>/dev/null; then
    echo "- $name (global): $($cmd --version 2>&1)"
  elif [[ -x "$local_bin/$cmd" ]]; then
    echo "- $name (local): $($local_bin/$cmd --version 2>&1)"
  else
    echo "- $name não instalado"
  fi
}

info_section "Inventário de Software — $(date '+%Y-%m-%d %H:%M:%S')"

info_section "SISTEMA OPERACIONAL"
# Distribuições compatíveis
if command -v lsb_release &>/dev/null; then
  lsb_release -a
else
  cat /etc/os-release
fi
uname -r

# Node.js, npm, ts-node e tsc
info_section "Node.js e NPM"
echo "- node: $(node -v)"
echo "- npm:  $(npm -v)"

info_section "TS-Node"
check_version "ts-node" "ts-node" "node_modules/.bin"

info_section "TSC (TypeScript Compiler)"
check_version "tsc" "tsc" "node_modules/.bin"

# Dependências principais
info_section "Dependências (package.json)"
if command -v jq &>/dev/null; then
  jq -r '.dependencies + .devDependencies
  | to_entries[]
  | select(.key | IN("typescript","express","openai","better-sqlite3","dotenv","csv-writer","jest","ts-jest"))
  | "- \(.key): \(.value)"' package.json
else
  echo "jq não instalado: listando nomes das dependências principais via npm"
  npm ls --depth=0 | grep -E "typescript|express|openai|better-sqlite3|dotenv|csv-writer|jest|ts-jest"
fi

# Serviços de infraestrutura
info_section "Serviços Instalados"
echo "- nginx:   $(nginx -v 2>&1)"
echo "- pm2:     $(pm2 -v)"
echo "- certbot: $(certbot --version 2>/dev/null || echo 'não instalado')"
echo "- sqlite3: $(sqlite3 --version 2>/dev/null || echo 'não instalado')"

# Docker e Compose
info_section "Docker"
if command -v docker &>/dev/null; then
  echo "- docker:         $(docker --version)"
  echo "- docker-compose: $(docker-compose --version 2>/dev/null || echo 'não instalado')"
else
  echo "- Docker não instalado"
fi

info_section "FIM DO INVENTÁRIO"
