# Resumo — Configuração do Cluster Ubuntu com Ansible e Apache Guacamole

**Data:** 11/11/2025

## Infraestrutura
- `mach1` (192.168.15.201): Controle (Ansible + Guacamole)
- `mach2` (192.168.15.202): Gerenciado
- `mach3` (192.168.15.203): Gerenciado (**11/11/2025:** reinstalado como standby; monitorar disco até troca preventiva)

> **Importante:** apenas `.env` deve ser utilizado nas worktrees (`mach1`/`mach2`/`mach3`). Não deixe `.env.prod` ou variantes; mantenha o conteúdo idêntico entre nós, alterando apenas `APP_VERSION=2.5.1@machX` para identificar o host.

### Inventário Ansible
```ini
[cluster_ubuntu]
192.168.15.201 ansible_connection=local
192.168.15.202 ansible_user=alessandro
192.168.15.203 ansible_user=alessandro
```

## Tomcat 9 + Guacamole
- Tomcat 9.0.111 em `/opt/tomcat9` (8080)
- `guacd` 1.6.0 (4822)
- Guacamole 1.6.0 (JDBC PostgreSQL; link `/opt/tomcat9/.guacamole -> /etc/guacamole`)
- URL: `http://192.168.15.201:8080/guacamole/`

## PostgreSQL 16 (Guacamole)
- DB `guacamole_db`; user `guacamole_user` (permissões aplicadas); porta 5432

## tmux
- `~/cluster_tmux.sh` (sessão com 3 painéis e sincronização)

## Comandos
```bash
ansible -m ping cluster_ubuntu
ansible cluster_ubuntu -a "uptime"
sudo systemctl restart guacd tomcat9 postgresql
sudo tail -f /opt/tomcat9/logs/catalina.out
```
