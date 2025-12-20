
# 🚀 LATE — Sprints Futuras (Roadmap 2025-2026)
> Atualizado em 2025/12/19.

**Versão:** 2.0.2  
**Última atualização:** 2025/12/19

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Sprints Planejadas](#sprints-planejadas)
3. [Backlog de Melhorias](#backlog-de-melhorias)
4. [Critérios de Priorização](#critérios-de-priorização)

---

## 🎯 Visão Geral

Este documento consolida todas as sprints futuras planejadas para o projeto LATE, organizadas por prioridade e dependências.

### Status Atual

| Categoria | Concluídas | Em Andamento | Planejadas | Total |
|-----------|------------|--------------|------------|-------|
| **Sprints** | 9 | 1 | 6 | 16 |
| **Melhorias** | 12 | 1 | 11 | 24 |

### Próximas Prioridades

1. ✅ **Sprint 02B — Auditoria (UI & Exportações + Status Operacional)** (concluída em 12/11/2025)
2. 🟢 **Sprint CRM Fase I — RBAC & Escopos** (entregue: filtros Me/Equipe/All em listagens CRM)
3. ✅ **Sprint CRM Fase II — Stats/Dashboards MVs** (entregue em 19/12/2025)
4. 🟡 **Sprint CRM Fase III — Import CSV Avançado** (em andamento na branch `feature/crm-import-csv`)
5. 🟡 **Sprint Hardening PG + CSP** (TLS no PostgreSQL, Helmet report-only/enforce; refator de `health/status`)
6. 🟠 **Correção PR #217 — Watchers fora do escopo** (rotas `/api/messages/:id/watchers` e controller precisam validar escopo)

---

## 📦 Sprints Planejadas

### Sprint CRM Fase II — Stats/Dashboards (MVs)

**Status:** ✅ Concluída  
**Prioridade:** 🔴 Alta

#### Objetivo
Consolidar dashboards do CRM com views materializadas e filtro de escopo (Me/Equipe/All).

#### Entregas
- API `/api/crm/stats` com staleness e escopo.
- UI do dashboard e calendário com filtro de escopo.
- Refresh MV com lock e logs.

### Sprint CRM Fase III — Import CSV Avançado

**Status:** 🟡 Em andamento  
**Prioridade:** 🔴 Alta

#### Objetivo
Entregar import CSV com preview, dedup/merge e dry-run para leads/contatos/oportunidades.

#### Entregas
- Wizard em 5 passos (mapeamento, preview, dedup, dry-run, aplicar).
- Limite de upload 100MB e validação de 200k linhas.
- Relatório final CSV/JSON e rollback seguro.

### Sprint 00-PRE — Hardening & Sanidade do Ambiente

**Status:** ✅ Concluída em 03/11/2025 (PR #259)  

**Prioridade:** 🔴 Alta (Imediato)  
**Duração estimada:** 3-5 dias  
**Dependências:** Nenhuma

#### Objetivo
Consolidar a base: remover legado `callback_time`, garantir idempotência nas automations e aumentar segurança do intake.

#### Entregas

##### 1. Remover Legado `callback_time`

**Migration:** `migrations/20251210b_drop_callback_time.sql`

```sql
BEGIN;

-- Remover índices antigos
DROP INDEX CONCURRENTLY IF EXISTS idx_messages_callback_time;
DROP INDEX CONCURRENTLY IF EXISTS idx_messages_status_cbtime;

-- Remover coluna legada
ALTER TABLE messages DROP COLUMN IF EXISTS callback_time;

-- Criar índices otimizados para callback_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_callback_at
  ON messages(callback_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_status_cb_at
  ON messages(status, callback_at DESC);

COMMIT;
```

**Validação:**
```sql
-- Verificar que callback_time foi removida
SELECT column_name FROM information_schema.columns
WHERE table_name='messages' AND column_name='callback_time';
-- Resultado esperado: 0 linhas

-- Verificar novos índices
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename='messages' AND indexname LIKE '%callback%';
```

##### 2. Idempotência das Automations

**Migration:** `migrations/20251210c_uniq_automation_minute.sql`

```sql
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='automation_logs' AND column_name='fired_at'
  ) THEN
    -- Usar fired_at se existir
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_automation_minute
      ON automation_logs (automation_id, message_id, date_trunc('minute', fired_at));
  ELSE
    -- Fallback para created_at
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_automation_minute_ca
      ON automation_logs (automation_id, message_id, date_trunc('minute', created_at));
  END IF;
END$$;

COMMIT;
```

**Código (job de automação):**

```javascript
// Com fired_at:
const result = await db.query(`
  INSERT INTO automation_logs (id, automation_id, message_id, fired_at)
  VALUES ($1, $2, $3, NOW())
  ON CONFLICT ON CONSTRAINT uniq_automation_minute DO NOTHING
  RETURNING id
`, [uuid(), automationId, messageId]);

// Fallback (created_at):
const result = await db.query(`
  INSERT INTO automation_logs (id, automation_id, message_id, created_at)
  VALUES ($1, $2, $3, NOW())
  ON CONFLICT ON CONSTRAINT uniq_automation_minute_ca DO NOTHING
  RETURNING id
`, [uuid(), automationId, messageId]);

// Se result.rows.length === 0, já foi executada neste minuto
```

**Validação:**
```sql
-- Verificar índice único criado
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename='automation_logs' AND indexname LIKE '%uniq_automation%';
```

##### 3. Intake sem Token em Claro (Hash)

**Migration:** `migrations/20251210d_intake_logs_token_hash.sql`

```sql
BEGIN;

-- Adicionar coluna token_hash
ALTER TABLE intake_logs
  ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- Remover coluna token (não mais necessária)
ALTER TABLE intake_logs
  DROP COLUMN IF EXISTS token;

COMMIT;
```

**Utilitário:** `utils/hashToken.js`

```javascript
const crypto = require('crypto');

/**
 * Gera hash SHA-256 do token com pepper opcional
 * @param {string} token - Token a ser hasheado
 * @returns {string} Hash hexadecimal
 */
function hashToken(token) {
  const pepper = process.env.INTAKE_TOKEN_PEPPER || '';
  return crypto
    .createHash('sha256')
    .update(String(token ?? '') + pepper)
    .digest('hex');
}

module.exports = { hashToken };
```

**Controller:** `controllers/intakeController.js`

```javascript
const { hashToken } = require('../utils/hashToken');

// Antes:
// token: providedToken,

// Depois:
tokenHash: hashToken(providedToken),
ip: req.ip,
userAgent: req.headers['user-agent'] || null
```

**Operação pós-deploy:**
```bash
# 1. Aplicar migration
NODE_ENV=production node scripts/migrate.js

# 2. Rotacionar INTAKE_TOKEN
# Gerar novo token:
openssl rand -hex 32

# 3. Atualizar .env (único)
INTAKE_TOKEN=<novo_token>
INTAKE_TOKEN_PEPPER=<pepper_secreto>

# 4. Reiniciar aplicação
pm2 restart late-prod --update-env

# 5. Atualizar sistemas externos com novo token
```

**Validação:**
```sql
-- Verificar que token foi removido e token_hash existe
SELECT column_name FROM information_schema.columns
WHERE table_name='intake_logs' AND column_name IN ('token','token_hash');
-- Resultado esperado: apenas 'token_hash'
```

#### Testes

```bash
# 1. Verificar remoção de callback_time
psql -d late_dev -c "SELECT column_name FROM information_schema.columns WHERE table_name='messages' AND column_name='callback_time';"

# 2. Verificar índice único de automations
psql -d late_dev -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='automation_logs';"

# 3. Verificar intake_logs sem token
psql -d late_dev -c "SELECT column_name FROM information_schema.columns WHERE table_name='intake_logs' AND column_name IN ('token','token_hash');"

# 4. Testar idempotência
# Executar automação 2x no mesmo minuto → apenas 1 log criado

# 5. Testar intake com token hasheado
curl -X POST http://localhost:3001/api/intake \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <NOVO_TOKEN>" \
  -d '{"sender_name":"Teste","subject":"Teste","message":"Teste"}'
```

#### Checklist de Deploy

- [ ] Aplicar migrations em DEV
- [ ] Testar idempotência de automations
- [ ] Testar intake com token hasheado
- [ ] Gerar novo `INTAKE_TOKEN`
- [ ] Atualizar `.env` (documentação + exemplos)
- [ ] Aplicar migrations em PROD
- [ ] Reiniciar aplicações
- [ ] Atualizar sistemas externos
- [ ] Validar logs de intake

---

### Sprint 01 — Dev Tools (Diagnóstico CLI e Endpoint)

**Prioridade:** 🟡 Média  
**Duração estimada:** 2-3 dias  
**Dependências:** Sprint 00-PRE (concluída)
**Status:** ✅ Concluída em 04/11/2025 (CLI + endpoint homologados)

#### Objetivo
Facilitar troubleshooting local/CI com status de DB/filas/features.

#### Entregas

##### 1. Script CLI `scripts/dev-info.js`

**Funcionalidades:**
- Imprime snapshot de diagnóstico no stdout
- Flag `--json` grava o resultado em `diagnostics.json` (padrão)
- Flag `--output` personaliza o nome/caminho quando usada com `--json`
- Fecha o pool do PostgreSQL ao terminar (evita testes travados em CI)
- Informações coletadas:
  - `nodeEnv`: Ambiente atual
  - `pgDatabase`: Nome do banco
  - `pgcrypto`: Extensão instalada?
  - `messageIndexes`: Índices da tabela messages
  - `emailQueuePending`: E-mails pendentes na fila
  - `generatedAt`: Timestamp ISO da coleta

**Uso:**
```bash
node scripts/dev-info.js

# Salvar JSON (padrão: diagnostics.json)
node scripts/dev-info.js --json

# Salvar JSON com nome customizado
node scripts/dev-info.js --json --output=/tmp/dev-info.json
```

**Exemplo de saída:**
```json
{
  "nodeEnv": "development",
  "pgDatabase": "late_dev",
  "pgcrypto": true,
  "messageIndexes": [
    "idx_messages_callback_at",
    "idx_messages_status_cb_at",
    "idx_messages_created_status"
  ],
  "emailQueuePending": 3,
  "generatedAt": "2025-11-04T12:34:56.789Z"
}
```

##### 2. Endpoint `GET /api/debug/info` (DEV only)

**Características:**
- Disponível **apenas** quando `NODE_ENV=development`
- Retorna mesmo JSON do script CLI
- Protegido por autenticação (usuário logado)

**Rota:** `routes/api.js`

```javascript
const { collectDevInfo } = require('../utils/devInfo');
const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();

if (nodeEnv === 'development' || nodeEnv === 'test') {
  router.get(
    '/debug/info',
    ...flatFns(requireAuth),
    async (req, res) => {
      try {
        const info = await collectDevInfo();
        return res.json({ success: true, data: info });
      } catch (err) {
        console.error('[debug/info] falha ao coletar diagnóstico:', err);
        return res.status(500).json({ success: false, error: 'Falha ao coletar diagnóstico' });
      }
    }
  );
}
```

**Teste:**
```bash
# Deve funcionar em DEV
curl -s http://127.0.0.1:3001/api/debug/info | jq .

# Deve exigir autenticação
curl -i http://127.0.0.1:3001/api/debug/info

# Não é registrado em PROD (rota ausente)
curl -s http://127.0.0.1:3000/api/debug/info
```

#### Testes

- [ ] CLI imprime snapshot consistente (stdout)
- [ ] `--json` gera arquivo válido
- [ ] `--output` respeita caminho customizado
- [x] Endpoint exige autenticação (`401` sem sessão) — `__tests__/dev-info.test.js`
- [x] Endpoint retorna JSON correto quando autenticado — `__tests__/dev-info.test.js`
- [ ] Rota não é registrada fora de DEV/TEST

---

### Sprint 02 — Audit (Trilhas de Auditoria Leves)

**Status:** ✅ Concluída em 05/11/2025 (PR #265)  
**Prioridade:** 🟡 Média  
**Duração:** 3-4 dias  
**Dependências:** Sprint 00-PRE (concluída)

#### Objetivo
Registrar eventos para relatórios/diagnóstico sem PII sensível e garantir follow-up obrigatório na resolução.

#### Entregas

##### 1. Tabela `event_logs`

**Migration:** `migrations/20251216_create_event_logs.sql`

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  actor_user_id INTEGER,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_type
  ON event_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_event_logs_entity
  ON event_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_event_logs_created_at
  ON event_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_logs_actor
  ON event_logs(actor_user_id)
  WHERE actor_user_id IS NOT NULL;

COMMIT;
```

##### 2. Hooks de eventos (fase 1)

- [x] `message.created` → `logMessageEvent` persiste em `message_events` + `event_logs`
- [x] `message.status_changed` → inclui `from`/`to` no metadata
- [x] `comment.created` → log com `context: 'resolution'` quando follow-up automático
- [x] `user.login` → audit trail em `event_logs`
- [x] `automation.fired` → `AutomationLogModel.create` replica em `event_logs` com metadados (status, message_id, erro/payload)
- [x] `user.logout` → `authController.logout` encerra sessão e registra auditoria

##### 3. Follow-up obrigatório ao resolver

- [x] API exige `resolutionComment` ao enviar `status: 'resolved'`
- [x] UI (lista + visualizar) solicita texto antes de concluir
- [x] Comentário criado no fluxo recebe contexto `resolution`
- [x] Auditoria: `comment.created` + `message.status_changed` + `message.resolved`
- [x] Teste automatizado — `__tests__/api.messages.status-resolution.test.js`

##### 4. Trilhas de evento e relatórios

- `message_events` continua sendo a fonte da timeline exibida em `/visualizar-recado`, preservando payloads ricos (encaminhamentos, falhas de e-mail, diffs) para o trabalho das equipes.
- `event_logs` guarda auditoria leve para consultas agregadas e novas visões em `/relatorios` (ex.: ações por usuário, mudanças de status por período) sem expor PII desnecessária.
- Convergir as trilhas só faz sentido quando a interface passar a consumir `event_logs`. Requisitos: cobrir todos os ganchos operacionais, criar camada de leitura unificada (ex.: `listTimeline`) e adaptar o front.
- Enquanto isso, manter trilhas paralelas evita regressão na timeline e dá flexibilidade para fase 2 expor dashboards/consultas a partir do `event_logs`.
- Ganchos adicionais (`automation.fired`, `user.logout`) já escrevem em `event_logs`, mantendo o recorte de auditoria independente da timeline colaborativa.

##### 5. Queries de análise (fase inicial)

**Mensagens criadas por dia:**
```sql
SELECT DATE(created_at) AS date, COUNT(*) AS count
  FROM event_logs
 WHERE event_type = 'message.created'
   AND created_at >= NOW() - INTERVAL '30 days'
 GROUP BY DATE(created_at)
 ORDER BY date DESC;
```

**Mudanças de status:**
```sql
SELECT metadata->>'from' AS from_status,
       metadata->>'to'   AS to_status,
       COUNT(*)          AS changes
  FROM event_logs
 WHERE event_type = 'message.status_changed'
   AND created_at >= NOW() - INTERVAL '7 days'
 GROUP BY metadata->>'from', metadata->>'to'
 ORDER BY changes DESC;
```

**Ações por usuário:**
```sql
SELECT u.name, COUNT(*) AS actions
  FROM event_logs el
  JOIN users u ON u.id = el.actor_user_id
 WHERE el.created_at >= NOW() - INTERVAL '7 days'
 GROUP BY u.id, u.name
 ORDER BY actions DESC
 LIMIT 10;
```

##### 6. Entrega inicial da rota `/relatorios/auditoria`

- [x] Rota web protegida (`requireRole('ADMIN','SUPERVISOR')`) reutilizando a estrutura existente.
- [x] Filtros padrão carregados (últimos 7 dias) expostos em `auditInitialFilters`.
- [x] APIs REST (`GET /api/event-logs`, `/summary`, `/:id`) com paginação por cursor, busca livre e filtros por ator/entidade.
- [x] UI completa com cards dinâmicos, filtros persistidos, drill-down de metadata e botão de exportar ligando para `/relatorios/exportacoes`.
- [x] Página de exportações com formulários dedicados (auditoria e registros), histórico com download seguro e status em tempo real.
- [x] Worker `worker:exports` (PM2) escrevendo arquivos CSV/JSON em `storage/exports`, envio de e-mail “Exportação pronta” e limpeza automática após 7 dias.

##### 7. Pendências encaminhadas para Sprint 02B

- Monitorar ganchos em produção nos primeiros dias (login/logout, automations, follow-up) e ajustar rapidamente se algum evento falhar.
- Aprimorar salvamento/compartilhamento de filtros frequentes (auditoria e exportações) e expor contagem de linhas antes do agendamento.
- Expandir indicadores da aba Auditoria (ex.: cards adicionais, drill-down por usuário) e preparar a documentação operacional para o novo fluxo de exportações.

#### Testes

- [x] `__tests__/api.messages.status-resolution.test.js`
- [x] `__tests__/dev-info.test.js` (rota auditável)
- [x] Validação das queries (automatizada em `__tests__/event-logs.queries.test.js`)
- [x] Gatilhos de automations/logouts (`__tests__/automation-log.test.js`, `__tests__/auth.logout.test.js`)

---

### Sprint 03 — IMAP Intake (Registrar via E-mail)

**Prioridade:** 🟢 Baixa  
**Duração estimada:** 5-7 dias  
**Dependências:** Sprint 00-PRE (concluída), Sprint C

#### Objetivo
Criar "Registros" (tabela `messages`) a partir de e-mails via IMAP, sem custo de SMTP transacional.

#### Entregas

##### 1. Variáveis de Ambiente

**`.env` IMAP:**
```ini
# Configuração IMAP
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=1
IMAP_USER=recados@empresa.com
IMAP_PASS=***
IMAP_MAILBOX=INBOX
IMAP_POLL_INTERVAL=60000  # 1 minuto
```

##### 2. Worker `scripts/imap-intake.js`

**Funcionalidades:**
- Conectar ao servidor IMAP
- Buscar e-mails não lidos
- Parsear assunto e corpo
- Criar `message` com `created_by='intake'`
- Marcar como lido ou mover para pasta "Processed"
- Logar em `event_logs` e/ou `intake_logs`

**Normalização:**
- Detectar `DD/MM/YYYY HH:MM` e converter para `callback_at`
- Detectar `HHh` (ex: "14h30") e converter para hoje às 14:30
- Extrair telefone e email do remetente

**PM2 Config:**
```javascript
{
  name: 'late-imap-dev',
  script: './scripts/imap-intake.js',
  cwd: '/home/amah/late-dev',
  instances: 1,
  exec_mode: 'fork',
  env: {
    NODE_ENV: 'development'
  }
}
```

**Exemplo de código:**

```javascript
const Imap = require('imap');
const { simpleParser } = require('mailparser');

const imap = new Imap({
  user: process.env.IMAP_USER,
  password: process.env.IMAP_PASS,
  host: process.env.IMAP_HOST,
  port: parseInt(process.env.IMAP_PORT),
  tls: process.env.IMAP_SECURE === '1',
  tlsOptions: { rejectUnauthorized: false }
});

async function processEmails() {
  imap.once('ready', () => {
    imap.openBox('INBOX', false, (err, box) => {
      if (err) throw err;

      imap.search(['UNSEEN'], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return;

        const fetch = imap.fetch(results, { bodies: '' });

        fetch.on('message', (msg) => {
          msg.on('body', async (stream) => {
            const parsed = await simpleParser(stream);

            // Criar message
            await createMessageFromEmail(parsed);

            // Marcar como lido
            msg.once('attributes', (attrs) => {
              imap.addFlags(attrs.uid, '\\Seen', (err) => {
                if (err) console.error(err);
              });
            });
          });
        });
      });
    });
  });

  imap.connect();
}

setInterval(processEmails, parseInt(process.env.IMAP_POLL_INTERVAL));
```

##### 3. Logs e Auditoria

**Tabela `intake_logs` estendida:**
```sql
ALTER TABLE intake_logs
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'api';
  -- valores: 'api', 'imap', 'form'
```

**Evento em `event_logs`:**
```javascript
await db.query(`
  INSERT INTO event_logs (event_type, entity_type, entity_id, metadata)
  VALUES ($1, $2, $3, $4)
`, [
  'message.created_via_imap',
  'message',
  message.id,
  JSON.stringify({ from: email.from.text, subject: email.subject })
]);
```

#### Testes

- [ ] 2 e-mails de teste → 2 `messages`
- [ ] Reprocessamento não duplica
- [ ] Normalização de data funciona
- [ ] Falhas IMAP → backoff exponencial
- [ ] Logs registrados corretamente

---

### Sprint 04 — Notifications Plus (Comentários, @Menções, Lembretes)

**Prioridade:** 🟡 Média  
**Duração estimada:** 4-5 dias  
**Dependências:** Sprint C

#### Objetivo
Ampliar o sistema de notificações já baseado em fila/worker.

#### Entregas

##### 1. Gatilhos Adicionais

**Novos gatilhos:**
- `comment.created` → Notificar destinatário(s) e watchers
- `@menção` em comentário → Notificar usuário mencionado
- `message.resolved` → E-mail de fechamento

**Regex para @menção:**
```javascript
const mentionRegex = /@(\w+)/g;
const mentions = comment.content.match(mentionRegex);

if (mentions) {
  for (const mention of mentions) {
    const username = mention.substring(1);
    const user = await User.findByUsername(username);
    if (user) {
      await enqueueEmail({
        to: user.email,
        subject: `${req.user.name} mencionou você em um comentário`,
        template: 'email_mention',
        data: { user, comment, message }
      });
    }
  }
}
```

##### 2. Preferências de Notificação (MVP)

**Flags em `users`:**
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_on_comment BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_mention BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_resolved BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_due_soon BOOLEAN DEFAULT TRUE;
```

**Verificação antes de enviar:**
```javascript
if (user.notify_on_comment) {
  await enqueueEmail({ ... });
}
```

##### 3. Templates Adicionais

**Novos templates:**
- `email_comment.html` - Novo comentário
- `email_mention.html` - Menção em comentário
- `email_resolved.html` - Recado resolvido

#### Testes

- [ ] Comentário → e-mail aos watchers
- [ ] @menção → e-mail ao mencionado
- [ ] Preferência desativada → não envia
- [ ] Templates renderizam corretamente

---

### Sprint 05 — Terminologia (UX "Registro(s)")

**Prioridade:** 🟢 Baixa  
**Duração estimada:** 2-3 dias  
**Dependências:** Nenhuma

#### Objetivo
Uniformizar a terminologia de UX para "Registro(s)", evitando conflito com "Contato(s)" (pessoas).

#### Entregas

##### 1. Trocar Textos em Views

**Substituições:**
- "Recado" → "Registro"
- "Recados" → "Registros"
- "Novo Recado" → "Novo Registro"
- "Visualizar Recado" → "Visualizar Registro"

**Arquivos afetados:**
- `views/*.ejs` (todas as views)
- `public/js/*.js` (toasts e mensagens)
- Templates de e-mail

**NÃO alterar:**
- Identificadores técnicos (`message`, `messages`)
- Nomes de arquivos
- Nomes de variáveis/funções
- Rotas (`/messages`, `/api/messages`)

##### 2. Atualizar Documentação

**Arquivos:**
- `README.md` - Seção de funcionalidades
- `docs/MANUAL.md` - Manual do usuário
- `docs/API.md` - Documentação de API (apenas descrições)

##### 3. Comunicar Mudança

**Card "Novidade" no login:**
```html
<div class="alert alert-info">
  <strong>Novidade!</strong> Agora chamamos de "Registros" ao invés de "Recados".
  Isso evita confusão com "Contatos" (pessoas).
</div>
```

#### Testes

- [ ] Navegação completa com textos atualizados
- [ ] Toasts exibem "Registro"
- [ ] E-mails usam "Registro"
- [ ] Documentação atualizada

---

### Sprint 06 — Contacts Module Draft (Esboço Contatos)

**Prioridade:** 🟢 Baixa  
**Duração estimada:** 5-7 dias  
**Dependências:** Sprint D, Sprint 05

#### Objetivo
Preparar entidades de pessoas/organizações sem conflitar com "Registros".

#### Entregas

##### 1. Schema Inicial

**Tabela `contacts` estendida:**
```sql
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'person', -- 'person', 'org'
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_type
  ON contacts(type);

CREATE INDEX IF NOT EXISTS idx_contacts_tags
  ON contacts USING GIN(tags);
```

**Tabela `message_contacts`:**
```sql
CREATE TABLE IF NOT EXISTS message_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role TEXT, -- 'sender', 'recipient', 'cc', 'related'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, contact_id, role)
);

CREATE INDEX IF NOT EXISTS idx_message_contacts_message
  ON message_contacts(message_id);

CREATE INDEX IF NOT EXISTS idx_message_contacts_contact
  ON message_contacts(contact_id);
```

##### 2. DAL Interno

**Arquivo:** `models/Contact.js`

```javascript
class Contact {
  static async create({ type, name, email, phone, tags, notes }) {
    const phoneNormalized = phone ? phone.replace(/\D/g, '') : '';
    const emailNormalized = email ? email.toLowerCase().trim() : '';

    const result = await db.query(`
      INSERT INTO contacts (type, name, email, phone, phone_normalized, email_normalized, tags, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (email_normalized, phone_normalized) DO UPDATE
        SET name = EXCLUDED.name,
            tags = EXCLUDED.tags,
            notes = EXCLUDED.notes,
            updated_at = NOW()
      RETURNING *
    `, [type, name, email, phone, phoneNormalized, emailNormalized, tags, notes]);

    return result.rows[0];
  }

  static async findContacts({ search, type, tags, limit = 20, offset = 0 }) {
    // ... implementar busca ...
  }

  static async linkMessageContact(messageId, contactId, role) {
    await db.query(`
      INSERT INTO message_contacts (message_id, contact_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (message_id, contact_id, role) DO NOTHING
    `, [messageId, contactId, role]);
  }
}
```

##### 3. Feature Flag

**Arquivo:** `config/features.js`

```javascript
module.exports = {
  contacts: process.env.FEATURE_CONTACTS === 'true' || false
};
```

**Uso em rotas:**
```javascript
const features = require('../config/features');

if (features.contacts) {
  router.get('/contatos', ensureAuthenticated, contactController.list);
  router.post('/contatos', ensureAuthenticated, contactController.create);
}
```

#### Testes

- [ ] Migrations aplicam/rollback limpos
- [ ] DAL funcional (create, find, link)
- [ ] Feature flag desativa rotas
- [ ] Sem conflito com tabela `contacts` existente

---

### Sprint E — Sessão Única por Usuário

**Prioridade:** 🟡 Média  
**Duração estimada:** 3-4 dias  
**Dependências:** Sprint 00-PRE (concluída)
**Status:** 🚧 Em desenvolvimento (DEV · 04/11/2025)

#### Progresso recente
- ✅ Migration `20251215_add_session_version_to_users.sql` criada (session_version + índice)
- ✅ Middleware de sessão integrado a `requireAuth` com invalidação de versão
- ✅ Login/troca de senha/reset forçado incrementam `session_version`
- ✅ Testes automatizados (`__tests__/auth.session-version.test.js`)
- ⏳ Script opcional de prune/relatório de sessões divergentes

#### Objetivo
Implementar controle de sessão única por usuário, invalidando sessões antigas ao fazer novo login.

#### Entregas

##### 1. Versão de sessão por usuário

**Migration:** `migrations/20251215_add_session_version_to_users.sql`

```sql
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

UPDATE users
   SET session_version = 1
 WHERE session_version IS NULL;

COMMIT;
```

- Opcional: criar índice auxiliar para auditoria de logins (`CREATE INDEX IF NOT EXISTS idx_users_session_version ON users(session_version);`).

##### 2. Middleware de sessão (`middleware/sessionVersion.js`)

```javascript
const UserModel = require('../models/user');

async function ensureSessionVersion(req, res, next) {
  if (!req.session?.user) return next();

  const { id } = req.session.user;
  const sessionVersion = req.session.version;

  const user = await UserModel.findById(id);
  if (!user || user.session_version !== sessionVersion) {
    req.session.destroy(() => {
      res.clearCookie(req.session.cookie?.name || 'late.dev.sess');
      return res.redirect('/login?error=session_invalidada');
    });
    return;
  }

  return next();
}

module.exports = ensureSessionVersion;
```

- Registrar o middleware logo após `requireAuth` nas rotas protegidas (web e API) para encerrar sessões desatualizadas.

##### 3. Lógica de login

**Controller:** `controllers/authController.js`

```javascript
async function login(req, res) {
  // ... autenticação ...

  await db.query(`
    UPDATE users
       SET session_version = session_version + 1,
           updated_at = NOW()
     WHERE id = $1
     RETURNING session_version
  `, [user.id]).then(result => {
    req.session.version = result.rows[0].session_version;
  });

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    viewScope: user.view_scope || 'all',
  };

  // ... redirecionar ...
}
```

- Incrementar a versão também em flows críticos (troca de senha, reset forçado, inativação do usuário, bulk disable).
- Persistir metadados de IP/User-Agent em `intake_logs` ou tabela de auditoria leve (avaliar reuso).

##### 4. Governança da tabela `sessions`

- Manter `connect-pg-simple` como store canônica; ajustar `pruneSessionInterval` se necessário (`server.js:135`).
- Criar script opcional `scripts/prune-stale-sessions.js` para inspeção manual (listar sessão com versão divergente).
- Adicionar logs estruturados ao encerrar sessões por versão para pós-análise (`console.warn('[session] invalidada', {...})`).

#### Testes

- [x] Login registra nova `session_version` — `auth.session-version.test.js`
- [x] Middleware bloqueia sessão cujo `session_version` diverge do banco — `auth.session-version.test.js`
- [ ] Troca de senha incrementa `session_version` e força reautenticação
- [ ] Store (`sessions`) remove entradas expiradas automaticamente (prune)

---

### Sprint F — Memória Operacional (Contexto e Histórico)

**Prioridade:** 🟡 Média  
**Duração estimada:** 5-7 dias  
**Dependências:** Sprint D, Sprint 02

#### Objetivo
Implementar sistema de "memória" que sugere informações relevantes baseadas em interações anteriores.

#### Entregas

##### 1. Análise de Contexto

**Ao criar novo registro:**
- Buscar registros anteriores do mesmo contato
- Identificar padrões (assuntos recorrentes, setores frequentes)
- Sugerir informações relevantes

**Exemplo:**
```javascript
async function analyzeContext(phone, email) {
  const history = await Message.findByContact({ phoneNormalized, emailNormalized, limit: 10 });

  const patterns = {
    mostCommonSector: getMostCommon(history.map(m => m.sector)),
    mostCommonSubject: getMostCommon(history.map(m => m.subject)),
    averageResolutionTime: getAverage(history.map(m => m.resolution_time)),
    lastInteraction: history[0]?.created_at
  };

  return patterns;
}
```

##### 2. Sugestões na UI

**View:** `views/novo-registro.ejs`

```html
<div id="context-suggestions" class="alert alert-info" style="display:none;">
  <strong>Baseado em interações anteriores:</strong>
  <ul>
    <li>Setor sugerido: <strong id="suggested-sector"></strong></li>
    <li>Última interação: <strong id="last-interaction"></strong></li>
    <li>Tempo médio de resolução: <strong id="avg-resolution"></strong></li>
  </ul>
</div>
```

##### 3. API de Contexto

**Rota:** `GET /api/contacts/:id/context`

```javascript
router.get('/contacts/:id/context', async (req, res) => {
  const context = await analyzeContext(req.params.id);
  res.json({ success: true, data: context });
});
```

#### Testes

- [ ] Análise de contexto funciona
- [ ] Sugestões aparecem na UI
- [ ] API retorna dados corretos
- [ ] Performance aceitável

---

### Sprint 02B — Auditoria (UI, Status Operacional & Exportações)

**Status:** ✅ Concluída em 12/11/2025 (cards com filtros salvos, exportações CSV/JSON com fila/notificações e health-check pós-export)  
**Prioridade:** 🔴 Alta · Dependências: Sprint 02 concluída e cluster HA ativo

#### Objetivo
Finalizar a jornada de auditoria com indicadores em tempo real, exportações assíncronas e telemetria do cluster para suportar investigações rápidas.

#### Entregas já disponíveis

1. **Painel “Status Operacional” em `/relatorios/status`**
   - Cards de aplicação (versão, uptime, consumo) e banco (latência do `SELECT 1`, papel primário/standby, peers conectados).
   - Saúde do VIP 192.168.0.250 e do túnel Cloudflare (timeout/erros destacados).
   - Consolidação Prometheus (UP, Load1, CPU, Memória, RootFS, RX/TX) agrupada por `mach1`, `mach2`, `mach3`.
   - Auto-refresh a cada 10s sem recarregar a página.

2. **Navegação e UX**
   - Menu lateral ganhou o item “Status Operacional” dentro de Relatórios.
   - JSON estruturado enriquecido com `client_hostname`, `vip_health` e `tunnel_health`.

3. **Automação de Deploy**
   - Workflow GitHub Actions sincroniza `infra/deploy` para o bastion, injeta `ANSIBLE_BECOME_PASS` via secret e executa `ansible-playbook`.
   - PM2 roda em modo cluster para o app (`instances: 'max'`) e mantém workers de e-mail/export em fork.

#### Resultados finais da sprint

- ✅ Exportações CSV/JSON com fila (`report_exports`) e notificações no app.
- ✅ Cards de auditoria com filtros salvos e drill-down direto para `/relatorios/auditoria`.
- ✅ Health-check pós-export exibido no painel de status.

---

## 🎒 Backlog de Melhorias

### Melhorias Técnicas

1. ✅ **Flag `--json` para `scripts/dev-info.js`** (entregue na Sprint 01)
2. ✅ **Endpoint `GET /api/debug/info` (DEV/TEST)** (entregue na Sprint 01)
3. **Tabela `event_logs` (auditoria leve)** (Sprint 02)
4. **Integração Intake via IMAP** (Sprint 03)
5. **Notificações de @menção** (Sprint 04)
6. **Preferências de notificação** (Sprint 04)
7. ✅ **Sessão única por usuário** (Sprint E · concluída)
8. ✅ **Automação de deploy (GitHub → Ansible/PM2)** (Sprint 02B parcial)
9. ✅ **Dashboard “Status Operacional” + exportações CSV/JSON** (Sprint 02B)
10. **Memória operacional** (Sprint F)
11. 🚧 **Aprimoramento de acesso e vigilância (PR #217 e derivados)**  
    - Verificar `GET /api/messages/:id/watchers` (routes/api.js:398-413) e `messageWatcherController` para garantir que somente operadores com escopo vigente vejam os watchers de cada recado; hoje a permissão de leitura é suficiente e permite enumerar watchers fora do escopo de visão do usuário.
    - Documentar o risco nos logs e reforçar o filtro por setor/usuário na camada de controller/model (mesmo escopo que o `requireAuth` aplica nas mensagens).  
    - Evoluir a tela de administração: além de manter o toggle interno/externo, adicionar no painel “Admin · Usuários” um bloco “Acesso externo” com campos para listar IPs/URLs (separados por vírgula) liberados externamente, e parametrizar janelas de acesso (dias da semana + horário) por usuário.
    - Quando esses controles estiverem prontos, gerar flag de controle (ex.: `external_access_schedule`) e revisitar o roadmap para alinhar com o hardening de acesso por IP.

### Melhorias de UX

1. **Terminologia "Registro(s)"** (Sprint 05)
2. **Módulo de Contatos (pessoas/orgs)** (Sprint 06)
3. **Sugestões baseadas em histórico** (Sprint F)
4. **Dashboard com métricas avançadas**
5. **Busca full-text em registros**
6. **Exportação de relatórios (PDF/Excel)**
7. 🆕 **Anexar arquivos/imagens direto ao recado (nova sugestão 08/11)**

### Melhorias de Performance

1. **Cache de queries frequentes**
2. **Lazy loading de comentários**
3. **Paginação infinita em listagens**
4. **Índices adicionais otimizados**

### Melhorias de Segurança

1. ✅ **Token hasheado em intake** (entregue na Sprint 00-PRE)
2. **2FA opcional para usuários**
3. **Auditoria de acessos**
4. **Rate limiting por IP**
5. 🆕 **Revisão pós-cluster dos logins (alertas de tentativas falhas, MFA opcional)**

---

## 🎯 Critérios de Priorização

### Alta Prioridade (🔴)
- Impacta segurança ou estabilidade
- Resolve bugs críticos
- Requisito de compliance

### Média Prioridade (🟡)
- Melhora experiência do usuário
- Facilita operação/manutenção
- Requisito de negócio

### Baixa Prioridade (🟢)
- Nice to have
- Otimização incremental
- Funcionalidade experimental

---

## 📅 Cronograma Sugerido

### Novembro 2025
- ✅ Sprint 00-PRE (Semana 1)
- ✅ Sprint 01 (Semana 2 · Dev Tools)
- ✅ Sprint E (Semana 2-3 · Sessão única)
- ✅ Sprint 02B (Semana 4 · Auditoria UI + Status + Exportações)

### Dezembro 2025
- ⏳ Sprint 04 (Semana 3)
- ⏳ Sprint 05 (Semana 4)

### Janeiro 2026
- ⏳ Sprint F (Semana 1-2)
- ⏳ Sprint 03 (Semana 3-4)

### Fevereiro 2026
- ⏳ Sprint 06 (Semana 1-2)
- ⏳ Melhorias de Performance (Semana 3-4)

---

## 📚 Referências

- [Status Atual](LATE_STATUS_ATUAL.md)
- [Sprints Executadas](LATE_SPRINTS_EXECUTADAS.md)
- [Roadmap Completo](roadmap_late.md)
- [Cheatsheet DEV/PROD](LATE-cheatsheet-dev-prod.md)

---

**Última atualização:** 2025/11/12 por Manus AI  
**Próxima revisão:** Kick-off Sprint — Controle de Acesso por IP
### Sprint ? — Relatórios Exportações

### Sprint ? — Relatórios Exportações

**Objetivo:** permitir exportações CSV/JSON filtradas a partir da nova rota `/relatorios/exportacoes`.

**Escopo inicial:**
- Implementar backend `GET /api/event-logs/export` e `/api/messages/export` com filtros e paginação.
- UI com fila de exportação e histórico de arquivos gerados.
- Notificações por e-mail quando o relatório estiver pronto.
- Proteção RBAC (apenas `ADMIN`/`SUPERVISOR`).

**Dependências:** finalização das consultas de auditoria e desenho de UX para auditoria/exportações.

**Status:** planejado.
