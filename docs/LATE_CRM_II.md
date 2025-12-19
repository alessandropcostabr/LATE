# LATE_CRM_II – Backlog e Sprints
_Atualizado em 19 de dezembro de 2025_

> Documento para organizar pendências e próximas sprints do CRM. O histórico concluído permanece em `docs/LATE_CRM.md`.

## Sprint 1 — RBAC & Filtros “Meus/Equipe” (✅ concluída)
- Backend: reforçar escopo por owner/team em queries de leads/contacts/opps/activities; garantir uso consistente de `currentUser.team_id`.
- API: parâmetros `scope=me|team|all`, validação por perfil (admin pode `all`; gestor equipe pode `team`; default `me`).
- UI: adicionar filtros rápidos “Meus”/“Equipe” em todas as listagens e kanbans; persistência em querystring.
- Transições: impedir mudança de owner/estágio fora do escopo permitido; mensagens de erro claras.
- Testes: suites de controllers e integrações cobrindo filtros e RBAC (web + API).
- Critérios de aceite:
  - Toda listagem do CRM (leads, contacts, opps, activities, kanban) exibe e respeita “Meus/Equipe/All” conforme role.
  - Tentativa de acessar ou alterar registro fora do escopo retorna 403 com mensagem traduzida.
  - Cobertura de testes inclui pelo menos 1 caso positivo e 1 negativo por recurso (API e web).
  - POST para outro owner/time só é permitido a admin/gestor; casos inválidos retornam 403.
  - Listagens/kanban mantêm tempo de resposta <500ms em dataset de 10k registros (staging).

## Dependências
- Roles/teams existentes no LATE; perfis de admin e gestor já configurados.

### Desenho técnico
- Decisão Team Scope: **Opção 2 (normalizado via join)** — usar `users.team_id` em join/exists; não depender de `team_id` nas tabelas CRM.
- Query helpers: criar util `withScope(queryBuilder, user, opts)` para aplicar escopo por `owner_id` ou `team` via join/exists; reuso em models/controllers.
- Validação de escopo: middleware central que converte `scope` inválido em 400 e bloqueia `all` para não-admin; gestor ganha `team`.
- UI: componente único `ScopeFilter` com persistência em querystring/localStorage; default “Meus”.
- Índices: garantir índices em `owner_id` nas tabelas CRM (leads/opps/activities/contacts) e índice composto `users(team_id, id)` para acelerar join/exists.
- Operações: GET/POST/PATCH/DELETE devem respeitar escopo; criação para outro owner/time apenas admin/gestor.
- Testes: factories com usuários de times distintos; casos de 403 para acesso cross-team e sucesso para owner/gestor/admin.

### Issues sugeridas
- `crm-rbac-scope-helper`: adicionar util `withScope` e cobrir controllers de leads/contacts/opps/activities.
- `crm-rbac-scope-middleware`: validar query param `scope` (me|team|all) e roles; retornar 400/403 conforme regra.
- `crm-rbac-ui-scope-filter`: criar componente `ScopeFilter` e integrar nas listagens + kanban.
- `crm-rbac-indexes`: garantir índices `owner_id` nas tabelas principais e `users(team_id, id)` para joins de escopo.
- `crm-rbac-tests`: suites cobrindo acesso negado/permitido para owner, gestor e admin.

#### Exemplo de helper (sketch)
```js
// utils/scope.js
function withScope(q, user, scope = 'me', opts = {}) {
  const table = opts.tableAlias;
  const ownerCol = opts.ownerCol || 'owner_id';
  const col = table ? `${table}.${ownerCol}` : ownerCol;
  if (scope === 'all' && user.role !== 'admin') throw forbidden();
  if (scope === 'team') {
    if (!user.team_id) throw badRequest('team required');
    return q.whereExists(function () {
      this.select(1)
        .from('users as owner')
        .whereRaw(`owner.id = ${col}`)
        .where('owner.team_id', user.team_id);
    });
  }
  return q.where(col, user.id);
}
```

## Sprint 2 — Stats & Dashboards (MVs) (✅ concluída)
- Revisar MVs `mv_crm_*` e agendamento `refresh-crm-stats.js` (10 min) para cobrir novos filtros.
- Wiring final no frontend: dashboards únicos por escopo (me/team/all) e pipelines; gráficos de conversão e funil.
- Permissões: esconder cards/gráficos quando escopo não autorizado.
- Observabilidade: métricas de tempo de refresh e staleness; logar atrasos >2min.
- Testes: snapshot dos MVs em pg-mem e asserts das queries agregadas.
- Critérios de aceite:
  - Dashboards carregam em <1.5s em dados de staging com MVs pré-atualizadas.
  - Staleness exibida (timestamp do último refresh) e alertada em log quando >20 min; e-mail opcional habilitado por feature flag/env.
  - Cards/plots respeitam escopo e ocultam dados fora de permissão.
  - Testes validam agregações principais (pipeline por estágio, conversão por mês, atividades por owner).

### Desenho técnico
- MVs: garantir `refresh materialized view concurrently` quando possível; fallback serializado se sem índice unique. Agendar via `refresh-crm-stats.js` com lock simples em PG (`pg_advisory_lock`).
- API: endpoints `/api/crm/stats` aceitam `scope` e `pipeline_id`; retornam timestamp `refreshed_at`.
- UI: camada de dados com SWR/etag; skeleton + aviso de staleness >20min.
- Observabilidade: logar duração do refresh e idade dos dados; métrica exposta em `/health` opcional; alerta e-mail opcional via env (ex.: `STATS_ALERT_EMAILS`).
- Performance: validar `unique index` por MV e rodar `EXPLAIN ANALYZE` em staging antes de liberar.
- Testes: fixtures para MVs no pg-mem; validar filtros por `owner_id`, `team_id`, `pipeline_id`.

### Issues sugeridas
- `crm-stats-mv-refresh-lock`: aplicar `pg_advisory_lock` no script de refresh e logar duração.
- `crm-stats-api`: endpoint `/api/crm/stats` com `scope`/`pipeline_id` e `refreshed_at`.
- `crm-stats-ui-wiring`: conectar dashboards ao endpoint; skeleton + aviso de staleness.
- `crm-stats-tests`: fixtures pg-mem para MVs e asserts das agregações com escopo.

#### Exemplo de refresh com lock
```js
// scripts/refresh-crm-stats.js
await client.query('select pg_advisory_lock(90210)');
try {
  await client.query('refresh materialized view concurrently mv_crm_pipeline');
  await client.query('refresh materialized view concurrently mv_crm_activities');
} finally {
  await client.query('select pg_advisory_unlock(90210)');
}
```

### TO_DO sprint 2
- (Concluída) Revisões e merge realizados em 19 de dezembro de 2025.

## Sprint 3 — Import CSV Avançado (🚧 em andamento)
- Fluxo: upload → mapeamento de colunas → preview (primeiras 50) com validação → dedup/merge sugerido → dry-run → aplicar.
- Dedup: regras phone/email normalizados (E.164), match opcional por documento; opção “force new”.
- Escopo: suportar leads, contacts e opportunities; vincular pipeline/owner default por param.
- UX: indicadores de risco (campos faltando, colunas não mapeadas); relatório final exportável (CSV/JSON).
- Testes: casos de preview, dry-run, dedup merge, rollback em erro.
- Critérios de aceite:
  - Usuário consegue mapear colunas obrigatórias e concluir preview em <10s para 5k linhas.
  - Dry-run gera relatório com totais (novos, atualizados, ignorados, conflitos) e pode ser baixado em CSV/JSON.
  - Opção “force new” grava registros mesmo com possíveis matches; default é sugerir merge.
  - Erro em lote aborta transação sem registros parciais.
  - Upload limitado a 100MB; teste de carga com 200k linhas não causa OOM nem bloqueia o servidor.

### Desenho técnico
- Pipeline: endpoint de upload salva em storage temporário; parser streaming (csv-parse) com limites de memória; preview captura 50 linhas.
- Dedup: normalizar phone/email; buscas por hash (`email_norm`, `phone_norm`) com índice; sugerir merge e exibir causas.
- Oportunidades: aceitar `pipeline_name`/`stage_name` no CSV e resolver para IDs automaticamente (case-insensitive e sem acentos; fallback para IDs quando informados).
- Dry-run: executar em transação com `ROLLBACK` no final ou em tabela temporária; relatório consolidado por tipo de ação.
- Aplicar: mesma lógica do dry-run, mas com `COMMIT`; chunking por 1k linhas para evitar locks longos.
- UI: wizard de 5 passos com persistência de mapeamento; barra de progresso; download do relatório final.
- Testes: cenários de import lead/contact/opp, dedup por telefone, erro proposital para garantir rollback.

### Issues sugeridas
- `crm-import-upload-endpoint`: upload + storage temporário + preview 50 linhas.
- `crm-import-dedup-engine`: normalização phone/email, detecção e sugestão de merge.
- `crm-import-dry-run-report`: transação com rollback e relatório CSV/JSON.
- `crm-import-apply`: execução com chunking e commit; opção `forceNew`.
- `crm-import-ui-wizard`: frontend em 5 passos com barra de progresso e download de relatório.
- `crm-import-tests`: casos de dedup, rollback em erro e import para lead/contact/opp.

#### Exemplo de dedup normalizado
```js
const phoneNorm = normalizeE164(input.phone);
const existing = await db('contacts')
  .where({ phone_norm: phoneNorm })
  .orWhere({ email_norm: normalizeEmail(input.email) });
```

### TO_DO sprint 3
- (Concluído) Preview/dry-run/apply via upload multipart, auto‑mapping e modo merge/skip para duplicados.
- (Concluído) UI simples de importação (`/crm/importar`) com preview e simulação.
- (Concluído) Wizard em 5 passos com mapeamento interativo de colunas.
- (Concluído) Relatório exportável (CSV/JSON) após dry‑run.
- (Concluído) Aplicar chunking por 1k linhas com transação e rollback.
- TO_DO UI: consolidar botões “Voltar” duplicados no wizard.
- TO_DO UI: adicionar barra de progresso e validações visuais (erros por coluna/campo).
- Testes: dedup/rollback e carga 200k linhas (sem OOM).

## Sprint 4 — Custom Fields UI
- UI: builder para `custom_fields` (tipo, label, required, options, alvo: lead/contact/opp/activity).
- Form rendering: suportar custom fields em create/edit e no kanban inline; validação required por estágio/pipeline.
- Admin: ordenação, categorias, visibilidade por role/team.
- Tests: render/validations, migrations de schema em memória, snapshots de forms.
- Critérios de aceite:
  - Admin consegue criar/editar/apagar campo custom sem reiniciar servidor.
  - Campos aparecem nos formulários dos objetos-alvo, respeitando required por estágio.
  - Visibilidade por role/team funciona (campo some quando usuário não tem permissão).
  - Snapshot de UI cobre pelo menos 2 tipos de campo (texto, select) e validações.

### Desenho técnico
- API: endpoints CRUD para `custom_fields` + endpoint para `custom_field_values` por objeto.
- Schema: reutilizar tabelas já existentes (`custom_fields`, `custom_field_values`); garantir índices em `(target_type, target_id)`.
- Renderização: registry de tipos (text, number, select, date, bool); validações plugáveis; cache leve em memória com etag.
- Kanban inline: componentes reutilizáveis que consomem o registry; valida required antes de salvar estágio.
- Testes: snapshots de forms com dois tipos, validação de required e visibilidade por role.

### Issues sugeridas
- `crm-cf-builder-ui`: builder de campos custom (CRUD) para admin.
- `crm-cf-renderer`: registry de tipos e renderização nos forms/kanban.
- `crm-cf-visibility`: regras de visibilidade por role/team no frontend e backend.
- `crm-cf-tests`: snapshots e validações de required/visibilidade.

#### Exemplo de registry de tipos
```js
const fieldTypes = {
  text: ({ value, onChange }) => <Input value={value} onChange={onChange} />,
  select: ({ value, onChange, options }) =>
    <Select options={options} value={value} onChange={onChange} />,
};
```

## Sprint 5 — Recados → Activities
- Migração: mapear recados existentes para `activities` com links para lead/contact/opp.
- UI: navegação recado→activity; lista de recados unificada nas páginas de lead/contact/opp.
- ICS: garantir export dos novos activities; manter compatibilidade com calendários existentes.
- Tests: migração idempotente, exibição nas páginas, export ICS.
- Critérios de aceite:
  - Script de migração é idempotente e registra quantos recados foram migrados/ignorados.
  - Páginas de lead/contact/opp mostram timeline única de activities incluindo recados antigos.
  - Export ICS inclui atividades provenientes de recados; arquivos abrem no Google/Outlook sem warnings.
  - Testes cobrem migração e exibição (API + web).

### Desenho técnico
- Migração: script `scripts/migrate_recados_to_activities.js` que lê `recados` e cria `activities` mantendo owner, timestamps e vínculos; registra log em `_reports/recados_migration.log`.
- Idempotência: marcar recados migrados com flag/coluna ou tabela de controle; reentrância segura.
- UI: componente de timeline único consumindo activities; link canônico `activity/<id>` acessível a partir do recado antigo.
- ICS: reutilizar export existente; garantir que novos tipos apareçam; adicionar testes de parsing.
- Testes: migração sem duplicar, render em páginas de lead/contact/opp, e geração ICS contendo atividades migradas.
- Backup: gerar dump/CSV de recados antes da migração para rollback manual se necessário.

### Issues sugeridas
- `crm-recados-migration`: script idempotente para migrar recados → activities com log.
- `crm-recados-ui-timeline`: timeline única exibindo atividades migradas nas páginas de lead/contact/opp.
- `crm-recados-ics`: assegurar export ICS inclui atividades migradas e testes de parsing.
- `crm-recados-tests`: cobertura da migração e exibição web/API.

#### Exemplo de marcação idempotente
```js
// scripts/migrate_recados_to_activities.js
await db.transaction(async trx => {
  const recados = await trx('recados').whereNull('migrated_at');
  for (const r of recados) {
    await trx('activities').insert(mapRecado(r));
    await trx('recados').where({ id: r.id }).update({ migrated_at: trx.fn.now() });
  }
});
```

## Sprint 6 — Automações de Estágio/SLA
- Backend: executar auto_actions em updateStage (criar activity, notificar owner, ajustar probabilidade); SLA como reminder activity se `sla_minutes` excedido.
- UI: alertas no kanban para SLA próximo/vencido.
- Tests: cobertura de on_enter/on_exit, SLA cron.
- Critérios:
  - Automações rodam em <100ms por transição típica.
  - SLA gera activity automática e evita duplicados.
  - Testes incluem falha em notify sem quebrar transição principal.
- Desenho técnico:
  - Definir tabela/JSON de `pipeline_rules.auto_actions`.
  - Hook em move stage executa ações em transação separada (fire-and-forget via job/tabela de fila).
  - SLA checker periódico lê atividades pendentes e cria reminders.
  - Feature flag para desligar notificações.

## Sprint 7 — ICS/CalDAV Avançado
- Backend: export/subscribe ICS com filtros; avaliar CalDAV opcional (inspirar-se no openCRX).
- UI: botões de subscribe por owner/pipeline; mostrar staleness de ICS.
- Tests: parsing ICS em ferramentas externas (Google/Outlook).
- Critérios:
  - ICS carrega sem warnings; clientes atualizam em até X minutos (aceitar comportamento do cliente).
  - Endpoint ICS responde com ETag/Last-Modified e 304 quando não mudou.
  - CalDAV é opcional; se habilitado, deve respeitar escopos “me/team/all”.

## Outras pendências herdadas
- Testes adicionais: filtros, activities, custom fields, recado→lead→opp, CSV importer.

## Cards e Tickets (para uso no tracker)

### Card: CRM – RBAC: helper de escopo + middleware
- Objetivo: garantir que todas as queries CRM respeitem “me/team/all” conforme role.
- Critérios: listagens e kanban aplicam escopo; admin pode “all”, gestor “team”, padrão “me”; fora de escopo retorna 403 traduzido.
- Referência: Sprint 1 (`docs/LATE_CRM_II.md`).
- Tickets filhos:
  - `crm-rbac-scope-helper`
  - `crm-rbac-scope-middleware`
  - `crm-rbac-ui-scope-filter`
  - `crm-rbac-indexes`
  - `crm-rbac-tests`

### Card: CRM – Dashboards com MVs e staleness
- Objetivo: finalizar wiring de stats/dashboards usando MVs e escopos.
- Critérios: dashboards <1.5s com MVs frescas; staleness mostrado; cards ocultam dados sem permissão.
- Referência: Sprint 2.
- Tickets filhos:
  - `crm-stats-mv-refresh-lock`
  - `crm-stats-api`
  - `crm-stats-ui-wiring`
  - `crm-stats-tests`

### Card: CRM – Import CSV avançado (preview/dedup/dry-run)
- Objetivo: entregar fluxo completo de import com dedup e dry-run.
- Critérios: preview 5k linhas <10s; dry-run gera relatório CSV/JSON; rollback em erro; opção forceNew.
- Referência: Sprint 3.
- Tickets filhos:
  - `crm-import-upload-endpoint`
  - `crm-import-dedup-engine`
  - `crm-import-dry-run-report`
  - `crm-import-apply`
  - `crm-import-ui-wizard`
  - `crm-import-tests`

### Card: CRM – Custom Fields UI end-to-end
- Objetivo: builder + renderização + visibilidade por role/team.
- Critérios: admin CRUD sem restart; required por estágio respeitado; visibilidade aplicada; snapshots de tipos.
- Referência: Sprint 4.
- Tickets filhos:
  - `crm-cf-builder-ui`
  - `crm-cf-renderer`
  - `crm-cf-visibility`
  - `crm-cf-tests`

### Card: CRM – Recados migrados para Activities
- Objetivo: migrar recados e unificar timeline/ICS.
- Critérios: migração idempotente com log; timeline única; ICS inclui migrados; testes cobrindo migração e UI.
- Referência: Sprint 5.
- Tickets filhos:
  - `crm-recados-migration`
  - `crm-recados-ui-timeline`
  - `crm-recados-ics`
  - `crm-recados-tests`

### Card: CRM – Automações de Estágio/SLA
- Objetivo: executar automações on_enter/on_exit e reminders de SLA.
- Critérios: automações <100ms; SLA cria activity; falha em notify não bloqueia transição.
- Referência: Sprint 6.
- Tickets filhos:
  - `crm-automation-rules`
  - `crm-automation-sla-checker`
  - `crm-automation-ui-alerts`
  - `crm-automation-tests`

### Card: CRM – ICS/CalDAV avançado
- Objetivo: melhorar export/subscribe ICS e opcional CalDAV com escopos.
- Critérios: ICS sem warnings; atualiza em até X minutos; responde 304 com ETag/Last-Modified.
- Referência: Sprint 7.
- Tickets filhos:
  - `crm-ics-endpoint-etag`
  - `crm-ics-ui-subscribe`
  - `crm-caldav-optional`
  - `crm-ics-tests`
