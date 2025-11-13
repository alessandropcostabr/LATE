# Comunicado · 06/11/2025 — Auditoria leve disponível
> Atualizado em 2025/11/12.

## ✨ O que mudou
- A área **Relatórios** ganhou a aba **Auditoria**, exibindo cartões e listagem inicial alimentados pelos novos registros da tabela `event_logs`.
- Toda resolução de recado exige um comentário de follow-up, garantindo que o contexto fique registrado para auditoria e handoff.
- Eventos operacionais (criação, encaminhamento, mudanças de status, automations, login/logout) passam a gerar trilha leve automaticamente.

## 👥 Impacto para as equipes
- Supervisores e administradores podem acompanhar quem fez cada ação nos últimos dias sem precisar navegar recado por recado.
- O time passa a contar com histórico completo sempre que um recado é encerrado, facilitando revisões ou reaberturas.
- Alertas sobre sessões encerradas e logins simultâneos ficam registrados, reforçando a segurança.

## ✅ Checklist concluído
- Migração `event_logs` aplicada (DEV/PROD) e monitorada via PM2.
- Controllers atualizados para registrar as ações chave e exigir follow-up obrigatório.
- Novos testes cobrindo auditoria, logout e resolução com comentário.

## 🚀 Próximos passos
1. Evoluir a UI da aba Auditoria (cards dinâmicos, filtros salvos e drill-down completo).
2. Preparar exportação de eventos (CSV/JSON) com histórico por período.
3. Monitorar os primeiros dias de uso e ajustar alertas caso algum gancho de auditoria falhe.
