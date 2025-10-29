// public/js/recados.js
// Comentários em pt-BR; identificadores em inglês.
// Lista de contatos com filtros; tolera formatos de payload da API.

// Helpers (iguais ao app.js — duplicados localmente para evitar dependências implícitas)
const permissionsEl = document.querySelector('[data-message-permissions]');
const CAN_UPDATE_MESSAGE = permissionsEl?.dataset?.canUpdate === 'true';
const CAN_DELETE_MESSAGE = permissionsEl?.dataset?.canDelete === 'true';
const CAN_EDIT_OWN_MESSAGE = permissionsEl?.dataset?.canEditOwn === 'true';
const CAN_FORWARD_MESSAGE = permissionsEl?.dataset?.canForward === 'true';

const STATUS_LABELS = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  resolved: 'Resolvido'
};

const STATUS_OPTIONS = [
  {
    value: 'pending',
    label: STATUS_LABELS.pending,
    icon: '⏳',
    badgeClass: 'badge-pendente',
    themeClass: 'chip-pendente'
  },
  {
    value: 'in_progress',
    label: STATUS_LABELS.in_progress,
    icon: '🚧',
    badgeClass: 'badge-andamento',
    themeClass: 'chip-andamento'
  },
  {
    value: 'resolved',
    label: STATUS_LABELS.resolved,
    icon: '✅',
    badgeClass: 'badge-resolvido',
    themeClass: 'chip-resolvido'
  }
];

const STATUS_ACTION_COPY = {
  pending: {
    confirm: 'Reabrir este contato como pendente?',
    loading: 'Atualizando...',
    success: 'Contato marcado como pendente.',
    error: 'Erro ao atualizar contato.'
  },
  in_progress: {
    confirm: 'Marcar este contato como em andamento?',
    loading: 'Atualizando...',
    success: 'Contato marcado como em andamento.',
    error: 'Erro ao atualizar contato.'
  },
  resolved: {
    confirm: 'Marcar este contato como resolvido?',
    loading: 'Atualizando...',
    success: 'Contato marcado como resolvido.',
    error: 'Erro ao atualizar contato.'
  },
  default: {
    confirm: 'Atualizar situação do contato?',
    loading: 'Atualizando...',
    success: 'Situação do contato atualizada.',
    error: 'Erro ao atualizar contato.'
  }
};

async function request(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
    ...opts
  });
  let json;
  try { json = await res.json(); } catch (_e) {
    throw new Error('Resposta inválida do servidor');
  }
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && json.error) || 'Falha ao listar contatos');
  }
  return json;
}

function asItems(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function formatDateTimeBR(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo'
    }).format(d);
  } catch (_e) {
    return d.toLocaleString('pt-BR');
  }
}

function encodeAttr(value) {
  return encodeURIComponent(String(value ?? ''));
}

function decodeAttr(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch (_err) {
    return value;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

function setButtonLoading(button, loading, textWhenLoading = 'Processando...') {
  if (!button) return;
  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }
    button.disabled = true;
    button.textContent = textWhenLoading;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

// Constrói query string a partir do formulário de filtros
function buildQueryFromForm(form, { includeLimit = true } = {}) {
  const p = new URLSearchParams();
  const start = form.start_date?.value?.trim();
  const end   = form.end_date?.value?.trim();
  const rec   = form.recipient?.value?.trim();
  const st    = form.status?.value?.trim();

  if (start) p.set('start_date', start);
  if (end)   p.set('end_date', end);
  if (rec)   p.set('recipient', rec);
  if (st)    p.set('status', st);
  if (includeLimit) {
    p.set('limit', '10');
  }
  return p;
}

function hydrateFormFromUrl(form, searchParams = new URLSearchParams(window.location.search)) {
  if (!form || !form.elements) return;
  const mappings = [
    ['start_date', 'start_date'],
    ['end_date', 'end_date'],
    ['recipient', 'recipient'],
    ['status', 'status'],
  ];

  mappings.forEach(([fieldName, param]) => {
    const field = form.elements.namedItem(fieldName);
    if (!field) return;
    if (searchParams.has(param)) {
      field.value = searchParams.get(param) || '';
    } else {
      field.value = '';
    }
  });
}

function renderStatusControls(message, canEditThis, currentStatusLabel) {
  const statusLabelText = currentStatusLabel || STATUS_LABELS[message.status] || message.status || 'Situação desconhecida';
  const buttons = STATUS_OPTIONS.map((option) => {
    const isCurrent = message.status === option.value;
    const isInteractive = canEditThis && !isCurrent;
    const classes = [
      'message-status-btn',
      option.themeClass,
      isCurrent ? 'is-active' : ''
    ].filter(Boolean).join(' ');
    const ariaPressed = isCurrent ? 'true' : 'false';
    const title = isCurrent
      ? `Situação atual: ${option.label}`
      : `Marcar contato como ${option.label.toLowerCase()}`;

    const attrs = [
      'type="button"',
      `class="${classes}"`,
      `data-status-value="${option.value}"`,
      `aria-pressed="${ariaPressed}"`,
      `title="${title}"`
    ];

    if (isInteractive) {
      attrs.push('data-action="set-status"');
      attrs.push(`data-target-status="${option.value}"`);
      attrs.push(`data-message-id="${message.id}"`);
    } else {
      attrs.push('disabled');
    }

    return `
      <button ${attrs.join(' ')}>
        <span aria-hidden="true">${option.icon}</span>
        <span class="message-status-label">${option.label}</span>
      </button>
    `;
  }).join('');

  return `
    <div
      class="message-status-group"
      role="group"
      aria-label="Situação atual: ${escapeHtml(statusLabelText)}. Use os botões para alterar."
    >
      ${buttons}
    </div>
  `;
}

async function carregarRecados() {
  const container = document.getElementById('listaRecados');
  const totalEl   = document.getElementById('totalResultados');
  const form      = document.getElementById('filtrosForm');

  if (container) {
    container.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--text-secondary);">
        <span class="loading"></span> Carregando contatos...
      </div>`;
  }

  try {
    // Pega filtros da URL ou do form
    const url = new URL(window.location.href);
    const qs  = url.searchParams;
    let apiParams;

    if (form) {
      const formParams = buildQueryFromForm(form);
      apiParams = new URLSearchParams(formParams);

      // preserva parâmetros que não fazem parte do formulário (ex: paginação)
      qs.forEach((value, key) => {
        if (!['start_date', 'end_date', 'recipient', 'status', 'limit'].includes(key)) {
          apiParams.set(key, value);
        }
      });

      // Atualiza a URL visível com os filtros (sem o limit auxiliar)
      const urlParams = buildQueryFromForm(form, { includeLimit: false });
      const urlSearch = urlParams.toString();
      const targetSearch = urlSearch ? `?${urlSearch}` : '';
      if (targetSearch !== url.search) {
        history.replaceState({}, '', `${url.pathname}${targetSearch}`);
      }
    } else {
      apiParams = new URLSearchParams(qs);
      if (!apiParams.has('limit')) {
        apiParams.set('limit', '10');
      }
    }

    const queryString = apiParams.toString();
    const resp = await request(`/api/messages${queryString ? `?${queryString}` : ''}`);
    const list = asItems(resp);

    if (totalEl) totalEl.textContent = `${list.length} resultado(s)`;

    if (!list.length) {
      if (container) container.innerHTML = `
        <div style="text-align:center;padding:1.5rem;color:var(--text-secondary);">
          Nenhum contato encontrado.
        </div>`;
      return;
    }

    const html = list.map((m) => {
      const created = m.created_label || formatDateTimeBR(m.createdAt || m.created_at);
      const statusOption = STATUS_OPTIONS.find((opt) => opt.value === m.status);
      const statusLabel = m.status_label || statusOption?.label || m.status || '—';

      const subject = m.subject || '(Sem assunto)';
      const sender  = m.sender_name || m.sender_email || '—';
      const recipient = m.recipient || 'Não informado';
      const visibilityLabel = m.visibility === 'public' ? 'Público' : 'Privado';

      const isOwner = m.is_owner === true || m.isOwner === true;
      const isRecipient = m.is_recipient === true || m.isRecipient === true;
      const canEditThis = CAN_UPDATE_MESSAGE || (CAN_EDIT_OWN_MESSAGE && (isOwner || isRecipient));
      const canForwardThis = CAN_FORWARD_MESSAGE && canEditThis;

      const detailsUrl = `/visualizar-recado/${m.id}`;

      const actions = [`
        <a class="btn btn-neutral btn-sm" href="${detailsUrl}">Ver</a>
      `];

      if (canForwardThis) {
        actions.push(`
          <a class="btn btn-secondary btn-sm" href="${detailsUrl}?forward=1">📤 Encaminhar</a>
        `);
      }

      if (canEditThis) {
        actions.push(`
          <a class="btn btn-primary btn-sm" href="/editar-recado/${m.id}">✏️ Editar</a>
        `);
      }

      if (CAN_DELETE_MESSAGE) {
        actions.push(`
          <button
            type="button"
            class="btn btn-error btn-sm"
            data-action="delete-message"
            data-message-id="${m.id}"
            data-message-subject="${encodeAttr(subject)}"
          >🗑️ Excluir</button>
        `);
      }

      const statusControls = renderStatusControls(m, canEditThis, statusLabel);

      return `
        <article class="message-card list-item" data-message-id="${m.id}">
          <a class="message-card__primary" href="${detailsUrl}" aria-label="Abrir contato ${escapeHtml(subject)}">
            <div class="message-card__title">${escapeHtml(subject)}</div>
            <div class="message-card__meta">De: ${escapeHtml(sender)} • Para: ${escapeHtml(recipient)} • Visibilidade: ${escapeHtml(visibilityLabel)}</div>
            <div class="message-card__meta">Criado em: ${escapeHtml(created)}</div>
          </a>
          <div class="message-card__side">
            ${statusControls}
            <div class="message-card__actions">
              ${actions.join('')}
            </div>
          </div>
        </article>
      `;
    }).join('');

    if (container) container.innerHTML = html;
  } catch (err) {
    console.error('❌ Erro ao carregar contatos:', err);
    if (container) {
      container.innerHTML = `
        <div class="alert alert-danger" role="alert">
          Falha ao listar contatos
        </div>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Só roda na página /recados
  if (!document.getElementById('listaRecados')) return;

  const form = document.getElementById('filtrosForm');
  if (form) {
    hydrateFormFromUrl(form);
  }

  // Inicial
  carregarRecados();

  // Filtros
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      carregarRecados();
    });
    const btnLimpar = document.getElementById('btnLimpar');
    if (btnLimpar) {
      btnLimpar.addEventListener('click', (e) => {
        e.preventDefault();
        form.reset();
        history.replaceState({}, '', '/recados'); // limpa query da URL
        carregarRecados();
      });
    }
  }

  const listContainer = document.getElementById('listaRecados');
  if (listContainer) {
    listContainer.addEventListener('click', async (event) => {
      const deleteButton = event.target.closest('[data-action="delete-message"]');
      if (deleteButton) {
        if (!CAN_DELETE_MESSAGE) return;
        event.preventDefault();

        const messageId = deleteButton.getAttribute('data-message-id');
        if (!messageId) return;

        const subject = decodeAttr(deleteButton.getAttribute('data-message-subject') || '');
        const confirmation = subject
          ? `Tem certeza de que deseja excluir o contato "${subject}"?`
          : 'Tem certeza de que deseja excluir este contato?';

        if (!window.confirm(confirmation)) return;

        try {
          setButtonLoading(deleteButton, true, 'Excluindo...');

          if (!window.API || typeof window.API.deleteMessage !== 'function') {
            throw new Error('API indisponível para excluir contatos.');
          }

          await window.API.deleteMessage(messageId);
          if (window.Toast?.success) {
            window.Toast.success('Contato excluído com sucesso.');
          }
          carregarRecados();
        } catch (err) {
          const msg = err?.message || 'Erro ao excluir contato.';
          if (window.Toast?.error) {
            window.Toast.error(msg);
          } else {
            console.error('[recados] Falha ao excluir contato:', err);
            alert(msg);
          }
        } finally {
          setButtonLoading(deleteButton, false);
        }
        return;
      }

      const statusButton = event.target.closest('[data-action="set-status"]');
      if (statusButton) {
        event.preventDefault();

        if (!CAN_UPDATE_MESSAGE && !CAN_EDIT_OWN_MESSAGE) return;

        const messageId = statusButton.getAttribute('data-message-id');
        if (!messageId) return;

        const targetStatus = statusButton.getAttribute('data-target-status');
        if (!targetStatus) return;

        const statusCopy = STATUS_ACTION_COPY[targetStatus] || STATUS_ACTION_COPY.default;
        if (statusCopy.confirm && !window.confirm(statusCopy.confirm)) return;

        const group = statusButton.closest('.message-status-group');
        const buttonsInGroup = group ? Array.from(group.querySelectorAll('button')) : [];
        const originalStates = buttonsInGroup.map((btn) => ({ btn, disabled: btn.disabled }));
        let requestSucceeded = false;

        setButtonLoading(statusButton, true, statusCopy.loading || 'Atualizando...');
        buttonsInGroup.forEach((btn) => { btn.disabled = true; });
        if (group) {
          group.setAttribute('aria-busy', 'true');
        }

        try {
          if (!window.API || typeof window.API.updateMessageStatus !== 'function') {
            throw new Error('API indisponível para atualizar contatos.');
          }

          await window.API.updateMessageStatus(messageId, { status: targetStatus });
          if (window.Toast?.success) {
            window.Toast.success(statusCopy.success || 'Situação do contato atualizada.');
          }
          requestSucceeded = true;
        } catch (err) {
          const msg = err?.message || statusCopy.error || 'Erro ao atualizar contato.';
          if (window.Toast?.error) {
            window.Toast.error(msg);
          } else {
            console.error('[recados] Falha ao atualizar contato:', err);
            alert(msg);
          }
        } finally {
          setButtonLoading(statusButton, false);

          if (requestSucceeded) {
            buttonsInGroup.forEach((btn) => {
              if (btn.isConnected) {
                btn.disabled = true;
              }
            });
            carregarRecados();
          } else {
            originalStates.forEach(({ btn, disabled }) => {
              if (btn.isConnected) {
                btn.disabled = disabled;
              }
            });
          }

          if (group && group.isConnected) {
            group.removeAttribute('aria-busy');
          }
        }
      }
    });
  }

  window.addEventListener('popstate', () => {
    if (form) {
      hydrateFormFromUrl(form, new URLSearchParams(window.location.search));
    }
    carregarRecados();
  });
});
