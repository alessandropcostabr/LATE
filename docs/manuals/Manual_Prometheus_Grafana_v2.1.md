# Manual Simples — Prometheus & Grafana (Cluster Ubuntu)
> Atualizado em 2025/11/12.

**Data:** 09/11/2025

## 1. Visão Rápida
- **Prometheus** (9090) coleta métricas
- **Grafana** (3000) exibe dashboards
- **Node Exporter** (9100) exporta métricas

## 2. URLs
- Prometheus: `http://192.168.0.251:9090`
- Grafana: `http://192.168.0.251:3000` (admin/admin)

## 3. Serviços
```bash
sudo systemctl status prometheus
sudo systemctl status prometheus-node-exporter
sudo snap services grafana

sudo systemctl restart prometheus
sudo systemctl restart prometheus-node-exporter
sudo snap restart grafana

sudo ufw allow 9090/tcp
sudo ufw allow 9100/tcp
sudo ufw allow 3000/tcp
```
## 4. Troubleshooting
- Dashboards sem dados → Prometheus *Status > Targets*; reiniciar node-exporter; conferir `prometheus.yml`
- Portas: `netstat -tlnp | grep 3000` / `grep 9090`
- Logs: `journalctl -u prometheus -n 50` / `snap logs grafana`

## 5. Operação
- Importar dashboards: IDs **10000**, **8919**
- Consultar `up` em Prometheus
- Targets em *Status > Targets*

## 6. Manutenção
- Disco: `df -h /var/lib/prometheus`
- Reiniciar serviços após editar `prometheus.yml`
- Backup de dashboards via UI do Grafana
