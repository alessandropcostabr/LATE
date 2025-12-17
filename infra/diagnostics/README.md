# Diagnóstico Automático (Darkstar)

Arquivos de apoio para instalar no Darkstar:

- `diagnose.sh`: script principal. Copiar para `/opt/late-diagnostics/diagnose.sh`, dar `chmod +x` e ajustar variáveis `PG_DSN`, `CODEX_BIN` e `PGPASSWORD` (via environment ou `/etc/default/late-diagnostics`).
- `diagnostic-api.js`: API mínima para receber POST `/trigger-diagnostic` com header `X-Diagnostic-Token`.

## Deploy rápido (manual)
```bash
sudo mkdir -p /opt/late-diagnostics /var/log/late/diagnostics
sudo cp infra/diagnostics/diagnose.sh /opt/late-diagnostics/
sudo cp infra/diagnostics/diagnostic-api.js /opt/late-diagnostics/
sudo chmod +x /opt/late-diagnostics/diagnose.sh
```

Systemd unit (exemplo):
```ini
[Unit]
Description=Late Diagnostic API
After=network.target

[Service]
Environment=DARKSTAR_DIAGNOSTIC_TOKEN=troque-o-token
Environment=DIAGNOSTIC_ALLOWLIST=192.168.0.251,192.168.0.252,192.168.0.253
Environment=DIAGNOSTIC_SCRIPT=/opt/late-diagnostics/diagnose.sh
WorkingDirectory=/opt/late-diagnostics
ExecStart=/usr/bin/node /opt/late-diagnostics/diagnostic-api.js
Restart=always
User=late
Group=late

[Install]
WantedBy=multi-user.target
```

> ⚠️ Não exponha a porta 8888 na WAN. Libere apenas para mach1/2/3 via nftables.

## Fluxo esperado
1. LATE (mach1/2/3) faz POST para `http://192.168.0.254:8888/trigger-diagnostic` com header `X-Diagnostic-Token`.
2. Darkstar roda `diagnose.sh <incident_id>` em background e grava em `/var/log/late/diagnostics/`.
3. Opcional: usar Codex CLI para gerar leitura do log (já embutido no script).
