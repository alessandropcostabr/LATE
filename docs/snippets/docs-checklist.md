# Checklist Docs LATE (12/2025)

## 1. Fonte única
Toda documentação versionada mora em `docs/**`. Atualize as seções pertinentes:

| Tipo | Localização | Observação |
|------|-------------|------------|
| Novidades | `docs/news/news.md` | Mais recente no topo; linguagem comercial, simples e objetiva |
| Manuais | `docs/manuals/manual-operacional.md` | Handbooks em `docs/manuals/` |
| Planejamento | `docs/planning/*.md` | Sprints executadas e futuras |
| Roadmap | `docs/roadmap/LATE_roadmap.md` | Linguagem comercial, sem variáveis técnicas |
| Status | `docs/status/*.md` | Status atual e resumo executivo |
| CRM | `docs/LATE_CRM.md` | Visão completa do módulo CRM |
| Integrações | `docs/LATE_message_events.md` | WhatsApp Sender, Telefonia |
| Comunicados | `docs/comms/` | Comunicados internos |
| Especificações | `docs/specs/`, `docs/tecnicos/` | Documentação técnica |

## 2. Novos documentos
Ao criar novos handbooks (ex.: troubleshooting), salve em `docs/manuals/` com versão/data no nome e cite a fonte no PR.

## 3. Sincronização
Execute `npm run docs:sync` para regenerar os parciais:
- `views/partials/manual-content.ejs`
- `views/partials/news-content.ejs`

Se outras rotas passarem a usar docs, inclua o arquivo em `scripts/docs-sync.config.json`.

## 4. Validação
Após o sync, valide as rotas (local ou preview):
- `/news`
- `/manual-operacional`
- `/help`
- `/roadmap`

## 5. Testes
Rode `npm test -- dev-info` quando houver alterações que citem diagnósticos ou status operacional. Anexe o resultado ao PR se relevante.

## 6. Deploy
Registre no commit/resumo quais documentos foram atualizados. Após deploy, sincronize PM2:
```bash
pm2 reload ecosystem.config.js
```

## 7. Linguagem
- **news.md** e **roadmap**: linguagem comercial, não técnica
- Não expor variáveis de ambiente ou explicações longas
- Seja simples e objetivo
