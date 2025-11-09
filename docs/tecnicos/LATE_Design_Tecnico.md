# LATE — Design Tecnico Atualizado (v2.1)
**Data:** 09/11/2025

> Atualizado em 09/11/2025. Este documento reflete a migração para o **novo cluster de produção** (Ubuntu 24.04 LTS, 3 nós: mach1, mach2, mach3), com **HA por Pacemaker/Corosync** (VIP `192.168.15.250`), **deploy automatizado** (GitHub → Bastion → Ansible/PM2) e operação remota via **Apache Guacamole**. 
> Convenções do LATE mantidas: **identificadores em inglês**, **mensagens/UX em pt‑BR**, **API JSON apenas**, **DB = PostgreSQL**.


## Stack
- **Node.js 22**, **Express 5**, **EJS** (views)
- **PostgreSQL 16** (pg/Pool) — **PG only**
- Sessoes: `express-session` (cookie httpOnly, SameSite, `secure` em PROD)
- Seguranca: Helmet, CORS restrito, rate-limit, CSRF (`csurf`)
- **PM2** (web em cluster; workers em fork)

## Infra (PROD)
- **Cluster 3 nos**: `mach1` (.201), `mach2` (.202), `mach3` (.203)
- **HA**: Pacemaker/Corosync + **VIP 192.168.15.250**
- **DB**: primario `mach3`, replicas `mach1`/`mach2`
- **Acesso remoto**: Apache Guacamole (Tomcat 9 + guacd)
- **Automacao**: GitHub Actions → Bastion → **Ansible** → PM2 reload

## Convencoes
- Identificadores/codigo em **ingles**; UX e mensagens em **pt‑BR**; **API JSON** sempre.
- SQL **somente** em `models/`; controllers **sem SQL**.  
- Variaveis `.env`: `PG_*`, `PG_SSL=strict` em PROD recomendado.

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
