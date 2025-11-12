# 📘 Manual — Deploy Automatizado (GitHub → Bastion → Cluster)
> Atualizado em 2025/11/12.

> Última atualização: 2025/11/12

## 1. Visão Geral

1. Cada merge em `main` dispara o workflow **Deploy Cluster** no GitHub Actions.
2. O workflow sincroniza `infra/deploy` para o bastion (`mach1`) via `rsync`.
3. No bastion, o comando `ansible-playbook -i infra/deploy/inventory.ini infra/deploy/deploy.yml` roda com `ANSIBLE_BECOME_PASS` exportado via secret.
4. O playbook executa em paralelo nas máquinas `mach1`, `mach2` e `mach3`:
   - `git pull origin main`
   - `npm install` (quando necessário)
   - `pm2 reload ecosystem.config.js`
   - `pm2 start ecosystem.config.js --only <process>` (web e workers) — **não chame `node server.js` diretamente**, para manter `HOST=0.0.0.0`.

## 2. Pré-requisitos

- Usuário `alessandro` com acesso SSH usando a chave `~/.ssh/mach-key`.
- Secrets configurados no repositório:
  - `BASTION_HOST`, `BASTION_USER`, `BASTION_SSH_KEY`, `BASTION_SUDO_PASS`.
- Primário PostgreSQL exposto via VIP `192.168.15.251` (slot físico por nó standby, ex.: `mach1_slot`).
- Réplicas sincronizadas reportando `pg_is_in_recovery() = true` e `pg_stat_replication` ≥ 2 conexões.
- `.env` padronizado nos três nós (somente `APP_VERSION=2.5.1@machX` varia). Remova quaisquer `.env.prod` restantes antes do deploy.

## 3. Execução Manual (fallback)

```bash
ssh alessandro@191.9.115.129
export ANSIBLE_BECOME_PASS=ale123
cd ~/late-dev
ansible-playbook -i infra/deploy/inventory.ini infra/deploy/deploy.yml
```

## 4. Fluxo do Playbook `roles/deploy`

1. Confere se o diretório git existe (`stat`).
2. Executa `git pull --ff-only origin main`.
3. Roda `npm install` (pode ser desativado via `npm_install=false`).
4. `pm2 reload ecosystem.config.js` para aplicar o cluster.
5. `pm2 start ecosystem.config.js --only late-prod` garante instâncias web.
6. `pm2 start ecosystem.config.js --only late-prod-email-worker/late-prod-export-worker` garante workers.
7. `pm2 env <id> | grep HOST` deve retornar `HOST: 0.0.0.0` após o start/reload.

## 5. Logs e Troubleshooting

| Local | Descrição |
|-------|-----------|
| GitHub Actions → aba Deploy Cluster | Logs do workflow (ssh, rsync, ansible). |
| `~/late-dev/ansible.log` (TODO) | Log opcional com `ANSIBLE_LOG_PATH`. |
| `/home/alessandro/.pm2/logs/*.log` | Saída dos processos PM2 após o reload. |
| `/etc/haproxy/haproxy.cfg`         | Confirmar backends habilitados (desabilite nós fora do ar com `check disabled`). |

### Falhas comuns
- **"Invalid/incorrect password"**: exporte `ANSIBLE_BECOME_PASS` antes do playbook ou confirme o secret `BASTION_SUDO_PASS`.
- **"Host key verification failed"**: garanta `ssh-keyscan` no workflow ou adicione manualmente ao `known_hosts`.
- **PM2 não sobe em cluster**: verifique `ecosystem.config.js` e se o start foi feito com `pm2 start ecosystem.config.js --only late-prod` (mantém `HOST=0.0.0.0`).
- **Health-check 502/503 após deploy**:
  1. `pm2 env <id> | grep HOST` — se estiver `127.0.0.1`, reinicie com `pm2 delete` + `pm2 start ecosystem.config.js --only late-prod`.
  2. Confirme HAProxy (`sudo tail -n 50 /var/log/haproxy.log`) e desabilite backends inativos (`server ... check disabled`).
  3. Valide `/api/health` via VIP e túnel (`curl http://192.168.15.250/health` e `curl https://late.miahchat.com/api/health`).
- **Divergência de `.env`**: sincronize manualmente e valide URLs (`VIP_HEALTH_URL`, `TUNNEL_HEALTH_URL`), mantendo somente `.env` como fonte de configuração.

## 6. Próximos Passos
- Implementar `deploy-local.sh` + timer systemd como contingência.
- Registrar resultado do workflow no Slack (alerta de falha/sucesso).
- Adicionar health-check pós-playbook (curl `/api/health`, `/relatorios/status`) e assert `HOST=0.0.0.0` no PM2.

---

Qualquer dúvida, consulte também `infra/deploy/README.md` e `sprint-automacao-deploy.md`.
