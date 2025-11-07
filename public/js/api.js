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

    if (typeof document !== 'undefined') {
      const meta = document.querySelector('meta[name="csrf-token"]');
      const hidden = document.querySelector('input[name="_csrf"]');
      const token = meta?.getAttribute('content') || hidden?.value;
      if (token && !opts.headers['X-CSRF-Token']) {
        opts.headers['X-CSRF-Token'] = token;
      }
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
      const msg = body?.error || body?.data?.message || body?.message || body?.erro || body?.mensagem || `Falha na requisição (${res.status})`;
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

  async function forwardMessage(id, data) {
    return request(`/messages/${encodeURIComponent(id)}/forward`, { method: 'POST', data });
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

  async function addMessageLabel(messageId, label) {
    return request(`/messages/${encodeURIComponent(messageId)}/labels`, {
      method: 'POST',
      data: { label },
    });
  }

  async function removeMessageLabel(messageId, label) {
    return request(`/messages/${encodeURIComponent(messageId)}/labels/${encodeURIComponent(label)}`, {
      method: 'DELETE',
    });
  }

  async function createChecklist(messageId, data) {
    return request(`/messages/${encodeURIComponent(messageId)}/checklists`, {
      method: 'POST',
      data,
    });
  }

  async function updateChecklist(messageId, checklistId, data) {
    return request(`/messages/${encodeURIComponent(messageId)}/checklists/${encodeURIComponent(checklistId)}`, {
      method: 'PUT',
      data,
    });
  }

  async function removeChecklist(messageId, checklistId) {
    return request(`/messages/${encodeURIComponent(messageId)}/checklists/${encodeURIComponent(checklistId)}`, {
      method: 'DELETE',
    });
  }

  async function createChecklistItem(messageId, checklistId, data) {
    return request(`/messages/${encodeURIComponent(messageId)}/checklists/${encodeURIComponent(checklistId)}/items`, {
      method: 'POST',
      data,
    });
  }

  async function updateChecklistItem(messageId, checklistId, itemId, data) {
    return request(`/messages/${encodeURIComponent(messageId)}/checklists/${encodeURIComponent(checklistId)}/items/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      data,
    });
  }

  async function removeChecklistItem(messageId, checklistId, itemId) {
    return request(`/messages/${encodeURIComponent(messageId)}/checklists/${encodeURIComponent(checklistId)}/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    });
  }

  async function createComment(messageId, data) {
    return request(`/messages/${encodeURIComponent(messageId)}/comments`, {
      method: 'POST',
      data,
    });
  }

  async function removeComment(messageId, commentId) {
    return request(`/messages/${encodeURIComponent(messageId)}/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
    });
  }

  async function addWatcher(messageId, userId) {
    return request(`/messages/${encodeURIComponent(messageId)}/watchers`, {
      method: 'POST',
      data: { userId },
    });
  }

  async function removeWatcher(messageId, userId) {
    return request(`/messages/${encodeURIComponent(messageId)}/watchers/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  }

  async function getEventLogs(params = {}) {
    return request('/event-logs' + buildQuery(params));
  }

  async function getEventLogsSummary(params = {}) {
    return request('/event-logs/summary' + buildQuery(params));
  }

  async function getEventLog(id) {
    return request(`/event-logs/${encodeURIComponent(id)}`);
  }

  return {
    request,
    createMessage,
    listMessages,
    getMessage,
    updateMessage,
    forwardMessage,
    deleteMessage,
    updateMessageStatus,
    getMessageStats,
    listRecentMessages,
    addMessageLabel,
    removeMessageLabel,
    createChecklist,
    updateChecklist,
    removeChecklist,
    createChecklistItem,
    updateChecklistItem,
    removeChecklistItem,
    createComment,
    removeComment,
    addWatcher,
    removeWatcher,
    getEventLogs,
    getEventLogsSummary,
    getEventLog,

    // aliases temporários para compatibilidade
    createRecado: createMessage,
    listarRecados: listMessages,
    obterRecado: getMessage,
    atualizarRecado: updateMessage,
    excluirRecado: deleteMessage,
    getStats: getMessageStats,
    getRecadosRecentes: listRecentMessages,
    encaminharRecado: forwardMessage,
  };
})();

if (typeof window !== 'undefined') {
  window.API = API;
}
