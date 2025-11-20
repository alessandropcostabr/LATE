# Sprint — Controle de Acesso por IP (Back + Front)
> Atualizado em 2025/11/14.

> **Meta**: Individualizar as políticas de acesso usando o campo `access_restrictions` (IPs liberados + faixas de horário) e um bloco global mínimo (`IP_BLOCKLIST`). O sistema precisa mostrar o diagnóstico em `/relatorios/status` e `/api/whoami`, registrar auditoria de bloqueios e permitir que ADMIN configure tudo direto no formulário do usuário (sem alterar o layout base).

---

## 1) Objetivos e Resultados Esperados
1. `access_restrictions` JSONB normalizado: IPs permitidos e agenda (dias/horários).
2. Motor único (`utils/ipAccess.js`) para ler IP real, aplicar blocklist global e avaliar restrições por usuário (sem flag legado de acesso externo).
3. `/relatorios/status` e `/api/whoami` exibem IP atual, escopo aplicado e detalhes das restrições.
4. Auditoria para bloqueios e quando ADMIN altera regras.
5. Formulário de usuário com toggles “Acesso restrito por IP” e “Acesso restrito por horário”, permitindo listar IPs/intervalos.

---

## 2) Escopo (Back + Front)

### Back-end
- Helper único `utils/ipAccess.js`:
  - normaliza IP, horários e listas CIDR;
  - expõe `evaluateAccess`, `normalizeAccessRestrictions`, `getClientIp(s)`.
- Migration: `20251219_add_access_restrictions_to_users.sql` adiciona `access_restrictions JSONB` (default `{}`) e desativa o fluxo legado por flag externa.
- `authController` (login) e `middleware/auth` (sessão) chamam `evaluateAccess` antes de abrir/manter a sessão; bloqueios geram auditoria.
- `/api/whoami` e `/relatorios/status` leem `req.accessEvaluation` para mostrar escopo, IP e restrições.
- `IP_BLOCKLIST` e `TRUST_PROXY` continuam via `.env`; `OFFSITE_POLICY` pode ser ignorado (nenhuma UI/flag depende dela).

### Front-end (EJS/JS)
- Formulário Admin → Usuários recebe seção **Restrições de acesso** com toggles para IP/horário e editor dinâmico (JS).
- `/relatorios/status` exibe “Sessão & Rede” com IP atual, escopo, tags de restrição e lista de IPs permitidos/horários.
- `/news`, `/manual-operacional` e `/roadmap` referenciam o novo fluxo para orientar usuários/admins.

---

## 3) Itens de Backlog (User Stories)

1. **Como ADMIN**, quero **definir** se um usuário pode acessar de fora da empresa para permitir exceções controladas.  
   **Critério**: atualizar `allow_offsite_access` por API/UI; auditoria registrada.

2. **Como sistema**, quero **negar login** de IPs externos quando `OFFSITE_POLICY=deny`, salvo se o usuário tiver **exceção**.  
   **Critério**: retorno 403 JSON com mensagem pt-BR; log em `event_logs`.

3. **Como usuário autenticado**, quero **ver meu IP e o meu escopo** no painel de status para ter clareza de política ativa.  
   **Critério**: `/relatorios/status` exibe IP + badge.

4. **Como operador de suporte**, quero **verificar IP via API** para diagnosticar acessos.  
   **Critério**: `GET /api/whoami` retorna `{ ip, ips, userAgent, accessScope }`.

---

## 4) Arquitetura & Variáveis de Ambiente

**.env**
```dotenv
TRUST_PROXY=1
IP_BLOCKLIST=177.170.0.0/16,191.9.115.0/24
```

**Notas**
- `TRUST_PROXY` garante que `req.ips` reflitam a cadeia real quando estamos atrás do VIP/Cloudflare.
- `IP_BLOCKLIST` aceita IPs/CIDR (CSV) e bloqueia imediatamente qualquer usuário, antes de olhar as restrições individuais.

---

## 5) Banco de Dados (Migration PG)

**`migrations/20251219_add_access_restrictions_to_users.sql`**
```sql
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS access_restrictions JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE users
   SET access_restrictions = '{}'::jsonb
 WHERE access_restrictions IS NULL;

COMMIT;
```

> ⚠️ Pós-migrate: manter todos os usuários liberados (`access_restrictions = '{}'`) e permitir que a equipe ADMIN ajuste manualmente quem terá restrição por IP/horário. O fluxo legado de “Interno/Externo” foi removido da UI/API.
## 6) Backend — Tarefas

### 6.1 `utils/ipAccess.js`
- `normalizeIp` remove `::ffff:` e garante valores legíveis.
- `normalizeAccessRestrictions` aceita string/objeto e devolve `{ ip: { enabled, allowed[] }, schedule: { enabled, ranges[] } }`.
- `evaluateAccess` aplica `IP_BLOCKLIST`, checa lista de IPs por usuário e agenda por dia/horário, retornando `{ allowed, scope, reason, message, restrictions }`.
- `getClientIp(s)` usa apenas `req.ips` / `req.ip` (com `trust proxy`); headers arbitrários não são considerados.

### 6.2 Login / Sessão
- `controllers/authController.login` roda `evaluateAccess` logo após validar senha; bloqueios retornam 403 e registram `user.login_denied_offsite`.
- `middleware/auth.requireAuth` repete a checagem em cada request autenticado; se negar, destrói a sessão, grava `user.session_denied_offsite` e informa o motivo.
- `req.session.user` passa a carregar `access_restrictions` para views/scripts.

### 6.3 Models & Controllers
- `models/user` inclui `access_restrictions` nos `SELECT`/`INSERT`/`UPDATE` e normaliza antes de persistir.
- `controllers/userController` aceita `accessRestrictions` (camelCase) ou `access_restrictions`, valida JSON e registra auditoria quando `allow_offsite_access` muda.
- `controllers/whoamiController` expõe `{ ip, ips, accessScope, restrictions }`.

### 6.4 Views / Rotas
- `routes/web` injeta `clientIp`, `accessScope` e `accessRestrictions` na renderização de `/relatorios/status`.

---

## 7) Front-end — Tarefas

- Form Admin mantém o select “Tipo de acesso” (Interno/Externo) para o flag legado e adiciona a seção “Restrições de acesso” com toggles para IP/horário e listas dinâmicas (JS em `public/js/admin-user-form.js`).
- `/relatorios/status` mostra IP atual, badge de escopo (liberado, restrito por IP, restrito por horário, bloqueado) e lista os IPs/horários configurados.

---

## 8) Testes

1. **Unitários**: `__tests__/ip-access.test.js` cobre normalização e `evaluateAccess`.  
2. **Integração**: `POST/PUT /api/users` com `accessRestrictions`, `/api/whoami` refletindo escopo/IP.  
3. **Login**: simular IP bloqueado/liberado; garantir auditoria e mensagens corretas.  
4. **UI**: smoke no formulário (criar/editar) e painel `/relatorios/status`.

---

## 9) Critérios de Aceite

- Migration aplicada (DEV) e fixtures de teste atualizados.  
- `.env` com `TRUST_PROXY` + `IP_BLOCKLIST` configurados/documentados.  
- Login/sessão derrubam acessos fora das regras.  
- `/api/whoami` + `/relatorios/status` exibem IP/escopo/restrições.  
- Form Admin salva/edita restrições e mantém compatibilidade com o flag legado.  
- Auditoria grava bloqueios e mudanças de política.  
- Testes unitários/integrados passando.

---

## 10) Plano de Deploy & Rollback

**Deploy**
1. Aplicar `20251219_add_access_restrictions_to_users.sql`.
2. Garantir `.env` com `TRUST_PROXY=1`, `IP_BLOCKLIST` revisado e `OFFSITE_POLICY=allow` (fallback liberado).
3. `npm run migrate && pm2 reload ecosystem.config.js`.
4. Smoke:
   ```bash
   curl -s http://localhost:3000/api/whoami
   curl -s http://localhost:3000/relatorios/status
   npm test -- ip-access
   ```
5. Popular restrições por usuário somente após validação (todos começam liberados).

**Rollback**
- Reverter o deploy; manter a coluna (compatível).  
- Definir `OFFSITE_POLICY=allow` até reativar a política nova.

---

## 11) Riscos & Mitigações
- **Proxy mal configurado** → IP incorreto. Mitigar com `TRUST_PROXY=1` e cadeias conhecidas.  
- **Blocklist agressiva** → bloqueio geral. Testar entradas em DEV antes de mover para PROD.  
- **Admins esquecem de preencher IPs** → usuários trancados. Começar com todos liberados e documentar checklist no deploy.

---

## 12) Comandos Úteis

```bash
# Diagnóstico
curl -s http://localhost:3001/api/whoami | jq

# Simular IP bloqueado (com trust proxy ativo)
curl -i -H "X-Forwarded-For: 203.0.113.10" \
  -d "email=admin@late&password=***" http://localhost:3001/login

# Atualizar restrições via API
curl -X PUT -H "Content-Type: application/json" \
  -d '{"accessRestrictions":{"ip":{"enabled":true,"allowed":["191.9.115.129"]}}}' \
  http://localhost:3001/api/users/6
```

---

## 13) Entregáveis
- `utils/ipAccess.js`
- `controllers/authController.js`, `middleware/auth.js`
- `controllers/userController.js`, `models/user.js`
- `controllers/whoamiController.js`, `routes/web.js`
- `views/admin-user-form.ejs`, `public/js/admin-user-form.js`, `views/relatorios-status.ejs`
- `migrations/20251219_add_access_restrictions_to_users.sql`
- `__tests__/ip-access.test.js` + fixtures que criam `users` com `access_restrictions`
