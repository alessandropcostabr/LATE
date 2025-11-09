## Planejamento Sprint 01 — Dev Tools
**Data alvo da planning:** 05/11/2025 (quarta-feira)  
**Duração sugerida:** 45 minutos  
**Participantes:** Produto, Engenharia (backend + frontend), QA, Operações

### Agenda proposta
1. **Check-in rápido (5 min)**
   - Revisão dos aprendizados da Sprint 00-PRE
   - Riscos/ouvidos de produção após hardening
2. **Objetivos da Sprint 01 (10 min)**
   - CLI `scripts/dev-info.js` com flags `--json` e `--output`
   - Endpoint `/api/debug/info` (DEV/TEST, autenticado via `requireAuth`)
   - Utilitário compartilhado `utils/devInfo.js` (pool-safe + JSON padronizado)
3. **Divisão de trabalho (15 min)**
   - Owners por entrega
   - Critérios de aceite e cobertura de testes
   - Responsáveis por docs sync e validação manual do endpoint
4. **Dependências e riscos (10 min)**
   - Acesso a secrets/test doubles
   - Impacto em pipelines e ambientes (usar pool factory para testes)
   - Geração de snapshots JSON em ambientes compartilhados
5. **Próximos passos e cerimônias (5 min)**
   - Confirmação de daily/retro
   - Alinhamento com suporte/ops

### Preparação pré-planning
- [x] Revisar backlog da Sprint 01 em `docs/planning/LATE_SPRINTS_FUTURAS.md`
- [ ] Levantar cenários de QA para CLI e endpoint (`__tests__/dev-info.test.js` como base)
- [ ] Validar disponibilidade do time (feriados/férias)
- [x] Atualizar métricas recentes (logs do security-check, uso do intake, métricas no Resumo Executivo)

---

## Refinamento Sprint E — Sessão Única

### Objetivo do refinement
Alinhar implementação usando `session_version` em vez de tabela `user_sessions`, garantindo coerência com `express-session`.

### Pontos para discussão
- [ ] Confirmar requisitos de UX para mensagem de sessão invalidada.
- [ ] Decidir onde persistir IP / user-agent (auditoria leve).
- [ ] Revisar impactos em flows de reset/troca de senha e inativação.
- [ ] Validar se precisamos feature flag ou rollout gradual.
- [ ] Definir métricas/alertas para sessões derrubadas.

### Entradas necessárias
- Documento atualizado em `docs/planning/LATE_SPRINTS_FUTURAS.md` (sessão única).
- Documentação de suporte (`README.md`, `DEPLOY.md`, `docs/manuals/manual-operacional.md`) revisada com seção de diagnóstico.
- Logs recentes de login/logout para avaliar comportamento atual.
- Bordas identificadas por suporte (múltiplos dispositivos, mobile/desktop).
- Política de retenção de sessões (comparar com cookie 4h em `server.js`).

### Entregáveis pós-refinement
- Historinhas quebradas por componente (migration, middleware, controller, QA).
- Checklist de testes automatizados e manuais.
- Plano de comunicação para usuários afetados.
