# Sprint — Migração do `~/late-prod` para Cluster HA + Cloudflare Tunnel

> **Contexto LATE**: Node.js 22 + Express 5, EJS (sem alterações de layout), PostgreSQL via `PG_*`, PM2, Ubuntu 24.04. Exposição **exclusiva** via **Cloudflare Tunnel**.  
> **Atenção**: não alterar `views/` nem `public/` nesta sprint.

---

## 🎯 Objetivo
Migrar a aplicação **LATE** (diretório `~/late-prod`) para um **cluster HA** (Pacemaker/Corosync + VirtualIP), **publicando externamente** por **Cloudflare Tunnel**, com:
- VIP interno (ativo/passivo) para manter o endpoint estável na rede.
- `cloudflared` **orquestrado pelo Pacemaker**, migrando junto ao VIP.
- PM2 em **todos** os nós, garantindo pronta-atuação no failover.
- Banco **PostgreSQL** central acessível por todos os nós (`DB_DRIVER=pg`, `PG_*`).

---

## 📦 Escopo (in/out)
**Inclui**
- Validação do cluster (Corosync/Pacemaker + VIP).
- Instalação Node 22 + PM2 nos 3 nós.
- Publicação do código `~/late-prod` (mesmo commit em todos os nós).
- Healthcheck HTTP (`GET /health` com `SELECT 1`).
- Configuração do **Cloudflare Tunnel** como **recurso do cluster** (Systemd).
- Teste de **failover**: VIP + `cloudflared` + app migrando juntos.

**Não inclui**
- HA do PostgreSQL (planejar sprint posterior).
- Alterações em `views/` e `public/` (layout/UX).
- WAF/CDN/regras avançadas do Cloudflare (apenas túnel e DNS/CNAME).

---

## ✅ Pré-requisitos
- Cluster **verde** (3 nós Online) e **VirtualIP** configurado.
- Acesso SSH com sudo nos três nós.
- Hostname no Cloudflare (ex.: `late.amah.com.br`).
- Credenciais do **Cloudflare Tunnel** (arquivo `credentials-file` JSON).
- `.env` de produção contendo: `DB_DRIVER=pg`, `PG_HOST` (VIP 192.168.15.250), `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`, `PG_SSL`, `SESSION_SECRET` forte.

---

## 🚀 Plano de Execução (tarefas + testes)

### 1) Validar Cluster (VIP e estado)
**Comandos**
```bash
sudo crm status
ip -4 addr show <iface> | grep -E '192\.168\.15\.250'  # ajuste VIP/iface
ping -c2 192.168.15.250
```

**Critérios**
- 3 nós Online no `crm`.
- VIP presente **apenas** no nó ativo.
- Ping responde.

---

### 2) Preparar runtime (Node 22 + PM2) **em todos os nós**
**Comandos**
```bash
sudo apt update && sudo apt -y upgrade
node -v && npm -v || curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt -y install nodejs
sudo npm i -g pm2
mkdir -p ~/late-prod
```

**Critérios**
- `node -v` → v22.x
- `pm2 -v` → OK

---

### 3) Publicar `~/late-prod` (mesmo commit nos 3 nós)
**Comandos (no nó ativo; repetir nos demais)**
```bash
git clone --branch main --depth 1 <SEU_REPO> ~/late-prod \
  || (cd ~/late-prod && git fetch --all && git reset --hard origin/main)

cd ~/late-prod
npm ci --omit=dev

# Copiar env de produção
cp /caminho/seguro/.env ~/late-prod/.env
```

**Critérios**
- `npm ci` sem erros.
- `.env` contém `DB_DRIVER=pg` e variáveis `PG_*`.

---

### 4) Healthcheck HTTP `/health`
**Teste local**
```bash
curl -s -i http://127.0.0.1:3000/health
# Esperado: HTTP 200 + corpo "OK" (sem dependência de banco)
```

> *Se a rota não existir, criar uma rota simples que execute `SELECT 1` no PostgreSQL e retorne JSON. Não alterar views/public.*

---

### 5) PM2 — iniciar e persistir (nos 3 nós)
**Comandos**
```bash
cd ~/late-prod
pm2 start server.js --name late-prod --env production
pm2 save
pm2 status
```

**Critérios**
- `late-prod` em `online` no `pm2 status` de todos os nós.

---

### 6) Cloudflare Tunnel — HA com Pacemaker
**Topologia escolhida**
- **Um túnel nomeado** (ex.: `late-prod-tunnel`), **um conector ativo por vez**, executando **apenas no nó que detém o VIP** (controlado pelo Pacemaker).

**Passos**
1. **Instalar `cloudflared` nos 3 nós**:
   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
   sudo apt -y install /tmp/cloudflared.deb
   cloudflared --version
   ```

2. **Credenciais do túnel**:
   - Colocar o JSON do túnel (credentials) em:
     ```
     /etc/cloudflared/<UUID>.json
     ```

3. **Config do túnel** (igual nos 3 nós):
   ```yaml
   # /etc/cloudflared/config.yml
   tunnel: <UUID-DO-TUNNEL>
   credentials-file: /etc/cloudflared/<UUID>.json

   ingress:
     - hostname: late.amah.com.br
       service: http://127.0.0.1:3000
     - service: http_status:404
   ```

4. **Systemd unit** (igual nos 3 nós):
   ```bash
   sudo cloudflared service install
   # ou crie /etc/systemd/system/cloudflared.service
   sudo systemctl daemon-reload
   sudo systemctl enable cloudflared
   ```

5. **Pacemaker resource** (exemplo — ajuste nomes/iface/VIP):
   ```bash
   sudo crm configure primitive VirtualIP ocf:heartbeat:IPaddr2 \
     params ip=192.168.15.250 cidr_netmask=24 nic=enp0s25 op monitor interval=20s

   sudo crm configure primitive Cloudflared systemd:cloudflared op monitor interval=20s

   sudo crm configure order o_vip_then_cfd Mandatory: VirtualIP Cloudflared
   sudo crm configure colocation c_cfd_with_vip inf: Cloudflared VirtualIP

   sudo crm resource restart Cloudflared
   sudo crm status
   ```

**Critérios**
- `systemctl status cloudflared` **ativo** somente no nó **ativo** do VIP.
- `late.amah.com.br` (CNAME → Tunnel) responde 200 no `/health`.

---

### 7) CORS e Trust Proxy (ajustes mínimos, se necessários)
**Teste externo**
```bash
curl -I https://late.amah.com.br/health
```

**Critérios**
- `200 OK`, cookies com `secure`/`samesite` corretos.
- Se CORS restritivo, whitelistar `late.amah.com.br`.

---

### 8) Teste de Failover (fim-a-fim)
**Forçar migração**
```bash
# No nó ativo:
sudo crm node standby $(hostname)  # ou sudo systemctl stop corosync

# Verificar novo ativo:
sudo crm status

# Teste externo:
curl -I https://late.amah.com.br/health
```

**Critérios de aceite**
- A indisponibilidade é curta; o endpoint volta a 200 no novo nó ativo.

---

## 📏 Critérios de Aceite (DoR/DoD)
**Definition of Ready**
- Hostname no Cloudflare e credenciais do Tunnel disponíveis.
- Cluster operante com VIP.

**Definition of Done**
- `~/late-prod` presente e no **mesmo commit** em todos os nós; `npm ci` OK.
- PM2 com `late-prod` **online** e `pm2 save` aplicado.
- Túnel ativo **apenas** no nó com VIP (controlado pelo Pacemaker).
- `https://late.amah.com.br/health` responde **200**.
- Failover validado (VIP + cloudflared + app migrando).

---

## ⚠️ Riscos & Mitigações
- **Sessões caem no failover** (store em memória).  
  → Mitigar em sprint futura com session store (Redis/PG).
- **Banco único** (SPOF).  
  → Planejar replicação/Patroni ou backups frequentes.
- **CORS/headers** quebrando acesso via túnel.  
  → Whitelist do hostname, revisar `trust proxy` e cookies.
- **Divergência de config** (`/etc/cloudflared`/`crm`).  
  → Versionar configs e documentar passos de change.

---

## 🔙 Rollback (rápido)
1. Parar `cloudflared` no cluster e `standby` do nó ativo:
   ```bash
   sudo crm resource stop Cloudflared
   sudo crm node standby <nó-ativo>
   ```
2. No Cloudflare, reverter DNS para endpoint anterior **ou** apontar o túnel para o host antigo.
3. Se preciso, reverter código:
   ```bash
   cd ~/late-prod
   git checkout <commit_anterior>
   npm ci --omit=dev
   pm2 restart late-prod && pm2 status
   ```
4. Restaurar cluster (`crm node online`) após estabilizar.

---

## 🧪 Evidências a anexar
- Saídas:
  - `crm status`
  - `pm2 status`
  - `systemctl status cloudflared`
  - `curl -I https://late.amah.com.br/health`
- Prova de failover (antes/depois) com tempos.
- Logs:
  - `pm2 logs --lines 50`
  - `journalctl -u cloudflared -n 100 --no-pager`

---

## 🛠️ Anexos / Cheats
```bash
# Portas locais úteis
ss -tlnp | egrep '3000|9090|9100'

# Logs rápidos
pm2 logs --lines 50
journalctl -u cloudflared -n 100 --no-pager

# Testes HTTP
curl -s http://127.0.0.1:3000/health
curl -I https://late.amah.com.br/health

# Cluster
sudo crm status
sudo crm resource cleanup Cloudflared
sudo crm node standby <node> ; sudo crm node online <node>
```

> **Próxima sprint sugerida**: **Session Store HA** (Redis/PG) para preservar sessão no failover; **HA do PostgreSQL** (Patroni/replicação).

---

**Responsável:** Alessandro  
**Data:** (preencher)  
**Ambiente:** Cluster Ubuntu 24.04 LTS — Pacemaker/Corosync — PM2 — Cloudflare Tunnel
