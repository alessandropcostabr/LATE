# LATE — Cheatsheet de Comandos (v2.1)
**Atualizado:** 09/11/2025

> Atualizado em 09/11/2025. Este documento reflete a migração para o **novo cluster de produção** (Ubuntu 24.04 LTS, 3 nós: mach1, mach2, mach3), com **HA por Pacemaker/Corosync** (VIP `192.168.15.250`), **deploy automatizado** (GitHub → Bastion → Ansible/PM2) e operação remota via **Apache Guacamole**. 
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
ansible-playbook -i infra/deploy/inventory.ini infra/deploy/deploy.yml
```

## PM2
```bash
pm2 status
pm2 logs late-prod --lines 50
pm2 reload ecosystem.config.js
pm2 start ecosystem.config.js --only late-prod
```

## PostgreSQL
```bash
# PROD
psql -d late_prod -c "SELECT now(), pg_is_in_recovery();"
# Backup rapido
pg_dump late_prod | gzip > backup_prod_$(date +%Y%m%d).sql.gz
```

## Cluster (Pacemaker/Corosync)
```bash
# Status do cluster/recursos
sudo crm status
sudo crm resource list

# Ver VIP no no atual
ip addr show enp0s25 | grep 192.168.15.250

# Simular failover (em 1 no)
sudo systemctl stop corosync
# (aguarde migracao do VIP) 
sudo systemctl start corosync
```

## Guacamole
- URL: `http://192.168.15.201:8080/guacamole/`

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
PGHOST=192.168.15.250   # VIP do cluster
PG_SSL=require
SESSION_SECRET=<secret>
```
