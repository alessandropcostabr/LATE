# LATE — Cheatsheet de Comandos (v2.1)
**Atualizado:** 2025/11/12

> Atualizado em 2025/11/12. Este documento reflete a migração para o **novo cluster de produção** (Ubuntu 24.04 LTS, 3 nós: mach1, mach2, mach3), com **HA por Pacemaker/Corosync** (VIP app/DB `192.168.0.250`), **deploy automatizado** (GitHub → Bastion → Ansible/PM2) e operação remota via **Apache Guacamole**. 
> Convenções do LATE mantidas: **identificadores em inglês**, **mensagens/UX em pt‑BR**, **API JSON apenas**, **DB = PostgreSQL**.


## Ambientes / Worktrees
```
~/LATE        # repo base (git metadata)
~/late-dev    # worktree develop  (porta 3001)
~/late-prod   # worktree main     (porta 3000)
```

## DEV / Git
```bash
# Nova feature
cd ~/late-dev && git checkout develop && git pull --ff-only
git checkout -b feat/minha-feature
# ...codar...
git add . && git commit -m "feat: X"
git push -u origin feat/minha-feature
gh pr create --base develop --title "feat: X"
```

## Deploy (Automatizado)
```bash
# Merge em main → dispara pipeline
# Acompanhar: GitHub Actions → 'Deploy Cluster'

# Fallback manual (bastion)
ssh alessandro@<BASTION_IP>
export ANSIBLE_BECOME_PASS=<senha>
cd ~/infra/deploy
ansible-playbook -i inventory.local.ini deploy.yml --private-key ~/.ssh/mach-key
```

### `.env`
```bash
# Verificar consistência (esperado: apenas APP_VERSION muda)
diff -u mach1.env mach2.env
diff -u mach1.env mach3.env
# Sincronizar manualmente quando ajustar credenciais
scp ~/late-prod/.env alessandro@<host>:/home/alessandro/late-prod/.env
```

### Backups
```bash
# Relatórios/cron em mach1 geram pg_dump 2x/dia
ls -lh /var/backups/late/late_prod_*.sql.gz
```

## PM2
```bash
pm2 status
pm2 logs late-prod --lines 50
pm2 reload ecosystem.config.js
pm2 start ecosystem.config.js --only late-prod
pm2 env <id> | grep HOST        # deve ser HOST: 0.0.0.0 (reinicie se vier 127.0.0.1)
```

### Recuperar bind incorreto (502/503)
```bash
pm2 delete late-prod
pm2 start ecosystem.config.js --only late-prod
pm2 env $(pm2 list | awk '/late-prod/ {print $4}') | grep HOST
```

## PostgreSQL
```bash
# PROD (VIP 192.168.0.250)
psql -h 192.168.0.250 -d late_prod -c "SELECT now(), pg_is_in_recovery();"
psql -h 192.168.0.250 -d late_prod -c "SELECT pid, client_addr, state FROM pg_stat_replication;"
pg_dump late_prod | gzip > backup_prod_$(date +%Y%m%d).sql.gz
```

### Ajustes de fluxo de WAL (primário)
```bash
sudo -u postgres psql -c "SELECT pg_create_physical_replication_slot('mach1_slot');"
sudo -u postgres psql -c "SELECT slot_name, active FROM pg_replication_slots;"
```

### Ajustes de standby (`mach1`)
```bash
sudo sed -i "s/host=192.168.0.253/host=192.168.0.250/" /var/lib/postgresql/16/main/postgresql.auto.conf
sudo systemctl restart postgresql
tail -n 20 /var/log/postgresql/postgresql-16-main.log
```

## Cluster (Pacemaker/Corosync)
```bash
# Status do cluster/recursos
sudo crm status
sudo crm resource list
sudo crm configure show | grep -E "no-quorum|standby"

# Ver VIP no no atual
ip addr show enp0s25 | grep 192.168.0.250

# Simular failover (em 1 no)
sudo systemctl stop corosync
# (aguarde migracao do VIP) 
sudo systemctl start corosync

# Isolar nó com hardware em falha
sudo crm node standby <hostname>
sudo crm node online <hostname>
```

## HAProxy
```bash
sudo tail -n 50 /var/log/haproxy.log
sudo sed -n '1,120p' /etc/haproxy/haproxy.cfg
# Desabilitar backend indisponível (ex.: mach3 off)
sudo sed -i 's/server mach3 .* check$/server mach3 192.168.0.253:3100 check disabled/' /etc/haproxy/haproxy.cfg
sudo systemctl reload haproxy
```

## Guacamole
- URL: `http://192.168.0.251:8080/guacamole/`

## Ansible (basico)
```bash
ansible -m ping cluster_ubuntu
ansible cluster_ubuntu -a "uptime"
```

## Seguranca
```bash
# Gerar secret
openssl rand -hex 32

# .env (produção)
HOST=0.0.0.0
PGHOST=192.168.0.250   # VIP do cluster
PG_SSL=require
SESSION_SECRET=<secret>
```
