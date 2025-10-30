# LATE - Sistema de Registro de Ligações e Contatos

Sistema web moderno para automatizar o registro e gerenciamento de recados de ligações, substituindo o modelo impresso por uma solução digital segura, responsiva e acessível de qualquer lugar.

## 📋 Sobre o Projeto

Este sistema foi desenvolvido para digitalizar o processo de anotações de recados de ligações, anteriormente feito manualmente. Utiliza tecnologias modernas de backend e frontend, com foco em usabilidade, segurança e escalabilidade em ambiente Linux Mint 21.3.

## ✨ Funcionalidades

- Formulário completo para registrar ligações
- Campos com validação e preenchimento automático (data, hora, etc.)
- Filtros por status, destinatário, data e remetente
- Edição, visualização e exclusão de recados
- Dashboard com estatísticas em tempo real
- Design responsivo e acessível
- Interface baseada em templates EJS (com header unificado)
- Logs e backups automáticos

## 🛠️ Tecnologias Utilizadas (validadas em 2025-10-06)

### Backend
- **Node.js v22.19.0**
- **Express.js v5.1.0**
- **PostgreSQL 14+** via **pg** (Pool) e **connect-pg-simple** para sessões
- **Helmet.js**, **express-rate-limit**, **CORS**
- **express-validator v7.0.1** (validação robusta)
- **morgan v1.10.0** (logging de requisições)

### Frontend
- **EJS** (views dinâmicas e reutilizáveis)
- **HTML5 / CSS3 / JS Vanilla**
- **Interface com Design Responsivo**

### Dev / Build
- **PM2 v6.0.10** - Gerenciador de processos
- **TypeScript v5.8.3** (em desenvolvimento)
- **ts-node v10.9.2** (local)
- **Linux Mint 21.3**

## 📁 Estrutura do Projeto

- `server.js`: bootstrap do Express com Helmet, sessões em PostgreSQL e rotas web/API.
- `config/`: adapters de banco e helpers de conexão (PostgreSQL-only).
- `controllers/`: regras de negócio (auth, usuários, mensagens, health-check).
- `middleware/`: CORS, validações, autenticação e integrações de segurança.
- `models/`: acesso a dados usando pg.Pool.
- `routes/`: definição das rotas API e web.
- `public/` e `views/`: ativos estáticos e templates EJS.

## 🗣️ Convenções de idioma

- Conteúdos exibidos ao usuário (views, mensagens de erro/sucesso) sempre em português brasileiro.
- Comentários no código e documentação interna também em português para explicar regras de negócio.
- Identificadores técnicos (nomes de arquivos, funções, colunas) permanecem em inglês.
- Contrato JSON das APIs usa chaves em inglês (`success`, `data`, `error`) com mensagens em português.

## 🔐 Segurança

- **CSP ativa** (sem `unsafe-inline`)
- **Helmet.js** configurado
- **Prepared Statements** via pg.Pool (parametrização `$1`, `$2`)
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
# Configurar variáveis de conexão do PostgreSQL (exemplo local)
export PGHOST="127.0.0.1"
export PGPORT="5432"
export PGUSER="late_app"
export PGPASSWORD="senha"
export PGDATABASE="late_dev"
export PG_SSL="0"

export DB_DRIVER="pg" # use "1" ou JSON quando o provedor exigir SSL

node scripts/migrate.js # aplica migrations em migrations/
# Defina as variáveis do usuário administrador inicial **antes** de executar o seed
export ADMIN_NAME="Administrador" # opcional, altera o nome exibido
export ADMIN_EMAIL="admin@example.com" # obrigatório
export ADMIN_PASSWORD="altere-esta-senha" # obrigatório
node scripts/seed-admin.js # cria o usuário administrador padrão (evita duplicados)
# O script exige ADMIN_EMAIL e ADMIN_PASSWORD. Se ADMIN_PASSWORD não estiver definido,
# uma senha forte será gerada automaticamente e exibida uma única vez no terminal;
# armazene-a com segurança e atualize a variável de ambiente para reutilizações futuras.
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

## ✉️ Notificações por e-mail

As notificações são configuradas via variáveis de ambiente:

- `MAIL_DRIVER`: use `smtp` (padrão) para enviar e-mails reais ou `log` para apenas registrar no console.
- `APP_BASE_URL`: URL pública do LATE (ex.: `https://late.miahchat.com` em PROD; em DEV local use `http://127.0.0.1:3001`) usada no link “Abrir recado”.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`: host, porta e modo (465 + `SMTP_SECURE=1` para SSL, 587 + `SMTP_SECURE=0` para STARTTLS).
- `SMTP_USER`, `SMTP_PASS`: credenciais da caixa (ex.: `no-reply@seudominio.com.br`).
- `SMTP_FROM`: remetente exibido (ex.: `LATE <no-reply@seudominio.com.br>`).
- `EMAIL_WORKER_INTERVAL_MS` (opcional): intervalo entre execuções do worker (padrão 15000 ms).
- `EMAIL_WORKER_BATCH` (opcional): quantidade máxima de e-mails processados por ciclo (padrão 10).
- `EMAIL_QUEUE_MAX_ATTEMPTS` (opcional): número máximo de tentativas antes de marcar como `failed` (padrão 5).
- `EMAIL_QUEUE_PROCESSING_TIMEOUT_MINUTES` (opcional): tempo para reencaminhar jobs travados em `processing` de volta para a fila (padrão 10 minutos).

Os envios são inseridos na tabela `email_queue` e processados pelo worker dedicado. Para iniciar o worker localmente:

```bash
npm run worker:emails
```

Em produção utilize o PM2 (`pm2 start scripts/email-worker.js --name late-mails`).

Falhas de envio são registradas em log e não impedem a criação do recado. Para homologação, defina `MAIL_DRIVER=log`.

## 📥 Intake seguro

- `POST /api/intake`
- Protegido por `INTAKE_TOKEN` (enviar em `x-intake-token` ou `Authorization: Bearer`).
- Rate-limit configurável via `INTAKE_RATE_LIMIT` (padrão 20 requisições/minuto) e `INTAKE_RATE_WINDOW_MS`.
- Opcionalmente exija CSRF com `INTAKE_REQUIRE_CSRF=1` quando o intake for um formulário interno.
- Todas as requisições são auditadas na tabela `intake_logs` com IP, user-agent, status e mensagem associada.

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
{ "success": false, "error": "Usuário não encontrado ou inativo" }
```

ou

```json
{ "success": false, "error": "Senha incorreta" }
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
POST   /api/intake
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

# Backup manual (PostgreSQL)
pg_dump \
  --no-owner \
  --format=custom \
  --host="$PGHOST" --port="$PGPORT" \
  --username="$PGUSER" "$PGDATABASE" \
  --file "backup/late_$(date +%Y%m%d).dump"

# Restore (exemplo)
pg_restore --clean --if-exists --no-owner \
  --host="$PGHOST" --port="$PGPORT" \
  --username="$PGUSER" --dbname="$PGDATABASE" \
  "backup/late_YYYYMMDD.dump"

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
