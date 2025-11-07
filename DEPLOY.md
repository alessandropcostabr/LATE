# 🚀 DEPLOY — LATE

Última atualização: 07/11/2025

---

## 🧱 Ambientes

- **Local:** para desenvolvimento (localhost:3000)
- **Staging:** ambiente pré-produção (EC2 via worktree `dev`)
- **Produção:** instância EC2 com domínio e HTTPS

---

## ⛏️ Comandos Úteis (Cheatsheet)

### Worktree Git
```bash
# Cria pastas separadas para dev e main
./_scripts/setup-worktree.sh
```

### Setup Inicial
```bash
npm install
cp .env.example .env
npm run migrate
ADMIN_EMAIL=admin@local.test ADMIN_PASSWORD='SenhaForte!1' node scripts/seed-admin.js
```

### Rodar Local
```bash
npm run dev # inicia com nodemon e recarrega automaticamente
```

### PM2 (Staging/Produção)
```bash
pm2 restart ecosystem.config.js --only late-dev
pm2 restart ecosystem.config.js --only late-dev-email-worker
pm2 restart ecosystem.config.js --only late-dev-export-worker

pm2 restart ecosystem.config.js --only late-prod
pm2 restart ecosystem.config.js --only late-prod-email-worker
pm2 restart ecosystem.config.js --only late-prod-export-worker
```
> Recarregar (`pm2 reload ecosystem.config.js`) também funciona após atualizar o arquivo.

### Atualizar Produção
```bash
cd ~/late-prod
git pull origin main
npm install
npm run migrate
pm2 restart late-prod
```
- Confirmar acesso autenticado a `/relatorios/auditoria` e `/relatorios/exportacoes` (perfil ADMIN ou SUPERVISOR) após o deploy.

### Monitorar
```bash
pm2 logs
```

### Diagnóstico rápido
```bash
# Snapshot imediato (stdout)
node scripts/dev-info.js

# Gerar arquivo para anexar ao relatório
node scripts/dev-info.js --json --output /tmp/diagnostics-$(date +%Y%m%d-%H%M).json
```
- Execute antes e depois do deploy para comparar estado do banco/filas.
- Em incidentes, anexe o JSON gerado no chamado e compartilhe via #late-dev.
- A rota `GET /api/debug/info` responde o mesmo payload quando `NODE_ENV=development` (útil em staging).
- Após atualizar documentação Markdown, rode `npm run docs:sync` para sincronizar os fragmentos exibidos nas rotas públicas.
- Garanta que os workers (`worker:emails` e `worker:exports`) estão online via PM2 antes de liberar o deploy.
- Sempre que ajustar o diagnóstico, valide com `npm test -- dev-info` antes de subir PR/deploy.

---

## 🌐 Acesso

- Backend: `https://late.miahchat.com`
- Admin: `/admin`
- Ajuda: `/ajuda`

---

## 🔐 Segurança

- Sessões com cookie seguro
- Rate-limit ativo
- CSP, Helmet, CORS restrito

---

Para erros e suporte técnico, use `/admin/logs` ou o canal #suporte-dev no Slack.
