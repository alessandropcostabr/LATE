# Manual — Landscape SaaS (Monitoramento Central LATE)
> Atualizado em 2025/11/30.

## Objetivo
Descrever como registrar os nós do cluster (`mach1`, `mach2`, `mach3`) no **Landscape SaaS** da Canonical (conta `eltdqqsb`), reaproveitando o `ops-health-report.js` para execuções sob demanda e habilitando alertas de atualizações/Livepatch.

## 1. Pré-requisitos
- Ubuntu 24.04 LTS com **Ubuntu Pro** já anexado (`pro status`).
- Pacote `landscape-client` instalado (`sudo apt install landscape-client`).
- Acesso SSH com usuário `alessandro` e senha sudo `ale123`.
- Conta Landscape SaaS ativa (`https://landscape.canonical.com`, account-name `eltdqqsb`).

## 2. Registrar cada nó
Executar nos três nós (ajustando `machX-prod`):

```bash
sudo landscape-config \
  --computer-title mach1-prod \
  --account-name eltdqqsb \
  --url https://landscape.canonical.com/message-system \
  --ping-url https://landscape.canonical.com/ping \
  --silent
```

> O comando acima envia o pedido de registro automaticamente (não utiliza servidor self-hosted).  
> Checar serviço: `systemctl is-active landscape-client` → `active`.

## 3. Organização no Landscape
1. Acessar `https://landscape.canonical.com`.  
2. Aprovar os 3 hosts e mantê-los, por enquanto, no grupo **Global** (criar `late-prod-cluster` no futuro se necessário).  
3. Opcional: definir tags ou grupos adicionais para políticas específicas.

## 4. Script “Health Report” no Landscape
- Em **Scripts → Add script**, preencher:
  - **Interpreter:** `/bin/bash`
  - **Run as user:** `root`
  - **Time limit:** `300`
  - **Body:**
    ```bash
    #!/bin/bash
    set -euo pipefail
    sudo -u alessandro -H bash -c '
      cd /home/alessandro/late-prod
      SUDO_PASSWORD=ale123 \
      HEALTH_REPORT_RECIPIENTS=late@amah.vet \
      /usr/bin/node scripts/ops-health-report.js --email
    '
    ```
  - **Targets:** apenas `mach1-prod` (é o nó que já executa o cron).
- Com isso o Landscape executa o mesmo relatório usado no cron:
  - Gera backup `pg_dump`, valida `.env`, PM2, HAProxy, PostgreSQL, Prometheus, Slack **e agora também o estado do Ubuntu Pro/ESM/Livepatch**.
  - Saída fica registrada no painel (aba “Script results”) e o e-mail continua sendo enviado.

## 5. Alertas recomendados
1. **Security / Updates**  
   - Settings → Notifications → habilitar alertas para “Security updates available” e “Reboot required”.
2. **Heartbeat do client**  
   - Settings → Alerts → criar regra “Machine hasn’t checked in for 30 minutes”.
3. **Scripts**  
   - Na página do script, marcar “Notify when this script fails” para receber aviso se o health-report retornar erro.

## 6. Operação diária
- Continuar monitorando os relatórios por e-mail (cron 00h/12h) e usar o Landscape para execuções ad hoc ou auditorias centralizadas.
- Quando um nó for reinstalado, repetir o `landscape-config` para reaparecer no painel.
- Para desligar o cron local futuramente, comentar `/etc/cron.d/late-health-report` e agendar o script diretamente no Landscape.

---

**Resultado atual (nov/2025):** `mach1-prod`, `mach2-prod` e `mach3-prod` já estão registrados em `eltdqqsb`, com o script `late-prod-health-report` disponível para execução manual ou agendada.
