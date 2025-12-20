## Sprint — Opus Security Review & Hardening (REVISADO)
> Criado em 2025/12/19 por Claude Code (Opus 4)
> Revisado em 2025/12/19 após análise detalhada do código

**Objetivo:** Corrigir vulnerabilidades reais confirmadas no código e melhorar a segurança do sistema LATE, com foco em XSS, validação de upload e performance do módulo CRM.

**Status:** 🆕 Nova
**Prioridade:** 🔴 CRÍTICA
**Duração estimada:** 10 dias
**Dependências:** Sprint CRM Core (concluída)

---

## 📊 Resumo da Revisão

### Primeira Rodada - Sistema Base
- **Data:** 2025/12/19
- **Escopo:** Sistema LATE core (sem CRM)
- **Resultado:** Nenhum problema crítico, 2 alto, 3 médio, 2 baixo

### Segunda Rodada - Módulo CRM
- **Data:** 2025/12/19
- **Escopo:** Módulo CRM completo (após git pull)
- **Resultado inicial:** 4 críticos, 6 alto, 6 médio, 3 baixo
- **Reavaliação:** 2 críticos reais (XSS, Upload), 1 alto (DoS), outros reclassificados

### Estatísticas Consolidadas REVISADAS

| Severidade | Sistema Base | Módulo CRM | Total | Tempo Estimado |
|------------|--------------|------------|-------|----------------|
| CRÍTICO    | 0            | 2          | 2     | 10h            |
| ALTO       | 2            | 4          | 6     | 20h            |
| MÉDIO      | 3            | 8          | 11    | 25h            |
| BAIXO      | 2            | 5          | 7     | 10h            |
| **TOTAL**  | **7**        | **19**     | **26**| **65h**        |

---

## 🔴 Fase 1 — Correções CRÍTICAS REAIS (24-48h)

### 1. XSS (Cross-Site Scripting) — CONFIRMADO
**Problema:** Frontend renderiza HTML com `innerHTML` sem escape, permitindo injeção de scripts.

- [ ] Implementar função `escapeHtml()` global em `public/js/utils.js`
- [ ] Aplicar em `public/js/crm-kanban.js:128-130` (título e nome do contato)
- [ ] Aplicar em `public/js/crm-import.js:166-169` (preview de dados CSV)
- [ ] Aplicar em `public/js/crm-kanban.js:46-50` (opções de custom fields)
- [ ] Criar teste específico de XSS

**Correção sugerida:**
```javascript
// public/js/utils.js
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Nos arquivos afetados
card.innerHTML = `
  <strong>${escapeHtml(opp.title)}</strong>
  <p class="muted">${escapeHtml(opp.contact_name || '')}</p>
`;
```

### 2. Validação de Upload CSV — CONFIRMADO
**Problema:** Upload aceita qualquer arquivo sem validar extensão, MIME type ou conteúdo.

- [ ] Validar extensão `.csv` em `controllers/crmController.js:625-644`
- [ ] Validar MIME type (`text/csv`, `application/csv`, `text/plain`)
- [ ] Verificar primeiros 1KB do arquivo para confirmar formato CSV
- [ ] Rejeitar arquivos executáveis ou binários
- [ ] Adicionar teste de upload malicioso

**Correção sugerida:**
```javascript
const form = formidable({
  maxFileSize: 100 * 1024 * 1024,
  allowEmptyFiles: false,
  multiples: false,
  filter: (part) => {
    const validMimes = ['text/csv', 'application/csv', 'text/plain'];
    if (!validMimes.includes(part.mimetype)) {
      throw new Error('Apenas arquivos CSV são permitidos');
    }
    return true;
  },
});

// Após parse
if (file) {
  const ext = path.extname(file.originalFilename || '').toLowerCase();
  if (ext !== '.csv') {
    fs.unlink(file.filepath, () => {});
    throw new Error('Extensão inválida. Apenas .csv é permitido');
  }
}
```

### 3. Suite de Testes de Segurança Focada
- [ ] Criar `__tests__/crm-security.test.js` focado em XSS e upload
- [ ] Reaproveitar fixtures de `crmImportService.test.js`
- [ ] Adicionar casos: XSS em títulos, upload de .exe, CSV malformado

---

## 🟠 Fase 2 — Correções ALTO (1 semana)

### 1. DoS no Processamento CSV — CONFIRMADO
**Problema:** Import processa em streaming sem timeout ou backpressure, pode travar com arquivos grandes.

- [ ] Adicionar timeout configurável (padrão 5min) em `services/crmImportService.js`
- [ ] Implementar backpressure com pause/resume no parser
- [ ] Limitar uso de memória com monitoramento
- [ ] Fracionar processamento em batches menores
- [ ] Teste de stress com CSV de 100MB

### 2. Rate Limiting Específico CRM — CONFIRMADO
**Problema:** Rotas CRM não têm rate limit dedicado, vulnerável a DoS.

- [ ] Criar `middleware/rateLimitCRM.js` com política específica
- [ ] Import CSV: 5 requisições / 15 minutos
- [ ] APIs gerais CRM: 100 requisições / 15 minutos
- [ ] Integrar com Redis para distribuir entre workers
- [ ] Teste de rate limit

### 3. Performance N+1 Sistema Base — MANTIDO
- [ ] Refatorar loop em `services/messageAlerts.js:141-179`
- [ ] Query única com JOIN para buscar todos os dados
- [ ] Estimar ganho: 50ms → 5ms por execução

### 4. Performance N+1 CRM — CONFIRMADO
- [ ] Criar `listPipelinesWithStages()` com agregação JSON
- [ ] Eliminar loop de queries em `controllers/crmController.js:172-180`
- [ ] Benchmark antes/depois

---

## 🟡 Fase 3 — Correções MÉDIO (1 semana)

### 1. Refatoração Controller Gigante — MANUTENIBILIDADE
- [ ] Dividir `crmController.js` (816 linhas) em módulos menores
- [ ] Estrutura sugerida: `controllers/crm/[pipeline|lead|opportunity|activity|import].js`
- [ ] Manter compatibilidade das rotas existentes
- [ ] Benefício: facilita testes e manutenção

### 2. Manutenibilidade Sistema Base
- [ ] Dividir `models/message.js` (1520 linhas) em módulos
- [ ] Sugestão: messageQueries, messageStats, messageFilters
- [ ] Manter API pública do model

### 3. Race Conditions no Import (se confirmado em testes)
- [ ] Avaliar necessidade real com testes de concorrência
- [ ] Se necessário, implementar locks otimistas
- [ ] Documentar comportamento esperado

### 4. Melhorias de Testes Existentes
- [ ] Expandir `crmImportService.test.js` com casos de segurança
- [ ] Adicionar testes de performance (N+1)
- [ ] Cobertura mínima de 70% no módulo CRM

### 5. Otimizações de Performance
- [ ] Índices para queries de busca (se métricas confirmarem lentidão)
- [ ] Refresh automático de materialized views
- [ ] Cache de pipelines (imutáveis na sessão)

---

## 🟢 Fase 4 — Melhorias BAIXO (Backlog)

### 1. Legibilidade SQL
- [ ] Melhorar comentários em queries complexas (lead.js, opportunity.js)
- [ ] Documentar por que `i += 0` é usado (reutilização intencional de placeholder)

### 2. Padronização de Código
- [ ] Criar constantes para magic numbers
- [ ] Logger configurável por ambiente
- [ ] Remover console.logs desnecessários

### 3. Documentação Técnica
- [ ] Atualizar README com limites de import
- [ ] Documentar política de rate limiting
- [ ] Adicionar exemplos de CSV válidos

---

## ✅ Validação & Testes

### Script de Validação Focado nos Problemas Reais
```bash
#!/bin/bash
# scripts/validate-opus-review.sh

echo "=== LATE Security Validation Script (REVISADO) ==="
echo "=== Foco: XSS, Upload CSV, DoS, Performance ==="

# 1. XSS Protection Test
echo -e "\n[1/8] Testing XSS Protection..."
# Criar oportunidade com XSS no título
RESPONSE=$(curl -s -X POST "http://localhost:3100/api/crm/opportunities" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{"title":"<script>alert(1)</script>","pipeline_id":"1","stage_id":"1","phone":"11999999999"}')

# Verificar se o script foi armazenado (não deveria)
OPP_ID=$(echo "$RESPONSE" | jq -r '.data.id // empty')
if [ -n "$OPP_ID" ]; then
  # Buscar via API e verificar se retorna script
  curl -s "http://localhost:3100/api/crm/opportunities/$OPP_ID" \
    -H "Cookie: $SESSION_COOKIE" | grep -q "<script>" && echo "❌ FAIL - XSS stored" || echo "✅ PASS - Backend safe"
else
  echo "⚠️  Não conseguiu criar oportunidade para teste"
fi

# 2. File Upload Validation
echo -e "\n[2/8] Testing File Upload Validation..."
# Tentar upload de arquivo não-CSV
echo "#!/bin/bash" > malicious.sh
HTTP_CODE=$(curl -s -w "%{http_code}" -X POST "http://localhost:3100/api/crm/leads/import-csv" \
  -H "Cookie: $SESSION_COOKIE" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -F "csv=@malicious.sh" -o /dev/null)
[ "$HTTP_CODE" -eq 400 ] && echo "✅ PASS - Rejected non-CSV" || echo "❌ FAIL - Accepted non-CSV"
rm -f malicious.sh

# 3. CSV Content Validation
echo -e "\n[3/8] Testing CSV Content Validation..."
# Criar arquivo binário com extensão .csv
dd if=/dev/urandom of=fake.csv bs=1024 count=10 2>/dev/null
HTTP_CODE=$(curl -s -w "%{http_code}" -X POST "http://localhost:3100/api/crm/leads/import-csv" \
  -H "Cookie: $SESSION_COOKIE" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -F "csv=@fake.csv" -o /dev/null)
[ "$HTTP_CODE" -eq 400 ] && echo "✅ PASS - Rejected binary CSV" || echo "❌ FAIL - Accepted binary"
rm -f fake.csv

# 4. Rate Limiting Test
echo -e "\n[4/8] Testing Rate Limiting..."
SUCCESS_COUNT=0
for i in {1..6}; do
  HTTP_CODE=$(curl -s -w "%{http_code}" -X POST "http://localhost:3100/api/crm/leads/preview-csv" \
    -H "Cookie: $SESSION_COOKIE" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d '{"csv":"name,phone\nTest,11999999999"}' -o /dev/null)
  [ "$HTTP_CODE" -eq 200 ] && ((SUCCESS_COUNT++))
done
[ "$SUCCESS_COUNT" -le 5 ] && echo "✅ PASS - Rate limit working" || echo "❌ FAIL - No rate limit"

# 5. Large CSV Timeout Test
echo -e "\n[5/8] Testing Large CSV Timeout..."
# Gerar CSV de 10MB
echo "name,phone,email" > large.csv
for i in {1..100000}; do
  echo "User$i,1199999$i,user$i@test.com" >> large.csv
done
# Timeout deve ocorrer em 5 min
timeout 10s curl -s -X POST "http://localhost:3100/api/crm/leads/import-csv" \
  -H "Cookie: $SESSION_COOKIE" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -F "csv=@large.csv" -o /dev/null
[ $? -eq 124 ] && echo "⚠️  Request ainda rodando após 10s" || echo "✅ PASS - Request completou"
rm -f large.csv

# 6. N+1 Query Performance
echo -e "\n[6/8] Testing N+1 Query Performance..."
START_TIME=$(date +%s%N)
curl -s "http://localhost:3100/api/crm/pipelines" \
  -H "Cookie: $SESSION_COOKIE" -o /dev/null
END_TIME=$(date +%s%N)
DURATION=$(( ($END_TIME - $START_TIME) / 1000000 ))
echo "Pipeline query took: ${DURATION}ms"
[ "$DURATION" -lt 100 ] && echo "✅ PASS - Good performance" || echo "⚠️  Slow query detected"

# 7. Memory Usage During Import
echo -e "\n[7/8] Checking Memory Usage..."
BEFORE_RSS=$(ps aux | grep "node.*server.js" | grep -v grep | awk '{print $6}' | head -1)
# Pequeno import para teste
echo "name,phone\nTest1,11999999999\nTest2,11888888888" > small.csv
curl -s -X POST "http://localhost:3100/api/crm/leads/import-csv" \
  -H "Cookie: $SESSION_COOKIE" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -F "csv=@small.csv" -o /dev/null
AFTER_RSS=$(ps aux | grep "node.*server.js" | grep -v grep | awk '{print $6}' | head -1)
DIFF=$((AFTER_RSS - BEFORE_RSS))
echo "Memory delta: ${DIFF} KB"
rm -f small.csv

# 8. Run Security Tests
echo -e "\n[8/8] Running Security Test Suite..."
npm test -- __tests__/crm-security.test.js 2>/dev/null || echo "⚠️  Testes ainda não implementados"

echo -e "\n=== Validation Complete ==="
echo "Foco em problemas confirmados: XSS, Upload validation, DoS prevention"
```

### Checklist Manual
- [ ] Login/logout funcional
- [ ] CRUD de mensagens operacional
- [ ] Import CSV não trava o sistema
- [ ] Kanban drag & drop funcionando
- [ ] Notificações enviando corretamente
- [ ] Sem erros no console do navegador
- [ ] Logs do PM2 sem erros críticos

---

## 📈 Métricas de Sucesso REVISADAS

### Segurança
- **Meta:** 0 vulnerabilidades CRÍTICAS confirmadas
- **Atual:** 2 críticas (XSS, Upload)
- **Prazo:** 48h para correção e deploy

### Performance
- **N+1 Queries:** < 100ms para listagens
- **Import CSV:** Timeout em 5 min, backpressure ativo
- **Memory:** Estável durante imports grandes

### Qualidade
- **Testes de segurança:** 100% cobertura para XSS e upload
- **Controllers:** < 400 linhas por arquivo
- **Documentação:** Rate limits e upload claramente documentados

### Estabilidade
- **DoS Protection:** Rate limiting funcionando
- **Upload validation:** Rejeita 100% não-CSV
- **XSS:** 0 scripts no output

---

## 🚀 Deploy & Rollback

### Deploy Progressivo
1. **Dev** → Aplicar todas as correções
2. **Staging** → Validar por 48h
3. **Canário (mach1)** → Monitor 24h
4. **Prod (mach2/3)** → Rollout completo

### Rollback Plan
```bash
# Em caso de problemas
cd ~/late-prod
git checkout main
git pull origin main
pm2 restart late-prod
```

---

## 📝 Documentação a Atualizar

Após conclusão da sprint:

1. **CLAUDE.md**
   - Seção segurança com novas validações
   - Rate limits do CRM
   - Estrutura refatorada dos controllers

2. **manual-operacional.md**
   - Limites de upload (100MB, .csv apenas)
   - Rate limits (5 imports/15min)
   - Novos índices de performance

3. **LATE_SPRINTS_EXECUTADAS.md**
   - Adicionar esta sprint ao histórico
   - Atualizar contadores

4. **news.md**
   - Anunciar melhorias de segurança
   - Destacar nova performance

---

## 👥 Responsabilidades

- **Segurança (CRÍTICO):** Time completo, foco total
- **Performance (ALTO):** Backend team
- **Refatoração (MÉDIO):** Distribuir entre devs
- **Testes:** QA + Dev em par
- **Deploy:** DevOps com supervisão

---

**Criado por:** Claude Code (Opus 4)
**Data:** 2025/12/19
**Revisado:** 2025/12/19 - Ajustado após análise detalhada do código

## 📌 Nota de Revisão

Esta sprint foi revisada para focar nos problemas **realmente confirmados** no código:

### ✅ Problemas Reais Confirmados:
1. **XSS no Frontend** - innerHTML sem escape em vários componentes
2. **Validação de Upload Frágil** - Aceita qualquer arquivo sem validação
3. **DoS no Import CSV** - Sem timeout ou backpressure
4. **Rate Limiting Ausente** - Rotas CRM vulneráveis a abuso
5. **N+1 Queries** - Performance degradada em listagens

### ❌ Falsos Positivos Removidos:
1. **SQL Injection** - Código usa prepared statements corretamente, `i += 0` é intencional
2. **CSRF Missing** - Rotas já protegidas por middleware
3. **Desserialização Insegura** - Risco teórico, não confirmado na prática

**Próxima revisão:** Após implementação da Fase 1 (48h)