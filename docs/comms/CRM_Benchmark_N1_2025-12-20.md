# Comunicado Interno — Benchmark N+1 (CRM + Alertas)
**Data:** 20/12/2025

## Objetivo
Documentar benchmark antes/depois das correções de N+1 para:
- `/api/crm/pipelines` (pipelines + stages)
- Scheduler de alertas (`services/messageAlerts.js`)

## Como medir
1. **CRM pipelines:** medir tempo de resposta em ambiente DEV (sem cache).
2. **Alertas:** medir quantidade de queries por ciclo (log ou pg_stat_statements) + tempo total.

## Resultado (antes)
- CRM pipelines: _pendente_
- Alertas: _pendente_

## Resultado (depois)
- CRM pipelines: _pendente_
- Alertas: _pendente_

## Notas
- Registrar data/hora do teste e volume de dados aproximado.
- Se possível, usar `EXPLAIN ANALYZE` para comprovar redução de queries.
