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
│ └── recados.db
├── backup/
│ └── recados_YYYYMMDD.db
└── resultados_testes.md

## 🔐 Segurança

- **CSP ativa** (sem `unsafe-inline`)
- **Helmet.js** configurado
- **Prepared Statements** via better-sqlite3
- **Validações por Schema** (express-validator)
- **Rate Limiting ativo**

## 🚀 Instalação e Execução

### Requisitos
- Node.js ≥ v22.0.0
- NPM ≥ 10.9.0
- Ubuntu Linux ou compatível

### Passo a Passo

git clone <repo>
cd late
npm install
# Defina os domínios permitidos no CORS
export ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
npm start
Acesse: http://localhost:3000 ou http://<SEU-IP>:3000

Produção com PM2

pm2 start server.js --name "late"
pm2 save
pm2 startup
🔧 API REST
Principais endpoints:


GET    /api/recados
GET    /api/recados/:id
POST   /api/recados
PUT    /api/recados/:id
PATCH  /api/recados/:id/situacao
DELETE /api/recados/:id
GET    /api/stats/dashboard
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

criado_em, atualizado_em

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

✅ Checklist
 Views com EJS

 Header unificado

 CSP ativa e segura

 Validações robustas

 Backup automático agendado

 PM2 configurado

 Testes manuais validados

