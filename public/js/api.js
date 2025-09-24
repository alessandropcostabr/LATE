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
      body = { success: res.ok, error: `Resposta inválida do servidor (${res.status})` };
    }

    if (!res.ok) {
      // Propaga erro com mensagem do backend quando disponível
      const msg = body?.error || body?.message || body?.erro || body?.mensagem || `Falha na requisição (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    return body;
  }

  function buildQuery(params = {}) {
    const search = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      const value = params[key];
      if (value === undefined || value === null || value === '') return;
      search.append(key, value);
    });
    const qs = search.toString();
    return qs ? `?${qs}` : '';
  }

  // === Endpoints específicos ===

  async function createMessage(message) {
    return request('/messages', { method: 'POST', data: message });
  }

  async function listMessages(params = {}) {
    return request('/messages' + buildQuery(params));
  }

  async function getMessage(id) {
    return request(`/messages/${encodeURIComponent(id)}`);
  }

  async function updateMessage(id, data) {
    return request(`/messages/${encodeURIComponent(id)}`, { method: 'PUT', data });
  }

  async function deleteMessage(id) {
    return request(`/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async function updateMessageStatus(id, status) {
    const payload = typeof status === 'object' && status !== null ? status : { status };
    return request(`/messages/${encodeURIComponent(id)}/status`, { method: 'PATCH', data: payload });
  }

  async function getMessageStats() {
    return request('/messages/stats');
  }

  async function listRecentMessages(limit = 10) {
    return listMessages({ limit });
  }

  return {
    request,
    createMessage,
    listMessages,
    getMessage,
    updateMessage,
    deleteMessage,
    updateMessageStatus,
    getMessageStats,
    listRecentMessages,

    // aliases temporários para compatibilidade
    createRecado: createMessage,
    listarRecados: listMessages,
    obterRecado: getMessage,
    atualizarRecado: updateMessage,
    excluirRecado: deleteMessage,
    getStats: getMessageStats,
    getRecadosRecentes: listRecentMessages,
  };
})();

if (typeof window !== 'undefined') {
  window.API = API;
}

