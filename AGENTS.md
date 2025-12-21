# 🤖 AGENTS.md — LATE + CODEX CLI

Guia único para o agente CODEX CLI

> 📍 Visão consolidada do backlog: `/roadmap`  
> 📘 Ajuda para pessoas usuárias: `/help`

---

## 📊 Snapshot Atual

- Versão (`package.json`): `2.0.0`
- Worktrees oficiais:
  - `~/late-dev` → branch `develop`, porta 3001 (homolog/QA)
  - `~/late-prod` → branch `main`, porta 3100 (produção)
- Documentação estendida (versionada): `docs/**` (news, planning, roadmap, status, manuais, specs).  
  `_reports/` ficou reservado para artefatos temporários gerados por scripts locais.

---

## 🏗️ Estrutura Real do Repositório

```bash
LATE/
├── server.js             # Express 5 + sessões PG + EJS
├── config/               # database.js (pg Pool)
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
npm run dev                     # http://localhost:3100 (nodemon)
```

Sempre que alterar schema ou assets:
- `npm run migrate:dry` para validar SQL antes de aplicar
- `npm run build:css` (ou `npm run build`) para regenerar `public/css/style.min.css`

---

## 🔧 Variáveis de Ambiente Essenciais

Entradas (`server.js`, scripts em `scripts/`) chamam `dotenv` diretamente e carregam **um único `.env`**. Opcionalmente é possível sobrescrever com `DOTENV_FILE=/caminho/arquivo.env`.

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

## ⚙️ Operação & Worktrees

- `npm run dev` → nodemon local (porta 3100, override via `.env`).
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

## 📌 Princípios OPUS / Manifesto LATE

- **KISS sempre:** solução mais simples que funcione e seja fácil de manter.
- **Boring tech vence:** stack enxuta e conhecida; sem complexidade “só porque dá”.
- **PostgreSQL é a fonte de verdade:** consistência e rastreabilidade antes de atalhos.
- **API é contrato:** endpoints retornam JSON apenas; erros padronizados.
- **Segurança por padrão:** sessão segura, CSRF, rate-limit, CORS restrito, mínimo privilégio.
- **Separação clara:** rotas → controllers → models (SQL no model); middlewares fazem o corte transversal.
- **Convenções > opinião:** código/identificadores em inglês; UX/mensagens em pt-BR.
- **Deploy repetível:** produção previsível, automatizada e auditável.
- **Resiliência real:** falhas acontecem; degradar com dignidade e recuperar rápido.
- **Métrica e auditoria sem burocracia:** observar o essencial, registrar o importante, painel útil.
- **UI consistente e reaproveitável:** layout padrão + partials EJS; evitar duplicação sem aprovação.

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
- `MANIFESTO.md` — princípios operacionais do LATE (KISS, boring tech, API contrato).
- `docs/manuals/manual-operacional.md` — operação do sistema para times de atendimento.
- `docs/tecnicos/LATE_Cheatsheet_Comandos.md` — comandos Git/PM2/Deploy.
- `docs/planning/LATE_SPRINTS_EXECUTADAS.md` — histórico de sprints concluídas.
- `docs/planning/LATE_SPRINTS_FUTURAS.md` — roadmap detalhado.
- `docs/status/LATE_Status_Atual.md` — panorama DEV/PROD.

---

## ✅ Antes de Finalizar Uma Task

1. `npm run migrate:dry` e `npm run migrate` (se aplicável).  
2. `npm run build:css` quando o CSS base for alterado.  
3. `npm test` e revisar cobertura (commit inclui ajustes de teste).  
4. Revisar logs (`pm2 logs late-dev`) após subir em homolog/produção.  
5. Atualizar documentos afetados (`AGENTS.md`, `/help`, `/roadmap`, `docs/**`).  
6. Conferir que credenciais/artefatos locais (`.env*`, `_reports/`) não foram adicionados ao git.
7. Quando houver mudanças de segurança, gerar relatório com `scripts/security-check.sh` e anexar ao PR.

---
