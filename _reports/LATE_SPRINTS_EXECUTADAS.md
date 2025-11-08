# 📦 LATE — Sprints Executadas (Histórico Completo)

**Período:** Outubro - Novembro 2025  
**Versão Atual:** 2.0.0

---

## 📊 Resumo Geral

| Sprint | Status | Data | PRs | Migrations |
|--------|--------|------|-----|------------|
| Sprint 0 | ✅ Concluída | Out/2025 | - | Várias |
| Sprint A | ✅ Concluída | Out/2025 | - | 1 |
| Sprint B | ✅ Concluída | Out/2025 | - | - |
| Sprint C | ✅ Concluída | Out/2025 | - | 1 |
| Sprint D | ✅ Concluída | Out/2025 | #247 | 2 |
| **Correções Pós-D** | ✅ Concluída | Out-Nov/2025 | #248-257 | - |
| Sprint 02B (parcial) | 🟡 Em andamento | Nov/2025 | #266-268 | 0 |

---

## Sprint 02B — Auditoria & Infra (Parcial liberada em 08/11/2025)

### Objetivo
Fechar a Sprint 02B com a camada visual de auditoria, telemetria do cluster e deploy automatizado, preparando o terreno para exportações CSV/JSON.

### Entregas Principais

1. **Painel Status Operacional (`/relatorios/status`)**
   - Cards com versão, uptime, uso de memória e hostnames.
   - Ping do PostgreSQL (latência, papel primário/standby, peers conectados).
   - Saúde do VIP 192.168.15.250 e do túnel Cloudflare (timeout/erros).
   - Resumo Prometheus agrupado por nó (UP, Load1, CPU, Memória, RootFS, RX/TX).

2. **Atualização de Navegação e Equipe**
   - Item “Status Operacional” incluído no menu Relatórios.
   - JSON enriquecido com `vip_health`, `tunnel_health` e `client_hostname`.
   - Front-end com auto-refresh (10s) e mensagens de erro amigáveis.

3. **Automação de Deploy**
   - Workflow `.github/workflows/deploy.yml` sincroniza `infra/deploy` e executa `ansible-playbook` no bastion.
   - Secrets: `BASTION_HOST`, `BASTION_USER`, `BASTION_SSH_KEY`, `BASTION_SUDO_PASS`.
   - PM2 roda app em cluster (`instances: 'max'`) e mantém workers em fork.

4. **Infra Documentada**
   - Inventário Ansible sem senhas versionadas (`infra/deploy/inventory.ini`).
   - README e sprint docs descrevendo fluxo GitHub → Bastion → Cluster.

### Arquivos Atualizados
- `_reports/news.md`
- `_reports/LATE_SPRINTS_FUTURAS.md`
- `_reports/LATE_SPRINTS_EXECUTADAS.md`
- `_reports/📊 LATE — Resumo Executivo.md`
- `_reports/📊 LATE — Status Atual do Projeto.md`
- `_reports/LATE_roadmap.md`
- `_reports/sprint-automacao-deploy.md`
- `.github/workflows/deploy.yml`
- `infra/deploy/**`
- `views/relatorios-status.ejs`, `public/js/status.js`, `controllers/statusController.js`
- `manual-operacional.md`, `views/help.ejs`, `views/roadmap.ejs`

### Pendências
- Exportações CSV/JSON (fila + notificação).
- Cards e filtros salvos na aba Auditoria.
- Implementar anexos nos recados e revisão final da segurança de login.

---

## Sprint 0 — Infra, Segurança e Contrato

### Objetivo
Estabelecer base sólida de infraestrutura, segurança e padronização para o projeto LATE 2.0.

### Entregas Principais

#### 1. Organização de Worktrees
- **Estrutura criada:**
  - `~/LATE/` - Repositório base
  - `~/late-dev/` - Worktree develop (porta 3001)
  - `~/late-prod/` - Worktree main (porta 3000)

- **Configuração:**
  - `.env.dev` e `.env.prod` separados
  - `loadEnv.js` para carregamento automático
  - PM2 com processos isolados

#### 2. Hardening de Segurança
- **Helmet configurado:**
  - CSP sem `unsafe-inline`
  - HSTS apenas em produção
  - X-Frame-Options, X-Content-Type-Options

- **CSRF seletivo:**
  - Proteção em rotas de formulário
  - Exclusão de `/api/intake` (token próprio)

- **Rate Limiting:**
  - `/login`: 5 tentativas/15min
  - `/api/*`: 100 req/15min

- **Trust Proxy:**
  - DEV: `TRUST_PROXY=0`
  - PROD: `TRUST_PROXY=1` (atrás de Cloudflare/Nginx)

#### 3. Padronização de Contrato JSON
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

- Utilitários criados: `/api/health`, `/api/version`
- Middleware de erro padronizado

#### 4. Scripts Operacionais
- `scripts/migrate.js` - Aplicar migrations
- `scripts/seed-admin.js` - Criar usuário admin
- `scripts/email-worker.js` - Worker de e-mails (Sprint C)

#### 5. Documentação
- `DEPLOY.md` - Guia de deploy
- `CHEATSHEET.md` - Comandos do dia a dia
- `README.md` - Atualizado com novas features

### Migrations
- Várias migrations de setup inicial
- `20251110_add_password_reset_tokens.sql`
- `20251112_add_messages_creator.sql`
- `20251113_add_message_events.sql`

### Testes
- Suite de testes configurada
- Cobertura de rotas principais
- Testes de autenticação e RBAC

---

## Sprint A — Labels, Checklists, Comments, Watchers, Automations

### Objetivo
Preparar infraestrutura para suportar novas funcionalidades e ativar primeiros gatilhos automatizados.

### Entregas Principais

#### 1. Migrations

**Tabela `message_labels`:**
```sql
CREATE TABLE message_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Tabela `message_checklists`:**
```sql
CREATE TABLE message_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Tabela `message_checklist_items`:**
```sql
CREATE TABLE message_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES message_checklists(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Tabela `message_comments`:**
```sql
CREATE TABLE message_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Tabela `message_watchers`:**
```sql
CREATE TABLE message_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);
```

**Tabela `automations`:**
```sql
CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL, -- 'status_change', 'due_soon', etc.
  trigger_value TEXT,
  action_type TEXT NOT NULL, -- 'notify', 'escalate'
  target TEXT, -- user_id, role, etc.
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Tabela `automation_logs`:**
```sql
CREATE TABLE automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id),
  message_id UUID NOT NULL REFERENCES messages(id),
  fired_at TIMESTAMPTZ DEFAULT NOW(),
  result TEXT
);
```

#### 2. Controllers/Models

**Labels:**
- `POST /api/messages/:id/labels` - Adicionar label
- `DELETE /api/messages/:id/labels/:labelId` - Remover label
- Normalização automática de labels

**Checklists:**
- `POST /api/messages/:id/checklist` - Criar checklist
- `GET /api/messages/:id/checklist` - Listar checklists
- `POST /api/checklist/:id/items` - Adicionar item
- `PATCH /api/checklist_items/:id` - Marcar como feito
- `DELETE /api/checklist_items/:id` - Remover item
- Cálculo de progresso automático

**Comentários:**
- `POST /api/messages/:id/comments` - Adicionar comentário
- `GET /api/messages/:id/comments` - Listar comentários (paginado)
- Notificação de watchers

**Watchers:**
- `POST /api/messages/:id/watchers` - Adicionar watcher
- `DELETE /api/messages/:id/watchers/:userId` - Remover watcher
- Adição automática do criador

**Automações:**
- `POST /api/automations` - Criar automação
- `GET /api/automations` - Listar automações
- `PATCH /api/automations/:id` - Ativar/desativar
- Job cron para executar automações

#### 3. Automação Inicial

**Gatilhos implementados:**
- `due_soon_reminder` - Lembrete 30min antes do prazo
- `escalate_pending` - Escalonamento após 48h pendente

**Logs:**
- Todas as execuções registradas em `automation_logs`
- Visível via PM2 logs

#### 4. RBAC

- Comentários e checklists visíveis apenas por quem tem acesso ao recado
- Labels editáveis por Operador+
- Watchers podem ser adicionados por qualquer usuário com acesso

### Migrations
- `20251201_sprint_a_artifacts.sql`

### Testes
- Testes de API para todas as novas rotas
- Validação de RBAC
- Testes de normalização de labels
- Testes de progresso de checklist

---

## Sprint B — Vistas (Kanban/Calendário) e Widgets

### Objetivo
Criar visualizações alternativas (Kanban, Calendário) e widgets de dashboard para melhorar a gestão operacional.

### Entregas Principais

#### 1. Views EJS

**Kanban (`views/kanban.ejs`):**
- Colunas por status (pending, in_progress, resolved, cancelled)
- Filtros por setor e label
- Drag & drop para mudança de status
- Contadores por coluna
- Layout responsivo

**Calendário (`views/calendario.ejs`):**
- Visualização mensal
- Eventos por `callback_at`
- Filtros por setor e label
- Modal de detalhes ao clicar
- Navegação entre meses

#### 2. Widgets de Dashboard

**Widget "Hoje":**
```sql
SELECT COUNT(*) FROM messages
WHERE DATE(callback_at) = CURRENT_DATE
AND status IN ('pending', 'in_progress');
```

**Widget "Atrasados":**
```sql
SELECT COUNT(*) FROM messages
WHERE callback_at < NOW()
AND status IN ('pending', 'in_progress');
```

**Widget "SLA 48h":**
```sql
SELECT COUNT(*) FROM messages
WHERE created_at < NOW() - INTERVAL '48 hours'
AND status = 'pending';
```

#### 3. Consultas Otimizadas

**Índices criados:**
```sql
CREATE INDEX idx_messages_callback_at ON messages(callback_at);
CREATE INDEX idx_messages_status_cb_at ON messages(status, callback_at DESC);
CREATE INDEX idx_messages_created_status ON messages(created_at, status);
```

**Queries otimizadas:**
- Uso de `COUNT(*)` ao invés de `SELECT *`
- Filtros com índices
- Paginação em listagens

#### 4. RBAC nas Telas

- Filtros automáticos por setor do usuário
- Botões de ação condicionais (role-based)
- Mensagens de acesso negado

### Rotas Adicionadas
- `GET /kanban` - View Kanban
- `GET /calendario` - View Calendário
- `GET /api/messages/kanban` - Dados para Kanban (JSON)
- `GET /api/messages/calendario` - Dados para Calendário (JSON)

### Testes
- Testes de integração para views
- Validação de filtros
- Testes de RBAC nas visualizações

---

## Sprint C — Notificações & Intake

### Objetivo
Implementar sistema de notificações por e-mail e endpoint de intake externo para criação de registros.

### Entregas Principais

#### 1. Endpoint de Intake

**Rota:** `POST /api/intake`

**Características:**
- Autenticação via token (`INTAKE_TOKEN`)
- Rate limit: 10 req/min
- Validações dedicadas
- Auditoria em `intake_logs`

**Campos aceitos:**
```json
{
  "sender_name": "João Silva",
  "sender_phone": "11999999999",
  "sender_email": "joao@example.com",
  "subject": "Assunto do recado",
  "message": "Mensagem completa",
  "callback_at": "2025-11-05T14:30:00"
}
```

**Tabela `intake_logs`:**
```sql
CREATE TABLE intake_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT, -- será substituído por token_hash em Sprint futura
  ip TEXT,
  user_agent TEXT,
  payload JSONB,
  message_id UUID REFERENCES messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. Fila de E-mails

**Tabela `email_queue`:**
```sql
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Características:**
- Backoff exponencial (1min, 5min, 15min)
- Máximo 3 tentativas
- Status tracking
- Logs de erro

#### 3. Worker PM2

**Script:** `scripts/email-worker.js`

**Configuração PM2:**
```javascript
{
  name: 'late-email-worker-dev',
  script: './scripts/email-worker.js',
  cwd: '/home/amah/late-dev',
  instances: 1,
  exec_mode: 'fork',
  env: {
    NODE_ENV: 'development'
  }
}
```

**Funcionamento:**
- Polling a cada 30s
- Processa até 10 e-mails por vez
- Backoff exponencial em falhas
- Logs detalhados

#### 4. Templates pt-BR

**Templates criados:**
- `email_new_message.html` - Novo recado
- `email_mention.html` - Menção em comentário
- `email_due_soon.html` - Vencimento próximo
- `email_resolved.html` - Recado resolvido

**Características:**
- Responsivos (mobile-friendly)
- Branded (logo LATE)
- Links diretos para o sistema
- Texto alternativo (plain text)

#### 5. Notificações Implementadas

**Gatilhos:**
- **Novo recado:** Notifica destinatário e setor
- **Forward:** Notifica novo destinatário
- **Mudança de setor:** Notifica novo setor
- **Comentário:** Notifica watchers
- **@Menção:** Notifica usuário mencionado
- **Vencimento próximo:** Notifica destinatário (30min antes)
- **Pendente 48h:** Notifica gestor do setor
- **Resolvido:** Notifica criador e watchers

**Controllers migrados:**
- `messageController.js` - Enfileirar notificações
- `commentController.js` - Notificar em comentários
- `automationController.js` - Notificar em gatilhos

#### 6. Documentação

**Atualizada:**
- `README.md` - Seção de notificações
- `DEPLOY.md` - Configuração de SMTP
- `.env.example` - Variáveis de e-mail

**Novos envs:**
```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@example.com
SMTP_PASS=***
SMTP_FROM=LATE <noreply@example.com>
```

**Comandos:**
```bash
npm run worker:emails  # Iniciar worker
pm2 logs late-email-worker-dev  # Ver logs
```

### Migrations
- `20251205_notifications_intake.sql`

### Testes
- `__tests__/api.intake.test.js` - Testes de intake
- `__tests__/email-queue.test.js` - Testes de fila
- `__tests__/notifications.test.js` - Testes de notificações
- Mocks de SMTP
- Validação de templates

### Deploy
- **DEV:** Publicado em `late.miahchat.com:3001`
- **PROD:** Checklist pós-deploy atualizado

---

## Sprint D — Relacionamento

### Objetivo
Implementar log de interações por contato (telefone/email) e verificação de registros anteriores.

### Entregas Principais

#### 1. Campo `parent_message_id`

**Migration:** `20251211_add_parent_message_id_to_messages.sql`

```sql
ALTER TABLE messages
ADD COLUMN parent_message_id UUID REFERENCES messages(id);

CREATE INDEX idx_messages_parent_id
ON messages(parent_message_id)
WHERE parent_message_id IS NOT NULL;
```

**Uso:**
- Relacionar mensagens de um mesmo contato
- Criar histórico de interações
- Facilitar rastreamento

#### 2. Tabela `contacts`

**Migration:** `20251212_create_contacts.sql`

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  phone TEXT,
  email TEXT,
  phone_normalized TEXT NOT NULL DEFAULT '',
  email_normalized TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_contacts_email_phone_unique
ON contacts (email_normalized, phone_normalized);

CREATE INDEX idx_contacts_phone_normalized
ON contacts (phone_normalized)
WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';

CREATE INDEX idx_contacts_email_normalized
ON contacts (email_normalized)
WHERE email_normalized IS NOT NULL AND email_normalized <> '';
```

**Backfill automático:**
```sql
WITH source AS (
  SELECT
    NULLIF(TRIM(sender_name), '') AS name,
    NULLIF(TRIM(sender_phone), '') AS phone,
    NULLIF(LOWER(TRIM(sender_email)), '') AS email,
    COALESCE(regexp_replace(COALESCE(sender_phone, ''), '[^0-9]+', '', 'g'), '') AS phone_normalized,
    COALESCE(LOWER(TRIM(sender_email)), '') AS email_normalized
  FROM messages
),
prepared AS (
  SELECT DISTINCT ON (COALESCE(email_normalized, ''), COALESCE(phone_normalized, ''))
    name, phone, email, phone_normalized, email_normalized
  FROM source
  WHERE email_normalized <> '' OR phone_normalized <> ''
  ORDER BY COALESCE(email_normalized, ''), COALESCE(phone_normalized, ''), name NULLS LAST
)
INSERT INTO contacts (name, phone, email, phone_normalized, email_normalized)
SELECT name, phone, email, phone_normalized, email_normalized
FROM prepared;
```

#### 3. Rotas de Histórico

**Rota 1:** `GET /contatos/:phone/historico`

**Funcionamento:**
- Normaliza telefone (remove não-dígitos)
- Busca todos os registros com mesmo telefone
- Ordena por data (mais recente primeiro)
- Paginação (20 por página)

**Rota 2:** `GET /contatos/email/historico`

**Funcionamento:**
- Recebe email via query string (`?email=...`)
- Normaliza email (lowercase, trim)
- Busca todos os registros com mesmo email
- Ordena por data (mais recente primeiro)
- Paginação (20 por página)

**Controller:** `contactController.js`

```javascript
async function showHistory(req, res) {
  const { phone } = req.params;
  const { email } = req.query;

  let phoneNormalized = null;
  let emailNormalized = null;

  if (phone && phone !== 'email') {
    phoneNormalized = phone.replace(/\D/g, '');
  }

  if (email) {
    emailNormalized = email.toLowerCase().trim();
  }

  const messages = await Message.findByContact({
    phoneNormalized,
    emailNormalized,
    limit: 20,
    offset: 0
  });

  res.render('historico-contato', {
    messages,
    phone: phoneNormalized,
    email: emailNormalized
  });
}
```

#### 4. View de Histórico

**View:** `views/historico-contato.ejs`

**Características:**
- Lista de registros do contato
- Informações: data, assunto, status, setor
- Links para visualizar cada registro
- Botão "Novo registro para este contato"
- Breadcrumb de navegação

#### 5. Integração em Visualizar Recado

**View:** `views/visualizar-recado.ejs`

**Adições:**
- Seção "Histórico do contato"
- Link "Ver histórico completo"
- Contador de registros anteriores

**JavaScript:** `public/js/visualizar-recado.js`

```javascript
function updateContactHistorySection(phone, email) {
  let url = '/contatos/';
  if (phone && phone !== 'N/A') {
    url += `${phone}/historico?email=${encodeURIComponent(email || '')}`;
  } else if (email && email !== 'N/A') {
    url += `email/historico?email=${encodeURIComponent(email)}`;
  } else {
    return; // Sem telefone nem email
  }

  const link = `<a href="${url}" class="btn btn-link">Ver histórico completo</a>`;
  document.getElementById('contact-history').innerHTML = link;
}
```

### Migrations
- `20251211_add_parent_message_id_to_messages.sql`
- `20251212_create_contacts.sql`

### Testes
- Testes de normalização de telefone/email
- Testes de busca por contato
- Testes de paginação
- Testes de integração com views

### PRs
- **#247** - Deploy Sprint D + Correção excludeId (31/10/2025)

---

## Correções Pós-Sprint D

### PR #248 - Correções UX Histórico e Etiquetas
**Data:** 31/10/2025  
**Status:** ✅ Mergeada

**Mudanças:**
1. **Middleware de erro corrigido:**
   - Passa variável `error` para view 500
   - Fallback para `err.message`

2. **Histórico em visualizar-recado:**
   - Seção "Histórico do contato" adicionada
   - Link "Ver histórico completo"
   - JavaScript para montar URL dinâmica

3. **Tradução Label → Etiqueta:**
   - Todas as views atualizadas
   - Mantém identificadores em inglês
   - UX 100% pt-BR

---

### PR #249 - View 500.ejs
**Data:** 31/10/2025  
**Status:** ✅ Mergeada

**Mudanças:**
1. **View criada:** `views/500.ejs`
   - Layout consistente com 404
   - Mensagem amigável
   - Detalhes técnicos apenas em DEV
   - Botões de navegação

2. **Middleware atualizado:**
   - Renderiza view 500 ao invés de texto
   - Diferencia entre API (JSON) e web (HTML)

---

### PR #251 - Duplicação de Link e Erro 500
**Data:** 31/10/2025  
**Status:** ✅ Mergeada

**Mudanças:**
1. **Removida duplicação:**
   - Função `buildHistoryLink()` removida
   - Mantido apenas link na seção HTML

2. **Rota `/contatos/email/historico` criada:**
   - Para registros sem telefone
   - Controller aceita placeholder `'email'`

3. **Correção erro 500:**
   - Registros com apenas email agora funcionam
   - Não tenta acessar rota inexistente

**Arquivos:**
- `public/js/visualizar-recado.js`
- `routes/web.js`
- `controllers/contactController.js`

---

### PR #253 - Middleware de Erro e Botão Voltar
**Data:** 01/11/2025  
**Status:** ✅ Mergeada

**Mudanças:**
1. **Middleware de erro:**
   - Passa stack trace completo em DEV
   - Fallback: `err.message` ou `String(err)`
   - Nunca mais `error is not defined`

2. **Botão "Voltar" corrigido:**
   - De `<a href="javascript:history.back()">` para `<button onclick="window.history.back()">`
   - Funciona corretamente agora

**Arquivos:**
- `server.js`
- `views/500.ejs`

---

### PR #254 - Redesign Login com bg_LATE.png
**Data:** 01/11/2025  
**Status:** ✅ Mergeada

**Mudanças:**
1. **Arte personalizada:**
   - `public/assets/bg_LATE.png` (33KB)
   - Ilustrações geométricas de animais, mensagens, documentos

2. **Background da hero:**
   - `background-image: url('/assets/bg_LATE.png')`
   - `background-size: contain`
   - `background-position: center`

3. **Card glassmorphism:**
   - `background: rgba(255, 255, 255, 0.95)`
   - `backdrop-filter: blur(10px)`
   - `border-radius: 16px`

4. **Paleta atualizada:**
   - Body: gradiente verde água (`#f0fdfa` → `#d4f1f4`)
   - Texto: cinza escuro (`#1e293b`)
   - Botão: azul (`#2563eb`)

5. **CSS minificado:**
   - `npm run build:css` executado
   - `style.min.css` commitado

**Arquivos:**
- `public/assets/bg_LATE.png`
- `public/css/style.css`
- `public/css/style.min.css`

---

### PR #256 - Ajuste Posição Card Login
**Data:** 01/11/2025  
**Status:** ✅ Mergeada

**Mudanças:**
1. **Card movido:**
   - `align-items: flex-end` (alinha no fundo)
   - `justify-content: flex-end` (alinha à direita)

2. **Tamanho reduzido:**
   - Card: `280px` (antes: `420px`)
   - Título: `1.25rem` (antes: `2.5rem`)
   - Texto: `0.875rem` (antes: `1rem`)

3. **Arte visível:**
   - Animais e ícones totalmente visíveis
   - Card discreto no canto

**Arquivos:**
- `public/css/style.css`
- `public/css/style.min.css`

---

### PR #257 - Escopo Hero Layout Apenas Login
**Data:** 01/11/2025  
**Status:** ✅ Mergeada em `develop`  
**Pendente:** Merge `develop → main`

**Mudanças:**
1. **Classe específica:**
   - `.auth-hero-login` adicionada em `views/login.ejs`

2. **Estilos base restaurados:**
   - `.auth-hero`: centralizado, card 420px
   - `.auth-hero-login`: canto, card 280px

3. **Páginas restauradas:**
   - `/password-reset`: layout centralizado
   - `/password-recover`: layout centralizado

4. **Resolve Codex Review:**
   - "Restrict hero layout change to login"

**Arquivos:**
- `views/login.ejs`
- `public/css/style.css`
- `public/css/style.min.css`

---

## 📊 Métricas das Sprints

| Sprint | Migrations | Controllers | Views | Testes | PRs |
|--------|------------|-------------|-------|--------|-----|
| Sprint 0 | 3 | 5 | 10 | 20 | - |
| Sprint A | 1 | 5 | 5 | 15 | - |
| Sprint B | - | 2 | 2 | 10 | - |
| Sprint C | 1 | 3 | 4 | 12 | - |
| Sprint D | 2 | 1 | 2 | 8 | 1 |
| **Correções** | - | 1 | 3 | - | 9 |
| **Total** | **7** | **17** | **26** | **65** | **10** |

---

## 🎯 Lições Aprendidas

### Boas Práticas Consolidadas

1. **Worktrees funcionam muito bem:**
   - Ambientes isolados
   - Sem conflitos entre DEV e PROD
   - Deploy simplificado

2. **Migrations incrementais:**
   - Sempre com `IF NOT EXISTS`
   - Backfill automático quando necessário
   - Rollback planejado

3. **Testes são essenciais:**
   - Detectaram bugs antes de produção
   - Facilitaram refatoração
   - Documentam comportamento esperado

4. **Documentação atualizada:**
   - Cheatsheet muito útil
   - README sempre em dia
   - Comentários em pt-BR ajudam

5. **Codex Review é valioso:**
   - Identificou problemas reais
   - Sugestões práticas
   - Melhorou qualidade do código

### Desafios Superados

1. **Conflitos de merge:**
   - Resolvidos com `git checkout --theirs`
   - Regeneração de CSS minificado

2. **Migrations em produção:**
   - Executadas com sucesso
   - Sem downtime
   - Backfill automático funcionou

3. **Redesign de login:**
   - Iterações rápidas
   - Feedback do Codex incorporado
   - Resultado final excelente

---

## 📚 Referências

- [Roadmap LATE](roadmap_late.md)
- [Sprints Futuras](LATE_SPRINTS_FUTURAS.md)
- [Cheatsheet DEV/PROD](LATE-cheatsheet-dev-prod.md)
- [Guia de Worktrees](LATE_GUIA_WORKTREES.md)

---

**Última atualização:** 08/11/2025 por Manus AI  
**Próximas sprints:** Sprint 02B (fase 2), anexos nos recados e revisão de segurança de login pós-cluster
