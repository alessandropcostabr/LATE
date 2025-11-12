# LATE — Status Atual do Projeto (v2.1)
**Data:** 11/11/2025  
**Ambiente:** DEV (`late-dev`) + PROD (`late-prod`)

> Atualizado em 11/11/2025. Este documento reflete a migração para o **novo cluster de produção** (Ubuntu 24.04 LTS, 3 nós: mach1, mach2, mach3), com **HA por Pacemaker/Corosync** (VIP app `192.168.15.250` / VIP DB `192.168.15.251`), **deploy automatizado** (GitHub → Bastion → Ansible/PM2) e operação remota via **Apache Guacamole**. 
> Convenções do LATE mantidas: **identificadores em inglês**, **mensagens/UX em pt‑BR**, **API JSON apenas**, **DB = PostgreSQL**.


## Situacao Geral
| Item | Estado | Observacao |
|---|---|---|
| Producao | Estável | VIP `192.168.15.250` ativo via mach2; mach3 reintegrado (standby, monitorar disco) |
| Desenvolvimento | Ativo | Sprint 02B (export/export UI) |
| Banco | Primario em `mach2` (VIP `192.168.15.251`) | Standbys `mach1` e `mach3` ativos (`mach1_slot`, `mach3_slot`); observar health do SSD/HDD de mach3 |
| Deploy | Automatizado | GitHub → Bastion → Ansible/PM2 |
| Auditoria Leve | Em uso | `/relatorios/auditoria` (rascunho UI) |
| Status Operacional | Disponivel | `/relatorios/status` |
| Guacamole | Operacional | Conexoes SSH para mach1‑3 via web |

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

## Proximas Acoes
1) Monitorar o hardware de `mach3` (SMART/logs) e planejar troca preventiva do SSD/HDD.  
2) Automatizar validação `pm2 env` (`HOST=0.0.0.0`) no pós-deploy e checagem de `.env` unificado.  
3) Fechar Sprint 02B (exportacoes e filtros).  
4) Planejar MFA/alertas de tentativa falha.  
5) Health-check pos-playbook e alerta no Slack (proximo passo do workflow).
