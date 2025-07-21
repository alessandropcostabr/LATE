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

// ─── FUNÇÕES DE DASHBOARD COMPARTILHADAS ───────────────────────────────────────

/**
 * Busca e renderiza as estatísticas gerais de recados
 */
async function carregarEstatisticas() {
  try {
    const { data: stats } = await API.getStats();
    document.getElementById('totalRecados').textContent    = stats.total ?? '-';
    document.getElementById('totalPendentes').textContent  = stats.pendente ?? '-';
    document.getElementById('totalAndamento').textContent  = stats.em_andamento ?? '-';
    document.getElementById('totalResolvidos').textContent = stats.resolvido ?? '-';
  } catch {
    Toast.error('Erro ao carregar estatísticas');
  }
}

/**
 * Busca e renderiza os recados mais recentes (limite default = 10)
 */
async function carregarRecadosRecentes(limit = 10) {
  const container = document.getElementById('recadosRecentes');
  if (!container) return;

  try {
    const { data: recados } = await API.getRecadosRecentes(limit);

    if (!recados.length) {
      container.innerHTML = `
        <div class="no-data" style="text-align:center;padding:2rem;color:var(--text-secondary);">
          📝 Nenhum recado encontrado
        </div>`;
      return;
    }

    // Montagem da tabela (igual ao código anterior)
    const rows = recados.map(recado => `
      <tr>
        <td>
          <div style="font-weight:500;">${Utils.formatDate(recado.data_ligacao)}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);">${Utils.escapeHTML(recado.hora_ligacao)}</div>
        </td>
        <td style="font-weight:500;">${Utils.escapeHTML(recado.destinatario)}</td>
        <td>${Utils.escapeHTML(recado.remetente_nome)}</td>
        <td>${Utils.escapeHTML(Utils.truncateText(recado.assunto, 40))}</td>
        <td>
          <span class="badge badge-${recado.situacao.replace('_','')}">
            ${getSituacaoLabel(recado.situacao)}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:0.5rem;">
            <a href="/visualizar-recado/${recado.id}" class="btn btn-outline btn-sm">👁️</a>
            <a href="/editar-recado/${recado.id}" class="btn btn-outline btn-sm">✏️</a>
          </div>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <caption class="sr-only">Recados Recentes</caption>
          <thead>
            <tr><th>Data/Hora</th><th>Destinatário</th><th>Remetente</th><th>Assunto</th><th>Situação</th><th>Ações</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch {
    Toast.error('Erro ao carregar recados recentes');
  }
}

/**
 * Retorna o rótulo legível para cada situação
 */
function getSituacaoLabel(situacao) {
  const labels = { pendente: 'Pendente', em_andamento: 'Em Andamento', resolvido: 'Resolvido' };
  return labels[situacao] || situacao;
}

// Expõe globalmente
window.carregarEstatisticas     = carregarEstatisticas;
window.carregarRecadosRecentes = carregarRecadosRecentes;

// ─── INICIALIZAÇÃO AUTOMÁTICA ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Filtros rápidos (Dashboard)
  const btnHoje   = document.getElementById('btnHoje');
  const btnSemana = document.getElementById('btnSemana');
  if (btnHoje && btnSemana) {
    const hoje        = Utils.getCurrentDate();
    const semanaAtras = new Date();
    semanaAtras.setDate(semanaAtras.getDate() - 7);
    const semanaStr = semanaAtras.toISOString().split('T')[0];
    btnHoje.href   = `/recados?data_inicio=${hoje}&data_fim=${hoje}`;
    btnSemana.href = `/recados?data_inicio=${semanaStr}&data_fim=${hoje}`;
  }

  // Dashboard: estatísticas e recados recentes
  if (document.getElementById('recadosRecentes')) {
    carregarEstatisticas();
    carregarRecadosRecentes();
    setInterval(() => {
      carregarEstatisticas();
      carregarRecadosRecentes();
    }, 30000);
  }
});
