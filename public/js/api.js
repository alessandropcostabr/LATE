// public/js/api.js
// Cliente HTTP simples para a API do LATE.
// Por quê: centralizar fetch com JSON, headers e tratamento de erros em pt-BR.

const API = (() => {
  const base = '/api';

  async function request(path, { method = 'GET', data, headers = {} } = {}) {
    const opts = {
      method,
      credentials: 'include', // envia/recebe cookie de sessão
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data !== undefined) {
      // Garante JSON válido
      opts.body = JSON.stringify(data);
    }

    const res = await fetch(base + path, opts);

    // Tenta decodificar como JSON; se falhar, cria um corpo padrão
    let body;
    try {
      body = await res.json();
    } catch (_e) {
      body = { sucesso: res.ok, erro: `Resposta inválida do servidor (${res.status})` };
    }

    if (!res.ok) {
      // Propaga erro com mensagem do backend quando disponível
      const msg = body?.erro || body?.mensagem || `Falha na requisição (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    return body;
  }

  // === Endpoints específicos ===

  async function createRecado(recado) {
    return request('/recados', { method: 'POST', data: recado });
  }

  async function listarRecados(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request('/recados' + (qs ? `?${qs}` : ''));
  }

  async function obterRecado(id) {
    return request(`/recados/${encodeURIComponent(id)}`);
  }

  async function atualizarRecado(id, dados) {
    return request(`/recados/${encodeURIComponent(id)}`, { method: 'PUT', data: dados });
  }

  async function excluirRecado(id) {
    return request(`/recados/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  return {
    createRecado,
    listarRecados,
    obterRecado,
    atualizarRecado,
    excluirRecado
  };
})();

if (typeof window !== 'undefined') {
  window.API = API;
}

