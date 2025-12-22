# 📘 MP Operacional — LATE (v2.1)
**Atualizado:** 2025/11/12  
**Abrangência:** Produção (cluster HA), Desenvolvimento, Rotina de Deploy, Banco de Dados (PostgreSQL), Monitoramento e Troubleshooting.

> Este MP consolida a operação do LATE no **novo cluster**: Ubuntu 24.04 LTS (3 nós: mach1, mach2, mach3), **HA** com Pacemaker/Corosync (**VIP app/DB 192.168.0.250**), **deploy automatizado** (GitHub → Bastion → Ansible/PM2) e acesso remoto via **Apache Guacamole**.  
> Convenções oficiais: **identificadores em inglês**, **UX pt‑BR**, **API JSON apenas**, **DB = PostgreSQL** (PG only).

---

## 1) Visão Geral e Escopo
- O LATE é um **Contact & Follow‑up Hub** para registrar, acompanhar e resolver pendências, com histórico, responsáveis e prazos.
- Este MP normatiza: **ambientes**, **deploy**, **banco de dados**, **operação diária**, **monitoramento** e **segurança**.
- Público: equipe técnica (Dev/DevOps/Infra) e operação de plantão.

### Padrão de Idiomas (oficial)
- **Usuário final:** pt‑BR (views e mensagens).  
- **Identificadores:** inglês (código, tabelas/colunas, rotas, variáveis).  
- **Chaves JSON:** inglês (`success`, `error`, `data`); **valores** exibidos ao usuário em pt‑BR.  
- **Comentários e PRs:** pt‑BR com justificativa técnica.

---

## 2) Ambientes & Worktrees
- **DEV** → `~/late-dev` (branch `develop`, porta **3001**)  
- **PROD** → `~/late-prod` (branch `main`, porta **3000**)
- Fluxo: `feature` → PR → `develop` (homologa) → `main` (**deploy automatizado**).

**Setup essencial (resumo):**
```bash
cd ~/LATE
git worktree add ../late-dev develop
git worktree add ../late-prod main
cd ~/late-dev  && npm install
cd ~/late-prod && npm install
pm2 start ecosystem.config.js --only late-dev
pm2 start ecosystem.config.js --only late-prod
pm2 save
```

---

## 3) Infraestrutura de Produção (Cluster HA)
- **Nós:** `mach1` (192.168.0.251), `mach2` (192.168.0.252), `mach3` (192.168.0.253) — interface `enp0s25`. **11/11/2025:** `mach3` reinstalado e operando como standby; monitorar disco até substituição definitiva.
- **Failover IP (VIP app/DB):** `192.168.0.250` (recurso `VirtualIP`/`IPaddr2`), monitor a cada 30s — desabilite no HAProxy quaisquer backends inoperantes com `check disabled`.
- **Gerência:** Pacemaker/Corosync (`crm status`, `crm resource list`). Mantenha nós com falha em standby (`sudo crm node standby <host>`); retorne com `sudo crm node online <host>` após o reparo.
- **Acesso remoto:** Apache Guacamole (Tomcat 9 + guacd).

**Comandos rápidos:**
```bash
# Status do cluster
sudo crm status
sudo crm resource list

# Ver VIP no nó atual
ip addr show enp0s25 | grep 192.168.0.250

# Simular failover controlado (em 1 nó)
sudo systemctl stop corosync
# (aguardar migração do VIP)
sudo systemctl start corosync
```

---

## 4) Banco de Dados (PostgreSQL) — Produção
- **Topologia:** PostgreSQL 16 com VIP `192.168.0.250` — primário reside no nó que detém o VIP (em 11/11/2025: `mach2`); standbys: `mach1` e `mach3` (streaming `async`, sob observação de hardware).
- **App:** driver `pg` via `Pool`; **PG only**; `PG_SSL_MODE=verify-full` + `PG_SSL_CA` recomendado em PROD.
- **Acesso na app:** SQL **apenas** em `models/` (controllers sem SQL).

**Verificações essenciais:**
```bash
# Papel do nó
psql -h 192.168.0.250 -d late_prod -c "SELECT pg_is_in_recovery();"

# Replicação ativa (no primário)
psql -h 192.168.0.250 -d late_prod -c "SELECT count(*) FROM pg_stat_replication;"

# Lag (estimativa em bytes)
psql -d late_prod -c "
SELECT now() AS ts,
       pg_is_in_recovery() AS is_standby,
       pg_wal_lsn_diff(pg_current_wal_lsn(), pg_last_wal_replay_lsn()) AS bytes_lag;"
```

**Boas práticas PROD:**
- `statement_timeout = '60s'` no servidor/role; revisar *long queries*.
- `wal_keep_size` conforme tráfego; retenção e política de backup revisadas.
- Usuário de aplicação com **privilégios mínimos** (evitar DDL em runtime).
- `primary_conninfo` dos standbys deve apontar para `host=192.168.0.250` e usar slot físico dedicado (ex.: `mach1_slot`).
- `pg_hba.conf` deve permitir `replication` para `late_repl` em `192.168.0.0/24` (md5).

**Backup rápido:**
```bash
pg_dump late_prod | gzip > backup_prod_$(date +%Y%m%d).sql.gz
```

---

## 5) Deploy (GitHub → Bastion → Ansible/PM2)
- **Trigger:** merge em `main` ativa workflow **Deploy Cluster** (GitHub Actions).
- **Pipeline:** rsync para `~/infra/deploy` no bastion (`mach1`) → `ansible-playbook` nos 3 nós → `pm2 reload` (web em **cluster**, workers em **fork**).

**Fallback manual:**
```bash
ssh alessandro@<BASTION_IP>
export ANSIBLE_BECOME_PASS=<senha>
cd ~/infra/deploy
ansible-playbook -i inventory.local.ini deploy.yml --private-key ~/.ssh/mach-key
```

**Pós-deploy (health):**
```bash
curl -s http://localhost:3000/api/health
curl -s http://192.168.0.250/health
curl -s https://late.miahchat.com/api/health
```

---

## 6) Operação Diária

**Configuração (`.env`):** manter arquivo idêntico nos três nós; variação permitida apenas em `APP_VERSION=2.7.0@machX`. Remova `.env.prod` ou arquivos alternativos para evitar divergências.
**Relatório automático:** cron em mach1 (00h/12h) executa `node scripts/ops-health-report.js --email`, verificando .env, PM2, discos, Prometheus, status público do Slack **e o estado do Ubuntu Pro/ESM/Livepatch em todos os nós**, além de gerar `pg_dump` (gzip) em `/var/backups/late/`; saída consolidada via e-mail (SMTP do `.env`). O mesmo script foi cadastrado no Landscape SaaS para execuções sob demanda e histórico centralizado.
**PM2 (produção):**
```bash
pm2 status
pm2 logs late-prod --lines 50
pm2 reload ecosystem.config.js
pm2 start ecosystem.config.js --only late-prod
pm2 env $(pm2 list | awk '/late-prod/ {print $4}') | grep HOST   # deve ser HOST: 0.0.0.0
```

**Guacamole (admin remota):**
- URL: `http://192.168.0.251:8080/guacamole/`
- Serviços: `sudo systemctl status guacd tomcat9 postgresql --no-pager`

**Ansible (mass ops):**
```bash
ansible -m ping cluster_ubuntu
ansible cluster_ubuntu -a "uptime"
```

---

## 7) Painéis, Monitoramento e Status
- **Status Operacional:** `/relatorios/status` — VIP/túnel, papel do DB e saúde dos processos.
- **Prometheus/Grafana:** (se habilitado) métricas de CPU/RAM/DISCO/NET e targets UP/DOWN.
- **Auditoria Leve:** `event_logs` (hooks `message.*`, `user.login/logout`, `automation.fired`).

---

## 8) Segurança
- **Sessões:** `httpOnly`, `SameSite:'lax'`, `secure` em PROD; regenerar ID no login; **sessão única por usuário** (`session_version`).
- **Middleware:** Helmet (CSP sem `unsafe-inline`), CORS restrito, CSRF (`csurf`), rate‑limit.
- **Env PROD:** `PG_SSL_MODE=verify-full` + `PG_SSL_CA`, `SESSION_SECRET` forte (32+ hex), sem variáveis de SQLite.
- **API:** **sempre JSON**, nada de HTML.

---

## 9) Checklists Operacionais
### 9.1 Pré-Deploy
- [ ] PR revisado e **tests pass** (Jest + Supertest).  
- [ ] Migrations aplicáveis e **transacionais**.  
- [ ] `.env` de PROD com `PG_*`, `PG_SSL_MODE=verify-full` + `PG_SSL_CA`, `SESSION_SECRET` válido.

### 9.2 Pós-Deploy
- [ ] `pm2 status` sem processos falhando.  
- [ ] `/api/health` responde 200; `/relatorios/status` OK.  
- [ ] `pm2 env <id> | grep HOST` retorna `0.0.0.0`; HAProxy sem backend em falha (`tail -n 50 /var/log/haproxy.log`).
- [ ] Confirmar VIP ativo e serviço web acessível.

### 9.3 Failover (exercício controlado)
- [ ] Parar `corosync` em 1 nó; VIP migra (< 30s).  
- [ ] Verificar app operante pelo VIP.  
- [ ] Iniciar `corosync` e validar cluster **Online**.

### 9.4 PostgreSQL (rotina)
- [ ] `pg_is_in_recovery()` correto por nó.  
- [ ] `pg_stat_replication` presente no primário (VIP 192.168.0.250).  
- [ ] Lag aceitável; backups gerados/rotacionados.

---

## 10) Troubleshooting Rápido
- **Cluster não sobe / recurso falhando:** `sudo crm status`, `sudo crm resource list`, `tail -f /var/log/pacemaker.log`.  
- **VIP ausente:** checar `IPaddr2`, interface `enp0s25`, firewalls.  
- **App 5xx após deploy:** `pm2 logs`; verificar `pm2 env <id> | grep HOST` (esperado `0.0.0.0`), validar HAProxy (`/etc/haproxy/haproxy.cfg`) e health-checks (`curl http://192.168.0.250/health`).  
- **Nó com hardware off:** `sudo crm node standby <host>` + `server <host> ... check disabled` no HAProxy até o retorno do equipamento.  
- **Guacamole 404/erro auth:** `sudo tail -f /opt/tomcat9/logs/catalina.out`, checar `guacd` e permissões do JDBC.  
- **Prometheus/Grafana sem dados:** **Targets** em “UP”; reiniciar `node-exporter` e validar `prometheus.yml`.

---

## 11) Endpoints de Saúde
- `GET /api/health` → `{ success, data: { db: "ok" } }` (executa `SELECT 1`).  
- `GET /relatorios/status` → painel HTML com VIP/DB/PM2 (uso interno de operação).

---

## 12) Referências (documentos base)
- **Design Técnico v2.1**, **Resumo Executivo v2.1**, **Status Atual v2.1**  
- **Cheatsheet de Comandos v2.1**, **Guia Worktrees v2.1**  
- **Manual — Deploy Automatizado**, **Manual — Cluster HA**  
- **Troubleshooting — Tomcat9**, **Troubleshooting — Guacamole**  
- **Manual — Prometheus/Grafana**, **DB Best Practices (PostgreSQL)**  
- **Manual — Landscape SaaS (Monitoramento Central LATE)**

---

## 13) Apêndice — Variáveis de Ambiente (PROD)
```dotenv
DB_DRIVER=pg
PG_HOST=<host>
PG_PORT=5432
PG_USER=late
PG_PASSWORD=********
PG_DATABASE=late_prod
PG_SSL_MODE=verify-full
PG_SSL_CA=/caminho/ca.pem

SESSION_SECRET=<openssl rand -hex 32>
NODE_ENV=production
TRUST_PROXY=1
```

---

## 14) Política de Comunicação (Incidentes)
- **Severidade**: S1 (indisponibilidade), S2 (degradação), S3 (anômalo/aviso).  
- **Canais**: registro no LATE (recado “Incidente”), log no **event_logs**, resumo pós‑mortem em até 48h.  
- **Conteúdo mínimo**: impacto, causa raiz (quando conhecida), mitigação, próximos passos.

---

**Fim do MP Operacional v2.1** — Baseado nos manuais e guias oficiais do projeto.
