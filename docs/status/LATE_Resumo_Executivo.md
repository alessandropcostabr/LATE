# LATE — Resumo Executivo (v2.1)
**Data:** 09/11/2025

> Atualizado em 09/11/2025. Este documento reflete a migração para o **novo cluster de produção** (Ubuntu 24.04 LTS, 3 nós: mach1, mach2, mach3), com **HA por Pacemaker/Corosync** (VIP `192.168.15.250`), **deploy automatizado** (GitHub → Bastion → Ansible/PM2) e operação remota via **Apache Guacamole**. 
> Convenções do LATE mantidas: **identificadores em inglês**, **mensagens/UX em pt‑BR**, **API JSON apenas**, **DB = PostgreSQL**.


## Visao Geral
O LATE (Contact & Follow‑up Hub) concentra registros operacionais, status e follow-ups. A infraestrutura agora roda em **cluster** com **IP Virtual (VIP)** para failover e **deploy automatizado**.

### Metricas
- Versao do produto: **2.1**
- Ambientes: **DEV (`develop`, :3001)** e **PROD (`main`, :3000)**
- Testes e auditoria: suite passando; Auditoria Leve ativa.

## Infraestrutura de Producao
- **SO:** Ubuntu 24.04 LTS (3 nos: `mach1` `.201`, `mach2` `.202`, `mach3` `.203`)
- **HA:** Pacemaker/Corosync com **VIP `192.168.15.250`** (failover IP)  
- **App:** Node.js 22 + Express 5 + EJS; **PM2 em cluster** para web; workers em fork
- **DB:** PostgreSQL 16 (primario: `mach3`; replicas: `mach1`/`mach2`)
- **Acesso remoto:** Apache Guacamole (Tomcat 9 + guacd) — conexoes SSH para os 3 nos
- **Automacao:** GitHub Actions → Bastion (`mach1`) → **ansible-playbook** (git pull, npm install, pm2 reload)

## Deploy
**Fluxo:** merge em `main` → Workflow **Deploy Cluster** → rsync para bastion → `ansible-playbook` nos 3 nos → `pm2 reload`.  
Fallback manual disponivel no bastion.

## Seguranca
- Sessions httpOnly + SameSite + `secure` em PROD; CSRF; Helmet; rate-limit.
- Banco **PG-only**; `PG_SSL` suportado e recomendado com `strict/verify` em PROD.
- Auditoria leve: `event_logs` + hooks (`message.*`, `user.login/logout`, etc.).

## Roadmap imediato
- Finalizar **Sprint 02B** (exportacoes CSV/JSON + filtros salvos em Auditoria).
- Revisao de login pos-cluster (alertas de tentativas falhas, MFA opcional).

## Conclusao
Ambiente **estavel**, com HA e esteira de deploy automatizada consolidados. O foco segue em Auditoria 02B e endurecimento de seguranca de autenticacao.
