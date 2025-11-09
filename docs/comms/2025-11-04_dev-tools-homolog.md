## Atualização — Sprint 01 (Dev Tools) em homologação

> Sugestão de mensagem para compartilhar no canal `#late-dev`.

Olá, pessoal! 👋  
Avançamos na Sprint 01 — Dev Tools e entramos em fase de homologação. As principais entregas já estão disponíveis em DEV:

- CLI `node scripts/dev-info.js` com suporte a `--json` e `--output` (gera snapshot em arquivo);
- Endpoint autenticado `GET /api/debug/info` (apenas DEV/TEST), usando a mesma estrutura do CLI;
- Utilitário compartilhado `utils/devInfo.js`, que garante fechamento do pool e respostas padronizadas.

Como validar rapidamente:
- `node scripts/dev-info.js` e `node scripts/dev-info.js --json --output=diagnostics.json`;
- Login no DEV e `curl http://localhost:3001/api/debug/info` (deve exigir sessão e retornar JSON);
- Conferir `diagnostics.json` anexado ao chamado/PR, se gerado.

Documentação sincronizada:
- `docs/planning/LATE_SPRINTS_FUTURAS.md`
- `docs/status/LATE_Resumo_Executivo.md`
- `README.md`, `DEPLOY.md`, `docs/manuals/manual-operacional.md`

Próximos passos:
1. Rodar `npm run docs:sync` e atualizar parciais das rotas;
2. Executar `npm test -- dev-info` (novo teste automatizado);
3. Preparar agenda da Sprint 02 — Audit (trilhas de auditoria).

Qualquer achado durante a homologação, sinalizem no canal. Obrigado pelo apoio contínuo! 🚀
