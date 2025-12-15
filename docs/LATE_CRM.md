# LATE_CRM – Visão, Benchmarking e Plano de Execução
_Atualizado em 13 de dezembro de 2025_

## 1) Objetivo
Transformar o LATE em um CRM completo, flexível e configurável, mantendo licença MIT e arquitetura Node.js/Express/PostgreSQL já existente. Tudo que for reutilizado de terceiros seguirá duas regras: (a) só copiamos código MIT/Apache com cabeçalho preservado; (b) para projetos GPL/AGPL usamos apenas referência conceitual (clean room) ou integração via API.

## 2) Linha de base (Salesforce Amahpet)
- Módulos ativos: Leads, Contas, Oportunidades, Calendário, Painéis, Relatórios.
- Módulos configurados (vazios ou pouco usados): Turmas (Class__c), Cursos, Membros de Grupo, Campanhas.
- Dados atuais (12/12/2025): 6 contas (owner Bianca), 6 oportunidades todas em “Qualificação” (fechamentos 30/06/2025–30/09/2025), 5+ leads (nome/telefone/celular/email). Dashboards mostram pico ~9k em junho, ~2k agosto, ~4k setembro.
- Relatórios existentes: Leads por Fonte, Atividade do Vendedor, Oportunidades – Vendas, Contatos e Contas Todos. Criador: Alessandro (20/06/2023 e 02/07/2025).
- Regras implícitas: visões “Meus” registros, owner obrigatória, auditoria de criação/edição.

## 3) Princípios de design para o LATE CRM
1. **Flexibilidade de funil**: múltiplos pipelines por objeto; estágios configuráveis; regras por estágio (campos obrigatórios, impedimento de pular etapas, automações).
2. **Account opcional**: oportunidades podem existir sem conta; pipelines podem exigir ou não account/contact conforme regra.
3. **Custom fields e módulos leves**: metadados (`custom_fields`, `custom_field_values`) permitem adaptar (ex.: Turmas/Cursos) sem migrar schema.
4. **Clean room + licença**: nada de código GPL/AGPL; código MIT/Apache entra com cabeçalho preservado; restante reescrito.
5. **Operação simples**: importador CSV com dedup (email/telefone normalizado), dashboards PG materializados, ICS para calendário.
6. **Segurança**: owners, filtros “Meus”, RBAC existente, trilha em `audit_logs`, CSRF/rate limit já do LATE.

## 4) Benchmarking (o que vamos aproveitar)
- **HubSpot (referência conceitual)**: pipelines por objeto e automações de estágio (campos obrigatórios, bloqueio de salto, tasks/notifications automáticas).  
- **Pipedrive (alerta de rigidez)**: exige pessoa/org na criação de deals na UI; vamos evitar essa rigidez permitindo deals sem conta quando a regra liberar.  
- **NocoBase CRM (open source no-code)**: foco em plugins/campos dinâmicos e pipelines configuráveis; inspira custom fields e UI de configurações.  
- **NocoDB template “Simple Sales CRM”**: estrutura mínima (negócios, contatos) com views customizáveis; reforça abordagem modular.  
- **BottleCRM (MIT, SvelteKit/Node)**: kanban, filtros salvos, ACL simples. Trechos de UI/fluxos podem ser reutilizados com cabeçalho MIT.  
- **Creamy CRM (MIT, PHP)**: dedup simples por email/telefone, CRUD enxuto de contatos/tarefas; bom para importar lógica de validação.  
- **Apache OFBiz (Apache-2.0)**: modelagem Party/Contact/Opportunity e relacionamentos; útil para desenhar schema robusto e API.  
- **openCRX (BSD-like)**: auditoria detalhada, atividades recorrentes, CalDAV/WebDAV; inspira calendário e trilha de auditoria.  
- **Hydra OMS (Apache-2.0)**: orquestração de tarefas/ordens; inspira automações acopladas a transições de estágio.
- **Dolibarr, SuiteCRM, ERPNext (GPL/AGPL)**: somente referência conceitual ou uso via API externa; não copiar código.

## 5) Requisitos funcionais derivados
- **Objetos**: leads, contacts, accounts (opcional), opportunities, activities (tarefas/compromissos), pipelines, pipeline_stages, pipeline_rules, labels/tags, campaigns (leve), teams, custom_fields.
- **Pipelines**: múltiplos por objeto; estágios ordenados; probabilidade opcional; regra de obrigatoriedade de campos; bloqueio de retrocesso/salto; automações por evento (on_enter/on_exit).
- **Account opcional**: em cada pipeline definir se `account_id` é obrigatório. Para B2C, permitir “sem conta” e criar placeholder depois.
- **Deduplicação**: normalizar email/telefone (armazenar `phone_normalized` em E.164; aceitar entrada local “11 91234-5678” e converter); checar duplicatas em leads/contacts/accounts; sugerir merge sem bloquear.
- **Relacionamento recados/leads/contatos**: múltiplos recados (follow-ups) para um contato; um lead vinculado a um único contato; um contato pode ter múltiplas oportunidades/propostas.
- **Custom fields iniciais**: comuns `source_detail`, `notes_internal`; Treinamentos `course_id`, `class_id`, `modality`, `payment_method`; Clínica `pet_name`, `species`, `weight`, `urgency_level`, `preferred_branch`.
- **Import/export**: CSV com mapeamento de colunas, preview e dry-run; export com filtros aplicados.
- **Dashboards/relatórios**: pipeline por mês/estágio, atividade por owner, leads por origem, conversão; pastas/favoritos; materializações em PG para performance.
- **Calendário**: FullCalendar, ICS export/subscribe, views pessoal/equipe; tarefas “hoje/atrasadas/futuras”.
- **Ações em lote**: mudar owner/status, adicionar a campanha, enviar email (mailer atual), aplicar tag.
- **Auditoria**: `audit_logs` por mutação (user, objeto, diff); recuperação simples via API.

## 6) Modelo de dados proposto (PG)
- `pipelines(id, object_type, name, requires_account boolean, requires_contact boolean, active)`
- `pipeline_stages(id, pipeline_id, name, position, probability, color, sla_minutes nullable)`
- `pipeline_rules(id, pipeline_stage_id, required_fields jsonb, forbid_jump boolean, forbid_back boolean, auto_actions jsonb)`
- `accounts(id, name, phone, website, owner_id, tags, created_at, updated_at, deleted_at nullable)`
- `contacts(id, first_name, last_name, email, phone, mobile, owner_id, account_id nullable, tags, created_at, updated_at)`
- `leads(id, contact_id nullable, source, status, owner_id, score, notes, created_at, updated_at)`
- `opportunities(id, title, account_id nullable, contact_id nullable, pipeline_id, stage_id, amount numeric, close_date, owner_id, source, probability_override nullable, description, created_at, updated_at)`
- `activities(id, type (task/meeting/call), subject, starts_at, ends_at, owner_id, related_type (lead/contact/account/opportunity), related_id, status, location, created_at, updated_at)`
- `campaigns(id, name, status, budget, owner_id, created_at, updated_at)`
- `labels(id, name, color, scope (lead/contact/account/opportunity))` + tabela de junção `label_links`
- `custom_fields(id, entity, name, type, options, required, order)` + `custom_field_values(id, field_id, entity_type, entity_id, value)`
- `attachments(id, entity_type, entity_id, filename, url, size, owner_id, created_at)`
- `audit_logs(id, entity_type, entity_id, user_id, action, diff jsonb, created_at)`

## 7) Regras de negócio (configuráveis)
- **Criação de oportunidade**: valida conforme `pipeline_rules` do estágio inicial; `account_id` obrigatório apenas se `requires_account=true`.
- **Transição de estágio**: verifica `required_fields`, `forbid_jump`, `forbid_back`; dispara `auto_actions` (criar atividade, notificar owner, mudar probabilidade).
- **Dedup**: ao criar/atualizar lead/contact/account normaliza email/telefone e consulta duplicatas; oferece merge (não bloqueia). Telefone armazenado em E.164, entrada livre (ex.: “11 91234-5678”).
- **SLA de estágio**: se `sla_minutes` definido, agendar lembrete/alerta em `activities`.
- **Conversão de lead**: opcionalmente cria contact + opportunity; se pipeline permitir, mantém sem conta.

## 8) UX / Front-end
- **Kanban** de oportunidades por pipeline com drag&drop (referência BottleCRM).
- **Listas salvas**: filtros por owner, estágio, data, valor, tag, campanha, “Meus”, “Recentes”.
- **Dashboard Home**: cards Pipeline do Time, Atividade do Vendedor, Leads por Origem; atalhos “Minhas oportunidades”, “Meus leads”, tarefas de hoje.
- **Calendário**: semanal/mensal, “Meus” e “Outros” calendários, botão “Novo compromisso”, export ICS.
- **Importador CSV**: upload → preview → mapping → dedup check → dry-run → apply.
- **Configurações**: editor de pipelines/estágios, regras de estágio, campos customizados, cores e ordens.

## 9) Integrações e automações
- **E-mail**: usar `services/mailer.js` atual; template para follow-up de estágio, lead inativo, tarefa vencida.
- **Telefonia**: webhook Asterisk para logar chamadas como `activities` (futuro).
- **ICS/CalDAV**: export ICS imediato; CalDAV pode ser fase 2 inspirada em openCRX.
- **Jobs**: reusar schedulers do LATE (messageAlerts) para SLAs e lembretes.
- **WhatsApp / leads externos**: preparar webhooks/API para intake de Meta Ads/Make.com; armazenar payload bruto e vincular a `contacts` por telefone normalizado.

## 10) Licenciamento e compliance
- LATE permanece MIT.  
- Código copiado de MIT/Apache (BottleCRM, Creamy, OFBiz, openCRX, Hydra OMS) mantém cabeçalho original e citação em `NOTICE`.  
- Nenhum trecho de código de projetos GPL/AGPL (Dolibarr, SuiteCRM, ERPNext, Frappe). Somente referência conceitual ou uso via API externa.  
- Ao integrar serviço externo GPL (ex.: Dolibarr) mantemos processos separados e o LATE continua MIT.

## 11) Plano de entregas (proposto)
- **Sprint 1**: migração PG (tabelas acima), seeds (6 contas, 6 oportunidades, 5 leads), CRUD REST, filtros “Meus”, dedup básico, kanban simples, stats pipeline/activity.
- **Sprint 2**: FullCalendar + ICS, importador CSV com preview/dry-run, ações em lote em leads, regras básicas de estágio.
- **Sprint 3**: dashboards home com pastas/favoritos, custom fields UI, automações (on_enter/on_exit), campanhas/teams leves.
- **Sprint 4**: CalDAV opcional, webhooks Asterisk, relatórios avançados (conversão, win-rate), merge UI de duplicatas.

## 12) Dados para migração (Salesforce)
- Contas: 6 registros (Bianca owner). Exemplos: Juju, Dulce Maria Chipana Acuna, Adriana, Ary, Lais Nascimento Melo, Cris Rico.
- Oportunidades: 6 registros em “Qualificação”, fechamentos 30/06/2025–30/09/2025, owner Bianca Emboava.
- Leads: 5+ registros (Jaqueline Daiane, Emily Maria, Rebeca, Ana Carolina, Sarah Cristina) com telefone/celular/email.
- Relatórios a recriar: Leads por Fonte, Atividade do Vendedor, Oportunidades – Vendas, Contatos e Contas Todos.

## 13) Referências (benchmarking)
- HubSpot – pipelines e automações por estágio (customização de deal pipelines).  
- HubSpot – automações de pipeline por objeto (regras de criação/edição).  
- Pipedrive – impossibilidade de criar deal sem pessoa/org (evitar essa rigidez).  
- NocoBase CRM solution – pipelines e campos dinâmicos.  
- NocoDB template “Simple Sales CRM” – modelo mínimo e views customizáveis.  
- BottleCRM (MIT) – kanban, filtros salvos, ACL.  
- Creamy CRM (MIT) – dedup por email/telefone e CRUD simples.  
- Apache OFBiz (Apache-2.0) – modelagem Party/Contact/Opportunity.  
- openCRX (BSD-like) – auditoria e CalDAV/WebDAV.  
- Hydra OMS (Apache-2.0) – orquestração de tarefas/ordens.  
- Dolibarr/SuiteCRM/ERPNext (GPL/AGPL) – somente referência conceitual ou uso via API externa; não copiar código.

### Licenciamento das novas soluções levantadas
- Permissivos (podemos reutilizar código com cabeçalho preservado): **Krayin CRM (MIT, Laravel)**; **EPESI (MPL 1.1 – copyleft fraco por arquivo)**.  
- Copyleft (benchmark conceitual ou integração via API, não colar código): Dolibarr (GPL-3+), Vtiger (VPL/MPL), Akaunting (GPL-3), YetiForce (licença própria com obrigações adicionais), SugarCRM community (AGPL-3), SuiteCRM (GPL-3), FrontAccounting (GPL-3), EspoCRM (GPL-3), OrangeHRM (GPL-2), EGroupware (GPL-2), X2CRM (AGPL-3), Group Office (AGPL-3), Zurmo (GPL-3), ChurchCRM (GPL-3), webERP (GPL-2+), Tine 2.0 (AGPL-3), Sentrifugo (GPL-3), Zenbership (GPL-3), IceHrm community (AGPL-3), Jorani (GPL-3).
- Recomendação para o LATE (MIT): priorizar reuse de Krayin e, se aceitarmos MPL por arquivo, EPESI; demais apenas para ideias ou APIs externas.


## Sprint 13 de dezembro de 2025 — andamento
- Migrations CRM ativas + seeds do snapshot Salesforce aplicadas (6 oportunidades, 5 leads, pipelines Treinamentos/Clínica).
- Views materializadas para stats (pipeline/atividades) com cron a cada 10 min (`scripts/refresh-crm-stats.js` + crontab) para manter dashboards rápidos.
- Regras de estágio agora validam required_fields incluindo custom fields; RBAC usa view_scope (own/all) para filtrar listagens.
- Exportações: ICS de atividades; CSV de leads e oportunidades; import CSV simples para leads (sem preview/dedup ainda).
- Dashboard web do CRM consumindo stats; testes de API CRM estão passando após ajuste de idempotência e required_fields.

## 14) TO_DO (próximos passos para validar e iniciar implementação)
- Fechar catálogo de custom fields iniciais (Treinamentos: course_id/class_id/modality/payment; Clínica: pet_name/species/weight/urgency).
- SLAs por estágio e automações on_enter/on_exit (criar tarefa, notificar owner, ajustar probabilidade).
- Importador CSV com preview + dedup/merge (email/telefone) e dry-run antes de aplicar.
- UI para custom fields e para configuração de pipelines/regras (cores, probabilidade, forbid_jump/back).
- CalDAV/ICS subscribe e FullCalendar avançado (filtros por owner/pipeline, arrastar).
- RBAC de equipes: filtros "minha equipe"/hierarquia e checks em transição de estágio.
- Dedup/merge UI para leads/contacts/accounts e link recados->lead/opp nas telas.
- Monitorar cron de refresh das MVs (alertar erros em /var/log/late-crm-stats.log).
- Testes adicionais: listagens com filtros, activities, custom fields, CSV e fluxo recado→lead→opportunity.

---
Qualquer evolução futura deve manter compatibilidade com a arquitetura do LATE (Express + PG + EJS), priorizar performance (views materializadas para dashboards) e preservar a simplicidade operacional (importador CSV e automações leves antes de BI avançado).
