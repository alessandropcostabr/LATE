# Integração WhatsApp Sender → LATE (dev)

## Endpoints
- POST /api/message-events
  - Auth: X-API-Key (token em `api_tokens`, hash SHA-256)
  - Idempotência: header `Idempotency-Key = sender-session:<session_id>:phone:<phone_e164>`
  - Resposta: 200 sempre; `idempotent=true` em duplicatas, inclui `event_id`.
- GET /api/message-events (sessão ADMIN/SUPERVISOR)
  - Filtros: source (default sender-whatsapp), status, phone, from, to, limit/offset.

## Tabela
- `message_send_events`: índices único (source, idempotency_key) e (phone_e164, created_at).

## UI
- /relatorios/whatsapp (login ADMIN/SUPERVISOR) — lista eventos com filtros básicos.

## Health
- /api/health → { success: true, data: 'ok' } (compatível com testes)
- /api/health?verbose=1 → inclui meta com latency.

## Chaves em dev
- Base: http://192.168.0.251:3001/api
- X-API-Key: late-sender-dev-20251212

## Status atual
- Migrações aplicadas (20251221_create_api_tokens, 20251221_create_message_send_events).
- Idempotência validada via curl e pelo Sender E2E (2 leads).
- Testes LATE críticos (health/meta) OK; suíte completa passou anteriormente.

## Próximos passos
- (Prod) criar API key própria e aplicar migrations no ambiente alvo.
- (Opcional) rate-limit dedicado para /api/message-events.
- (Opcional) contadores por status na UI /relatorios/whatsapp.
