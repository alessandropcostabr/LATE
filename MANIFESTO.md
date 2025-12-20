# Manifesto LATE
_Atualizado em 20 de dezembro de 2025_

Princípios operacionais e de engenharia do LATE:

1. **KISS sempre** — solução mais simples que funcione e seja fácil de manter.
2. **Boring tech vence** — stack enxuta e conhecida; nada de complexidade “só porque dá”.
3. **PostgreSQL é a fonte de verdade** — consistência e rastreabilidade antes de atalhos.
4. **API é contrato** — endpoints retornam JSON apenas; erros padronizados.
5. **Segurança por padrão** — sessão segura, CSRF, rate-limit, CORS restrito, mínimo privilégio.
6. **Separação clara** — rotas → controllers → models (SQL no model); middlewares fazem o corte transversal.
7. **Convenções > opinião** — código/identificadores em inglês; UX/mensagens em pt-BR.
8. **Deploy repetível** — produção previsível, automatizada e auditável.
9. **Resiliência real** — falha acontece; degradar com dignidade e recuperar rápido.
10. **Métrica e auditoria sem burocracia** — observar o essencial, registrar o importante, painel útil.
11. **UI consistente e reaproveitável** — layout padrão e partials EJS, evitando duplicação sem aprovação.
