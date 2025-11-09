# LATE — Status Atual do Projeto (v2.1)
**Data:** 09/11/2025  
**Ambiente:** DEV (`late-dev`) + PROD (`late-prod`)

> Atualizado em 09/11/2025. Este documento reflete a migração para o **novo cluster de produção** (Ubuntu 24.04 LTS, 3 nós: mach1, mach2, mach3), com **HA por Pacemaker/Corosync** (VIP `192.168.15.250`), **deploy automatizado** (GitHub → Bastion → Ansible/PM2) e operação remota via **Apache Guacamole**. 
> Convenções do LATE mantidas: **identificadores em inglês**, **mensagens/UX em pt‑BR**, **API JSON apenas**, **DB = PostgreSQL**.


## Situacao Geral
| Item | Estado | Observacao |
|---|---|---|
| Producao | Estavel | VIP `192.168.15.250` ativo; PM2 em cluster |
| Desenvolvimento | Ativo | Sprint 02B (export/export UI) |
| Banco | Primario em `mach3` | Replicas `mach1`/`mach2` saudaveis |
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

## Deploy Automatizado
- Workflow **Deploy Cluster** (GitHub Actions): rsync `infra/deploy` + `ansible-playbook -i inventory.ini deploy.yml`
- Playbook: `git pull --ff-only`, `npm install` (opcional), `pm2 reload ecosystem.config.js`, `pm2 start --only late-prod[...]`

## Testes Essenciais
- `npm test` / cobertura ~70%+
- `__tests__/api.status.test.js`, `auth.session-version`, `dev-info`

## Proximas Acoes
1) Fechar Sprint 02B (exportacoes e filtros).  
2) Planejar MFA/alertas de tentativa falha.  
3) Health-check pos-playbook e alerta no Slack (proximo passo do workflow).
