# LATE - Sistema de Registro de Ligações e Recados

Sistema web moderno para automatizar o registro e gerenciamento de recados de ligações, substituindo o modelo impresso por uma solução digital segura, responsiva e acessível de qualquer lugar.

## 📋 Sobre o Projeto

Este sistema foi desenvolvido para digitalizar o processo de anotações de recados de ligações, anteriormente feito manualmente. Utiliza tecnologias modernas de backend e frontend, com foco em usabilidade, segurança e escalabilidade em ambiente Linux (Ubuntu AWS EC2).

## ✨ Funcionalidades

- Formulário completo para registrar ligações
- Campos com validação e preenchimento automático (data, hora, etc.)
- Filtros por status, destinatário, data e remetente
- Edição, visualização e exclusão de recados
- Dashboard com estatísticas em tempo real
- Design responsivo e acessível
- Interface baseada em templates EJS (com header unificado)
- Logs e backups automáticos

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js v22.15.1**
- **Express.js v5.1.0**
- **SQLite** com **better-sqlite3 v11.9.1**
- **Helmet.js**, **express-rate-limit**, **CORS**
- **express-validator v7.0.1** (validação robusta)
- **morgan v1.10.0** (logging de requisições)

### Frontend
- **EJS** (views dinâmicas e reutilizáveis)
- **HTML5 / CSS3 / JS Vanilla**
- **Interface com Design Responsivo**

### Dev / Build
- **PM2 v6.0.5** - Gerenciador de processos
- **TypeScript v5.8.3** (em desenvolvimento)
- **ts-node v10.9.2** (local)
- **Ubuntu 24.04.2 LTS (EC2)**

## 📁 Estrutura do Projeto

late/
├── server.js
├── package.json
├── config/
│ └── database.js
├── routes/
│ ├── api.js
│ └── web.js
├── models/
│ └── recado.js
├── middleware/
│ ├── cors.js
│ └── validation.js
├── public/
│ ├── css/
│ ├── js/
│ └── assets/
├── views/
│ ├── partials/
│ │ └── header.ejs
│ ├── index.ejs
│ ├── recados.ejs
│ ├── novo-recado.ejs
│ ├── editar-recado.ejs
│ └── visualizar-recado.ejs
├── data/
│ ├── recados.db
│ └── migrations/
├── backup/
│ └── recados_YYYYMMDD.db
└── resultados_testes.md

Todas as migrações do banco de dados devem estar em `data/migrations/` e ser aplicadas com `node scripts/migrate.js`.

## 🔐 Segurança

- **CSP ativa** (sem `unsafe-inline`)
- **Helmet.js** configurado
- **Prepared Statements** via better-sqlite3
- **Validações por Schema** (express-validator)
- **Rate Limiting ativo**

## ⏱️ Rate Limiting

Para proteger o serviço contra abuso, duas políticas de limite de requisições estão ativas:

- **Global `/api`**: máximo de **100 requisições** a cada **15 minutos** por IP.
- **`/login`**: máximo de **20 requisições** a cada **15 minutos** por IP.

### Verificando os limites

As respostas dessas rotas retornam cabeçalhos `RateLimit-*` que indicam seu status na janela atual:

- `RateLimit-Limit` – total de requisições permitidas na janela.
- `RateLimit-Remaining` – quantas requisições restam.
- `RateLimit-Reset` – em quantos segundos o limite será reiniciado.
- `Retry-After` – presente ao atingir o limite, indica quando tentar novamente.

Exemplo de inspeção:

```bash
curl -i https://late.miahchat.com/api/ping
```

O parâmetro `-i` exibe os cabeçalhos para que você confira os valores de `RateLimit-*`.

## 🚀 Instalação e Execução

### Requisitos
- Node.js ≥ v22.0.0
- NPM ≥ 10.9.0
- Ubuntu Linux ou compatível

### Passo a Passo

git clone <repo>
cd late
npm install
node scripts/migrate.js # aplica migrations de data/migrations
# (Opcional, mas recomendado) defina variáveis para o usuário administrador inicial
# export ADMIN_NAME="Administrador"
# export ADMIN_EMAIL="admin@example.com"
# export ADMIN_PASSWORD="altere-esta-senha"
node scripts/seed-admin.js # cria o usuário administrador padrão (evita duplicados)
# Defina os domínios permitidos no CORS via CORS_ORIGINS
# (ALLOWED_ORIGINS ainda é suportada, mas será descontinuada futuramente)
# Separe por vírgula **ou** espaço. Quando não definido, utiliza os domínios padrão
# (http://localhost:3000, http://localhost:8080, https://seu-dominio.com, https://late.miahchat.com).
# Ao definir a variável, **apenas** os domínios informados serão permitidos.
export CORS_ORIGINS=http://localhost:3000 http://localhost:8080
# Opcional: quantidade de proxies de confiança (quando atrás de proxy reverso)
export TRUST_PROXY=1
npm start
Acesse: http://localhost:3000 ou http://<SEU-IP>:3000

`TRUST_PROXY` informa ao Express quantos proxies existem à frente da aplicação e só é aplicado quando `NODE_ENV=production`.

Produção com PM2

pm2 start server.js --name "late"
pm2 save
pm2 startup

## 🔐 Auth + CORS

Exemplos de requisições utilizando CORS e autenticação de sessão:

### Preflight

```bash
curl -i -X OPTIONS https://late.miahchat.com/login \
  -H "Origin: https://late.miahchat.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

Headers esperados:

- `Access-Control-Allow-Origin: https://late.miahchat.com`
- `Access-Control-Allow-Credentials: true`
- `Set-Cookie:` *(nenhum)*

### Login

```bash
curl -i -X POST https://late.miahchat.com/login \
  -H "Origin: https://late.miahchat.com" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"usuario@example.com","password":"senha"}'
```

Headers esperados:

- `Access-Control-Allow-Origin: https://late.miahchat.com`
- `Access-Control-Allow-Credentials: true`
- `Set-Cookie: session=<id>; Path=/; HttpOnly; SameSite=None; Secure`

Se o cabeçalho `Accept` incluir `application/json`, respostas de erro do `/login` serão retornadas em JSON no formato:

```json
{ "error": "Usuário não encontrado ou inativo" }
```

ou

```json
{ "error": "Senha incorreta" }
```

### Ping autenticado

```bash
curl -i https://late.miahchat.com/api/ping \
  -H "Origin: https://late.miahchat.com" \
  -b cookies.txt
```

Headers esperados:

- `Access-Control-Allow-Origin: https://late.miahchat.com`
- `Access-Control-Allow-Credentials: true`
- `Set-Cookie:` *(nenhum, a menos que a sessão seja renovada)*

🔧 API REST
Principais endpoints:


GET    /api/recados
GET    /api/recados/:id
POST   /api/recados
PUT    /api/recados/:id
PATCH  /api/recados/:id/situacao
DELETE /api/recados/:id
GET    /api/stats
GET    /api/stats/por-destinatario

📊 Dashboard
Cards de contagem por status

Lista de recados recentes

Filtros rápidos por destinatário e situação

Totalizadores e visão gerencial

📄 Banco de Dados
Tabela: recados

Campos principais:

id, data_ligacao, hora_ligacao

destinatario, remetente_nome

remetente_telefone, remetente_email, horario_retorno

assunto, situacao, observacoes

created_at, updated_at, created_by, updated_by

Índices criados para performance:


CREATE INDEX idx_data_ligacao ON recados(data_ligacao);
CREATE INDEX idx_destinatario ON recados(destinatario);
CREATE INDEX idx_situacao ON recados(situacao);
🗄️ Backup e Logs

# Backup manual
cp data/recados.db backup/recados_$(date +%Y%m%d).db

# Logs PM2
pm2 logs late
📦 Deploy em EC2
Siga as instruções detalhadas no arquivo DEPLOY.md.

🧪 Testes
Testes manuais via navegador e Postman

Logs de validação no console

resultados_testes.md armazena feedback pós-sprint

Relatórios Lighthouse em `lighthouse-reports/`:
  - `index.html` e `index.json`
  - `recados.html` e `recados.json`
  - `novo-recado.html` e `novo-recado.json`
  - `relatorios.html` e `relatorios.json`
  - `editar-recado.html` e `editar-recado.json`
  - `visualizar-recado.html` e `visualizar-recado.json`
Para gerar novos relatórios, execute `npm run lighthouse` com o servidor rodando em `http://localhost:3000`.

✅ Checklist
 Views com EJS

 Header unificado

 CSP ativa e segura

 Validações robustas

 Backup automático agendado

 PM2 configurado

 Testes manuais validados

