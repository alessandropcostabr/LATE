// public/js/utils.js
// Comentários em pt-BR; identificadores em inglês.
// Este arquivo expõe Normalizer, Form, Loading (globais) e cuida APENAS dos cards do Dashboard.
// "Recados Recentes" é responsabilidade do public/js/app.js.

// ==== Normalizer ============================================================
const Normalizer = {
  stripAccents(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  },
  simplify(s) {
    return Normalizer.stripAccents(String(s || ""))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  },
  normalizeStatus(value) {
    if (!value) return value;
    const key = Normalizer.simplify(value);
    switch (key) {
      // pendente
      case "pendente":
      case "pend":
      case "novo":
      case "aberto":
      case "open":
      case "todo":
      case "pending":
        return "pending";
      // em andamento
      case "emandamento":
      case "andamento":
      case "inprogress":
      case "progress":
      case "ongoing":
      case "working":
      case "in_progress":
        return "in_progress";
      // resolvido
      case "resolvido":
      case "resolvida":
      case "concluido":
      case "concluida":
      case "finalizado":
      case "finalizada":
      case "fechado":
      case "done":
      case "ok":
      case "resolved":
        return "resolved";
      default:
        return value;
    }
  },
  toNullIfEmpty(v) {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  }
};

// ==== Form / Loading ========================================================
const Form = {
  getData(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      data[key] = typeof value === 'string' ? value.trim() : value;
    });
    return data;
  },

  /** Normaliza payload antes de enviar ao back */
  prepareRecadoPayload(data) {
    const out = { ...data };

    // Campos opcionais: vazio -> null
    out.sender_email  = Normalizer.toNullIfEmpty(out.sender_email);
    out.sender_phone  = Normalizer.toNullIfEmpty(out.sender_phone);
    out.callback_time = Normalizer.toNullIfEmpty(out.callback_time);
    out.notes         = Normalizer.toNullIfEmpty(out.notes);

    // Situação
    if (out.status !== undefined) {
      out.status = Normalizer.normalizeStatus(out.status);
    }

    // Mensagem obrigatória no back; se vier vazia, evita "null" na UI
    if (Object.prototype.hasOwnProperty.call(out, 'message')) {
      const msg = typeof out.message === 'string' ? out.message.trim() : out.message;
      out.message = msg || '(sem mensagem)';
    }

    return out;
  },

  // Alias de compatibilidade
  prepareMessagePayload(data) {
    return Form.prepareRecadoPayload(data);
  },

  validate(form) {
    const errors = [];
    form.querySelectorAll('[required]').forEach(field => {
      if (!String(field.value || '').trim()) {
        const label = field.dataset.label || field.name || 'Campo';
        errors.push(`${label} é obrigatório`);
      }
    });
    form.querySelectorAll('input[type="email"]').forEach(field => {
      const val = String(field.value || '').trim();
      if (val && !Form.isValidEmail(val)) {
        const label = field.dataset.label || field.name || 'E-mail';
        errors.push(`${label} inválido`);
      }
    });
    return errors;
  },

  populate(form, data) {
    Object.keys(data || {}).forEach(key => {
      const field = form.querySelector(`[name="${key}"]`);
      if (!field) return;
      const val = data[key];
      field.value = val == null ? "" : val;
    });
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
  }
};

const Loading = {
  _resolveTarget(target) {
    return typeof target === 'string'
      ? document.getElementById(target)
      : target instanceof HTMLElement
        ? target
        : null;
  },
  show(target) {
    const btn = Loading._resolveTarget(target);
    if (!btn) return;
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="loading"></span> ${btn.textContent.trim()}`;
  },
  hide(target) {
    const btn = Loading._resolveTarget(target);
    if (!btn) return;
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.innerHTML = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
  }
};

// ==== Dashboard cards (somente) =============================================
(() => {
  // Evita rodar duas vezes
  if (window.__lateStatsInit) return;
  window.__lateStatsInit = true;

  const CARD_IDS = {
    total: 'totalRecados',
    pending: 'totalPendentes',
    in_progress: 'totalAndamento',
    resolved: 'totalResolvidos',
  };

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

  // cache simples para evitar 429
  const STATS_TTL_MS = 5000;
  let statsCache = { ts: 0, data: null };

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

  // Expor para debug manual (opcional)
  window.carregarEstatisticasDashboard = carregarEstatisticasDashboard;
})();

// Exporta globais esperados por outras telas
window.Normalizer = Normalizer;
window.Form = Form;
window.Loading = Loading;

