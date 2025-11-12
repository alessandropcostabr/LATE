# Manual de Cluster HA com Pacemaker/Corosync
## Instalação, Configuração e Troubleshooting

**Versão**: 1.0  
**Data**: Novembro 2025  
**Ambiente**: Ubuntu 24.04 LTS - 3 nós (mach1, mach2, mach3)  
**Foco**: Failover IP com alta disponibilidade

---

## 1. Visão Geral do Cluster

### O que foi instalado?

- **Corosync**: Comunicação e sincronização entre nós
- **Pacemaker**: Gerenciamento de recursos e failover automático
- **IP Virtual (VirtualIP)**: IP flutuante que se move entre nós

### IPs do Ambiente

```
mach1: 192.168.15.201 (interface enp0s25)
mach2: 192.168.15.202 (interface enp0s25)
mach3: 192.168.15.203 (interface enp0s25)
VirtualIP (Failover app): 192.168.15.250
VirtualIP (Banco): 192.168.15.251
```

---

## 2. Instalação Rápida (via tmux)

### Passo 1: Instalar pacotes em todos os nós

Com tmux sincronizado (`Ctrl+b, :setw synchronize-panes on`):

```bash
sudo apt update
sudo apt install -y pacemaker corosync resource-agents-base resource-agents-extra pacemaker-cli-utils crmsh fence-agents
```

### Passo 2: Configurar corosync.conf em mach1

```bash
sudo nano /etc/corosync/corosync.conf
```

Cole o conteúdo:

```ini
system {
        allow_knet_handle_fallback: yes
}

totem {
        version: 2
        cluster_name: meu-cluster
        transport: udpu
        crypto_cipher: none
        crypto_hash: none
}

logging {
        fileline: off
        to_stderr: yes
        to_logfile: yes
        logfile: /var/log/corosync/corosync.log
        to_syslog: yes
        debug: off
        logger_subsys {
                subsys: QUORUM
                debug: off
        }
}

quorum {
        provider: corosync_votequorum
}

nodelist {
        node {
                nodeid: 1
                ring0_addr: 192.168.15.201
        }
        node {
                nodeid: 2
                ring0_addr: 192.168.15.202
        }
        node {
                nodeid: 3
                ring0_addr: 192.168.15.203
        }
}
```

Salve: `Ctrl+X`, `Y`, `Enter`.

### Passo 3: Copiar config para mach2 e mach3

Em mach1:

```bash
sudo scp /etc/corosync/corosync.conf alessandro@192.168.15.202:/tmp/corosync.conf
sudo scp /etc/corosync/corosync.conf alessandro@192.168.15.203:/tmp/corosync.conf
```

Em mach2 e mach3:

```bash
sudo mv /tmp/corosync.conf /etc/corosync/corosync.conf
sudo chown root:root /etc/corosync/corosync.conf
sudo chmod 644 /etc/corosync/corosync.conf
```

### Passo 4: Iniciar serviços em todos os nós

Com tmux sincronizado:

```bash
sudo systemctl stop corosync pacemaker
sudo rm -rf /var/lib/corosync/* /var/lib/pacemaker/*
sudo systemctl start corosync
sleep 3
sudo systemctl start pacemaker
sleep 3
sudo crm status
```

Esperado:

```
Cluster Summary:
  * Stack: corosync (Pacemaker is running)
  * Current DC: mach2 (version 2.1.6) - partition with quorum
  * 3 nodes configured
  * Online: [ mach1 mach2 mach3 ]
```

### Passo 5: Desabilitar STONITH (opcional, recomendado para seu cenário)

Em qualquer nó:

```bash
sudo crm configure property stonith-enabled=false
```

### Passo 6: Criar recurso IP Virtual

Em mach2 (DC atual):

```bash
sudo crm configure primitive VirtualIP ocf:heartbeat:IPaddr2 \
  params ip=192.168.15.250 cidr_netmask=24 nic=enp0s25 \
  op monitor interval=30s
```

Verifique:

```bash
sudo crm status
```

---

## 3. Operação do Cluster (Uso Diário)

### Verificar status do cluster

```bash
sudo crm status
```

Deve mostrar todos os nós **Online**.

### Verificar em qual nó está o IP Virtual

```bash
ip addr show enp0s25 | grep 192.168.15.250
```

O nó que mostra o IP é o ativo.

### Listar recursos do cluster

```bash
sudo crm resource list
```

### Parar um recurso (nó se mantém online)

```bash
sudo crm resource stop VirtualIP
```

### Iniciar um recurso

```bash
sudo crm resource start VirtualIP
```

### Monitorar logs em tempo real

```bash
sudo tail -f /var/log/corosync/corosync.log
sudo tail -f /var/log/pacemaker.log
```

### Isolar nó com falha (ex.: disco corrompido)

```bash
sudo crm node standby <hostname>
sudo crm configure show | grep standby
```

- Atualize o HAProxy para desabilitar o backend (`server <host> ... check disabled`).
- Garanta que os standbys PostgreSQL apontem para o VIP `192.168.15.251` e que apenas nós ativos mantenham slots (`SELECT * FROM pg_replication_slots;`).
- Para reintegrar após o reparo:

```bash
sudo crm node online <hostname>
sudo systemctl start corosync pacemaker
```

### Reintegrar nó após reparo (ex.: mach3)

1. **Sincronize configuração**  
   - Confirme que somente o arquivo `.env` existe e que ele replica o conteúdo comum (`APP_VERSION=2.5.1@mach3`, URLs de health iguais às demais máquinas).  
   - Garanta que `ecosystem.config.js` e scripts de workers sejam idênticos aos dos nós saudáveis (copie via `scp` se necessário).
2. **Preparar PostgreSQL em modo standby limpo**  
   ```bash
   sudo systemctl stop postgresql
   sudo mv /var/lib/postgresql/16/main /var/lib/postgresql/16/main.$(date +%Y%m%d%H%M%S).bak
   sudo -u postgres env PGPASSWORD='LATErepl@2025' /usr/lib/postgresql/16/bin/pg_basebackup \
     -h 192.168.15.251 -U late_repl -D /var/lib/postgresql/16/main \
     -X stream -P -R --slot=mach3_slot
   sudo chmod 700 /var/lib/postgresql/16/main
   sudo systemctl start postgresql
   ```
   - Verifique `sudo -u postgres psql -c "select status from pg_stat_wal_receiver;"` → `streaming`.
3. **Reativar no Pacemaker**  
   ```bash
   sudo crm node online mach3
   sudo crm_resource --cleanup --resource pgsql --node mach3
   ```
   - Aguarde `crm status` mostrar `mach3` como `Unpromoted`.
4. **Reabilitar backend no HAProxy**  
   - Atualize `/etc/haproxy/haproxy.cfg` removendo `check disabled` do servidor mach3 e recarregue o serviço onde o HAProxy estiver ativo (`sudo systemctl reload haproxy` no nó que detém o VIP).  
   - Teste com `curl http://192.168.15.203:3100/health` e `curl http://192.168.15.250/health`.
5. **PM2**  
   ```bash
   cd ~/late-prod
   pm2 start ecosystem.config.js --only late-prod
   pm2 start ecosystem.config.js --only late-prod-email-worker
   pm2 start ecosystem.config.js --only late-prod-export-worker
   pm2 save
   pm2 env <id> | grep HOST  # deve exibir 0.0.0.0
   ```

---

## 4. Teste de Failover

### Cenário: Simular falha de um nó

**Em mach1** (exemplo):

```bash
sudo systemctl stop corosync
```

**Em mach2 ou mach3**, verifique se o IP migrou:

```bash
ip addr show enp0s25 | grep 192.168.15.250
```

O IP deve aparecer em outro nó em até 30 segundos.

**Reiniciar mach1**:

```bash
sudo systemctl start corosync
sleep 3
sudo systemctl start pacemaker
sleep 3
sudo crm status
```

---

## 5. Troubleshooting

### Problema: Nó não conecta no cluster

**Sintomas:**
```
Node List:
  * Node mach1: offline
```

**Verificação:**

1. Checar status do Corosync:
```bash
sudo systemctl status corosync
```

2. Ver logs de erro:
```bash
sudo journalctl -u corosync -n 50
sudo tail -50 /var/log/corosync/corosync.log
```

3. Procurar por erros comuns:
- `failed to bind`: Firewall bloqueando ou IP incorreto
- `address already in use`: Porta 5405 ocupada
- `nodeid mismatch`: corosync.conf inconsistente

**Solução:**

1. Validar IPs no corosync.conf:
```bash
cat /etc/corosync/corosync.conf | grep ring0_addr
```

2. Verificar conectividade:
```bash
ping 192.168.15.202
ping 192.168.15.203
```

3. Permitir firewall:
```bash
sudo ufw allow in 5405/udp
sudo ufw allow in 6809/udp
sudo ufw allow in 21064/tcp
```

4. Reiniciar:
```bash
sudo systemctl stop corosync pacemaker
sudo rm -rf /var/lib/corosync/* /var/lib/pacemaker/*
sudo systemctl start corosync
sleep 3
sudo systemctl start pacemaker
```

---

### Problema: Stack: unknown em `crm status`

**Sintomas:**
```
Cluster Summary:
  * Stack: unknown (Pacemaker is running)
  * Current DC: NONE
```

**Causa:** Pacemaker não conectou ao Corosync.

**Solução:**

```bash
sudo systemctl restart pacemaker
sleep 5
sudo crm status
```

Se persistir:
```bash
sudo journalctl -u pacemaker -n 100
```

---

### Problema: IP Virtual não está em nenhum nó

**Sintomas:**
```
* VirtualIP (ocf:heartbeat:IPaddr2): FAILED
```

**Verificação:**

```bash
sudo crm resource status VirtualIP
```

**Solução:**

1. Parar e iniciar o recurso:
```bash
sudo crm resource stop VirtualIP
sleep 2
sudo crm resource start VirtualIP
```

2. Verificar logs:
```bash
sudo tail -50 /var/log/pacemaker.log | grep VirtualIP
```

3. Validar configuração:
```bash
sudo crm configure show primitive VirtualIP
```

---

### Problema: Dois nós com o mesmo IP Virtual

**Causa:** Split-brain ou quorum perdido.

**Verificação:**

```bash
sudo crm status
```

Procure por `partition WITHOUT quorum`.

**Solução:**

Resetar o cluster:
```bash
sudo systemctl stop corosync pacemaker
sudo rm -rf /var/lib/corosync/* /var/lib/pacemaker/*
sudo systemctl start corosync
sleep 3
sudo systemctl start pacemaker
sleep 3
sudo crm status
```

---

## 6. Administração com tmux

### Iniciar painel tmux do cluster

```bash
./clustertmux.sh
```

Ou manualmente:
```bash
tmux new-session -d -s cluster -x 250 -y 50
tmux new-window -t cluster
tmux send-keys -t cluster "ssh mach1" Enter
tmux send-keys -t cluster "ssh mach2" Enter
tmux send-keys -t cluster "ssh mach3" Enter
```

### Sincronizar comandos em todos os nós

No tmux:
```
Ctrl+b, :setw synchronize-panes on
```

Digite comando (executará em todos os painéis).

### Desincronizar

```
Ctrl+b, :setw synchronize-panes off
```

---

## 7. Comandos Essenciais (Referência Rápida)

| Comando | Descrição |
|---------|-----------|
| `sudo crm status` | Status completo do cluster |
| `sudo crm resource list` | Listar recursos |
| `sudo crm configure show` | Ver configuração |
| `sudo systemctl status corosync` | Status do Corosync |
| `sudo systemctl status pacemaker` | Status do Pacemaker |
| `ip addr show enp0s25` | Verificar IPs da máquina |
| `sudo tail -f /var/log/corosync/corosync.log` | Logs de Corosync |
| `sudo tail -f /var/log/pacemaker.log` | Logs de Pacemaker |
| `sudo journalctl -u corosync -n 50` | Últimas 50 linhas Corosync |
| `sudo journalctl -u pacemaker -n 50` | Últimas 50 linhas Pacemaker |

---

## 8. Segurança e Manutenção

### Firewall - Portas necessárias

```bash
sudo ufw allow in 5405/udp    # Corosync TOTEM
sudo ufw allow in 6809/udp    # Corosync Knet
sudo ufw allow in 21064/tcp   # Pacemaker Remote
```

### Permissões críticas

```bash
# Verificar permissões de config
ls -la /etc/corosync/corosync.conf
# Esperado: -rw-r--r-- 1 root root

# Verificar diretórios do cluster
ls -la /var/lib/corosync/
ls -la /var/lib/pacemaker/
```

### Limpeza de logs antigos

Configure logrotate para arquivos de cluster:

```bash
sudo cat > /etc/logrotate.d/corosync << 'EOF'
/var/log/corosync/corosync.log {
    daily
    rotate 7
    missingok
    notifempty
    compress
    postrotate
        systemctl reload corosync > /dev/null 2>&1 || true
    endscript
}
EOF
```

---

## 9. Próximos Passos Recomendados

- [ ] Configurar PostgreSQL com replicação
- [ ] Integrar Node.js/Express com PM2 e Pacemaker
- [ ] Instalar Ansible para automação
- [ ] Implementar Apache Guacamole para acesso remoto
- [ ] Configurar Prometheus/Grafana para monitoramento
- [ ] Ativar fail2ban para segurança

---

## 10. Contato e Suporte

Para troubleshooting adicional:

1. Verifique logs de Corosync e Pacemaker
2. Execute `sudo crm verify -L` para validar configuração
3. Restart completo se necessário: `sudo systemctl restart corosync pacemaker`
4. Consulte documentação oficial: clusterlabs.org

---

**Documento gerado para cluster HA Ubuntu 24.04 com 3 nós e failover IP automático.**
