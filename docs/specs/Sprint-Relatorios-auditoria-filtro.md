# 📋 Draft — Filtro Avançado (`/relatorios/auditoria`)
> Atualizado em 2025/11/12.

Este rascunho detalha o Item 2 da proposta de UI para a rota `/relatorios/auditoria`: o filtro avançado que permite investigar eventos registrados em `event_logs`.

## 🎯 Objetivos

- Facilitar investigações pontuais (ex.: “quem resolveu recados do setor X hoje?”).
- Permitir combinação de múltiplos critérios mantendo resposta performática.
- Oferecer defaults seguros (“últimos 7 dias”) para evitar consultas caras.

## 🧩 Componentes do Filtro

| Campo | Tipo | Observações |
|-------|------|-------------|
| Período | seletor (7 dias / 30 dias / intervalo customizado) | campos `from` e `to` em ISO 8601; máximo sugerido: 90 dias. |
| Ator (Usuário) | autocomplete | usa `users` ativos; enviar `actor_user_id`. |
| Tipo de evento | multi-select | agrupar por prefixos (`message.*`, `user.*`, `automation.*`). |
| Entidade | select simples | `message`, `comment`, `user`, `automation`. |
| ID da entidade | texto | validação simples (UUID ou número). |
| Buscar no payload | input texto | faz `ILIKE` em `metadata::text` com escaping (cuidado com `%/_`). |

## ✅ Validações

- Datas: `from <= to`; intervalo máximo 90 dias.
- `limit`: padrão 50, máximo 500.
- `search`: escapar caracteres (`%`, `_`, `\`).
- `event_type`: aceitar prefixos com `*` (converte para `%`).
- Cursor: base64 de `created_at|id`.

## 🔄 Interação

1. Painéis carregam com filtros padrão (últimos 7 dias).
2. Ao expandir o filtro avançado, alterações disparam nova consulta (debounce 400 ms).
3. URL deve refletir filtros (`?from=...&event_type=message.status_changed`).
4. Botão “Limpar” retorna ao preset padrão.

## 📦 APIs Envolvidas

- `GET /api/event-logs`: respeita filtros acima, paginação por cursor.
- `GET /api/event-logs/summary`: usa mesmo conjunto de filtros para sincronizar cards/gráficos.

## 📌 Pendente / Futuro

- Filtros salvos por usuário.
- Exportação (`/relatorios/exportacoes`).
- Permitir combinação de múltiplos IDs de entidade.

> Referência principal: `docs/relatorios-auditoria-filtro.md`.
