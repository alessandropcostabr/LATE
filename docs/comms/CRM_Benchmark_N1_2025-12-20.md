# Comunicado Interno — Benchmark N+1 (CRM + Alertas)
**Data:** 20/12/2025

## Objetivo
Documentar benchmark antes/depois das correções de N+1 para:
- `/api/crm/pipelines` (pipelines + stages)
- Scheduler de alertas (`services/messageAlerts.js`)

## Como medir
1. **CRM pipelines:** medir tempo de resposta em ambiente DEV (sem cache).
2. **Alertas:** medir quantidade de queries por ciclo (log ou pg_stat_statements) + tempo total.

## Metodologia (padronizada)
- **CRM pipelines (HTTP):** tempo de resposta do endpoint, 10 amostras via `curl` em DEV, sem cache. Reportar média e data.
- **Alertas (scheduler):** tempo do ciclo interno (`runAlertCycle`) e tempos por query via `pg_stat_statements`. Reportar volume (pending/in_progress) e flags usadas.
- **Comparação:** métricas de CRM (HTTP) e alertas (scheduler/DB) não são diretamente equivalentes; comparar antes/depois dentro do mesmo tipo de medição.

## Resultado (antes)
- CRM pipelines (legado N+1, pg_stat_statements em 21/12/2025)
  - Script: `bench-crm-pipelines-baseline.js` (0,12s; pipelines=3, stages=14)
  - `pipelines`: 1 call, mean 0,151s, total 0,151s
  - `pipeline_stages` + `pipeline_rules`: 3 calls, mean 0,114s, total 0,343s
- Alertas (legado N+1, pg_stat_statements em 21/12/2025)
  - Script: `bench-alerts-baseline.js` (0,13s; pending=2, in_progress=0)
  - `messages` (status IN): 2 calls, mean 0,063s, total 0,127s
  - `message_alerts` (MAX por mensagem): 2 calls, mean 0,021s, total 0,042s
  - `user_sectors`/`users` (setores): 2 calls, mean 0,039s, total 0,078s

## Resultado (depois)
- CRM pipelines: média **0.115s** (avg=0.115263s, 10 amostras via `curl` em 20/12/2025)
- CRM pipelines (query única, pg_stat_statements em 21/12/2025)
  - `pipelines` + `stages` + `rules`: 1 call, mean 0,384s, total 0,384s
- Alertas (pg_stat_statements): ciclo **0,13s** (21/12/2025)
  - Contexto: `runAlertCycle` com defaults (99999h), `skipLock=1`, `skip_schema=1`
  - Volume: pending=2, in_progress=0
  - Consultas relevantes (pg_stat_statements):
    - `messages` (status IN): 2 calls, mean 0,058s, total 0,116s
    - `message_alerts` (MAX por lote): 1 call, mean 0,023s, total 0,023s
    - `user_sectors`/`users` (setores): 1 call, mean 0,047s, total 0,047s

## Notas
- Registrar data/hora do teste e volume de dados aproximado.
- Se possível, usar `EXPLAIN ANALYZE` para comprovar redução de queries.
