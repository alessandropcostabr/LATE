# 📀 LATE — Design Técnico Atualizado (Novembro/2025)

> Visão consolidada da arquitetura, stack, estrutura de dados e diretrizes técnicas do sistema LATE. Atualizado com base nas sprints até a Sprint E (Sessão Única).

---

## 🚀 Stack e Arquitetura

### Backend
- **Node.js** v22
- **Express** v5
- **EJS** para views
- **PostgreSQL** via `pg`
- **Sessões** com `express-session` (cookie httpOnly + SameSite + secure)
- **Segurança**: Helmet, CORS, CSRF, rate-limit, validação server-side
- **Jobs/schedulers** via `node-cron`

### Frontend
- EJS + arquivos estáticos (JS/CSS) em `/public`
- Views responsivas, sem framework SPA
- Navegação server-rendered com formulários RESTful

### DevOps
- **PM2** para processos
- **Logs** com `morgan`
- **Ambientes**: Ubuntu 24.04 (prod), Linux Mint (dev)
- **Deploy** via `git pull`, `npm ci --omit=dev`, `pm2 restart`

---

## 📁 Estrutura de Pastas (Backend)

```
/controllers         => lógica das rotas
/middleware          => autenticação, RBAC, validações
/routes              => organização de rotas web/API
/models              => DAL/queries SQL encapsuladas
/views               => templates EJS
/public              => JS/CSS client-side
/scripts             => seed, migrations, helpers
/jobs, /schedulers   => tarefas recorrentes e filas
```

---

## 📊 Banco de Dados (PostgreSQL)

### Tabelas principais

- `users`
  - Campos: `id`, `name`, `email`, `password_hash`, `role`, `session_version`, `is_active`, timestamps

- `messages`
  - Agora chamados de "**registros**"
  - Campos: `id`, `call_date`, `call_time`, `recipient`, `sender_name`, `sender_email`, `sender_phone`, `subject`, `message`, `status`, `callback_time`, `notes`, timestamps

- `message_labels`, `message_checklists`, `message_comments`, `message_watchers`
- `automation_rules`, `automation_logs`
- `email_queue`
- `notifications`

### Indices
- Indice composto: `(status, callback_time DESC)` para Kanban/Calendário
- `gen_random_uuid()` via `pgcrypto`

### Constraints
- Check de comprimento em `message_comments.body`, `message_checklists.title`, etc.

---

## 🌐 Rotas e Funcionalidades

### Autenticação & Sessão
- Login com proteção contra fixation, rate-limit e ver. ativa
- Sessão única por usuário com `session_version`

### Registros
- CRUD de mensagens ("recados") com filtros e paginação
- Etiquetas, checklists, histórico de contato (por email/telefone)
- Comentários com @menções e watchers

### Visões
- `/recados/kanban` por status
- `/recados/calendario` por callback
- `/roadmap` com sprints e andamento

### Notificações
- E-mail em eventos chave (novo, resolvido, menção, vencimento)
- Painel de configurações admin para ativar/desativar

### Intake externo
- POST `/api/intake` com token e rate-limit
- Auditado: IP, user-agent, criador = `intake`

---

## 🌐 Convenções e Idioma

- Visível para o usuário: pt-BR
- Identificadores e rotas: inglês
- Chaves JSON: inglês; valores: pt-BR
- Labels normalizadas: `lower(trim(label))`

---

## 📊 Monitoramento e Auditoria

- Logs de login, troca de senha, desativação
- Logs de e-mail e automações
- Sessão encerrada se versão diferente
- Telemetria futura (sessões simultâneas, uso de widgets)

---

## 📄 Documentação Relacionada

- `📊 LATE — Status Atual do Projeto.md`
- `📊 LATE — Resumo Executivo.md`
- `⚡ LATE — Cheatsheet de Comandos.md`
- `🌳 LATE — Guia de Worktrees.md`
- `AGENTS.md` para automação com Codex CLI

---

## 🔄 Em revisão constante

Este arquivo acompanha as sprints. Atualizar após cada entrega.

✅ Atualizado até: **Sprint E — Sessão Única (04/11/2025)**

