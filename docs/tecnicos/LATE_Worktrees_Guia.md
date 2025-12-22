# LATE — Guia Completo de Worktrees (v2.1)
**Atualizado:** 2025/11/12

> Atualizado em 2025/11/12. Este documento reflete a migração para o **novo cluster de produção** (Ubuntu 24.04 LTS, 3 nós: mach1, mach2, mach3), com **HA por Pacemaker/Corosync** (VIP app/DB `192.168.0.250`), **deploy automatizado** (GitHub → Bastion → Ansible/PM2) e operação remota via **Apache Guacamole**. 
> Convenções do LATE mantidas: **identificadores em inglês**, **mensagens/UX em pt‑BR**, **API JSON apenas**, **DB = PostgreSQL**.


## Por que Worktrees?
- Isola **DEV** e **PROD** fisicamente.
- Permite rodar ambos em paralelo (3001/3000).
- Facilita rollback e inspecao.

## Fluxo
```
feature → PR → develop (homologar em :3001)
        → main (deploy automatizado → :3000)
```

## Setup Essencial
```bash
# No repo base
cd ~/LATE
git worktree add ../late-dev develop
git worktree add ../late-prod main

# Instalar deps e PM2 por worktree
cd ~/late-dev  && npm install
cd ~/late-prod && npm install
pm2 start ecosystem.config.js --only late-dev
pm2 start ecosystem.config.js --only late-prod
pm2 env $(pm2 list | awk '/late-prod/ {print $4}') | grep HOST   # garantir 0.0.0.0
pm2 save
```

## Dicas
- PRs **sempre** contra `develop`.
- Merge `develop → main` com `--no-ff` para releases.
- Nao editar diretamente em `late-prod` (exceto hotfix planejado).
- Apos merge em `main`, acompanhe **Deploy Cluster** (GitHub Actions).
- `.env` deve permanecer alinhado entre os nós de produção; somente `APP_VERSION=2.7.0@machX` identifica o host. Remova arquivos alternativos (`.env.prod`, etc.).
