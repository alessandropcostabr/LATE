# 📊 LATE — Status Atual do Projeto

**Data:** 08/11/2025  
**Versão:** 2.0.1  
**Ambiente:** Desenvolvimento (late-dev) + Produção (late-prod)

---

## 🎯 Resumo Executivo

O projeto LATE entrou na **fase de Auditoria 02B**, com o painel “Status Operacional” liberado, deploy automatizado via GitHub → Ansible e PM2 rodando em modo cluster nos três nós. Auditoria leve e sessão única já estão em produção; agora o foco é finalizar exportações e anexos.

### Status Geral

| Aspecto | Status | Observação |
|---------|--------|------------|
| **Produção** | ✅ Estável | Status Operacional habilitado, auditoria leve em uso |
| **Desenvolvimento** | ✅ Ativo | Sprint 02B (exportações) em andamento |
| **Banco de Dados** | ✅ Sincronizado | Primário em `mach3`, replicas `mach1/mach2` saudáveis |
| **Testes** | ✅ Passando | `npm test -- __tests__/api.status.test.js` + suite completa |
| **Deploy** | ✅ Automatizado | Workflow GitHub → bastion → Ansible/PM2 cluster |
| **Sincronização** | ✅ Completa | `develop` = `main` após PR #268 |

---

## 📦 Versões das Branches

### Branch `main` (Produção)
- **Último commit:** `1fcdc26` - "feat: status report + deploy automation (PR #268)"
- **Data:** 08/11/2025
- **PRs incluídas:** #265, #266, #268 (auditoria leve + status + workflow)

### Branch `develop` (Desenvolvimento)
- **Último commit:** `d7e7d0b` - "Merge branch 'origin/main' into develop"
- **Data:** 08/11/2025
- **PRs incluídas:** Mesmas de `main` (sincronizado)

### Diferença entre Branches

✅ **Branches sincronizadas!**

- Deploy automático estreado na PR #268.
- Status Operacional e workflow já estão em `main` e `develop`.
- Próximos commits devem focar em exportações e anexos.

---

## ✅ Sprints Executadas

### Sprint 0 — Infra, Segurança e Contrato
**Status:** ✅ Concluída  
**Data:** Out/2025

**Entregas:**
- Organização de worktrees (`late-prod`/`late-dev`)
- Configuração de `.env` dedicados
- Hardening de segurança (Helmet, CSRF, rate-limit)
- Padronização de contrato JSON
- Scripts operacionais (`migrate`, `seed-admin`)

---

### Sprint A — Labels, Checklists, Comments, Watchers, Automations
**Status:** ✅ Concluída  
**Data:** Out/2025

**Entregas:**
- ✅ Migrations para `message_labels`, checklists, checklist items, comentários, watchers
- ✅ Controllers/Models implementados
- ✅ Automação inicial (`automations`, `automation_logs`)
- ✅ Testes de API com RBAC

**Migrations:**
- `20251201_sprint_a_artifacts.sql`

---

### Sprint B — Vistas (Kanban/Calendário) e Widgets
**Status:** ✅ Concluída  
**Data:** Out/2025

**Entregas:**
- ✅ Views EJS para Kanban e Calendário
- ✅ Filtros por setor/label
- ✅ Widgets de dashboard (Hoje, Atrasados, SLA 48h)
- ✅ Consultas otimizadas
- ✅ RBAC refletido nas telas

---

### Sprint C — Notificações & Intake
**Status:** ✅ Concluída  
**Data:** Out/2025

**Entregas:**
- ✅ Endpoint `POST /api/intake` com token
- ✅ Fila de e-mails (`email_queue`)
- ✅ Worker PM2 (`scripts/email-worker.js`)
- ✅ Templates pt-BR reutilizáveis
- ✅ Notificações por evento (novo, @menção, resolvido, vencendo)
- ✅ Suite de testes expandida

**Migrations:**
- `20251205_notifications_intake.sql`

---

### Sprint D — Relacionamento
**Status:** ✅ Concluída  
**Data:** Out/2025

**Entregas:**
- ✅ Log de interações por contato (telefone/email)
- ✅ Verificação de registros anteriores
- ✅ Campo `parent_message_id`
- ✅ Nova rota `/contatos/:phone/historico`
- ✅ Nova rota `/contatos/email/historico`
- ✅ Tabela `contacts` com backfill automático

**Migrations:**
- `20251211_add_parent_message_id_to_messages.sql`
- `20251212_create_contacts.sql`

---

## 🐛 Correções Recentes (Pós-Sprint D)

### PR #248 - Correções UX Histórico e Etiquetas
**Status:** ✅ Mergeada (31/10/2025)

**Mudanças:**
- Middleware de erro corrigido
- Histórico adicionado em visualizar-recado
- Tradução "Label" → "Etiqueta"

---

### PR #249 - View 500.ejs
**Status:** ✅ Mergeada (31/10/2025)

**Mudanças:**
- Criada view `500.ejs` para erros internos
- Middleware de erro atualizado para renderizar view

---

### PR #251 - Duplicação de Link e Erro 500
**Status:** ✅ Mergeada (31/10/2025)

**Mudanças:**
- Removida duplicação do link "Ver histórico completo"
- Adicionada rota `/contatos/email/historico`
- Controller aceita placeholder `'email'`
- Corrigido erro 500 para registros sem telefone

---

### PR #253 - Middleware de Erro e Botão Voltar
**Status:** ✅ Mergeada (01/11/2025)

**Mudanças:**
- Middleware passa stack trace completo em desenvolvimento
- Botão "Voltar" corrigido (onclick ao invés de href)
- Fallback para `err.message` ou `String(err)`

---

### PR #254 - Redesign Login com bg_LATE.png
**Status:** ✅ Mergeada (01/11/2025)

**Mudanças:**
- Arte personalizada `bg_LATE.png` (33KB)
- Background da hero com ilustrações geométricas
- Card glassmorphism com blur
- Paleta atualizada (verde água, azul claro, roxo, verde limão)
- CSS minificado regenerado

---

### PR #256 - Ajuste Posição Card Login
**Status:** ✅ Mergeada (01/11/2025)

**Mudanças:**
- Card movido para canto inferior direito
- Tamanho reduzido (280px)
- Arte totalmente visível

---

### PR #257 - Escopo Hero Layout Apenas Login
**Status:** ✅ Mergeada (01/11/2025)  
**Pendente:** Merge `develop → main`

**Mudanças:**
- Classe `.auth-hero-login` adicionada
- Estilos específicos apenas para login
- Páginas password-reset e password-recover restauradas (layout centralizado)
- Resolve feedback do Codex Review

---

## 🗄️ Migrations Aplicadas

| Migration | Descrição | Status |
|-----------|-----------|--------|
| `20251110_add_password_reset_tokens.sql` | Tokens de reset de senha | ✅ |
| `20251112_add_messages_creator.sql` | Campo creator em messages | ✅ |
| `20251113_add_message_events.sql` | Eventos de mensagens | ✅ |
| `20251114_create_notification_settings.sql` | Configurações de notificação | ✅ |
| `20251115_create_message_alerts.sql` | Alertas de mensagens | ✅ |
| `20251201_sprint_a_artifacts.sql` | Labels, checklists, comments, watchers | ✅ |
| `20251205_notifications_intake.sql` | Fila de e-mails e intake | ✅ |
| `20251210_add_callback_at.sql` | Campo callback_at | ✅ |
| `20251211_add_parent_message_id_to_messages.sql` | Relacionamento entre mensagens | ✅ |
| `20251212_create_contacts.sql` | Tabela contacts + backfill | ✅ |

---

## 🎨 Redesign de Login

### Implementação Atual

**Arquivos:**
- `public/assets/bg_LATE.png` (33KB)
- `public/css/style.css` (atualizado)
- `public/css/style.min.css` (regenerado)
- `views/login.ejs` (classe `.auth-hero-login`)

**Características:**
- 🎨 Arte personalizada com animais geométricos, mensagens e documentos
- 💎 Card glassmorphism semi-transparente
- 🌊 Gradiente verde água no fundo
- 📱 Responsivo (mobile esconde a hero)
- ♿ Acessível (contraste adequado)

**Layout:**
- Desktop: Formulário (esquerda) + Arte (direita)
- Card pequeno (280px) no canto inferior direito
- Arte totalmente visível no centro e topo

---

## 🔧 Ambiente de Desenvolvimento

### Worktrees

```
~/LATE/              # Repositório base (não usar para desenvolvimento)
~/late-dev/          # Worktree develop (porta 3001)
~/late-prod/         # Worktree main (porta 3000)
```

### Variáveis de Ambiente

**DEV (`.env.dev`):**
```ini
NODE_ENV=development
PORT=3001
TRUST_PROXY=0
PGDATABASE=late_dev
```

**PROD (`.env.prod`):**
```ini
NODE_ENV=production
PORT=3000
TRUST_PROXY=1
PGDATABASE=late_prod
PG_SSL=1
```

### PM2 Processes

| Nome | Worktree | Branch | Porta | Status |
|------|----------|--------|-------|--------|
| `late-dev` | ~/late-dev | develop | 3001 | ✅ Rodando |
| `late-prod` | ~/late-prod | main | 3000 | ✅ Rodando |

---

## 📋 Próximas Ações Recomendadas

### Imediato (Hoje)

1. **Monitorar painel Status Operacional**  
   - Validar latência do banco após failover e se o VIP/Túnel permanecem verdes.  
   - Registrar no Slack qualquer pico de CPU ou memória detectado pelo Prometheus.

2. **Executar workflow `Deploy Cluster` sempre que `main` receber merge**  
   - O pipeline já sincroniza `infra/deploy` e chama o playbook; acompanhe os logs do Actions + ansible para confirmar que mach1-3 ficaram como `changed=X`.

### Curto Prazo (Esta Semana)

1. **Finalizar Sprint 02B**: exportações CSV/JSON + cards e filtros salvos em Auditoria.
2. **Documentar e priorizar uploads de anexos nos recados** (definir limites, storage e retenção).
3. **Planejar revisão de segurança de login pós-cluster** (alertas de tentativas falhas, bloqueio por IP suspeito, MFA opcional).

### Médio Prazo (Este Mês)

1. **Expandir notificações (Sprint 04)** e revisar preferências por usuário.
2. **Iniciar módulo de anexos e memória operacional** alinhado ao roadmap.
3. **Rodar bateria extra de testes (`npm test -- dev-info` + `npm test -- report-export`) após concluir exportações.**

---

## 🎯 Indicadores de Saúde

| Indicador | Status | Observação |
|-----------|--------|------------|
| **Uptime PROD** | ✅ 99.9% | Estável |
| **Uptime DEV** | ✅ 99.5% | Estável |
| **Testes Passando** | ✅ 100% | Suite completa |
| **Migrations Sync** | ✅ Sim | DEV e PROD sincronizados |
| **Branches Sync** | ⚠️ Quase | develop 1 commit à frente |
| **Documentação** | ✅ Atualizada | Este documento |

---

## 📚 Documentação Relacionada

- `roadmap_late.md` - Roadmap completo do projeto
- `sprints_executadas.md` - Histórico de sprints
- `sprints_futuras.md` - Backlog de evoluções
- `LATE-cheatsheet-dev-prod.md` - Comandos do dia a dia
- `Worktrees.odt` - Como trabalhar com worktrees

---

## 🎉 Conquistas Recentes

- ✅ **Sprint D completa** em produção
- ✅ **Redesign de login** implementado
- ✅ **Tabela contacts** criada e populada
- ✅ **Histórico de contatos** funcionando
- ✅ **Codex Reviews** resolvidos
- ✅ **Sistema estável** em ambos ambientes

---

**Próxima revisão:** Após merge de PR #257
