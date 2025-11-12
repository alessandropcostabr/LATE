# LATE — Resumo Executivo (v2.1)
**Data:** 11/11/2025

> Atualizado em 11/11/2025. Este documento reflete a migração para o **novo cluster de produção** (Ubuntu 24.04 LTS, 3 nós: mach1, mach2, mach3), com **HA por Pacemaker/Corosync** (VIP app `192.168.15.250` / VIP DB `192.168.15.251`), **deploy automatizado** (GitHub → Bastion → Ansible/PM2) e operação remota via **Apache Guacamole**. 
> Convenções do LATE mantidas: **identificadores em inglês**, **mensagens/UX em pt‑BR**, **API JSON apenas**, **DB = PostgreSQL**.


## Visao Geral
O LATE (Contact & Follow‑up Hub) concentra registros operacionais, status e follow-ups. A infraestrutura agora roda em **cluster** com **IP Virtual (VIP)** para failover e **deploy automatizado**.

### Metricas
- Versao do produto: **2.1**
- Ambientes: **DEV (`develop`, :3001)** e **PROD (`main`, :3000)**
- Testes e auditoria: suite passando; Auditoria Leve ativa.

## Infraestrutura de Producao
- **SO:** Ubuntu 24.04 LTS (3 nos: `mach1` `.201`, `mach2` `.202`, `mach3` `.203`) — **11/11/2025:** `mach3` reintegrado como standby; monitorar disco até substituição.
- **HA:** Pacemaker/Corosync com **VIP app `192.168.15.250`** e **VIP DB `192.168.15.251`** (failover IPs).  
- **App:** Node.js 22 + Express 5 + EJS; **PM2 em cluster** para web; workers em fork
- **DB:** PostgreSQL 16 (primário exposto via VIP `192.168.15.251`; nó ativo atual `mach2`; standbys `mach1`/`mach3` via slots `mach1_slot`/`mach3_slot`)
- **Acesso remoto:** Apache Guacamole (Tomcat 9 + guacd) — conexoes SSH para os 3 nos
- **Automacao:** GitHub Actions → Bastion (`mach1`) → **ansible-playbook** (git pull, npm install, pm2 reload)

## Deploy
**Fluxo:** merge em `main` → Workflow **Deploy Cluster** → rsync para bastion → `ansible-playbook` nos 3 nos → `pm2 reload` + `pm2 start ecosystem.config.js --only late-prod` (confirmar `HOST=0.0.0.0` via `pm2 env` e `.env` idêntico em todos os nós, diferenciando apenas `APP_VERSION=2.5.1@machX`).  
Fallback manual disponivel no bastion.

## Seguranca
- Sessions httpOnly + SameSite + `secure` em PROD; CSRF; Helmet; rate-limit.
- Banco **PG-only**; `PG_SSL` suportado e recomendado com `strict/verify` em PROD.
- Auditoria leve: `event_logs` + hooks (`message.*`, `user.login/logout`, etc.).

## Roadmap imediato
- Finalizar **Sprint 02B** (exportacoes CSV/JSON + filtros salvos em Auditoria).
- Revisao de login pos-cluster (alertas de tentativas falhas, MFA opcional).

## Conclusao
Ambiente **estável** (mach2 como primário, mach1/mach3 standbys) com HA e esteira de deploy automatizada consolidados. O foco segue em Auditoria 02B, endurecimento de autenticação, automações para validar binding/health, e monitoramento do hardware de mach3 até troca preventiva.
