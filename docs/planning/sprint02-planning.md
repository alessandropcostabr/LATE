# Planejamento Sprint 02 — Audit Leve

**Status:** ✅ Concluída em 05/11/2025  
**Objetivo:** Consolidar trilhas de auditoria leves e garantir follow-up obrigatório na resolução de recados.

## ✅ Entregas concluídas
- Migration `event_logs` + helper `utils/auditLogger`.
- Hooks de auditoria para `message.created`, `message.status_changed`, `comment.created`, `user.login`, `automation.fired`, `user.logout`.
- Follow-up obrigatório (API + UI) com criação automática de comentário e auditoria associada.
- Suites de teste atualizadas (`automation-log`, `auth.logout`, `web.recados`, `password.flow`, `api.messages.*`) garantindo fixtures com `session_version`.
- Queries analíticas validadas para volume diário, transições de status e ações por usuário.

## ➡️ Pendências encaminhadas para Sprint 02B
- Construir UI completa da aba Auditoria (cards dinâmicos, filtros salvos e drill-down).
- Criar fluxo de exportação (CSV/JSON) e histórico de downloads.
- Monitorar logs em produção e ajustar ganchos (automations, login/logout) conforme feedback.

## ⚠️ Riscos / Observações
- Necessário validar manualmente `/relatorios`, `/manual-operacional`, `/help`, `/roadmap` após sincronização dos parciais.
- Comunicar às equipes o novo fluxo de follow-up obrigatório antes do deploy em produção.

## ✅ Checklist antes do merge
1. Rodar `npm run docs:sync` e publicar parciais atualizados.
2. Revisar manualmente as rotas `/news`, `/manual-operacional`, `/help`, `/roadmap`.
3. Executar `npm test -- dev-info`.
4. Registrar pendências na Sprint 02B e atualizar `/roadmap` com o novo escopo.
