Checklist Docs LATE (11/2025):
> Atualizado em 2025/11/12.

1. Fonte única: toda documentação versionada mora em `docs/**`. Atualize as seções pertinentes:
   - `docs/news/news.md` (mais recente no topo, inclui resumo + próximos passos);
   - `docs/manuals/manual-operacional.md` e demais handbooks em `docs/manuals/`;
   - Planejamento/roadmap/status em `docs/planning/*.md`, `docs/roadmap/LATE_roadmap.md`, `docs/status/*.md`;
   - Comunicados internos em `docs/comms/` e especificações em `docs/specs/`/`docs/tecnicos/`.
2. Ao mover conteúdo legado de `_reports/`, garanta que as referências internas (README, AGENTS, sprints) apontem para o novo caminho em `docs/**`.
3. Caso crie novos handbooks (ex.: troubleshooting), salve em `docs/manuals/` com versão/date no nome e cite a fonte no PR.
4. Execute `npm run docs:sync` para regenerar os parciais (`views/partials/manual-content.ejs`, `views/partials/news-content.ejs`). Se outras rotas passarem a usar docs, inclua o arquivo em `scripts/docs-sync.config.json`.
5. Valide `/news`, `/manual-operacional`, `/help` e `/roadmap` após o sync (local ou em preview) para garantir que o HTML refletiu o Markdown.
6. Rode `npm test -- dev-info` quando houver alterações que citem diagnósticos ou status operacional; anexe o resultado ao PR se for relevante.
7. Registre no commit/resumo quais documentos foram atualizados e sincronize PM2 (`pm2 reload ecosystem.config.js`) depois do deploy em cada nó.
