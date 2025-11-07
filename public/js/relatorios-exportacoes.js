(function exportModule(global) {
  const AUTO_INIT_DISABLED = Boolean(global.__LATE_DISABLE_EXPORT_AUTO_INIT__);
  const state = {
    history: [],
    interval: null,
  };

  function getToast() {
    return global.Toast || {
      success: (msg) => alert(msg),
      error: (msg) => alert(msg),
      info: (msg) => alert(msg),
    };
  }

  function serializeForm(form) {
    const data = {};
    const formData = new FormData(form);
    formData.forEach((value, key) => {
      if (value === undefined || value === null || value === '') return;
      data[key] = value;
    });
    return data;
  }

  async function submitExport(url, payload, button) {
    if (button) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = 'Enviando...';
    }

    try {
      const response = await API.request(url, {
        method: 'POST',
        data: payload,
      });
      getToast().success('Exportação agendada com sucesso.');
      await refreshHistory();
      return response;
    } catch (err) {
      getToast().error(err?.message || err?.body?.error || 'Falha ao agendar exportação.');
      throw err;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Enviar';
      }
    }
  }

  async function refreshHistory() {
    try {
      const response = await API.request('/report-exports?limit=30');
      state.history = Array.isArray(response?.data) ? response.data : [];
      renderHistory();
    } catch (err) {
      console.error('[exports] falha ao carregar histórico', err);
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
    } catch (_err) {
      return value;
    }
  }

  function formatStatus(status) {
    const map = {
      pending: 'Pendente',
      processing: 'Processando',
      completed: 'Concluído',
      failed: 'Erro',
      expired: 'Expirado',
    };
    return map[status] || status;
  }

  function formatType(type) {
    if (type === 'messages') return 'Registros';
    if (type === 'event_logs') return 'Auditoria';
    return type;
  }

  function renderHistory() {
    const tbody = document.getElementById('exportHistoryTable');
    if (!tbody) return;

    if (!state.history.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-muted text-center">Nenhuma exportação encontrada.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = state.history
      .map((item) => {
        const canDownload = item.downloadUrl && item.status === 'completed';
        return `
          <tr>
            <td>${formatType(item.export_type)}</td>
            <td>${(item.format || '').toUpperCase()}</td>
            <td><span class="badge status-badge status-${item.status}">${formatStatus(item.status)}</span></td>
            <td>${formatDate(item.created_at)}</td>
            <td>${formatDate(item.completed_at)}</td>
            <td>
              ${canDownload ? `<a class="btn btn-sm btn-outline-primary" href="${item.downloadUrl}">Baixar</a>` : '<span class="text-muted">—</span>'}
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function bindForms() {
    const auditForm = document.getElementById('exportAuditForm');
    const messageForm = document.getElementById('exportMessagesForm');

    if (auditForm) {
      auditForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const payload = serializeForm(auditForm);
        submitExport('/event-logs/export', payload, auditForm.querySelector('button[type="submit"]')).catch(() => {});
      });
    }

    if (messageForm) {
      messageForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const payload = serializeForm(messageForm);
        submitExport('/messages/export', payload, messageForm.querySelector('button[type="submit"]')).catch(() => {});
      });
    }

    const refreshButton = document.getElementById('exportHistoryRefresh');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => refreshHistory());
    }
  }

  async function init() {
    bindForms();
    await refreshHistory();
    state.interval = setInterval(refreshHistory, 20000);
    return true;
  }

  if (!AUTO_INIT_DISABLED && typeof document !== 'undefined') {
    const boot = () => {
      init().catch((err) => console.error('[exports] falha ao iniciar página', err));
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }

  global.LATE = global.LATE || {};
  global.LATE.reportExports = { init };
})(typeof window !== 'undefined' ? window : globalThis);
