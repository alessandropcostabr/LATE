# 🗺️ ROADMAP — LATE
> Atualizado em 16/12/2025

Este roadmap consolida as entregas concluídas, em andamento e planejadas para o LATE, com foco em relacionamento, rastreabilidade, operação e segurança.

---

## ✅ ENTREGAS CONCLUÍDAS

### CRM Core — Dezembro 2025
- Pipelines de vendas com estágios configuráveis e regras por etapa
- Leads, Contatos e Oportunidades com criação flexível (B2B/B2C)
- Atividades (tarefas, reuniões, chamadas) com calendário FullCalendar
- Calendário com filtros, drag/drop, resize e export ICS
- Deduplicação de contatos por email/telefone com merge seguro
- Export CSV de leads/oportunidades respeitando escopo de acesso
- Import simples de leads via CSV
- Automações de estágio: SLA automático e auto-actions (create_activity, notify_owner, set_probability)
- Página de configuração do CRM (`/crm/config`)
- Integrações: WhatsApp Sender (idempotente), Telefonia (HMAC), healthGate (503 JSON)
- Views materializadas para dashboards e cron de refresh

### Sprints Anteriores — Outubro a Novembro 2025
- Infraestrutura sólida (login seguro, CSP, CSRF, cookies httpOnly, trust proxy)
- Checklists, comentários, etiquetas e @menções
- Widgets de SLA (Hoje, Atrasados, 48h)
- Visões Kanban e Calendário de recados
- Filtro por labels, setor, status
- Recados com watchers e progresso
- Fila de e-mail com logs e reenvio
- Endpoint intake seguro com token
- Auditoria de automações + painel "Status Operacional"
- Sessão única por usuário (Single-Session)
- Restrições de acesso por IP e horário
- Workflow GitHub → Ansible com PM2 em cluster
- Central de Ajuda e Manual revisado
- Scripts CLI e worktree operacionais

---

## 🏗️ EM ANDAMENTO

### Sprint RBAC & Filtros de Equipe
- Filtros "Meus / Equipe" em todas as listagens do CRM
- Permissões granulares por pipeline e estágio
- Visibilidade de oportunidades por owner e time

### Sprint Stats & Dashboards
- Wiring final das Materialized Views nos dashboards
- Pipeline por estágio/mês, atividades por owner
- Leads por origem, taxa de conversão
- UI consolidada com gráficos interativos

---

## 🧠 PRÓXIMAS ENTREGAS

### Sprint Importador CSV Avançado
- Preview antes de importar
- Dedup/merge automático durante import
- Dry-run para validação
- Suporte a leads, contacts e opportunities

### Sprint Custom Fields UI
- Interface para gerenciar campos customizados
- Required_fields incluindo campos custom
- Editor visual de pipelines, estágios e regras
- Configuração de cores, probabilidades e restrições (forbid_jump/back)

### Sprint Recados → Activities
- Mapear recados existentes para activities do CRM
- Navegação recado → contato → lead → oportunidade
- Agenda integrada com recados e atividades CRM

### Sprint ICS/CalDAV Avançado
- Subscribe/export completo
- Filtros por owner e pipeline
- CalDAV opcional para sincronização externa

---

## 🔐 FUTURO

### Sprint Templates Inteligentes
- Modelos de recado por setor (checklist + etiquetas)
- Sugestão de preenchimento com base em padrões anteriores

### Sprint Indicadores Avançados
- Dashboard com histórico e evolução semanal
- Ciclo de melhoria contínua por setor (gargalos e plano de ação)

### Sprint API Pública
- API REST documentada para parceiros
- Webhook para notificações outbound
- Tokens com escopo restrito e auditoria de uso

### Sprint Anexos & Evidências
- Upload de imagens/PDFs no recado com quotas
- Pré-visualização e log por usuário

### Sprint Operações de Plantão
- Registro de turno (Log de Passagem de Plantão)
- Checklists de abertura/fechamento por setor
- Dashboard de plantão (tarefas pendentes + ocorrências)

---

## 📌 COMO USAR O ROADMAP

- `/roadmap` exibe esta visão geral no sistema
- Atualizações refletem status de sprints em tempo real
- Cada sprint possui arquivos `.md` com ações e contexto

---

## 📚 REFERÊNCIAS

- `LATE_CRM.md` — Visão completa do módulo CRM
- `LATE_Status_Atual.md` — Status atual do projeto
- `LATE_SPRINTS_EXECUTADAS.md` — Histórico de sprints
- `LATE_SPRINTS_FUTURAS.md` — Planejamento futuro

---

_Foco constante: Relacionamento, Responsabilidade, Resultado._
