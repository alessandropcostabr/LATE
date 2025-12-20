# Comunicado Interno — CRM Import CSV (Fase 1)
**Data:** 19/12/2025

## Resumo
Entrou a base do importador CSV do CRM com upload multipart, preview, dry-run e aplicação inicial para leads/oportunidades (com suporte a mapeamento de colunas). Uma UI simples está disponível em `/crm/importar`; o wizard completo ainda será criado.

## Impacto
- Nova tela básica de importação para testes internos.
- Endpoints já suportam upload multipart e auto‑mapping.
- Mantemos o fluxo antigo compatível com JSON (quando necessário).

## Próximos passos
- Implementar UI em 5 passos (mapeamento, preview, dedup/merge, dry-run, aplicar).
- Limite de upload 100MB e validação de 200k linhas.
- Testes adicionais para dedup/rollback.
