# Setup Prompt — Implementar `/relatorios/auditoria` (Sprint 02 — Auditoria Leve)
> Atualizado em 2025/11/12.

## Objetivo
Criar a **API de auditoria** e a **rota web** para a nova área **/relatorios/auditoria**, consumindo eventos de `event_logs` com filtros, paginação e sumários. UX: cards de resumo + tabela com drill-down (sem alterar layout visual). Baseie-se no esboço e requisitos funcionais já definidos.

---

## Regras do Projeto (obrigatórias)
- **Stack**: Node 22, Express 5, EJS, PostgreSQL via `pg`. **Sem SQLite.** SQL fica **apenas** nos *models*; controllers não contêm SQL. APIs sempre retornam **JSON**. Mensagens visíveis ao usuário em **pt-BR**; **chaves JSON** em **inglês** (`success`, `data`, `error`). Segurança: Helmet, CSRF, sessão httpOnly, CORS, rate-limit.
- **Não modificar** layout/arquivos em `views/` ou `public/` sem autorização. Entregue API + rota backend (server-render) reaproveitando a view de relatórios já existente.  
- **RBAC**: acesso restrito a `ADMIN` e `SUPERVISOR` (middleware existente `requireRole`).

---

## Escopo desta entrega
1. **API REST `event-logs`**  
   - `GET /api/event-logs` — lista paginada com filtros.  
   - `GET /api/event-logs/summary` — agregados por tipo/período.  
   - **Opcional**: `GET /api/event-logs/:id` — detalhe completo (metadados).  
   Filtros: `from`, `to` (ISO), `event_type` (multi, ex. `message.*`, `user.*`, `automation.*`), `entity_type`, `entity_id`, `actor_user_id`, `search` (match em `metadata`), `limit`, `cursor`/`page`.
2. **Rota Web `/relatorios/auditoria`**  
   - Renderizar a página de relatórios existente (sem mexer em layout) e injetar dados iniciais mínimos (ex.: período padrão últimos 7 dias).  
   - O carregamento dinâmico da tabela/cards deve consumir **somente** as novas APIs.  
3. **Model/DAL**  
   - Implementar `models/eventLog.js` com funções puras usando `db().query()`:  
     - `listFiltered(filters)`  
     - `getById(id)`  
     - `summary(params)`  
     - **Índices**: considere `(created_at DESC)`, `(event_type)`, `(entity_type, entity_id)`, `(actor_user_id)` e GIN em `metadata` para busca textual (quando habilitada).  
4. **Segurança & Performance**  
   - Sanitizar entradas; validar datas ISO; limitar `limit` padrão (50, máx. 500).  
   - Ordenação padrão: `created_at DESC`. Cursor/offset estável.  
   - **RBAC** nas rotas da API e da rota web.  
5. **Mensagens e Idiomas**  
   - **Valores** de mensagens em pt-BR; **chaves** em inglês. Ex.:  
     ```json
     { "success": false, "error": "Parâmetros inválidos." }
     ```  
6. **Testes**  
   - Unitários (model): filtros, paginação, ordenação, resumo.  
   - Integração (controller): `GET /api/event-logs`, `GET /api/event-logs/summary` (Supertest).  
   - Cobrir pelo menos casos: sem filtro (padrão 7 dias), `event_type` múltiplo, busca em `metadata`, limites, RBAC.  
   - Reaproveitar padrões de testes existentes (PG only, sem SQLite).

---

## Contratos de API (DTO esperado)

### `GET /api/event-logs` — lista
Parâmetros aceitos (query):  
`from`, `to`, `event_type[]` (ou `event_type=message.*`), `entity_type`, `entity_id`, `actor_user_id`, `search`, `limit`, `cursor`

Resposta (exemplo):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-or-bigint",
        "event_type": "message.status_changed",
        "entity_type": "message",
        "entity_id": "123",
        "actor_user": { "id": 10, "name": "João Silva" },
        "metadata": { "from": "pending", "to": "resolved" },
        "created_at": "2025-11-05T14:32:00Z"
      }
    ],
    "nextCursor": "opaque"
  }
}
```
> **Notas**: `actor_user` deve vir joinado/derivado (id+name). `metadata` é JSON. Datas em ISO.

### `GET /api/event-logs/summary` — agregados
Parâmetros aceitos: `from`, `to`, `event_type` (opcional).  
Retornar contagens por `event_type` e série diária (últimos 7/30).  
Este endpoint alimenta os **cards** e gráficos da UI (linha/barras).

### `GET /api/event-logs/:id` — detalhe (opcional)
Retornar evento + `metadata` completa para o drill-down.

---

## Especificação de Filtros e Paginação
- **Período padrão**: últimos **7 dias** se `from`/`to` ausentes.  
- **`event_type`** aceita coringas (ex.: `message.*`).  
- **`search`** faz `ILIKE` no JSON `metadata::text` (ou GIN se disponível).  
- **`limit`**: default **50**, máximo **500**.  
- **Cursor**: usar `created_at,id` descendente para estabilidade (ou `OFFSET` com proteção).  
- **Ordenação**: **`ORDER BY created_at DESC, id DESC`**.

---

## Arquivos a criar/alterar (mínimo)
- `models/eventLog.js` — **novo** (DAL PG only).  
- `controllers/eventLogsController.js` — **novo** (sem SQL).  
- `routes/api.js` — adicionar rotas:  
  - `GET /api/event-logs`  
  - `GET /api/event-logs/summary`  
  - `GET /api/event-logs/:id` (se implementado)  
  com `requireRole('ADMIN','SUPERVISOR')`.
- `routes/web.js` — adicionar `GET /relatorios/auditoria` com RBAC, renderizando a view já existente (sem alterar layout).  
- `__tests__/event-logs.model.test.js` — unitário (filtros/ordenação).  
- `__tests__/event-logs.controller.test.js` — integração (Supertest).

> **Não** alterar `views/` nem `public/` (layout, CSS, JS) sem autorização.

---

## Esqueleto esperado (Model)
// Comentários em **pt-BR**; identificadores em **inglês**.  
// Usar `db().query()`; placeholders `$1..$n`; datas com `NOW()`.

```js
// models/eventLog.js
const db = require('./_db');

// Lista com filtros e paginação
exports.listFiltered = async (filters = {}) => {
  // TODO: montar WHERE incremental (from/to/event_type/entity/actor/search)
  // TODO: paginação (cursor ou offset), ORDER BY created_at DESC, id DESC
  // TODO: join leve para actor_user (id,name) se aplicável
  // Retornar { items, nextCursor }
};

// Sumário por tipo/período
exports.summary = async (params = {}) => {
  // TODO: contagens por event_type no período
  // TODO: série por dia (últimos 7/30)
};

// Detalhe por id
exports.getById = async (id) => {
  // TODO
};
```

---

## Regras de UX/UI a observar na API
- **Estados**: a UI terá skeletons para cards/tabela; responda rápido e de forma consistente.  
- **Drill-down**: `metadata` deve ser JSON legível (não oculte campos úteis).  
- **Mensagens**: erros claros em pt-BR:  
  - 400: `"Parâmetros inválidos."`  
  - 403: `"Você não tem permissão para acessar este recurso."`  
  - 500: `"Erro interno ao consultar os registros de auditoria."`  

---

## Casos de Teste (mínimos)

**Model**
- Devolve últimos 7 dias por padrão.  
- `event_type=message.*` retorna somente eventos com prefixo `message.`.  
- `search` encontra substring em `metadata`.  
- `limit` respeitado (<=500), `nextCursor` quando houver mais.  
- Ordenação **DESC** por `created_at,id`.

**Controller**
- `GET /api/event-logs` sem filtros → 200 + até 50 itens + `nextCursor` (ou vazio).  
- `GET /api/event-logs?event_type=automation.fired` → somente automations.  
- `GET /api/event-logs/summary?from=...&to=...` → 200 + agregados.  
- RBAC: usuário sem `ADMIN/SUPERVISOR` → 403.  

**Erros**
- `from > to` → 400 com mensagem pt-BR.  
- `limit > 500` → 400.  
- Falha de DB → 500 com mensagem pt-BR (sem vazar SQL).

---

## Dicas técnicas (PostgreSQL)
- Índices úteis: `(created_at DESC)`, `(event_type)`, `(entity_type, entity_id)`, `(actor_user_id)`; avaliar `GIN` em `metadata` (jsonb_path_ops) se o volume crescer.  
- Campos padrão de `event_logs`: `created_at`, `event_type`, `user_id` (actor), `entity_type`, `entity_id`, `metadata` (jsonb).

---

## Aceite (Definition of Done)
- Rotas novas registradas, com RBAC e **sem alterar** `views/` ou `public/`.  
- Model `eventLog.js` sem SQL em controllers.  
- API responde exatamente ao contrato (DTO e mensagens pt-BR).  
- Testes (model + controller) passando.  
- Logs sem dados sensíveis.  
- Documentar no PR o **uso** e **exemplos de curl**:

```bash
# Lista (últimos 7 dias)
curl -s "http://localhost:3000/api/event-logs?limit=50"

# Filtro por tipo
curl -s "http://localhost:3000/api/event-logs?event_type=message.*&limit=100"

# Sumário 30 dias
curl -s "http://localhost:3000/api/event-logs/summary?from=2025-10-06&to=2025-11-04"
```
