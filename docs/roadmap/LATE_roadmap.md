# 🗺️ ROADMAP — LATE
> Atualizado em 2025/11/12.

> Última atualização: 2025/11/12

Este roadmap consolida as entregas concluídas, em andamento e planejadas para o LATE, com foco em relacionamento, rastreabilidade, operação e segurança.

---

## ✅ ENTREGAS CONCLUÍDAS

**Sprints 0 + A + B + C + D + E + 02 (parcial 02B)**

- Infraestrutura sólida (login seguro, CSP, CSRF, cookies httpOnly, trust proxy)
- Checklists, comentários, etiquetas e @menções
- Widgets de SLA (Hoje, Atrasados, 48h)
- Visões Kanban e Calendário
- Filtro por labels, setor, status
- Recados com watchers e progresso
- Fila de e-mail com logs e reenvio
- Endpoint intake seguro com token
- Auditoria de automações + painel “Status Operacional”
- Sessão única por usuário (Single-Session)
- Workflow GitHub → Ansible com PM2 em cluster
- Central de Ajuda e Manual revisado
- Scripts CLI e worktree operacionais

---

## 🏗️ EM ANDAMENTO

### Sprint 02B — Auditoria (UI, Status & Exportações)
- ✅ Painel `/relatorios/status` com telemetria Prometheus, VIP/Túnel e replicação.
- ✅ Workflow de deploy automático + PM2 em cluster.
- ⏳ Cards e filtros salvos na aba Auditoria.
- ⏳ Exportações CSV/JSON com fila e notificações.
- ⏳ Health-check pós-export no painel de status.

### Sprint Hardening PG + CSP
- 🔒 TLS no PostgreSQL: canário em mach1 (ssl=on + `PG_SSL=true`), rollout total após 24h sem incidentes.
- 🛡️ CSP global: middleware Helmet em `report-only`, coleta de violações, migração para enforce (sem `'unsafe-inline'`).
- 🧪 Diagnostics model: mover `SELECT 1`/`pg_stat_replication` para `models/diagnostics.js`, controllers apenas orquestram.
- 📝 Testes automatizados para garantir CSP em headers e que o app continua PG-only.

### Operação do Cluster
- 🔁 Exercitar failover automático (Pacemaker) após cada deploy.
- 📒 Documentar fallback local (`deploy-local.sh` + timers) para contingência.
- 🔐 Planejar revisão das políticas de login (MFA opcional, alertas de tentativa, bloqueio por IP).

---

## 🧠 FUTURO PRÓXIMO

### Sprint H — Templates Inteligentes
- 🧰 Modelos de recado por setor (checklist + etiquetas)
- 🧠 Sugestão de preenchimento com base em padrões anteriores

### Sprint I — Indicadores Avançados
- 📈 Dashboard com histórico e evolução semanal
- 🔁 Ciclo de melhoria contínua por setor (gargalos e plano de ação)

### Sprint J — Integração e API Pública
- 🔗 API REST externa documentada para parceiros
- ✉️ Webhook para notificações outbound
- 🔒 Tokens com escopo restrito e auditoria de uso

---

### Sprint "Anexos & Evidências"
- 📎 Upload de imagens/PDFs no recado com quotas e retenção
- 🧾 Pré-visualização e log por usuário

### Sprint G — Operações de Plantão
- 🕐 Registro de turno (Log de Passagem de Plantão)
- ✅ Checklists de abertura/fechamento por setor
- 📌 Dashboard de plantão (tarefas pendentes + ocorrências)

## 🔐 SUGESTÕES FUTURAS

- MFA para administradores e alertas de tentativa de login (revisão pós-cluster)
- Notificação push para novo login
- SLA por tipo de recado
- Relatório de leitura de comunicados
- Dashboard pessoal por usuário

---

## 📌 COMO USAR O ROADMAP

- `/roadmap` exibe esta visão geral no sistema
- Atualizações semanais refletem status de sprints
- Cada sprint possui arquivos `.md` com ações e contexto

---

## 📚 REFERÊNCIAS

- `📊 LATE — Status Atual do Projeto.md`
- `📊 LATE — Resumo Executivo.md`
- `LATE_SPRINTS_EXECUTADAS.md`
- `LATE_SPRINTS_FUTURAS.md`
- `design_sistema.md`
- `AGENTS.md`

---

_Foco constante: Relacionamento, Responsabilidade, Resultado._
