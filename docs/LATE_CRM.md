# LATE_CRM – Visão, Benchmarking e Plano de Execução
_Atualizado em 18 de dezembro de 2025_

## 1) Objetivo
Transformar o LATE em um CRM completo, flexível e configurável, mantendo licença MIT e a arquitetura Node.js/Express/PostgreSQL já existente. Reuso de terceiros segue: (a) código MIT/Apache com cabeçalho preservado; (b) GPL/AGPL apenas como referência conceitual (clean room) ou via API externa.

## 2) Linha de base (Salesforce Amahpet)
- Módulos ativos: Leads, Contas, Oportunidades, Calendário, Painéis, Relatórios.
- Módulos configurados: Turmas (Class__c), Cursos, Membros de Grupo, Campanhas (sem dados).
- Dados (12/12/2025): 6 contas (owner Bianca), 6 oportunidades em “Qualificação” (fech. 30/06/2025–30/09/2025), 5+ leads com nome/telefone/cel/email. Dashboards: pico ~9k em jun/25, ~2k ago/25, ~4k set/25.
- Relatórios: Leads por Fonte, Atividade do Vendedor, Oportunidades – Vendas, Contatos e Contas Todos (Alessandro, 20/06/2023 e 02/07/2025).
- Regras implícitas: visão “Meus”, owner obrigatório, auditoria de criação/edição.

## 3) Princípios de design
1. Flexibilidade de funil: múltiplos pipelines por objeto; estágios configuráveis; regras por estágio (required_fields, forbid_jump/back, automações on_enter/on_exit).
2. Account opcional: oportunidade pode existir sem conta conforme regra do pipeline (útil para B2C).
3. Custom fields/metadados: `custom_fields` + `custom_field_values` para adaptar (Turmas/Cursos, pet/urgência etc.).
4. Clean room + licença: nada de código GPL/AGPL; MIT/Apache entram com cabeçalho preservado.
5. Operação simples: import CSV com dedup, dashboards com MVs, ICS no calendário.
6. Segurança: owners, filtros “Meus”, RBAC do LATE, audit_logs, CSRF/rate-limit.

## 4) Benchmarking (reuso ou inspiração)
- MIT/Apache (pode reusar código): BottleCRM (kanban/filtros — inativo pós-2023, inspiração), Creamy CRM (dedup — inativo), Krayin (MIT — ativo, releases 2025, priorizar reuso), OFBiz (Apache-2.0, modelagem Party/Contact/Opp — atividade baixa), openCRX (BSD-like, CalDAV/WebDAV — atividade baixa), Hydra OMS (Apache-2.0 — sem updates recentes).
- Conceitual/API apenas (GPL/AGPL): Dolibarr, SuiteCRM, ERPNext, Pipedrive/HubSpot (conceitos), Vtiger, YetiForce, etc.

## 5) Requisitos funcionais
- Objetos: leads, contacts, accounts (opcional), opportunities, activities, pipelines/stages/rules, labels, campaigns leves, teams, custom_fields.
- Pipelines: múltiplos por objeto; probabilidade opcional; required_fields por estágio; forbid_jump/back; automações on_enter/on_exit.
- Dedup: normalizar phone/email (E.164); sugerir merge sem bloquear; merge reatribui leads/opps/activities.
- Recados→CRM: múltiplos recados (follow-ups) por contato; 1 lead por contato; 1 contato para n oportunidades/propostas; recado linkável a lead/opp.
- Custom fields iniciais: comuns (source_detail, notes_internal); Treinamentos (course_id, class_id, modality, payment_method); Clínica (pet_name, species, weight, urgency_level, preferred_branch).
- Import/export: CSV com mapeamento, preview/dry-run, dedup; export respeita filtros/escopo.
- Dashboards/relatórios: pipeline por mês/estágio, atividades por owner, leads por origem, conversão; MVs em PG.
- Calendário: FullCalendar, filtros owner/status/tipo/data, drag/drop/resize, export ICS.
- Ações em lote: mudar owner/status, campanha, email, tag.
- Auditoria: audit_logs por mutação.

## 6) Modelo de dados (já migrado)
`pipelines`, `pipeline_stages`, `pipeline_rules`, `accounts`, `contacts` (phone/email normalizados), `leads`, `opportunities`, `activities`, `campaigns`, `labels`/`label_links`, `custom_fields`/`custom_field_values`, `attachments`, `audit_logs`, `message_send_events`, `telephony_events`, MVs `mv_crm_*` para stats.
- Audit logs: eventos mínimos a registrar — `created`, `updated`, `stage_moved`, `owner_changed`, `merged`.

## 7) Regras de negócio
- Criar oportunidade: valida regras do estágio inicial; `account_id` só se pipeline exigir.
- Mover estágio: checa required_fields (incluindo custom), forbid_jump/back; executa automações (futuro) e SLA.
- Dedup: normalização E.164; merge não bloqueia criação.
- SLA: se `sla_minutes`, agendar lembrete/alerta em activity.
- Conversão de lead: opcionalmente cria contact + opp; pipelines podem permitir “sem conta”.

## 8) UX / Front-end entregues
- Kanban de oportunidades, listas com filtros, dedup UI, calendário com filtros e edição de horário, dashboards iniciais, pages de leads/opps/activities.
- Export: ICS de activities; CSV de leads/opps com escopo/owner aplicado.
- Import: CSV com preview/dry‑run e dedup/merge básico; upload multipart e UI inicial em `/crm/importar`.

## 9) Integrações/infra entregues
- Message Send Events: API idempotente, UI /relatorios/whatsapp, constraint (source,idempotency_key).
- Telephony ingest: webhook com HMAC raw body, bearer/allowlist, grava em `telephony_events`.
- healthGate: 503 JSON para /api* quando DB indisponível.
- Seeds: snapshot Salesforce (6 contas, 6 opps, 5 leads) aplicado; pipelines Treinamentos/Clínica.
- Cron: `refresh-crm-stats.js` para MVs (10 min).
- Tests: activities time/list/ics, dedup merge, CRM API básicas, web dashboard.

## 10) Licenciamento
- LATE permanece MIT; código MIT/Apache reutilizado mantém cabeçalho; GPL/AGPL apenas referência/API.

## 11) Continuidade
Backlog, sprints futuras e pendências estão em `docs/LATE_CRM_II.md` (atualizado em 19 de dezembro de 2025). Este arquivo mantém apenas o que já foi entregue ou decidido.
