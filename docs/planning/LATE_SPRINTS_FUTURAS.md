# 🚀 LATE — Sprints Futuras (Roadmap 2025-2026)
_Atualizado em 23 de dezembro de 2025._

**Versão:** 2.7.0  
**Última atualização:** 23 de dezembro de 2025

---

## 🎯 Visão Geral

Este documento mantém **apenas** sprints e pendências futuras. Sprints concluídas foram registradas em `docs/planning/LATE_SPRINTS_EXECUTADAS.md`.

### Próximas prioridades (ordenadas por impacto)

1. 🟡 **Sprint CRM Fase III — Import CSV Avançado (pendências finais)**
2. 🟡 **Sprint CRM — CRUD Completo (Leads/Contatos/Oportunidades/Atividades)**
3. 🟡 **Sprint 4 — Custom Fields UI**
4. 🟠 **Correção PR #217 — Watchers fora do escopo**
5. 🟡 **Sprint 5 — Recados → Activities**
6. 🟡 **Sprint 6 — Automações de Estágio/SLA**
7. 🟡 **Sprint 7 — ICS/CalDAV Avançado**

---

## 📦 Sprints Planejadas

### Sprint CRM Fase III — Import CSV Avançado (pendências finais)

**Status:** 🟡 Em andamento  
**Prioridade:** 🔴 Alta

**Pendências atuais**
- Barra de progresso do upload (arquivos grandes).
- Testes de dedup/rollback e carga 200k linhas (sem OOM).

### Sprint CRM — CRUD Completo (Leads/Contatos/Oportunidades/Atividades)

**Status:** 🟡 Planejada  
**Prioridade:** 🔴 Alta

**Objetivo**  
Completar operações de **editar/excluir** no CRM com regras de acesso iguais às de recados (escopo por owner/team/admin) e respostas padronizadas.

**Detalhes**  
Ver `docs/LATE_CRM_III.md`.

**Entregas (resumo)**
- API: endpoints `PATCH/DELETE` + `/dependencies` por entidade.
- Regras: escopo com namespace `crm:update`/`crm:delete`, 403 fora do escopo.
- Soft delete padrão com `deleted_at` e filtros em listagens.
- UI mínima: editar/excluir + resumo de impacto.
- Auditoria: `event_logs` com diff simples.
- Testes: RBAC/CSRF/400/403/404 + 1 fluxo Cypress.

### Sprint 4 — Custom Fields UI

**Status:** 🟡 Em andamento  
**Prioridade:** 🟠 Média

**Objetivo**  
UI completa para campos customizados (builder/admin + render nos formulários e kanban).

### Sprint 5 — Recados → Activities

**Status:** 🟡 Planejada  
**Prioridade:** 🟠 Média

### Sprint 6 — Automações de Estágio/SLA

**Status:** 🟡 Planejada  
**Prioridade:** 🟠 Média

### Sprint 7 — ICS/CalDAV Avançado

**Status:** 🟡 Planejada  
**Prioridade:** 🟠 Média

### Correção PR #217 — Watchers fora do escopo

**Status:** 🟠 Planejada  
**Prioridade:** 🟠 Média

**Objetivo**  
Garantir que `/api/messages/:id/watchers` respeite o escopo do usuário.

---

## 🧾 Backlog de Melhorias (não-sprint)

- Remover uso da opção `scope` do EJS (warning no log).
- Melhorar observabilidade de jobs e rotinas (logs e métricas).
- Ajustar `views/500.ejs` para não quebrar quando `error` estiver indefinido.

---

## ✅ Critérios de Priorização

1. Segurança e estabilidade primeiro.
2. Impacto no fluxo diário das equipes.
3. Esforço vs. retorno (quick wins).
4. Dependências técnicas (migrações, dados, infra).
