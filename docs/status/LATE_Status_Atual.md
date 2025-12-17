# LATE — Status Atual do Projeto (v2.1)
**Data:** 16/12/2025  
**Ambiente:** DEV (`late-dev`) + PROD (`late-prod`)

> Atualizado em 2025/12/16. Inclui o **CRM nativo** (pipelines, leads/contatos/oportunidades, activities), calendário com ICS, dedup, integrações de message-events e telefonia, e health gate para /api. Convenções do LATE mantidas: **identificadores em inglês**, **mensagens/UX em pt‑BR**, **API JSON apenas**, **DB = PostgreSQL**.


## Situacao Geral
| Item | Estado | Observacao |
|---|---|---|
| Producao | Estável | VIP `192.168.0.250` ativo; HA Pacemaker/Corosync em 3 nós |
| Desenvolvimento | Ativo | CRM core mergeado (pipelines, calendar/ICS, dedup, message-events, telephony) |
| Banco | Primario em `mach2` (VIP `192.168.0.250`) | Standbys `mach1` e `mach3` ativos; monitorar disco de mach3 |
| Deploy | Automatizado | GitHub → Bastion → Ansible/PM2 |
| Auditoria Leve | Em uso | `/relatorios/auditoria` |
| Status Operacional | Disponível | `/relatorios/status` |
| Guacamole | Operacional | Conexões SSH para mach1‑3 via web |
| Monitoramento | Reforçado | Cron + Landscape SaaS coletam health-report |

## Branches / Worktrees
- **`develop` → `~/late-dev` → :3001**
- **`main` → `~/late-prod` → :3000**
- Fluxo: *feature → PR → develop → (homologa) → main → deploy automatizado*

## Infra & HA
- **Pacemaker/Corosync**: recurso `VirtualIP` (IPaddr2) com monitor 30s
- **Testes de failover**: parar `corosync` em um no → VIP migra em ~30s
- **tmux cluster**: sessao sincronizada para comandos em massa
- **Estado atual (11/11/2025)**: `mach3` reinserido como standby, HAProxy com os três backends ativos; manter monitoramento do disco até substituição.

## Deploy Automatizado
- Workflow **Deploy Cluster** (GitHub Actions): rsync `infra/deploy` + `ansible-playbook -i inventory.ini deploy.yml`
- Playbook: `git pull --ff-only`, `npm install` (opcional), `pm2 reload ecosystem.config.js`, `pm2 start ecosystem.config.js --only late-prod[...]` (confirmar `HOST=0.0.0.0` com `pm2 env`)

## Testes Essenciais
- `npm test` / cobertura ~70%+
- `__tests__/api.status.test.js`, `auth.session-version`, `dev-info`

## Próximas Ações
1) RBAC fino e filtros “Meus/Equipe” em todas as listagens e transições do CRM.  
2) Stats/Dashboards: wiring final usando MVs do PG; UI consolidada (pipeline por estágio/mês, atividades por owner).  
3) Importador CSV avançado: preview, dedup/merge, dry-run e aplicação para leads/contacts/opps.  
4) Custom fields UI + required_fields incluindo custom; editor de pipelines/estágios/regras.  
5) Recados → activities: mapear recados, link recado→contato/lead/opp e agenda integrada.  
6) ICS/CalDAV avançado (subscribe/export) e filtros por owner/pipeline.  
7) Automações de estágio/SLA (on_enter/on_exit): criar activity, notificar owner, ajustar probabilidade, lembretes.  
8) Tests adicionais cobrindo filtros, activities, custom fields, recado→lead→opp e CSV importer.
