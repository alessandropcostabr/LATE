# Automação de Deploy · Inventário Inicial

Este diretório guarda o inventário base da Sprint “Automação de Deploy GitHub → Cluster PostgreSQL/PM2”.  O objetivo do item 1 é consolidar os dados de acesso dos nós antes de escrever os playbooks. Utilize o arquivo `inventory.ini` nas execuções do Ansible.

## Nós identificados

| Host   | Funções principais                     | IP interno | Observações |
|--------|----------------------------------------|------------|-------------|
| mach1  | Bastion SSH, HAProxy, Cloudflared, app | 192.168.15.201 | Único nó acessível publicamente (`ansible_host=191.9.115.129`). Fornece ProxyJump para os demais nós. |
| mach2  | App/API + workers (PM2)                | 192.168.15.202 | Sem IP público; requer ProxyJump via mach1. |
| mach3  | App/API + workers + primário PostgreSQL | 192.168.15.203 | Mantém VIPs internos 192.168.15.250 (HTTP) e 192.168.15.251 (DB). |

## Acesso Ansible

- Usuário SSH: `alessandro`
- Porta padrão: `22`
- Autenticação atual: usuário `alessandro` com senha `ale123` (definida em `inventory.ini`; migrar para vault quando as senhas forem rotacionadas).
- `sudo` necessário para operações de sistema (utilizar `ansible_become: true`).
- Para mach2/mach3 é obrigatório usar `ProxyJump=alessandro@191.9.115.129` (já definido em `inventory.ini`).

## Próximos passos

1. Versionar `group_vars/` com variáveis comuns (ex.: diretórios da aplicação, caminho do PM2, etc.).
2. Criar role Ansible para atualizar o código (`git pull`), rodar `npm install` quando necessário e reiniciar os processos PM2 (web e workers).
3. Integrar o inventário ao pipeline (GitHub Actions / runner interno) conforme backlog da sprint.

## Pipeline GitHub Actions

O workflow `.github/workflows/deploy.yml` dispara em `push` para `main` (ou manual via _workflow dispatch_). Ele:

1. Faz checkout do repositório.
2. Configura a chave SSH armazenada no secret `BASTION_SSH_KEY`.
3. Sincroniza `infra/deploy/` para `~/late-dev/infra/deploy/` no bastion.
4. Executa `ansible-playbook -i infra/deploy/inventory.ini infra/deploy/deploy.yml`.

### Secrets necessários

| Secret            | Descrição                                      |
|-------------------|------------------------------------------------|
| `BASTION_HOST`    | IP/hostname público do bastion (mach1).        |
| `BASTION_USER`    | Usuário SSH (ex.: `alessandro`).               |
| `BASTION_SSH_KEY` | Chave privada em formato PEM para acessar o bastion. |

Certifique-se de que o bastion possua Ansible instalado e acesso às máquinas internas via ProxyJump (já configurado no inventário).
