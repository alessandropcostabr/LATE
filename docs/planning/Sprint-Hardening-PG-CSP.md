## Sprint — Hardening PG + CSP
> Atualizado em 2025/11/12.

**Objetivo:** aplicar as três frentes remanescentes do plano de endurecimento (TLS no PostgreSQL, CSP progressiva e eliminação de SQL nos controllers) garantindo rollout seguro no cluster.

### 1. TLS no PostgreSQL (PG_SSL) — prioridade alta
- [ ] Habilitar `ssl = on` no PostgreSQL do mach1, configurar `hostssl` em `pg_hba.conf` e provisionar certificados.
- [ ] Ajustar `.env` do mach1 com `PG_SSL_MODE=require` (ou `verify-full`) e `PG_SSL_CA` quando aplicável.
- [ ] `pm2 reload late-prod` no canário e validar com `psql ... sslmode=require` + logs do app.
- [ ] Monitorar 24h; em seguida repetir para mach2/mach3.
- [ ] Atualizar DEPLOY/README com a matriz de envs (`PG_SSL`/`PG_SSL_MODE`).

### 2. CSP global em duas fases — prioridade média-alta
- [ ] Criar `middleware/csp.js` com Helmet `contentSecurityPolicy({ reportOnly: true, ... })`.
- [ ] Registrar middleware em `server.js` logo após o Helmet padrão (desabilitando o CSP built-in).
- [ ] Adicionar teste Supertest garantindo presença de `content-security-policy-report-only`.
- [ ] Coletar violações (via logs/report-uri) por pelo menos 3 dias.
- [ ] Após ajustes nas views, mudar para enforce (`reportOnly: false`, remover `'unsafe-inline'`) e atualizar testes.

#### Endpoint de coleta (DEV)
- Endpoint: `POST /api/csp-report`
- Content-Types aceitos: `application/csp-report`, `application/reports+json`, `application/json`
- Rate limit: 60 req/min

Exemplo de teste manual:
```bash
curl -X POST http://127.0.0.1:3001/api/csp-report \
  -H 'Content-Type: application/csp-report' \
  --data '{"csp-report":{"document-uri":"https://dev.miahchat.com/test","violated-directive":"script-src","blocked-uri":"inline","disposition":"report"}}'
```

Exemplo de log:
```
[csp-report] {"document_uri":"https://dev.miahchat.com/test","blocked_uri":"inline","violated_directive":"script-src","disposition":"report","ip":"127.0.0.1","ua":"curl/8.5.0","skipped":0}
```

### 3. SQL fora dos controllers (health/status) — prioridade média
- [ ] Criar `models/diagnostics.js` com helpers (`ping()`, `dbVersion()` etc.).
- [ ] Atualizar `controllers/healthController.js` e `statusController.js` para usar o model.
- [ ] Garantir cobertura em `__tests__/` verificando as respostas de `/health` e `/status`.
- [ ] Rodar `rg "db.query" controllers/` para confirmar que não restou SQL direto.

### Sequência sugerida
1. TLS em mach1 (canário) → monitorar → replicar nos demais.
2. CSP report-only em todos os nós.
3. Refator controllers de health/status.
4. CSP enforce após limpeza das views.

### Checks úteis
```bash
# TLS ativo
PGPASSWORD="$PGPASSWORD" psql "host=$PGHOST user=$PGUSER dbname=$PGDATABASE sslmode=require" -c "SHOW ssl;"

# CSP report-only
curl -Is http://127.0.0.1:3000/ | grep -i 'content-security-policy'

# Controllers limpos
rg "db.query" controllers/
```
