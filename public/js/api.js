// public/js/api.js

const API_BASE = '/api';

const API = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options };
    try {
      const res = await fetch(url, config);
      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw { message: `Resposta do servidor não é JSON: ${text}` };
      }
      if (!res.ok) {
        throw { message: data.message || 'Erro na requisição', details: data.errors || data.details };
      }
      return data;
    } catch (err) {
      console.error('Erro na API:', err);
      throw err;
    }
  },

  async getRecados(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/recados${params ? `?${params}` : ''}`);
  },
  async getRecado(id) { return this.request(`/recados/${id}`); },
  async createRecado(data) { return this.request(`/recados`, { method: 'POST', body: JSON.stringify(data) }); },
  async updateRecado(id, data) { return this.request(`/recados/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async updateSituacao(id, situacao) { return this.request(`/recados/${id}/situacao`, { method: 'PATCH', body: JSON.stringify({ situacao }) }); },
  async deleteRecado(id) { return this.request(`/recados/${id}`, { method: 'DELETE' }); },
  async getStats() { return this.request('/stats'); },
  async getStatsByDestinatario() { return this.request('/stats/por-destinatario'); },
  async getRecadosRecentes(limit = 10) { return this.request(`/recados-recentes?limit=${limit}`); }
};

window.API = API;

