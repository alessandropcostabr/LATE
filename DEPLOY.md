# Instruções de Deploy - Sistema de Recados

## 🎯 Deploy no Seu Ambiente AWS EC2

Estas instruções são específicas para o seu ambiente já configurado:
- **Servidor**: AWS EC2 (Ubuntu 22.04.5 LTS, t2.micro)
- **Node.js**: v22.15.0 já instalado
- **Express.js**: v5.1.0
- **PM2**: v6.0.5 já configurado
- **SQLite**: better-sqlite3 v11.9.1

## 📋 Pré-requisitos Verificados

✅ Node.js v22.15.0 instalado  
✅ PM2 v6.0.5 configurado  
✅ Servidor AWS EC2 ativo  
✅ Acesso SSH ao servidor  

## 🚀 Passos para Deploy

### 1. Transferir Arquivos para o Servidor

```bash
# Opção 1: Via SCP (se você tem acesso SSH)
scp -r late/ usuario@seu-servidor-ec2:/caminho/destino/

# Opção 2: Via Git (recomendado)
# No servidor EC2:
git clone <url-do-repositorio>
cd late

# Opção 3: Upload via painel de controle
# Compacte a pasta late em ZIP
# Faça upload via painel web do seu provedor
# Extraia no servidor
```

### 2. Instalar Dependências

```bash
# No servidor EC2, dentro da pasta do projeto:
cd late
npm install
```

### 3. Executar Migrações

As migrações do banco devem estar em `data/migrations`.

```bash
node scripts/migrate.js
```

### 4. Configurar PM2

```bash
# Parar aplicações existentes (se houver)
pm2 stop all

# Iniciar o sistema de recados
pm2 start server.js --name "late"

# Verificar status
pm2 status

# Salvar configuração para reinicialização automática
pm2 save
```

### 5. Configurar Firewall (se necessário)

```bash
# Permitir acesso à porta 3000
sudo ufw allow 3000

# Verificar regras
sudo ufw status
```

### 6. Testar Funcionamento

```bash
# Verificar se o servidor está rodando
curl http://localhost:3000

# Ou acesse via navegador:
# http://SEU-IP-EC2:3000
```

## 🔧 Configurações Específicas

### Arquivo de Configuração PM2 (Opcional)

Crie um arquivo `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'late',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

Então use:
```bash
pm2 start ecosystem.config.js
```

### Configuração de Proxy Reverso (Nginx - Opcional)

Se você quiser usar uma porta padrão (80/443):

Os cabeçalhos CORS devem ser tratados pela aplicação Node.js. No Nginx, apenas encaminhe o cabeçalho `Origin` original e não adicione `Access-Control-Allow-*`.

```nginx
# /etc/nginx/sites-available/late
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header Origin $http_origin;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 Monitoramento

### Comandos PM2 Úteis

```bash
# Ver logs em tempo real
pm2 logs late

# Ver status detalhado
pm2 show late

# Reiniciar aplicação
pm2 restart late

# Parar aplicação
pm2 stop late

# Remover aplicação
pm2 delete late

# Ver métricas de performance
pm2 monit
```

### Verificar Saúde do Sistema

```bash
# Verificar uso de memória
free -h

# Verificar uso de disco
df -h

# Verificar processos Node.js
ps aux | grep node

# Verificar porta 3000
netstat -tlnp | grep :3000
```

## 🔄 Atualizações Futuras

### Para atualizar o sistema:

```bash
# 1. Fazer backup do banco de dados
cp data/recados.db backup/recados_$(date +%Y%m%d_%H%M%S).db

# 2. Parar aplicação
pm2 stop late

# 3. Atualizar código (via Git)
git pull origin main

# 4. Instalar novas dependências (se houver)
npm install

# 5. Reiniciar aplicação
pm2 start late
```

## 🗄️ Backup Automático

### Configurar Backup Diário

```bash
# Editar crontab
crontab -e

# Adicionar linha para backup diário às 2h da manhã:
0 2 * * * cp /caminho/para/late/data/recados.db /backup/recados_$(date +\%Y\%m\%d).db
```

## 🔒 Segurança

### Configurações Recomendadas

1. **Firewall**:
   ```bash
   # Permitir apenas portas necessárias
   sudo ufw enable
   sudo ufw allow ssh
   sudo ufw allow 3000
   ```

2. **Atualizações do Sistema**:
   ```bash
   # Manter sistema atualizado
   sudo apt update && sudo apt upgrade -y
   ```

3. **Monitoramento de Logs**:
   ```bash
   # Verificar logs do sistema regularmente
   sudo tail -f /var/log/syslog
   ```

## 🆘 Solução de Problemas

### Problemas Comuns no Deploy

1. **Erro "EADDRINUSE" (Porta em uso)**:
   ```bash
   # Verificar processo na porta 3000
   sudo lsof -i :3000
   
   # Matar processo se necessário
   sudo kill -9 PID_DO_PROCESSO
   ```

2. **Erro de Permissões**:
   ```bash
   # Ajustar permissões da pasta
   sudo chown -R $USER:$USER late/
   chmod -R 755 late/
   ```

3. **Banco de Dados não Criado**:
   ```bash
   # Verificar se a pasta data existe
   ls -la late/data/
   
   # Criar manualmente se necessário
   mkdir -p late/data
   ```

4. **Dependências não Instaladas**:
   ```bash
   # Limpar cache e reinstalar
   rm -rf node_modules package-lock.json
   npm cache clean --force
   npm install
   ```

## 📞 Acesso ao Sistema

Após o deploy bem-sucedido:

- **URL Local**: http://localhost:3000
- **URL Externa**: http://SEU-IP-EC2:3000
- **Dashboard**: Página inicial com estatísticas
- **Novo Recado**: /novo-recado
- **Lista Completa**: /recados

## ✅ Checklist de Deploy

- [ ] Arquivos transferidos para o servidor
- [ ] Dependências instaladas (`npm install`)
- [ ] PM2 configurado e aplicação iniciada
- [ ] Firewall configurado (porta 3000)
- [ ] Sistema acessível via navegador
- [ ] Banco de dados criado automaticamente
- [ ] Backup configurado
- [ ] Logs funcionando (`pm2 logs`)

---

**🎉 Parabéns! Seu Sistema de Recados está no ar!**

Para suporte, consulte os logs do PM2 e a documentação principal no README.md.

