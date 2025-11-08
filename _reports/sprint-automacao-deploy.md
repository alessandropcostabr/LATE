# Sprint: Automação de Deploy GitHub → Cluster PostgreSQL/PM2

## Objetivo
Garantir que cada merge de `develop` para `main` acione uma atualização automática dos três nós do cluster, aplicando `git pull`, `npm install` e os comandos PM2 necessários, com logs auditáveis.

## Status em 08/11/2025

- ✅ Inventário (`infra/deploy/inventory.ini`) e `group_vars` com caminhos padrão.
- ✅ Role `deploy` sincroniza `git pull` → `npm install` → `pm2 reload/start` (web em cluster + workers em fork).
- ✅ Workflow `.github/workflows/deploy.yml` copia os artefatos para o bastion, exporta `ANSIBLE_BECOME_PASS` via secret e executa `ansible-playbook`.
- ✅ PM2 padronizado (`instances: 'max'` para o app + workers em `fork`) tanto em DEV quanto em PROD.
- ✅ Documentação atualizada no README/infra e neste arquivo.
- 🔄 Em aberto: fallback local (script + timer) e alertas automáticos em caso de falha.

## Backlog da Sprint
1. [x] Levantar inventário dos três nós (IPs, usuários, portas, requisitos de sudo) e preparar acesso Ansible.
2. [x] Estruturar `infra/deploy` com playbooks, roles e variáveis segregadas.
3. [x] Criar role Ansible para `git pull`, `npm install` e `pm2 reload/start` com logs e rollback simples.
4. [x] Configurar secrets no GitHub (`BASTION_HOST`, `BASTION_USER`, `BASTION_SSH_KEY`, `BASTION_SUDO_PASS`).
5. [x] Implementar pipeline GitHub Actions disparado em push `main`, sincronizando o bastion e rodando o playbook.
6. [ ] Criar fallback local (`deploy-local.sh` + timer systemd) para contingências sem acesso ao GitHub Actions.
7. [ ] Validar em ambiente de teste/staging; documentar plano de rollback e alertas de falha.
8. [x] Documentar operação: passos de preparação, variáveis, como rodar manualmente, troubleshooting.

## Critérios de Aceite
- Deploy automatizado atualiza código e reinicia PM2 nos três nós em < 5 minutos.
- Logs do GitHub Actions + bastion (`/var/log/ansible-deploy.log`) disponíveis.
- Segredos não ficam em arquivos versionados; apenas no vault/secrets.
- Falhas interrompem o rollout e notificam o time (pendente via Slack/email).

## Riscos e Mitigações
- **Credenciais expostas:** uso de secrets e remoção de senhas do inventário.
- **Deploy interrompido:** fallback local e playbook idempotente.
- **Divergência entre nós:** health-check pós-playbook no painel Status Operacional.

## Próximos Passos
1. Implementar fallback local/timer.
2. Adicionar notificações (Slack/email) para falha do workflow.
3. Formalizar runbook de rollback (PM2 + git reset) e checklist pós-deploy.
