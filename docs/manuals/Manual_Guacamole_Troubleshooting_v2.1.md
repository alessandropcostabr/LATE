# Manual de Troubleshooting — Apache Guacamole (1.6.0)

**Data:** 09/11/2025

## Arquitetura
- Tomcat 9 (8080) → guacd (4822) → SSH/RDP/VNC
- JDBC → PostgreSQL 16 (5432, DB `guacamole_db`)

## Serviços
```bash
sudo systemctl status guacd tomcat9 postgresql --no-pager
sudo systemctl is-active guacd tomcat9 postgresql
sudo systemctl is-enabled guacd tomcat9 postgresql
```

## Gestão rápida
```bash
sudo systemctl restart guacd
sudo systemctl restart tomcat9
sudo systemctl restart postgresql
sudo tail -f /opt/tomcat9/logs/catalina.out
```

## Verificações
```bash
sudo ss -tlnp | grep -E '4822|8080|5432'
curl -I http://localhost:8080/guacamole/
PGPASSWORD='***' psql -h localhost -U guacamole_user -d guacamole_db -c "SELECT COUNT(*) FROM guacamole_user;"
```

## Problemas comuns
- Auth falha → conferir permissões e logs; aplicar GRANTs no schema
- `guacamole.properties` ausente → recriar link `/opt/tomcat9/.guacamole -> /etc/guacamole`
- JDBC não carrega → copiar JARs e reiniciar Tomcat
