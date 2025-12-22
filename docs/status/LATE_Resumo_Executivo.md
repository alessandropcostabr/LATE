# LATE — Resumo Executivo (v2.1)
**Data:** 11/11/2025

> Atualizado em 2025/11/12. Este documento reflete a migração para o **novo cluster de produção** (Ubuntu 24.04 LTS, 3 nós: mach1, mach2, mach3), com **HA por Pacemaker/Corosync** (VIP app/DB `192.168.0.250`), **deploy automatizado** (GitHub → Bastion → Ansible/PM2) e operação remota via **Apache Guacamole**. 
> Convenções do LATE mantidas: **identificadores em inglês**, **mensagens/UX em pt‑BR**, **API JSON apenas**, **DB = PostgreSQL**.


## Visao Geral
O LATE (Contact & Follow‑up Hub) concentra registros operacionais, status e follow-ups. A infraestrutura agora roda em **cluster** com **IP Virtual (VIP)** para failover e **deploy automatizado**.

### Metricas
- Versao do produto: **2.1**
- Ambientes: **DEV (`develop`, :3001)** e **PROD (`main`, :3000)**
- Testes e auditoria: suite passando; Auditoria Leve ativa.

## Infraestrutura de Producao
- **SO:** Ubuntu 24.04 LTS (3 nos: `mach1` `192.168.0.251`, `mach2` `192.168.0.252`, `mach3` `192.168.0.253`) — **11/11/2025:** `mach3` reintegrado como standby; monitorar disco até substituição.
- **HA:** Pacemaker/Corosync com **VIP app/DB `192.168.0.250`** (failover IP).  
- **App:** Node.js 22 + Express 5 + EJS; **PM2 em cluster** para web; workers em fork
- **DB:** PostgreSQL 16 (primário exposto via VIP `192.168.0.250`; nó ativo atual `mach2`; standbys `mach1`/`mach3` via slots `mach1_slot`/`mach3_slot`)
- **Acesso remoto:** Apache Guacamole (Tomcat 9 + guacd) — conexoes SSH para os 3 nos
- **Automacao:** GitHub Actions → Bastion (`mach1`) → **ansible-playbook** (git pull, npm install, pm2 reload)
- **Monitoramento extra:** `ops-health-report.js` inclui verificação de Ubuntu Pro/ESM/Livepatch e foi cadastrado no Landscape SaaS (conta `eltdqqsb`) para execuções sob demanda.

## Deploy
**Fluxo:** merge em `main` → Workflow **Deploy Cluster** → rsync para bastion → `ansible-playbook` nos 3 nos → `pm2 reload` + `pm2 start ecosystem.config.js --only late-prod` (confirmar `HOST=0.0.0.0` via `pm2 env` e `.env` idêntico em todos os nós, diferenciando apenas `APP_VERSION=2.7.0@machX`).  
Fallback manual disponivel no bastion.

## Seguranca
- Sessions httpOnly + SameSite + `secure` em PROD; CSRF; Helmet; rate-limit.
- Banco **PG-only**; `PG_SSL` suportado e recomendado com `strict/verify` em PROD.
- Auditoria leve: `event_logs` + hooks (`message.*`, `user.login/logout`, etc.).

## Roadmap imediato
- Sprint 02B entregue (exportações CSV/JSON, filtros salvos e health-checks no painel).
- Implantar **controle de acesso por IP** com política OFFSITE, auditoria e badge no `/relatorios/status`.
- Reforçar **Hardening PG + CSP** (TLS no PostgreSQL, CSP report-only → enforce e `models/diagnostics.js`).

## Conclusao
Ambiente **estável** (mach2 como primário, mach1/mach3 standbys) com HA e esteira de deploy automatizada consolidados. O foco agora está no controle de acesso por IP, no hardening PG + CSP e no monitoramento do hardware de mach3 até a troca preventiva do SSD/HDD.
