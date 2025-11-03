# 🤖 AGENTS.md — LATE + CODEX CLI

Guia único para o agente CODEX CLI e para colaboradorxs humanos que operam o **LATE**. Consulte antes de investigar arquivos ou rodar comandos.

> 📍 Visão consolidada do backlog: `/roadmap`  
> 📘 Ajuda para pessoas usuárias: `/help`

---

## 📊 Snapshot Atual

- Versão (`package.json`): `2.0.0`
- HEAD local: `8cddcd8` — `feat: exibir versão e build na interface (dev)`
- Últimas entregas: **Registros relacionados** (histórico por contato) · **Tela de login redesenhada** (arte + ajustes CSS)
- Worktrees oficiais:
  - `~/late-dev` → branch `develop`, porta 3001 (homolog/QA)
  - `~/late-prod` → branch `main`, porta 3000 (produção)
- Sprints concluídas: 0, A, B, C, D  
  Próximas sprints priorizadas: **Sprint 00-PRE — Hardening & Sanidade**, **Sprint E — Sessão Única**
- Documentação estendida (não versionada): `_reports/*.md` gerados por `scripts/generate-artifacts.sh`

---

## 🏗️ Estrutura Real do Repositório

```bash
LATE/
├── server.js             # Express 5 + sessões PG + EJS
├── config/               # database.js (pg Pool), loadEnv.js
├── controllers/          # auth, mensagens, usuários, setores, stats
├── middleware/           # auth (RBAC), CSRF, CORS, validações
├── models/               # acesso PostgreSQL (messages, alerts, users, stats)
├── routes/               # routers API (api.js) e web (web.js)
├── services/             # mailer SMTP/log e agendador de alertas
├── scripts/              # migrate.js, seed-admin, inventário/artefatos, backup
├── migrations/           # SQL incremental (20250927_*.sql ... 20251115_*.sql)
├── views/                # Templates EJS
├── public/               # JS estático, CSS, assets
├── __tests__/            # Suite Jest + Supertest + pg-mem
├── utils/                # helpers (ex.: política de senha)
└── ecosystem.config.js   # processo PM2 `late-dev`
```

> Não existem diretórios `api/` ou `workers/` neste snapshot; serviços de fila/alerta estão em `services/`.

---

## 🚀 Onboarding Rápido

```bash
cp .env.example .env            # ajuste as variáveis antes de rodar
npm install
npm run migrate                 # aplica migrations (PG-only)
node scripts/seed-admin.js      # exige ADMIN_EMAIL e ADMIN_PASSWORD
npm run dev                     # http://localhost:3000 (nodemon)
```

Sempre que alterar schema ou assets:
- `npm run migrate:dry` para validar SQL antes de aplicar
- `npm run build:css` (ou `npm run build`) para regenerar `public/css/style.min.css`

---

## ✅ Últimas Entregas

- **Registros relacionados (Sprint D)** — Histórico por telefone/e-mail, normalização de contatos e visualização agregada diretamente nos recados.
- **Tela de login redesenhada** — Arte em tela cheia (`public/assets/bg_LATE.png`), card compacto e CSS ajustado para foco em acessibilidade.

---

## 🔧 Variáveis de Ambiente Essenciais

`config/loadEnv.js` carrega automaticamente `.env.dev`/`.env.prod` → `.env.local` → `.env` (pode sobrescrever via `DOTENV_FILE`).

- Banco: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PG_SSL`
- Sessões: `SESSION_SECRET`, `COOKIE_NAME`, `SESSION_MAX_AGE`
- Rede: `CORS_ORIGINS`, `TRUST_PROXY` (número ou palavra-chave; obrigatório em produção)
- Mailer: `MAIL_DRIVER` (`smtp` ou `log`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Aplicação: `APP_BASE_URL`, `APP_VERSION`, `APP_BUILD`, `MAIL_DEBUG`
- Intake: `INTAKE_TOKEN`, `INTAKE_TOKEN_PEPPER`, `INTAKE_TOKEN_EXPIRES_AT`, `INTAKE_RATE_LIMIT`, `INTAKE_RATE_WINDOW_MS`, `INTAKE_REQUIRE_CSRF`
- Scripts: `ADMIN_EMAIL`, `ADMIN_PASSWORD` para `seed-admin`

---

## 🧪 Testes & Qualidade

- `npm test` → Jest in-band com cobertura (ver `coverage/`).
- Focar em suites específicas: `npm test -- controllers/messageController`.
- Testes utilizam `supertest` + `pg-mem`; configure fixtures no próprio teste.
- Checklist antes de abrir PR:
  1. `npm run migrate:dry` (se houver migrations novas) e `npm run migrate`.
  2. `npm run build:css` após mexer em `public/css/style.css`.
  3. `npm test` e revisar cobertura.
  4. Verificação manual mínima: login/logout, criação/edição de recado, mudança de status, notificações com `MAIL_DRIVER=log`.

---

## 🔄 Automação de Alertas

- Serviço `services/messageAlerts.js` roda agendador (intervalo padrão: 60 min).
- Consulta `messages` por status (`pending`, `in_progress`) e dispara e-mails via `services/mailer.js`.
- Registra histórico em `message_alerts` e `message_events`.
- Respeita `notification_settings` (editável via controllers/models).
- `MAIL_DEBUG=1` habilita logs sem envio real.

---

## 🗂️ Banco & Migrations

- Migrations SQL numeradas por data em `migrations/`.
- Destaques já aplicados:
  - Setores e permissões (`20251006_add_sectors.sql`, `20251107_add_users_view_scope.sql`)
  - Alertas e notificações (`20251114_create_notification_settings.sql`, `20251115_create_message_alerts.sql`)
  - Recuperação de senha (`20251110_add_password_reset_tokens.sql`)
  - Idempotência das automations (`20251211_add_automation_logs_unique_idx.sql`)
  - Intake: hash de token e auditoria (`20251211_update_intake_logs_token_hash.sql`)
  - Remoção de legado `callback_time` (`20251211_drop_callback_time.sql`)
- Scripts:
  - `npm run migrate` / `npm run migrate:dry`
  - `scripts/backup-simple.sh` → usa `pg_dump`
  - `scripts/generate-inventory.sh` / `scripts/generate-artifacts.sh`

---

## 🕹️ Backlog Imediato

### Sprint 00-PRE — Hardening & Sanidade
- Garantir idempotência para automations (índices únicos em `automation_logs`).
- Revisar tokens do intake (hash + expiração) e remover legados (`callback_time`).
- Rodar checklist de segurança (rate limit, headers, seeds) antes de seguir.

### Sprint E — Sessão Única
- Migration: adicionar `session_version INT DEFAULT 1` em `users`.
- Incrementar a versão ao autenticar, trocar senha ou desativar usuário.
- Persistir `session_version` em `req.session.version` e validá-la via middleware dedicado.
- Ao detectar divergência: destruir sessão, registrar IP/user-agent/userId e exibir `Sua sessão foi encerrada...`.

---

## ⚙️ Operação & Worktrees

- `npm run dev` → nodemon local (porta 3000, override via `.env`).
- `npm start` → execução simples (production ready, sem watch).
- PM2:
  - `pm2 start ecosystem.config.js --only late-dev`
  - `pm2 restart late-dev`
  - `pm2 logs late-dev`
- Worktree DEV (`~/late-dev`): `git checkout develop && git pull origin develop`
- Worktree PROD (`~/late-prod`): `git checkout main && git pull origin main`
- Nunca desenvolva diretamente na raiz `~/LATE/`; utilize o worktree correto e confirme branch antes de editar.

---

## 🧰 Scripts Úteis

- `scripts/migrate.js [--dry-run]`
- `scripts/seed-admin.js`
- `scripts/security-check.sh [BASE_URL]` — gera relatório do checklist de segurança
- `scripts/generate-artifacts.sh` → gera `_reports/inventario_*.txt`, tree e dump textual (sem subir para o Git)
- `scripts/generate-inventory.sh`
- `scripts/backup-simple.sh`

---

## ✍️ Convenções de Código & PRs

- Node.js ≥ 22, CommonJS, indentação 2 espaços, semicolons mantidos.
- Identificadores em inglês; mensagens exibidas/comentários de negócio em pt-BR.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, etc.).
- PRs devem incluir:
  - Resumo objetivo + motivação.
  - Riscos (auth, rate limiting, migrations, e-mail).
  - Passos manuais (ex.: `npm run migrate`, `npm run build:css`).
  - Evidências (logs, screenshots quando UI mudar).

---

## 🔐 Segurança

- Helmet + CSP (API); HSTS somente em produção HTTPS.
- Rate limit: `/login` 20 req/15min, `/api` 100 req/15min.
- CSRF: middleware dedicado (ver `middleware/csrf.js`), endpoint `GET /api/csrf` renova token.
- Sessões: `express-session` + `connect-pg-simple`, cookies `httpOnly`, `secure` quando `NODE_ENV=production`.
- CORS: `middleware/cors.js` checa origem com base em `CORS_ORIGINS`.
- `validateOrigin` (opcional) pode ser habilitado em produção para reforçar allowlist.

---

## 📚 Referências Rápidas

- `README.md` — visão geral, instruções de deploy, rate limits.
- `manual-operacional.md` — operação do sistema para times de atendimento.
- `_reports/⚡ LATE — Cheatsheet de Comandos.md` — comandos Git/PM2/Deploy (não versionado).
- `_reports/LATE_SPRINTS_EXECUTADAS.md` — histórico de sprints concluídas.
- `_reports/LATE_SPRINTS_FUTURAS.md` — roadmap detalhado.
- `_reports/📊 LATE — Status Atual do Projeto.md` — panorama DEV/PROD.

---

## ✅ Antes de Finalizar Uma Task

1. `npm run migrate:dry` e `npm run migrate` (se aplicável).  
2. `npm run build:css` quando o CSS base for alterado.  
3. `npm test` e revisar cobertura (commit inclui ajustes de teste).  
4. Revisar logs (`pm2 logs late-dev`) após subir em homolog/produção.  
5. Atualizar documentos afetados (`AGENTS.md`, `/help`, `/roadmap`, `_reports`).  
6. Conferir que credenciais/artefatos locais (`.env*`, `_reports/`) não foram adicionados ao git.

---

🌀 Powered by Codex CLI + LATE Core v2.0.0
