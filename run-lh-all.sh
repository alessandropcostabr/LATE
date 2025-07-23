#!/usr/bin/env bash
BASE_URL="https://late.miahchat.com"
OUT_DIR="$HOME/late/lighthouse-reports"

# Cria pasta de saída
mkdir -p "$OUT_DIR"

# Rotas estáticas (basename das views)
ROUTES=("/" "/recados" "/novo-recado" "/relatorios")

# Rotas dinâmicas com um ID de exemplo (ajuste o “1” se necessário)
declare -A DYN_ROUTES=(
  ["editar-recado"]="/editar-recado/1"
  ["visualizar-recado"]="/visualizar-recado/1"
)

echo "▶ Iniciando auditoria Lighthouse…"

# Helper para chamar o LH
run_lh () {
  local url=$1   # URL completa
  local name=$2  # nome base (ex.: index, recados, editar-recado)

  echo "  • JSON → $name.json"
  npx lighthouse "$url" \
    --quiet \
    --chrome-flags="--headless --no-sandbox --disable-gpu" \
    --output=json \
    --output-path="$OUT_DIR/${name}.json"

  echo "  • HTML → $name.html"
  npx lighthouse "$url" \
    --quiet \
    --chrome-flags="--headless --no-sandbox --disable-gpu" \
    --output=html \
    --output-path="$OUT_DIR/${name}.html"
}

# Estáticas
for path in "${ROUTES[@]}"; do
  [[ "$path" == "/" ]] && name="index" || name="${path#/}"
  run_lh "$BASE_URL$path" "$name"
done

# Dinâmicas
for name in "${!DYN_ROUTES[@]}"; do
  run_lh "$BASE_URL${DYN_ROUTES[$name]}" "$name"
done

echo "✅ Auditoria concluída. Veja os arquivos em $OUT_DIR"
