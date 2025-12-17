# Integração WhatsApp Sender → LATE (dev)
_Atualizado em 16 de dezembro de 2025_

## Endpoints
- **POST /api/message-events**
  - Auth: `X-API-Key` (token em `api_tokens`, hash SHA-256)
  - Idempotência: header `Idempotency-Key = sender-session:<session_id>:phone:<phone_e164>`
  - Resposta: 200 sempre; `idempotent=true` em duplicatas, inclui `event_id`.
- **GET /api/message-events** (ADMIN/SUPERVISOR)
  - Filtros: `source` (default `sender-whatsapp`), `status`, `phone`, `from`, `to`, `limit/offset`.

## Tabela
- `message_send_events`: índices únicos (source, idempotency_key) e (phone_e164, created_at). Inserção idempotente com `ON CONFLICT`.

## UI
- `/relatorios/whatsapp` (login ADMIN/SUPERVISOR) — lista eventos com filtros básicos e indica duplicados.

## Health
- `/api/health` → `{ success: true, data: 'ok' }`
- `/api/health?verbose=1` → inclui meta com latency.

## Chaves em dev
- Base: `http://192.168.0.251:3001/api`
- `X-API-Key`: `late-sender-dev-20251212`

## Status atual
- Migrações aplicadas (`20251221_create_api_tokens`, `20251221_create_message_send_events`).
- Idempotência validada via curl e pelo Sender E2E (2 leads).
- Tests críticos de health/meta OK; demais suites mantêm compatibilidade.

## Próximos passos
- (Prod) Criar API key própria e aplicar migrations no ambiente alvo.
- Rate-limit dedicado para `/api/message-events` (opcional).
- Contadores por status na UI `/relatorios/whatsapp` (opcional).
- Monitorar duplicação por IP/phone para alertas de abuso.
