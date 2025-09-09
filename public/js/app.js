// public/js/app.js

// Utilitários
const Utils = {
  /**
   * Constrói um objeto Date no fuso local a partir de 'YYYY-MM-DD'.
   */
  _parseDate(dateString = '') {
    const [y, m, d] = dateString.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  },

  /**
   * Constrói um objeto Date no fuso local a partir de 'YYYY-MM-DDTHH:mm:ss'.
   */
  _parseDateTime(dateString = '') {
    const [datePart, timePart = ''] = dateString.split(/T| /);
    const [y, m, d] = datePart.split('-').map(Number);
    const [h = 0, min = 0, s = 0] = timePart.split(':').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, h, min, s);
  },

  formatDate(dateString) {
    const date = this._parseDate(dateString);
    return date.toLocaleDateString('pt-BR');
  },
  formatDateTime(dateString) {
    const date = this._parseDateTime(dateString);
    return date.toLocaleString('pt-BR');
  },
  formatDateForInput(dateString) {
    const date = this._parseDate(dateString);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },
  formatTimeForInput(timeString) {
    return timeString.substring(0, 5);
  },
  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  },
  getCurrentTime() {
    const now = new Date();
    return now.toTimeString().substring(0, 5);
  },
  truncateText(text, maxLength = 50) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },
  debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },
  escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

// Notificações e modais (mantidos conforme original)
const Modal = { /* … */ };


/**
 * Retorna o rótulo legível para cada situação
 */
function getSituacaoLabel(situacao) {
  const labels = { pendente: 'Pendente', em_andamento: 'Em Andamento', resolvido: 'Resolvido' };
  return labels[situacao] || situacao;
}

// Expõe globalmente
window.getSituacaoLabel = getSituacaoLabel;

// ─── INICIALIZAÇÃO LAZY ──────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("recadosRecentes")) {
    import("/js/dashboard.js")
      .then(mod => mod.initDashboard())
      .catch(err => console.error("Erro ao carregar módulo do dashboard", err));
  }
});

