// public/js/utils.js
// Comentários em pt-BR; identificadores em inglês.
// - Busca estatísticas uma única vez por carregamento (cache com TTL curto).
// - Preenche os cards do Dashboard se os elementos existirem.

(() => {
  if (window.__lateStatsInit) return;
  window.__lateStatsInit = true;

  const CARD_IDS = {
    total: 'totalRecados',
    pending: 'totalPendentes',
    in_progress: 'totalAndamento',
    resolved: 'totalResolvidos',
  };

  // Cache simples para evitar chamadas duplicadas (evita 429)
  const STATS_TTL_MS = 5000; // 5s de vida
  let statsCache = { ts: 0, data: null };

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };

  const setAllCards = (d) => {
    setText(CARD_IDS.total, d?.total ?? '-');
    setText(CARD_IDS.pending, d?.pending ?? '-');
    setText(CARD_IDS.in_progress, d?.in_progress ?? '-');
    setText(CARD_IDS.resolved, d?.resolved ?? '-');
  };

  async function fetchStatsOnce() {
    const now = Date.now();
    if (statsCache.data && (now - statsCache.ts) < STATS_TTL_MS) {
      return statsCache.data;
    }
    const resp = await fetch('/api/messages/stats', { credentials: 'include' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (!json || json.success !== true || !json.data) {
      throw new Error('JSON inválido de /api/messages/stats');
    }
    statsCache = { ts: now, data: json.data };
    return json.data;
  }

  async function carregarEstatisticasDashboard() {
    try {
      const data = await fetchStatsOnce();
      setAllCards(data);
    } catch (err) {
      console.error('[dashboard] erro ao carregar estatísticas:', err);
      setAllCards({ total: '-', pending: '-', in_progress: '-', resolved: '-' });
    }
  }

  // Dispara automaticamente no Dashboard (se os elementos existirem)
  document.addEventListener('DOMContentLoaded', () => {
    const hasCards =
      document.getElementById(CARD_IDS.total) ||
      document.getElementById(CARD_IDS.pending) ||
      document.getElementById(CARD_IDS.in_progress) ||
      document.getElementById(CARD_IDS.resolved);

    if (hasCards) carregarEstatisticasDashboard();
  });

  // Expor para debug manual no console
  window.carregarEstatisticasDashboard = carregarEstatisticasDashboard;
})();

