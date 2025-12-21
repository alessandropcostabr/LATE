# 📘 LATE — Ligação, Atendimento e Triagem Eficiente

LATE é uma aplicação web para registro, triagem e acompanhamento de recados operacionais com foco em rastreabilidade, relacionamento e cumprimento de prazos. Foi projetado para substituir papel, WhatsApp e planilhas na comunicação entre setores, com um sistema leve e seguro.

## 🧭 Visão Geral

- **Stack:** Node.js 22 · Express 5 · PostgreSQL · EJS · PM2
- **Arquitetura:** MVC com middlewares, views EJS, sessão segura
- **Autenticação:** Session cookie (httpOnly, secure, sameSite), regeneração de ID, RBAC com escopos por setor
- **Segurança:** Helmet, CSRF, CORS, validações, rate limit, single-session via `session_version`

## 📂 Funcionalidades

- Registro de recados com etiquetas, destinatário, status e prazos
- Checklists e comentários com @menções e notificações por e-mail
- Visões em lista, Kanban e Calendário
- Widgets de dashboard com SLAs e indicadores
- Relatórios de auditoria leve (`/relatorios/auditoria`) com filtros por evento
- Exportações CSV/JSON com fila dedicada e histórico em `/relatorios/exportacoes`
- Endpoint `/intake` para entrada automatizada (formulários ou e-mail)
- Fila de e-mail com retries e auditoria
- Trilha de auditoria leve via `event_logs` (login, automations, mudanças de recado, follow-up)
- Ferramentas de diagnóstico (CLI `scripts/dev-info.js` e endpoint `/api/debug/info` em DEV/TEST)
- Follow-up obrigatório: ao resolver um recado, registrar comentário com a solução

## 🔒 Limites do CRM

- **Importação CSV:** até 10MB e no máximo 10.000 linhas por arquivo.
- **Timeout de import:** 5 minutos por execução (com backpressure).
- **Rate limit CRM:** 100 req/15min nas rotas gerais.
- **Rate limit import:** 5 req/15min nas rotas de importação.

## 📌 Roteiro e Referências

- [`/news`](./news): changelog com sprints e entregas
- [`/relatorios/auditoria`](./relatorios/auditoria): consulta de eventos registrados em `event_logs`
- [`/relatorios/exportacoes`](./relatorios/exportacoes): painel para gerar arquivos CSV/JSON com filtros aplicados
- [`/roadmap`](./roadmap): planejamento técnico e versões
- [`manual-operacional.md`](./docs/manuals/manual-operacional.md): instruções para uso operacional
- [`DEPLOY.md`](./DEPLOY.md): comandos e boas práticas de operação
- [`LATE_SPRINTS_EXECUTADAS.md`](./LATE_SPRINTS_EXECUTADAS.md)
- [`LATE_SPRINTS_FUTURAS.md`](./LATE_SPRINTS_FUTURAS.md)

## 🛠️ Ambiente de Desenvolvimento

- Repositório usa `git worktree` para `main`, `dev` e `infra`
- Veja `🌳 LATE — Guia Completo de Worktrees.md`
- Cheatsheet em `⚡ LATE — Cheatsheet de Comandos.md`
- `npm run docs:sync` gera os fragmentos HTML usados nas rotas a partir dos arquivos Markdown (`docs/manuals/manual-operacional.md`, `docs/news/news.md` etc.).

## 🩺 Diagnóstico rápido

- `node scripts/dev-info.js`: imprime snapshot do ambiente (NODE_ENV, banco atual, pgcrypto, índices de `messages`, fila de e-mails pendente).
- `node scripts/dev-info.js --json [--output=diagnostics.json]`: salva o mesmo diagnóstico em arquivo para anexar em chamados ou PRs.
- Endpoint espelho: `GET /api/debug/info` (apenas `NODE_ENV=development/test`, requer sessão autenticada). Útil para validar estado do ambiente sem acessar o servidor.
- Recomendações: executar antes de abrir incidentes, anexar ao relatório de deploy e durante troubleshooting em staging/produção (exportar JSON e anexar ao ticket).

## 👥 Contribuição

- Ver `CONTRIBUTING.md` para guidelines
- Licença em `LICENSE`

---

🔐 LATE prioriza **segurança**, **relacionamento com o cliente** e **organização intersetorial**.

📅 Última atualização: 07/11/2025

💡 Projeto em uso interno por equipes clínicas e operacionais.
