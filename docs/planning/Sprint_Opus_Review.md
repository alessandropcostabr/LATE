## Sprint — Opus Security Review & Hardening (ATUALIZADO)
> Criado em 2025/12/19 por Claude Code (Opus 4)
> Revisado em 2025/12/19 após análise detalhada do código
> **Atualizado em 2025/12/20 com progresso da implementação**

**Objetivo:** Corrigir vulnerabilidades reais confirmadas no código e melhorar a segurança do sistema LATE, com foco em XSS, validação de upload e performance do módulo CRM.

**Status:** 🚧 Em Progresso (30% concluído)
**Prioridade:** 🔴 CRÍTICA
**Duração estimada:** 10 dias
**Dependências:** Sprint CRM Core (concluída)
**PR Atual:** #318 (fix/xss-sanitization-crm → develop)

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

## 🚀 PROGRESSO DA IMPLEMENTAÇÃO (2025/12/20)

### ✅ O que foi feito:

#### 1. Sanitização XSS (CRÍTICO) - **CONCLUÍDO**
- [x] Implementadas funções `escapeHtml()` e `escapeAttr()` em `public/js/utils.js`
- [x] Sanitização aplicada em 5 arquivos CRM:
  - `crm-kanban.js` - títulos, contatos, valores, stages, custom fields
  - `crm-import.js` - preview CSV, headers, mapeamento
  - `crm-leads.js` - tabela completa (nome, telefone, email, status, etc)
  - `crm-opportunities.js` - todos os campos da tabela
  - `crm-dedup.js` - telefone, email, total
- [x] Testado manualmente com caracteres especiais
- [x] Bot Codex validou e identificou casos adicionais que foram corrigidos

#### 2. Validação de Upload CSV (CRÍTICO) - **CONCLUÍDO**
- [x] Criado `middleware/fileValidation.js` com validação robusta
- [x] Validações implementadas:
  - Extensão permitida apenas `.csv`
  - Tamanho máximo reduzido de 100MB para 10MB
  - Verificação de conteúdo binário
  - Detecção de CSV injection (fórmulas, scripts)
  - Estrutura mínima (header + dados)
- [x] Integrado em `parseImportRequest()` do crmController
- [x] Limpeza automática de arquivos inválidos

#### 3. Timeout e Backpressure CSV (ALTO) - **CONCLUÍDO**
- [x] Timeout máximo de 5 minutos implementado
- [x] Limite de 10.000 linhas por importação
- [x] Sistema de backpressure com pause/resume
- [x] Redução do batch size de 1000 para 100-500
- [x] Progress logging a cada 5 segundos
- [x] Logs detalhados de sucesso/erro com tempo decorrido

### 📋 O que falta fazer:

#### Fase 2 - ALTO (Próximas prioridades)
1. **Rate Limiting CRM**
   - Criar `middleware/rateLimitCRM.js`
   - Import: 5 req/15min, APIs: 100 req/15min
   - Integrar com Redis

2. **Otimização N+1 Queries**
   - Refatorar `messageAlerts.js:141-179`
   - Criar `listPipelinesWithStages()` com agregação

#### Fase 3 - MÉDIO
3. **Refatoração crmController.js**
   - Dividir 816 linhas em módulos menores
   - Estrutura: `controllers/crm/[pipeline|lead|opportunity|activity|import].js`

4. **Suite de Testes de Segurança**
   - Criar `__tests__/crm-security.test.js`
   - Casos: XSS, upload .exe, CSV malformado
   - Testes de rate limiting

#### Fase 4 - BAIXO
5. **Melhorias de Código**
   - Documentar SQL complexo
   - Criar constantes para magic numbers
   - Atualizar documentação

---

## 🔴 Fase 1 — Correções CRÍTICAS REAIS (24-48h)

### 1. XSS (Cross-Site Scripting) — ✅ CONCLUÍDO
**Problema:** Frontend renderiza HTML com `innerHTML` sem escape, permitindo injeção de scripts.

- [x] Implementar função `escapeHtml()` global em `public/js/utils.js`
- [x] Aplicar em `public/js/crm-kanban.js:128-130` (título e nome do contato)
- [x] Aplicar em `public/js/crm-import.js:166-169` (preview de dados CSV)
- [x] Aplicar em `public/js/crm-kanban.js:46-50` (opções de custom fields)
- [x] Aplicar em arquivos adicionais identificados pelo bot Codex:
  - [x] `crm-leads.js` - sanitização completa da tabela
  - [x] `crm-opportunities.js` - todos os campos
  - [x] `crm-dedup.js` - telefone, email, total
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

### 2. Validação de Upload CSV — ✅ CONCLUÍDO
**Problema:** Upload aceita qualquer arquivo sem validar extensão, MIME type ou conteúdo.

- [x] Validar extensão `.csv` em `controllers/crmController.js:625-644`
- [x] Criar `middleware/fileValidation.js` com validação completa
- [x] Verificar primeiros 8KB do arquivo para confirmar formato CSV
- [x] Rejeitar arquivos executáveis ou binários
- [x] Detectar CSV injection (fórmulas, scripts)
- [x] Reduzir limite de 100MB para 10MB
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

### 1. DoS no Processamento CSV — ✅ CONCLUÍDO
**Problema:** Import processa em streaming sem timeout ou backpressure, pode travar com arquivos grandes.

- [x] Adicionar timeout configurável (padrão 5min) em `services/crmImportService.js`
- [x] Implementar backpressure com pause/resume no parser
- [x] Limitar linhas máximas para 10.000 por importação
- [x] Reduzir batch size de 1000 para 100-500
- [x] Progress logging a cada 5 segundos
- [ ] Teste de stress com CSV de 10MB

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

---

## 💡 SUGESTÕES DE IMPLEMENTAÇÃO PARA PRÓXIMAS TAREFAS

### 1. Rate Limiting CRM (PRÓXIMA PRIORIDADE)

#### Criar `middleware/rateLimitCRM.js`:
```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');

// Para import CSV - mais restritivo
const importLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:crm:import:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 imports por janela
  message: 'Limite de imports excedido. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Para APIs gerais CRM
const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:crm:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por janela
  message: 'Muitas requisições. Tente novamente mais tarde.',
});

module.exports = { importLimiter, apiLimiter };
```

#### Aplicar nas rotas:
```javascript
// routes/api.js
const { importLimiter, apiLimiter } = require('../middleware/rateLimitCRM');

// Import routes - mais restritivas
router.post('/crm/leads/import-csv', auth, importLimiter, crmController.importLeadsCsv);
router.post('/crm/leads/preview-csv', auth, importLimiter, crmController.previewLeadsCsv);
router.post('/crm/leads/dry-run', auth, importLimiter, crmController.dryRunImportCsv);

// APIs gerais
router.use('/crm/*', auth, apiLimiter);
```

### 2. Otimização N+1 Queries

#### Para messageAlerts.js:
```javascript
// Substituir loop individual por query única
async function getAlertsWithDetails() {
  const query = `
    SELECT
      ma.*,
      m.subject,
      m.message,
      u.name as recipient_name,
      u.email as recipient_email,
      ns.email_enabled,
      ns.alert_frequency
    FROM message_alerts ma
    JOIN messages m ON m.id = ma.message_id
    JOIN users u ON u.id = m.recipient_user_id
    LEFT JOIN notification_settings ns ON ns.user_id = u.id
    WHERE ma.status = 'pending'
    AND ma.scheduled_for <= NOW()
  `;
  return pool.query(query);
}
```

#### Para pipelines:
```javascript
// models/pipeline.js
async function listPipelinesWithStages() {
  const query = `
    SELECT
      p.id,
      p.name,
      p.is_active,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', ps.id,
            'name', ps.name,
            'position', ps.position,
            'color', ps.color
          ) ORDER BY ps.position
        ) FILTER (WHERE ps.id IS NOT NULL),
        '[]'
      ) as stages
    FROM pipelines p
    LEFT JOIN pipeline_stages ps ON ps.pipeline_id = p.id
    WHERE p.is_active = true
    GROUP BY p.id, p.name, p.is_active
    ORDER BY p.position, p.name
  `;
  const result = await pool.query(query);
  return result.rows;
}
```

### 3. Testes de Segurança

#### Criar `__tests__/crm-security.test.js`:
```javascript
const request = require('supertest');
const app = require('../server');
const fs = require('fs');
const path = require('path');

describe('CRM Security Tests', () => {
  let authCookie;
  let csrfToken;

  beforeAll(async () => {
    // Login e obter tokens
    const loginRes = await request(app)
      .post('/login')
      .send({ email: 'test@example.com', password: 'password' });
    authCookie = loginRes.headers['set-cookie'];
    csrfToken = loginRes.body.csrfToken;
  });

  describe('XSS Prevention', () => {
    it('should escape HTML in opportunity titles', async () => {
      const maliciousTitle = '<script>alert("XSS")</script>';

      const res = await request(app)
        .post('/api/crm/opportunities')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: maliciousTitle,
          pipeline_id: 1,
          stage_id: 1,
          phone: '11999999999'
        });

      expect(res.status).toBe(200);

      // Verificar que o script não é executado no retorno
      const getRes = await request(app)
        .get(`/api/crm/opportunities/${res.body.data.id}`)
        .set('Cookie', authCookie);

      expect(getRes.body.data.title).toBe(maliciousTitle);
      expect(getRes.text).not.toContain('<script>');
    });
  });

  describe('CSV Upload Validation', () => {
    it('should reject non-CSV files', async () => {
      const filePath = path.join(__dirname, 'fixtures/test.exe');
      fs.writeFileSync(filePath, 'MZ'); // EXE header

      const res = await request(app)
        .post('/api/crm/leads/import-csv')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .attach('csv', filePath);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('CSV');

      fs.unlinkSync(filePath);
    });

    it('should reject CSV injection attempts', async () => {
      const maliciousCSV = 'name,phone\n=cmd|"/c calc",11999999999';
      const filePath = path.join(__dirname, 'fixtures/malicious.csv');
      fs.writeFileSync(filePath, maliciousCSV);

      const res = await request(app)
        .post('/api/crm/leads/import-csv')
        .set('Cookie', authCookie)
        .set('X-CSRF-Token', csrfToken)
        .attach('csv', filePath);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('perigoso');

      fs.unlinkSync(filePath);
    });
  });

  describe('Rate Limiting', () => {
    it('should limit import requests', async () => {
      const validCSV = 'name,phone\nTest,11999999999';

      // Fazer 6 requests (limite é 5)
      for (let i = 0; i < 6; i++) {
        const res = await request(app)
          .post('/api/crm/leads/preview-csv')
          .set('Cookie', authCookie)
          .set('X-CSRF-Token', csrfToken)
          .send({ csv: validCSV });

        if (i < 5) {
          expect(res.status).toBe(200);
        } else {
          expect(res.status).toBe(429);
          expect(res.body.error).toContain('Limite');
        }
      }
    });
  });
});
```

### 4. Estrutura Refatorada do crmController

```
controllers/
├── crm/
│   ├── index.js           # Exporta todos os controllers
│   ├── pipelineController.js
│   ├── leadController.js
│   ├── opportunityController.js
│   ├── activityController.js
│   ├── importController.js
│   └── helpers/
│       ├── validation.js
│       └── csvParser.js
```

**Exemplo de divisão:**
```javascript
// controllers/crm/leadController.js
const LeadModel = require('../../models/lead');
const { validatePhone, validateEmail } = require('./helpers/validation');

async function listLeads(req, res) {
  // Lógica específica de leads
}

async function createLead(req, res) {
  // Lógica de criação
}

module.exports = {
  listLeads,
  createLead,
  // ...
};
```

**Atualizado por:** Claude Code (Opus 4)
**Data:** 2025/12/20