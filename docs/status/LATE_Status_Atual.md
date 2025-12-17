# LATE — Status Atual do Projeto (v2.2)
**Data:** 16/12/2025  
**Ambiente:** DEV (`late-dev`) + PROD (`late-prod`)

> Atualizado em 16/12/2025. Inclui o **CRM nativo** completo com pipelines, leads/contatos/oportunidades, activities, calendário ICS, dedup, integrações de message-events e telefonia, automações de estágio/SLA, e configuração de pipelines. Convenções do LATE mantidas: **identificadores em inglês**, **mensagens/UX em pt‑BR**, **API JSON apenas**, **DB = PostgreSQL**.

---

## Situação Geral

| Item | Estado | Observação |
|------|--------|------------|
| Produção | Estável | VIP `192.168.0.250` ativo; HA Pacemaker/Corosync em 3 nós |
| Desenvolvimento | Ativo | CRM core completo; automações de estágio/SLA implementadas |
| Banco | Primário em `mach2` | Standbys `mach1` e `mach3` ativos |
| Deploy | Automatizado | GitHub → Bastion → Ansible/PM2 |
| Auditoria | Em uso | `/relatorios/auditoria` |
| Status Operacional | Disponível | `/relatorios/status` |
| CRM | Operacional | Pipelines, Leads, Oportunidades, Calendário, Dedup |

---

## Módulos do CRM Entregues

| Módulo | Funcionalidades | Status |
|--------|-----------------|--------|
| Pipelines | Múltiplos pipelines, estágios configuráveis, regras (required_fields, forbid_jump/back) | ✅ |
| Leads/Contacts | Criação com dedup por email/telefone, export CSV | ✅ |
| Oportunidades | Criação flexível (B2B/B2C), movimentação entre estágios | ✅ |
| Atividades | CRUD, filtros, drag/drop no calendário, export ICS | ✅ |
| Automações | SLA automático, auto-actions (create_activity, notify_owner, set_probability) | ✅ |
| Configuração | Página `/crm/config` para gerenciar pipelines e estágios | ✅ |
| Integrações | WhatsApp Sender, Telefonia HMAC, healthGate | ✅ |
| Stats | Views materializadas com cron de refresh | ✅ |

---

## Branches / Worktrees

- **`develop` → `~/late-dev` → :3001**
- **`main` → `~/late-prod` → :3000**
- Fluxo: *feature → PR → develop → (homologa) → main → deploy automatizado*

---

## Infra & HA

- **Pacemaker/Corosync**: recurso `VirtualIP` (IPaddr2) com monitor 30s
- **Testes de failover**: parar `corosync` em um nó → VIP migra em ~30s
- **tmux cluster**: sessão sincronizada para comandos em massa

---

## Próximas Ações

| Prioridade | Ação | Descrição |
|------------|------|-----------|
| 1 | RBAC fino | Filtros "Meus/Equipe" em todas as listagens e transições do CRM |
| 2 | Stats/Dashboards | Wiring final usando MVs; UI consolidada (pipeline por estágio/mês) |
| 3 | Import CSV avançado | Preview, dedup/merge, dry-run para leads/contacts/opps |
| 4 | Custom fields UI | Interface para campos customizados; editor de pipelines/estágios |
| 5 | Recados → Activities | Mapear recados existentes; navegação integrada |
| 6 | ICS/CalDAV | Subscribe/export avançado; filtros por owner/pipeline |

---

## Testes

- `npm test` / cobertura ~70%+
- Testes de CRM: activities (time/list/ics), dedup merge, API básicas
- Testes de status, auth, session-version, dev-info
