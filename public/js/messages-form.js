// public/js/messages-form.js
// Busca registros relacionados por telefone/e-mail e permite vincular parent_message_id.

(function () {
  const forms = document.querySelectorAll('[data-related-messages]');
  if (!forms.length) return;

  const API_URL = '/api/messages/related';
  const DEFAULT_LIMIT = 5;
  const DEBOUNCE_MS = 450;

  forms.forEach((form) => setupForm(form));

  function setupForm(form) {
    const container = form.querySelector('[data-related-container]');
    const phoneInput = form.querySelector('[data-related-phone]') || form.querySelector('#sender_phone');
    const emailInput = form.querySelector('[data-related-email]') || form.querySelector('#sender_email');
    const parentInput = form.querySelector('input[name="parent_message_id"]');
    if (!container || !phoneInput || !emailInput || !parentInput) return;

    const featureEnabled = container.dataset.feature !== 'off';
    if (!featureEnabled) {
      container.remove();
      return;
    }

    const listEl = container.querySelector('[data-related-list]');
    const feedbackEl = container.querySelector('[data-related-feedback]');
    const footerEl = container.querySelector('[data-related-footer]');
    const selectionEl = container.querySelector('[data-related-selection]');
    const selectionIdEl = container.querySelector('[data-related-selection-id]');
    const clearBtn = container.querySelector('[data-related-clear]');
    const historyLink = container.querySelector('[data-related-history]');
    const limit = Number(container.dataset.limit) || DEFAULT_LIMIT;
    const historyBase = form.dataset.contactHistoryBase || '/contatos';

    let debounceTimer = null;
    let currentRequest = null;
    let currentSelection = sanitizeId(parentInput.value);

    renderSelection();
    updateHistoryLink(phoneInput.value, emailInput.value);

    phoneInput.addEventListener('input', scheduleFetch);
    emailInput.addEventListener('input', scheduleFetch);

    clearBtn?.addEventListener('click', (ev) => {
      ev.preventDefault();
      currentSelection = null;
      parentInput.value = '';
      renderSelection();
    });

    form.addEventListener('reset', () => {
      currentSelection = null;
      parentInput.value = '';
      renderSelection();
      showFeedback('Informe telefone ou e-mail para verificar registros anteriores.');
      hideList();
    });

    function scheduleFetch() {
      updateHistoryLink(phoneInput.value, emailInput.value);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchRelated(phoneInput.value, emailInput.value);
      }, DEBOUNCE_MS);
    }

    function fetchRelated(phoneRaw, emailRaw) {
      const phone = normalizePhone(phoneRaw);
      const email = normalizeEmail(emailRaw);

      if (!phone && !email) {
        if (currentRequest?.abort) currentRequest.abort();
        showFeedback('Informe telefone ou e-mail para verificar registros anteriores.');
        hideList();
        return;
      }

      const params = new URLSearchParams();
      if (phone) params.set('phone', phoneRaw.trim());
      if (email) params.set('email', emailRaw.trim());
      params.set('limit', String(limit));

      if (currentRequest?.abort) currentRequest.abort();
      const controller = new AbortController();
      currentRequest = controller;

      showFeedback('Buscando registros relacionados…', true);

      fetch(`${API_URL}?${params.toString()}`, { signal: controller.signal })
        .then((resp) => {
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }
          return resp.json();
        })
        .then((payload) => {
          if (!payload?.success) {
            throw new Error(payload?.error || 'Falha ao buscar registros relacionados.');
          }
          renderList(Array.isArray(payload.data) ? payload.data : []);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          console.error('[related-messages] erro na busca', err);
          showFeedback('Não foi possível buscar registros relacionados.');
          hideList();
        })
        .finally(() => {
          if (currentRequest === controller) {
            currentRequest = null;
          }
        });
    }

    function renderList(items) {
      if (!listEl) return;

      listEl.innerHTML = '';

      if (!Array.isArray(items) || items.length === 0) {
        showFeedback('Nenhum registro anterior encontrado para este contato.');
        hideList();
        return;
      }

      const fragments = document.createDocumentFragment();
      items.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'related-item';
        li.innerHTML = `
          <div class="related-item__info">
            <strong class="related-item__subject">${escapeHtml(item.subject || '(sem assunto)')}</strong>
            <div class="related-item__meta">
              <span>${formatDate(item.call_date || item.created_at) || 'Data não informada'}</span>
              <span>·</span>
              <span class="status-badge status-${item.status || 'pending'}">${escapeHtml(item.status_label || item.status || 'Pendente')}</span>
              <span>·</span>
              <span>${escapeHtml(item.recipient_name || item.recipientName || '-') }</span>
            </div>
          </div>
          <div class="related-item__actions">
            <a class="btn btn-link" href="/visualizar-recado/${item.id}" target="_blank" rel="noopener">Abrir</a>
            <button type="button" class="btn btn-secondary" data-related-select="${item.id}">Vincular</button>
          </div>
        `;
        fragments.appendChild(li);
      });

      listEl.appendChild(fragments);
      listEl.hidden = false;
      if (feedbackEl) {
        feedbackEl.textContent = 'Selecione um registro para vincular como continuidade do atendimento.';
        feedbackEl.dataset.loading = 'false';
      }
      footerEl?.classList.remove('d-none');

      listEl.querySelectorAll('[data-related-select]').forEach((button) => {
        button.addEventListener('click', () => {
          const id = sanitizeId(button.getAttribute('data-related-select'));
          if (!id) return;
          currentSelection = id;
          parentInput.value = String(id);
          renderSelection();
        });
      });
    }

    function renderSelection() {
      if (!selectionEl) return;
      if (currentSelection) {
        selectionEl.hidden = false;
        if (selectionIdEl) selectionIdEl.textContent = String(currentSelection);
      } else {
        selectionEl.hidden = true;
      }
    }

    function showFeedback(message, loading = false) {
      if (!feedbackEl) return;
      feedbackEl.textContent = message;
      feedbackEl.dataset.loading = loading ? 'true' : 'false';
    }

    function hideList() {
      if (listEl) {
        listEl.innerHTML = '';
        listEl.hidden = true;
      }
    }

    function updateHistoryLink(phoneRaw, emailRaw) {
      if (!historyLink) return;
      const phone = normalizePhone(phoneRaw);
      if (!phone) {
        historyLink.hidden = true;
        return;
      }
      const url = new URL(`${historyBase.replace(/\/$/, '')}/${encodeURIComponent(phone)}/historico`, window.location.origin);
      const email = normalizeEmail(emailRaw);
      if (email) {
        url.searchParams.set('email', emailRaw.trim());
      }
      historyLink.href = url.pathname + (url.search || '');
      historyLink.hidden = false;
    }
  }

  function normalizePhone(value) {
    if (!value) return '';
    return String(value).replace(/[^0-9]+/g, '');
  }

  function normalizeEmail(value) {
    if (!value) return '';
    return String(value).trim().toLowerCase();
  }

  function sanitizeId(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      try {
        return date.toLocaleDateString('pt-BR');
      } catch (_err) {
        return value;
      }
    }
    return value;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
