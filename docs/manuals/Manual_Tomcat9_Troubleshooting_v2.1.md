# Manual de Troubleshooting — Apache Tomcat 9 (9.0.111)

**Data:** 09/11/2025

## Estrutura
```
/opt/tomcat9/ -> /opt/apache-tomcat-9.0.111/
bin/ conf/ webapps/ logs/
```
**Service unit** em `/etc/systemd/system/tomcat9.service` (ExecStart/Stop, User=tomcat, Restart=on-failure).

## Portas
HTTP 8080 • HTTPS 8443 • AJP 8009 • Shutdown 8005

## Gestão
```bash
sudo systemctl start|stop|restart|status tomcat9
sudo systemctl daemon-reload && sudo systemctl restart tomcat9
sudo ss -tlnp | grep 8080
curl -I http://localhost:8080/
```

## Problemas
- Não inicia (Erro 203/EXEC): permissões/binários
- Porta 8080 em uso: matar processo ou alterar `server.xml`
- Permissões: `chown -R tomcat:tomcat /opt/tomcat9`
- OOM: exportar `CATALINA_OPTS` com limites de heap/metaspace
- 404: WAR inválido; verificar `catalina.out`
