# Esboço — Relatórios · Auditoria
> Atualizado em 2025/11/12.

> ✅ MVP entregue em 05/11/2025 (APIs + coleta). Próxima fase: Sprint 02B focada em UI e exportações.

> Objetivo: preparar a implementação da rota `/relatorios/auditoria` e da API correspondente.

## 1. API de Auditoria

### 1.1 Endpoints
- `GET /api/event-logs` — lista paginada com filtros.
- `GET /api/event-logs/:id` — detalhe opcional (metadados completos).
- `GET /api/event-logs/summary` — contagens agregadas por evento/período.

### 1.2 Filtros aceitos
- `from`, `to` (ISO date/time)
- `event_type` (multi, `message.*`, `user.*`, `automation.*`)
- `entity_type`, `entity_id`
- `actor_user_id`
- `search` (match em metadata JSON -> textual)
- `limit`, `cursor`/`page`

### 1.3 DTO de resposta (lista)
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "event_type": "message.status_changed",
        "entity_type": "message",
        "entity_id": "123",
        "actor_user": {
          "id": 10,
          "name": "João Silva"
        },
        "metadata": {
          "from": "pending",
          "to": "resolved"
        },
        "created_at": "2025-11-05T14:32:00Z"
      }
    ],
    "nextCursor": "opaque"
  }
}
```

### 1.4 Autorização
- Apenas `ADMIN` e `SUPERVISOR`.
- Middleware `requireRole('ADMIN', 'SUPERVISOR')` reutilizado nas rotas de relatórios.

### 1.5 Performance
- Índices existentes: `(event_type)`, `(entity_type, entity_id)`, `(actor_user_id)`, `(created_at DESC)`.
- Verificar necessidade de `GIN` em `metadata` para busca textual.

## 2. UI /relatorios/auditoria (Sprint 02B)

### 2.1 Estrutura inicial
- Painéis de resumo (cards) consumindo `/api/event-logs/summary`.
- Filtro colapsável com inputs baseados nos filtros da API.
- Tabela central com paginação e ação de expandir para ver metadata JSON formatada.
- Placeholder de gráficos (linha, heatmap, barras) alimentados pela mesma API.

### 2.2 Estados de carregamento / erro
- Skeleton nos cards e tabela.
- Aviso quando não houver dados no período selecionado.

### 2.3 Acessibilidade
- Navegação por teclado, tabela com headers `<th>`, botões com texto claro.

## 3. Roadmap técnico

1. ✅ Implementar `EventLogModel.listFiltered` com filtros e paginação.
2. ✅ Criar controller/rota REST (`eventLogsController`).
3. ⏳ Ajustar frontend (`public/js/relatorios-auditoria.js`) com fetch + renderização dos cards.
4. ⏳ Adicionar testes de UI (renderização da tabela/cards) após concluir a camada visual.
5. 🚧 Iteração futura: exportar CSV/JSON (Sprint Exportações).

## 4. Pendências / Decisões
- Definir limites padrão (ex.: 50 por página, máximo 500).
- Avaliar se auditoria deve mascarar dados sensíveis em metadata.
- Decidir formato final dos gráficos (Chart.js reaproveitado?).
- Definir SLA para consolidação de dados (hoje real time).

---

> Referências: `models/eventLog.js`, `utils/auditLogger.js`, `docs/relatorios-auditoria-filtro.md`.
