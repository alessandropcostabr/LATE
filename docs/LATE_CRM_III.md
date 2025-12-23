# LATE_CRM_III — Sprint CRM CRUD Completo
_Atualizado em 23 de dezembro de 2025_

> Documento dedicado à sprint de CRUD completo no CRM. Mantém o desenho técnico e critérios de aceite alinhados ao módulo de recados.

**Status:** ✅ Concluída em 23 de dezembro de 2025  
**PRs principais:** #360, #361

## Objetivo
Completar **editar/excluir** no CRM com o mesmo rigor de escopo, CSRF e auditoria do módulo de recados.

## Escopo
- **Entidades:** leads, contacts, opportunities, activities.
- **API:** `PATCH/DELETE` para cada entidade.
- **UI:** botões de editar/excluir nas listagens e telas de detalhe (mínimo funcional, sem reestilizar layout).

## Regras de Acesso (iguais a recados)
- **Permissões com namespace:** `requirePermission('crm:update')` / `requirePermission('crm:delete')`.
- **Admin/Supervisor:** acesso total.
- **Demais usuários:** apenas registros do próprio escopo (`owner_id`) com `view_scope=own` respeitado.
- Fora do escopo → **403** com mensagem pt-BR.

## CSRF + JSON-only
- **Header obrigatório:** `X-CSRF-Token` em `PATCH/DELETE`.
- **Origem do token:** meta tag já existente nas views CRM (`<meta name="csrf-token" ...>`).
- **Fallback opcional:** `GET /api/csrf` retorna `{ success:true, data:{ csrfToken } }`.

## Soft delete (padrão)
- Adicionar `deleted_at TIMESTAMPTZ NULL` nas entidades CRM.
- Listagens sempre com `WHERE deleted_at IS NULL`.
- `GET /:id` retorna **404** se `deleted_at` não for NULL.
- `DELETE` marca `deleted_at` + log em `event_logs`.
- Índices únicos parciais quando aplicável (ex.: e-mail/telefone) → `WHERE deleted_at IS NULL`.

## Contrato da API (JSON only)
- Sucesso: `{ success: true, data: {...} }`
- Erro: `{ success: false, error: 'Mensagem clara' }`
- **400** para payload inválido/campo proibido
- **403** fora do escopo
- **404** não encontrado (ou deletado)

## Endpoints propostos
**CRUD**
- `PATCH /api/crm/leads/:id`
- `DELETE /api/crm/leads/:id`
- `PATCH /api/crm/contacts/:id`
- `DELETE /api/crm/contacts/:id`
- `PATCH /api/crm/opportunities/:id`
- `DELETE /api/crm/opportunities/:id`
- `PATCH /api/crm/activities/:id`
- `DELETE /api/crm/activities/:id`

**Dependências (impacto)**
- `GET /api/crm/leads/:id/dependencies`
- `GET /api/crm/contacts/:id/dependencies`
- `GET /api/crm/opportunities/:id/dependencies`
- `GET /api/crm/activities/:id/dependencies`

**Formato sugerido**
```json
{ "success": true, "data": { "counts": { "opportunities": 3, "activities": 12 } } }
```

## Whitelist de campos (PATCH)
- Cada entidade terá `allowedFields` centralizado.
- Campos sempre proibidos: `id`, `owner_id` (exceto admin), `created_at`, `updated_at`, `deleted_at`.
- Payload vazio → **400**.

## Auditoria (event_logs)
Eventos mínimos:
- `crm.lead.updated`, `crm.lead.deleted`
- `crm.contact.updated`, `crm.contact.deleted`
- `crm.opportunity.updated`, `crm.opportunity.deleted`
- `crm.activity.updated`, `crm.activity.deleted`

**Diff simples (metadata):**
```json
"metadata": { "changed": { "campo": { "from": "x", "to": "y" } } }
```
- Registrar apenas campos alterados e whitelisted.

## Performance (p95 < 500ms em 10k)
Índices sugeridos (por entidade):
- `(owner_id, deleted_at, updated_at DESC)` ou `(owner_id, deleted_at, id DESC)` conforme ORDER BY.
- Índices únicos parciais (e-mail/telefone) → `WHERE deleted_at IS NULL`.

## UI mínima (must-have)
- Botões **Editar/Excluir** + confirmação + feedback (Toast/alerts).
- Excluir deve consultar `/dependencies` antes de confirmar.

## Testes (mínimo)
- **Supertest**: RBAC (permitido/negado), CSRF (falha/sucesso), 400 em campo proibido, 404 inexistente/deletado.
- **Soft delete**: item some das listagens pós-delete.
- **Cypress (1 fluxo)**: abrir modal → carregar dependencies → confirmar → toast → item some.

## Critérios de aceite
- CRUD completo em todas as entidades CRM.
- Escopo aplicado igual recados (403 cross-owner).
- CSRF obrigatório em PATCH/DELETE.
- Soft delete ativo, com `GET /:id` retornando 404 se deletado.
- Dependências exibidas antes de excluir.
- Logs em `event_logs` com diff simples.
- Testes cobrindo casos principais.
