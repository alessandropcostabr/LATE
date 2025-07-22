// public/js/app.js

// Configurações globais
const API_BASE = '/api';

// Utilitários
const Utils = {
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  },
  formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  },
  formatDateForInput(dateString) {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
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

// Gerenciador de API
const API = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    };
    try {
      const res = await fetch(url, config);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Erro na requisição');
      return json;
    } catch (err) {
      console.error('Erro na API:', err);
      throw err;
    }
  },

  // Listagem completa de recados (com filtros e paginação)
  async getRecados(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const endpoint = `/recados${params ? `?${params}` : ''}`;
    return this.request(endpoint);
  },

  async getRecado(id) { return this.request(`/recados/${id}`); },
  async createRecado(data) { return this.request(`/recados`, { method: 'POST', body: JSON.stringify(data) }); },
  async updateRecado(id, data) { return this.request(`/recados/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async updateSituacao(id, situacao) { return this.request(`/recados/${id}/situacao`, { method: 'PATCH', body: JSON.stringify({ situacao }) }); },
  async deleteRecado(id) { return this.request(`/recados/${id}`, { method: 'DELETE' }); },

  // Estatísticas pro Dashboard
  async getStats() { return this.request('/stats/dashboard'); },
  async getStatsByDestinatario() { return this.request('/stats/por-destinatario'); },

  // Recados recentes pro Dashboard
  async getRecadosRecentes(limit = 10) { return this.request(`/recados-recentes?limit=${limit}`); }
};

// Notificações e modais (mantidos conforme original)
const Toast = { error: msg => console.error(msg) };
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

