# Sprint — Controle de Acesso por IP (Back + Front)
> Atualizado em 2025/11/12.

> **Meta**: Restringir/monitorar acesso ao **LATE** por IP (rede interna vs. acesso externo), com exceção por usuário; exibir IP e escopo de acesso no **/relatorios/status**; permitir **ADMIN** configurar “Acesso externo habilitado” por usuário.  
> **Restrições**: não alterar o layout base (EJS/CSS/JS) — apenas incluir campos/badges discretos.

---

## 1) Objetivos e Resultados Esperados
1. **Política de IP** (allowlist/blocklist + política OFFSITE `deny|allow`).
2. **Exceção por usuário** via flag `allow_offsite_access` (Interno / Externo habilitado).
3. **Captura e exibição do IP** no `/relatorios/status` e `/api/whoami`.
4. **Auditoria leve** para tentativas negadas/alterações de política.
5. **UI Admin** para ajustar a flag dos usuários (sem quebrar layout).

---

## 2) Escopo (Back + Front)

### Back-end
- Middleware `ipAccessGuard` (CIDR, trust proxy, exceção por usuário).
- Expor cliente IP (`req.clientIp`) e whoami (`/api/whoami`).
- Migration PG: `allow_offsite_access boolean default false`.
- Ajuste auth: checar OFFSITE_POLICY no login.
- Logs de auditoria: `user.login_denied_offsite`, `user.access_policy_changed`.

### Front-end (EJS)
- **Form** de edição de usuário: campo **Acesso externo** (select Interno/Externo habilitado).
- **/relatorios/status**: mostrar **Seu IP** + **badge** do escopo (Interno | Externo habilitado).
- Opcional discreto: badge com escopo no dropdown/perfil (sem mexer em layout global).

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
IP_ALLOWLIST=192.168.15.0/24,10.0.0.0/8
IP_BLOCKLIST=
OFFSITE_POLICY=deny
TRUST_PROXY=1
```

**Notas**  
- Em PROD, `app.set('trust proxy', 1)` para `req.ip`/`req.ips` corretos atrás de proxy/VIP.  
- Allowlist aceita IPs/CIDR; se vazia, política OFFSITE ainda se aplica (deny = exige exceção).

---

## 5) Banco de Dados (Migration PG)

**`migrations/20251111_add_allow_offsite_access.sql`**
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS allow_offsite_access boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_allow_offsite_access
  ON users (allow_offsite_access);
```

---

## 6) Backend — Tarefas e Patches

### 6.1 Middleware `middleware/ip-access-guard.js`
Responsável por:
- Resolver IP do cliente (honrando trust proxy).
- Checar `IP_BLOCKLIST` (nega imediato).
- Checar `OFFSITE_POLICY`:
  - `deny`: se IP não é “interno” → **exigir** `user.allow_offsite_access`.
- Anexar `req.clientIp`.

> **Registro**: Aplicar **antes** das rotas autenticadas e após rotas públicas mínimas (assets, `/api/health`).

**Esqueleto sugerido**:
```js
const ipaddr = require('ipaddr.js');

function parseList(csv) {
  if (!csv) return [];
  return csv.split(',').map(s => s.trim()).filter(Boolean);
}

function ipInCidrList(ip, list) {
  try {
    const addr = ipaddr.parse(ip);
    return list.some(cidr => {
      const [range, lenStr] = cidr.includes('/') ? cidr.split('/') : [cidr, addr.kind() === 'ipv6' ? '128' : '32'];
      const parsedRange = ipaddr.parse(range);
      const len = parseInt(lenStr, 10);
      return addr.match(parsedRange, len);
    });
  } catch {
    return false;
  }
}

function getClientIp(req) {
  return req.ip || req.headers['cf-connecting-ip'] || req.connection?.remoteAddress || '0.0.0.0';
}

module.exports = function ipAccessGuard() {
  const allowList = parseList(process.env.IP_ALLOWLIST || '');
  const blockList = parseList(process.env.IP_BLOCKLIST || '');
  const offsitePolicy = (process.env.OFFSITE_POLICY || 'deny').toLowerCase();

  return async function (req, res, next) {
    const clientIp = getClientIp(req);
    req.clientIp = clientIp;

    const isAllowedByAllowlist = allowList.length ? ipInCidrList(clientIp, allowList) : true;
    const isBlockedByBlocklist = blockList.length ? ipInCidrList(clientIp, blockList) : false;
    const isOfficeIp = allowList.length ? ipInCidrList(clientIp, allowList) : false;
    const allowedOffsite = Boolean(req.user?.allow_offsite_access);

    if (isBlockedByBlocklist) {
      return res.status(403).json({ success: false, error: 'Acesso bloqueado pelo IP (política de segurança).' });
    }

    if (offsitePolicy === 'deny' && !isOfficeIp) {
      if (!allowedOffsite) {
        return res.status(403).json({ success: false, error: 'Acesso externo negado. Contate o administrador.' });
      }
    }

    if (!isAllowedByAllowlist && !allowedOffsite) {
      return res.status(403).json({ success: false, error: 'IP não autorizado pela lista de acesso.' });
    }

    return next();
  };
};
```

### 6.2 Auth Controller (`controllers/authController.js`)
Após validar credenciais e **antes** de criar a sessão:
- Calcular `isOfficeIp` (contra allowlist).
- Se `OFFSITE_POLICY=deny` **e** `!isOfficeIp` **e** `!user.allow_offsite_access` → **403** + auditoria `user.login_denied_offsite`.

Ao criar `req.session.user`, incluir:
```js
allow_offsite_access: !!user.allow_offsite_access
```

### 6.3 Users Model/Controller
- **Model**: incluir `allow_offsite_access` em `SELECT`/`UPDATE`.
- **Controller**: aceitar `allow_offsite_access` (`true/false` em string), validar e persistir.
- **Auditoria**: ao alterar flag, registrar `user.access_policy_changed` com `{ target_user_id, allow_offsite_access }`.

### 6.4 WhoAmI API
- `GET /api/whoami` → `{ ip, ips, userAgent, accessScope }`.

### 6.5 Status Controller
- Injetar `clientIp` e `accessScope` no `render('relatorios/status', ...)`.

---

## 7) Front-end — Tarefas

### 7.1 Edição de Usuário (EJS existente)
Adicionar campo:
```ejs
<label for="allow_offsite_access" class="form-label">Acesso externo</label>
<select id="allow_offsite_access" name="allow_offsite_access" class="form-select">
  <option value="false" <%= user && !user.allow_offsite_access ? 'selected' : '' %>>Interno (bloquear fora da empresa)</option>
  <option value="true"  <%= user &&  user.allow_offsite_access ? 'selected' : '' %>>Externo habilitado</option>
</select>
<small class="form-text">Permite acesso fora da rede corporativa para este usuário.</small>
```

### 7.2 `/relatorios/status` (EJS)
Adicionar bloco:
```ejs
<dl class="row">
  <dt class="col-sm-3">Seu IP</dt>
  <dd class="col-sm-9"><%= clientIp %></dd>

  <dt class="col-sm-3">Acesso do usuário</dt>
  <dd class="col-sm-9">
    <span class="badge <%= accessScope === 'external_allowed' ? 'bg-success' : 'bg-secondary' %>">
      <%= accessScope === 'external_allowed' ? 'Externo habilitado' : 'Interno' %>
    </span>
  </dd>
</dl>
```

### 7.3 (Opcional) Badge no perfil/navbar
- Injetar `res.locals.currentUserAccessScope` e exibir badge pequeno (classe `.badge`).

---

## 8) Testes

### 8.1 Unitários (Jest)
- `ip-access-guard`:
  - IP em blocklist → 403.
  - OFFSITE `deny` + IP externo + flag false → 403.
  - OFFSITE `deny` + IP externo + flag true → `next()`.
- Parsers: CSV → arrays; CIDR matching.

### 8.2 Integração (Supertest)
- `PUT /api/users/:id` (ADMIN) altera `allow_offsite_access` → 200 e persiste.
- `GET /api/whoami` retorna `accessScope`.

### 8.3 Fluxo de Login
- Simular IP externo (header `X-Forwarded-For`) com `TRUST_PROXY=1`:
  - OFFSITE=deny + user.flag=false → 403 + auditoria.
  - OFFSITE=deny + user.flag=true → 200 cria sessão.

### 8.4 UI (Smoke Manual)
- Form de usuário salva flag.
- `/relatorios/status` mostra IP e badge correto.

---

## 9) Critérios de Aceite (DoD)

- [ ] Migration aplicada e reversível.  
- [ ] Variáveis `.env` documentadas e lidas.  
- [ ] Middleware ativo em PROD/DEV, sem quebrar rotas públicas.  
- [ ] Login respeita OFFSITE_POLICY e exceção por usuário.  
- [ ] API `/api/whoami` disponível com `success:true`.  
- [ ] **/relatorios/status** exibe IP e badge.  
- [ ] UI Admin permite ajustar flag por usuário (com CSRF).  
- [ ] Auditoria grava mudanças de política e tentativas negadas.  
- [ ] Testes unit/integration passando (CI verde).

---

## 10) Plano de Deploy & Rollback

**Deploy**
1. Aplicar migration no **PG**.
2. Definir `.env` em DEV/PROD (`TRUST_PROXY=1`, `OFFSITE_POLICY`, `IP_ALLOWLIST`).  
3. `pm2 reload` do app; validar `/api/health`.
4. Smoke:
   ```bash
   curl -s http://localhost:3000/api/whoami
   curl -s http://localhost:3000/relatorios/status
   ```
   - Acesso interno (rede) → login OK.
   - Acesso externo sem exceção (simulado) → 403.
   - Dar exceção ao usuário → login OK.

**Rollback**
- Reverter commit; reload PM2.  
- (Se necessário) manter coluna no PG (é backward-compatible).  
- Desligar política via `.env` (`OFFSITE_POLICY=allow`) enquanto reverte o código.

---

## 11) Riscos & Mitigações
- **Proxy/headers incorretos** → `req.ip` errado.  
  **Mitigação**: `TRUST_PROXY=1` e validação de cabeçalhos (`X-Forwarded-For`).
- **Allowlist mal configurada** → bloqueio indevido.  
  **Mitigação**: iniciar com `OFFSITE_POLICY=allow`, popular allowlist, depois trocar para `deny`.
- **Falsa sensação de segurança** se túnel/proxy expõe IP do balanceador.  
  **Mitigação**: fixar cadeia de proxies confiáveis; validar IP real (Cloudflare `CF-Connecting-IP` quando aplicável).

---

## 12) Comandos Úteis (DEV/PROD)

```bash
# Ver IP e escopo
curl -s http://localhost:3001/api/whoami | jq

# Testar login negado (simulando IP externo via X-Forwarded-For)
curl -i -H "X-Forwarded-For: 203.0.113.10" -X POST \
  -d "email=user@late&password=***" http://localhost:3001/login

# Alterar flag do usuário (ex.: id=42) – requer cookie/admin
curl -X PUT -H "Content-Type: application/json" \
  -d '{"allow_offsite_access":"true"}' \
  http://localhost:3001/api/users/42
```

---

## 13) Entregáveis (arquivos/touch points)

- `middleware/ip-access-guard.js`  
- `controllers/authController.js` (checagem OFFSITE + sessão com flag)  
- `models/usersModel.js` (coluna `allow_offsite_access`)  
- `controllers/usersController.js` (update + auditoria)  
- `routes/api/whoami.js`  
- `controllers/statusController.js` (injeta `clientIp`, `accessScope`)  
- **EJS** (form de usuário e bloco em `/relatorios/status`)  
- `migrations/20251111_add_allow_offsite_access.sql`  
- `__tests__/middleware/ip-access-guard.test.js`  
- `__tests__/routes/users.update-allow-offsite.test.js`  
- `__tests__/auth/offsite-policy-login-flow.test.js`
