# LATE — Design Tecnico Atualizado (v2.1)
**Data:** 11/11/2025

> Atualizado em 2025/11/12. Este documento reflete a migração para o **novo cluster de produção** (Ubuntu 24.04 LTS, 3 nós: mach1, mach2, mach3), com **HA por Pacemaker/Corosync** (VIP app/DB `192.168.0.250`), **deploy automatizado** (GitHub → Bastion → Ansible/PM2) e operação remota via **Apache Guacamole**. 
> Convenções do LATE mantidas: **identificadores em inglês**, **mensagens/UX em pt‑BR**, **API JSON apenas**, **DB = PostgreSQL**.


## Stack
- **Node.js 22**, **Express 5**, **EJS** (views)
- **PostgreSQL 16** (pg/Pool) — **PG only**
- Sessoes: `express-session` (cookie httpOnly, SameSite, `secure` em PROD)
- Seguranca: Helmet, CORS restrito, rate-limit, CSRF (`csurf`)
- **PM2** (web em cluster; workers em fork)

## Infra (PROD)
- **Cluster 3 nos**: `mach1` (192.168.0.251), `mach2` (192.168.0.252), `mach3` (192.168.0.253) — **11/11/2025:** `mach3` desligado (falha de disco) e mantido em standby.
- **HA**: Pacemaker/Corosync + VIP app/DB `192.168.0.250` (HAProxy/Cloudflared + PostgreSQL).
- **DB**: primário aponta sempre para o VIP `192.168.0.250`; nó detentor atual `mach2` (`mach1` em standby, `mach3` off). Replicação usa slots dedicados (`mach1_slot`, `mach3_slot`).
- **Acesso remoto**: Apache Guacamole (Tomcat 9 + guacd)
- **Automacao**: GitHub Actions → Bastion → **Ansible** → PM2 reload

## Convencoes
- Identificadores/codigo em **ingles**; UX e mensagens em **pt‑BR**; **API JSON** sempre.
- SQL **somente** em `models/`; controllers **sem SQL**.  
- Variaveis `.env`: `PG_*`, `PG_SSL=strict` em PROD recomendado. Usamos apenas `.env` (sem `.env.prod`), sincronizado entre nós e com `APP_VERSION=2.5.1@machX` para identificar o host.
- Processos web devem ser iniciados via `pm2 start ecosystem.config.js --only late-prod` para garantir `HOST=0.0.0.0` (verificar com `pm2 env`); nós offline precisam ter backend desabilitado no HAProxy (`check disabled`).

## Testes & Saude
- `GET /api/health` executa `SELECT 1` (200/500).
- Jest + Supertest; cobertura ~70%+.
- Status Operacional: `/relatorios/status` (verificacao DB, VIP e processos).

## Auditoria Leve
- Tabela `event_logs`; hooks para `message.*`, `comment.*`, `user.login/logout`, `automation.fired`.
- Exportacoes CSV/JSON planejadas (Sprint 02B).

## Sessao Unica
- `session_version` em `users` para invalidar sessoes antigas ao novo login.

## Documentos Relacionados
- Cheatsheet, Worktrees, Status Atual, Resumo Executivo, Manuais de Cluster, Deploy e Guacamole.
