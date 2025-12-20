# 🤖 CLAUDE.md — LATE Project

Instruções para Claude Code trabalhar com o projeto LATE.

> 📍 Visão consolidada do backlog: `docs/planning/LATE_SPRINTS_FUTURAS.md`  
> 📘 Documentação para usuários: `docs/manuals/manual-operacional.md`

---

## 📊 Contexto do Projeto

**LATE** é um sistema de gerenciamento de mensagens/recados com:
- Backend: Node.js 22 + Express 5 + PostgreSQL
- Frontend: EJS templates + CSS/JS vanilla
- Autenticação: sessões (express-session + connect-pg-simple)
- Deploy: PM2 com worktrees Git separados (dev/prod)

### Informações Importantes
- **Versão atual:** `2.0.0` (ver `package.json`)
- **Worktree DEV:** `~/late-dev` → branch `develop`, porta 3001
- **Worktree PROD:** `~/late-prod` → branch `main`, porta 3100
- **Node.js:** ≥ 22 (CommonJS, não ES modules)
- **Database:** PostgreSQL com migrations SQL incrementais

---

## 🏗️ Estrutura do Repositório

```
LATE/
├── server.js             # Express app principal + sessões PG + EJS
├── config/               # database.js (pg Pool config)
├── controllers/          # auth, mensagens, usuários, setores, stats
├── middleware/           # auth (RBAC), CSRF, CORS, validações
├── models/               # queries PostgreSQL (messages, alerts, users, stats)
├── routes/               # api.js (REST API) + web.js (páginas EJS)
├── services/             # mailer (SMTP/log) + messageAlerts (scheduler)
├── scripts/              # migrate.js, seed-admin, backup, security-check
├── migrations/           # SQL incremental (20250927_*.sql ... 20251211_*.sql)
├── views/                # Templates EJS (login, dashboard, mensagens)
├── public/               # CSS, JS estático, assets
├── __tests__/            # Jest + Supertest + pg-mem
├── utils/                # helpers (ex: password policy)
└── ecosystem.config.js   # PM2 config para `late-dev`
```

**⚠️ IMPORTANTE:**
- NÃO existem diretórios `api/` ou `workers/` neste projeto
- Serviços de fila/alerta estão em `services/`
- Documentação versionada está em `docs/**`
- Artefatos temporários vão em `_reports/` (não versionado)

---

## 🔧 Convenções de Código

### Estilo JavaScript
- **Node.js:** ≥ 22, CommonJS (não usar ES modules/import)
- **Indentação:** 2 espaços (sem tabs)
- **Semicolons:** Manter sempre
- **Strings:** Preferir aspas simples `'texto'` (exceto templates)
- **Async/await:** Preferir sobre callbacks/promises
- **Error handling:** Sempre usar try-catch em async functions

### Nomenclatura
- **Arquivos:** kebab-case (`message-controller.js`, `auth-middleware.js`)
- **Variáveis/funções:** camelCase (`getUserById`, `messageData`)
- **Constantes:** UPPER_SNAKE_CASE (`SESSION_SECRET`, `MAX_RETRY_ATTEMPTS`)
- **Classes:** PascalCase (se houver)
- **Identificadores:** Inglês
- **Mensagens/comentários de negócio:** Português (pt-BR)

### Estrutura de Controllers
```javascript
// controllers/messageController.js
const messageModel = require('../models/messageModel');

async function getMessages(req, res) {
  try {
    const messages = await messageModel.findAll();
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar mensagens' });
  }
}

module.exports = { getMessages };
```

### Queries SQL (Models)
```javascript
// models/messageModel.js
const pool = require('../config/database');

async function findAll() {
  const result = await pool.query(
    'SELECT * FROM messages ORDER BY created_at DESC'
  );
  return result.rows;
}

module.exports = { findAll };
```

---

## 🔐 Segurança

### Práticas Obrigatórias
- ✅ **NUNCA** commitar `.env` ou arquivos em `_reports/`
- ✅ Sempre validar inputs do usuário
- ✅ Usar prepared statements (pool.query com placeholders `$1, $2`)
- ✅ Implementar rate limiting (já configurado em `middleware/`)
- ✅ CSRF tokens obrigatórios (via `middleware/csrf.js`)
- ✅ Sessões com `httpOnly: true` e `secure: true` em produção
- ✅ CORS restrito via `CORS_ORIGINS` no `.env`
- ✅ Logs não devem conter senhas ou tokens

### Rate Limits Atuais
- `/login`: 20 requisições / 15 min
- `/api/*`: 100 requisições / 15 min

### Checklist de Segurança
Antes de PR envolvendo autenticação/autorização/intake:
```bash
scripts/security-check.sh http://localhost:3100
# Anexar relatório gerado ao PR
```

---

## 🗂️ Banco de Dados

### Migrations
- Arquivos SQL numerados por data em `migrations/`
- Formato: `YYYYMMDD_descricao.sql`
- Sempre idempotentes (usar `IF NOT EXISTS`, `DROP IF EXISTS`)
- Aplicar com: `npm run migrate` ou `node scripts/migrate.js`
- Testar antes: `npm run migrate:dry`

### Migrations Recentes Importantes
- `20251006_add_sectors.sql` - Setores e permissões
- `20251107_add_users_view_scope.sql` - Escopos de visualização
- `20251114_create_notification_settings.sql` - Configurações de notificação
- `20251115_create_message_alerts.sql` - Sistema de alertas
- `20251211_add_automation_logs_unique_idx.sql` - Idempotência de automações
- `20251211_drop_callback_time.sql` - Remoção de campo legado

### Exemplo de Migration
```sql
-- migrations/20250101_exemplo.sql
BEGIN;

-- Idempotente
CREATE TABLE IF NOT EXISTS exemplo (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_exemplo_nome ON exemplo(nome);

COMMIT;
```

---

## 🧪 Testes

### Executar Testes
```bash
npm test                                    # Todos os testes
npm test -- controllers/messageController   # Suite específica
```

### Estrutura de Testes
- Framework: **Jest**
- HTTP testing: **Supertest**
- Database mock: **pg-mem**
- Cobertura em: `coverage/`

### Template de Teste
```javascript
// __tests__/controllers/messageController.test.js
const request = require('supertest');
const app = require('../../server');
const pool = require('../../config/database');

describe('Message Controller', () => {
  beforeEach(async () => {
    // Setup fixtures
    await pool.query('TRUNCATE messages CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /api/messages', () => {
    it('should return all messages', async () => {
      const response = await request(app)
        .get('/api/messages')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.messages)).toBe(true);
    });
  });
});
```

### Antes de Abrir PR
1. ✅ `npm run migrate:dry` (se houver migrations novas)
2. ✅ `npm run migrate` (aplicar migrations)
3. ✅ `npm run build:css` (se mexeu em CSS)
4. ✅ `npm test` (todos os testes passando)
5. ✅ Revisar cobertura em `coverage/index.html`
6. ✅ Teste manual: login, CRUD de mensagens, notificações

---

## 🔄 Git & Commits

### Conventional Commits
```bash
feat: adiciona filtro por setor na listagem de mensagens
fix: corrige rate limit no endpoint de login
chore: atualiza dependências de segurança
docs: atualiza CLAUDE.md com novas convenções
test: adiciona testes para messageAlerts service
refactor: extrai lógica de validação para utils/
```

### Branches
- `main` - Produção (protegida, worktree em `~/late-prod`)
- `develop` - Desenvolvimento (worktree em `~/late-dev`)
- `feature/nome-feature` - Novas funcionalidades
- `fix/nome-bug` - Correções
- `hotfix/nome-urgente` - Correções urgentes em produção

### Worktrees
**⚠️ NUNCA desenvolver na raiz `~/LATE/`!**

```bash
# DEV
cd ~/late-dev
git checkout develop
git pull origin develop

# PROD
cd ~/late-prod
git checkout main
git pull origin main
```

---

## ⚙️ Variáveis de Ambiente

Arquivo **único** `.env` na raiz (copiar de `.env.example`):

### Banco de Dados
```bash
PGHOST=localhost
PGPORT=5432
PGUSER=late_user
PGPASSWORD=senha_segura
PGDATABASE=late_db
PG_SSL=false  # true em produção
```

### Sessões
```bash
SESSION_SECRET=chave-super-secreta-de-32-chars
COOKIE_NAME=late_session
SESSION_MAX_AGE=86400000  # 24h em ms
```

### Rede
```bash
PORT=3100
CORS_ORIGINS=http://localhost:3100,https://late.empresa.com
TRUST_PROXY=1  # número de proxies ou 'loopback,linklocal,uniquelocal'
```

### E-mail
```bash
MAIL_DRIVER=smtp           # ou 'log' para desenvolvimento
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false          # true para porta 465
SMTP_USER=noreply@empresa.com
SMTP_PASS=senha_app
SMTP_FROM=LATE System <noreply@empresa.com>
MAIL_DEBUG=0               # 1 para logs sem envio real
```

### Aplicação
```bash
NODE_ENV=development       # production em prod
APP_BASE_URL=http://localhost:3100
APP_VERSION=2.0.0
APP_BUILD=20250101
```

### Intake (API pública)
```bash
INTAKE_TOKEN=token-publico-intake
INTAKE_TOKEN_PEPPER=salt-adicional-para-hash
INTAKE_TOKEN_EXPIRES_AT=2025-12-31
INTAKE_RATE_LIMIT=10
INTAKE_RATE_WINDOW_MS=60000
INTAKE_REQUIRE_CSRF=false
```

### Scripts
```bash
ADMIN_EMAIL=admin@empresa.com
ADMIN_PASSWORD=SenhaForte123!
```

---

## 🚀 Operação

### Desenvolvimento Local
```bash
cp .env.example .env        # Ajustar variáveis
npm install
npm run migrate             # Aplicar migrations
node scripts/seed-admin.js  # Criar admin inicial
npm run dev                 # http://localhost:3100 (nodemon)
```

### Build
```bash
npm run build               # CSS + outras assets
npm run build:css           # Apenas CSS (gera style.min.css)
```

### Produção (PM2)
```bash
pm2 start ecosystem.config.js --only late-dev
pm2 restart late-dev
pm2 logs late-dev
pm2 monit
```

### Scripts Úteis
```bash
# Migrations
npm run migrate                  # Aplicar todas pendentes
npm run migrate:dry              # Ver SQL sem executar
node scripts/migrate.js --dry-run

# Admin
node scripts/seed-admin.js       # Criar/atualizar admin

# Backup
scripts/backup-simple.sh         # pg_dump completo

# Segurança
scripts/security-check.sh http://localhost:3100

# Inventário (não versionado)
scripts/generate-inventory.sh
scripts/generate-artifacts.sh    # Gera tree + dump em _reports/
```

---

## 🔔 Sistema de Alertas

### Como Funciona
- Serviço: `services/messageAlerts.js`
- Scheduler: intervalo padrão 60 minutos
- Consulta mensagens com status `pending` ou `in_progress`
- Dispara e-mails via `services/mailer.js`
- Registra histórico em `message_alerts` e `message_events`
- Respeita configurações em `notification_settings`

### Configuração
```javascript
// services/messageAlerts.js
const ALERT_INTERVAL = 60 * 60 * 1000; // 1 hora
```

### Testar Alertas
```bash
# Modo log (sem enviar e-mails)
MAIL_DRIVER=log MAIL_DEBUG=1 npm run dev

# Ver logs
pm2 logs late-dev | grep alert
```

---

## 📚 Documentação

### Estrutura `docs/`
```
docs/
├── manuals/              # Manuais operacionais
│   └── manual-operacional.md
├── planning/             # Sprints e roadmap
│   ├── LATE_SPRINTS_EXECUTADAS.md
│   └── LATE_SPRINTS_FUTURAS.md
├── status/               # Status atual DEV/PROD
│   └── LATE_Status_Atual.md
└── tecnicos/             # Cheatsheets técnicos
    └── LATE_Cheatsheet_Comandos.md
```

### Atualizações de Documentação
Sempre que fizer mudanças que afetem:
- Operação do sistema → `docs/manuals/`
- Arquitetura/estrutura → Este `CLAUDE.md`
- Sprints/roadmap → `docs/planning/`
- Status de deploy → `docs/status/`

---

## ✅ Checklist Antes de Finalizar Task

```bash
# 1. Migrations (se aplicável)
npm run migrate:dry
npm run migrate

# 2. Build de assets (se mexeu em CSS/JS)
npm run build:css

# 3. Testes
npm test
# Revisar cobertura em coverage/index.html

# 4. Logs (após subir em homolog/prod)
pm2 logs late-dev

# 5. Segurança (se mudou auth/intake)
scripts/security-check.sh http://localhost:3100

# 6. Documentação
# - Atualizar CLAUDE.md se necessário
# - Atualizar docs/** relevantes
# - Verificar que não commitou .env ou _reports/

# 7. Git
git status                    # Nada de .env, node_modules, _reports/
git add .
git commit -m "feat: descrição clara"
git push origin develop       # ou feature branch
```

---

## 🚨 O Que NUNCA Fazer

- ❌ Desenvolver na raiz `~/LATE/` (usar worktrees)
- ❌ Commitar `.env`, `.env.*`, `_reports/`
- ❌ Usar `import/export` (projeto é CommonJS)
- ❌ Aplicar migrations direto em produção sem `--dry-run`
- ❌ Fazer push para `main` sem PR aprovado
- ❌ Subir código sem rodar testes
- ❌ Usar `console.log()` sem remover depois (exceto em desenvolvimento)
- ❌ Expor dados sensíveis em logs ou respostas de API
- ❌ Modificar migrations antigas (criar novas)
- ❌ Instalar dependências sem atualizar `package.json`

---

## 💡 O Que SEMPRE Fazer

- ✅ Trabalhar no worktree correto (`~/late-dev` para develop)
- ✅ Verificar branch antes de editar (`git branch`)
- ✅ Usar prepared statements em queries SQL
- ✅ Validar inputs do usuário (middleware de validação)
- ✅ Try-catch em funções async
- ✅ Comentários em português para lógica de negócio
- ✅ Testar manualmente login/logout após mudanças em auth
- ✅ Revisar logs do PM2 após deploy
- ✅ Atualizar documentação quando estrutura mudar
- ✅ Rate limiting em endpoints públicos
- ✅ CSRF tokens em formulários

---

## 🎯 Quando Revisar Código, Procure Por

### Segurança
- [ ] SQL injection (usar `$1, $2` em pool.query)
- [ ] XSS (sanitizar inputs, escapar outputs no EJS)
- [ ] Secrets expostos (senhas, tokens em código)
- [ ] Rate limiting em novos endpoints
- [ ] CSRF tokens em formulários
- [ ] Validação de inputs (tipos, tamanhos, formatos)
- [ ] Logs com dados sensíveis

### Performance
- [ ] Queries N+1 (usar JOINs apropriados)
- [ ] Índices em colunas filtradas/ordenadas
- [ ] Paginação em listagens grandes
- [ ] Cache de sessões funcionando
- [ ] Conexões de pool sendo liberadas

### Qualidade
- [ ] Testes cobrindo casos de sucesso e erro
- [ ] Error handling com try-catch
- [ ] Logs informativos (não excessivos)
- [ ] Código duplicado (extrair para utils/)
- [ ] Funções > 50 linhas (considerar refatorar)
- [ ] Comentários explicando "por quê", não "o quê"

### Operação
- [ ] Migrations testadas com `--dry-run`
- [ ] Variáveis de ambiente documentadas
- [ ] Scripts têm tratamento de erros
- [ ] PM2 ecosystem atualizado se necessário
- [ ] Documentação atualizada

---

## 📞 Contatos & Links

- **Git:** branches `main` (prod) e `develop` (dev)
- **Worktrees:** `~/late-dev` e `~/late-prod`
- **PM2 process:** `late-dev`
- **Docs:** `docs/**` (versionado)
- **Artefatos:** `_reports/**` (local, não versionado)

---

**Última atualização:** 2025-01-XX  
**Mantenedor:** Time LATE

---

## 🤖 Nota para Claude Code

Ao trabalhar neste projeto:

1. **Sempre verifique** em qual worktree está (`~/late-dev` ou `~/late-prod`)
2. **Confirme a branch** antes de fazer mudanças (`git branch`)
3. **Aplique migrations** com `npm run migrate:dry` primeiro
4. **Execute testes** após cada mudança significativa
5. **Respeite** as convenções de código (CommonJS, 2 espaços, semicolons)
6. **Não commite** arquivos sensíveis (`.env`, `_reports/`)
7. **Atualize documentação** quando estrutura/comportamento mudar
8. **Use português** em mensagens de UI e comentários de negócio
9. **Use inglês** em código (variáveis, funções, commits)
10. **Teste manualmente** funcionalidades críticas (auth, alertas, e-mail)

Em caso de dúvida sobre estrutura ou fluxo, consulte:
- `docs/planning/LATE_SPRINTS_FUTURAS.md` - Roadmap
- `docs/manuals/manual-operacional.md` - Como o sistema funciona
- `docs/tecnicos/LATE_Cheatsheet_Comandos.md` - Comandos úteis
