// public/js/recados.js
// Comentários em pt-BR; identificadores em inglês.
// Lista de recados com filtros; tolera formatos de payload da API.

// Helpers (iguais ao app.js — duplicados localmente para evitar dependências implícitas)
const permissionsEl = document.querySelector('[data-message-permissions]');
const CAN_UPDATE_MESSAGE = permissionsEl?.dataset?.canUpdate === 'true';
const CAN_DELETE_MESSAGE = permissionsEl?.dataset?.canDelete === 'true';
const CAN_EDIT_OWN_MESSAGE = permissionsEl?.dataset?.canEditOwn === 'true';

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
    throw new Error((json && json.error) || 'Falha ao listar recados');
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

async function carregarRecados() {
  const container = document.getElementById('listaRecados');
  const totalEl   = document.getElementById('totalResultados');
  const form      = document.getElementById('filtrosForm');

  if (container) {
    container.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--text-secondary);">
        <span class="loading"></span> Carregando recados...
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
          Nenhum recado encontrado.
        </div>`;
      return;
    }

    const html = list.map((m) => {
      const created = m.created_label || formatDateTimeBR(m.createdAt || m.created_at);
      const statusLabel = m.status_label || ({
        pending: 'Pendente',
        in_progress: 'Em andamento',
        resolved: 'Resolvido'
      }[m.status] || m.status || '—');

      const subject = m.subject || '(Sem assunto)';
      const sender  = m.sender_name || m.sender_email || '—';
      const recipient = m.recipient || 'Não informado';
      const visibilityLabel = m.visibility === 'public' ? 'Público' : 'Privado';

      const isOwner = m.is_owner === true || m.isOwner === true;
      const canEditThis = CAN_UPDATE_MESSAGE || (CAN_EDIT_OWN_MESSAGE && isOwner);

      const actions = [`
        <a class="btn btn-outline btn-sm" href="/recados/${m.id}">Ver</a>
      `];

      if (canEditThis) {
        actions.push(`
          <a class="btn btn-primary btn-sm" href="/editar-recado/${m.id}">✏️ Editar</a>
        `);

        if (m.status !== 'resolved') {
          actions.push(`
            <button
              type="button"
              class="btn btn-success btn-sm"
              data-action="resolve-message"
              data-message-id="${m.id}"
            >✅ Resolver</button>
          `);
        }
      }

      if (CAN_DELETE_MESSAGE) {
        actions.push(`
          <button
            type="button"
            class="btn btn-danger btn-sm"
            data-action="delete-message"
            data-message-id="${m.id}"
            data-message-subject="${encodeAttr(subject)}"
          >🗑️ Excluir</button>
        `);
      }

      return `
        <div class="list-item" style="display:grid;grid-template-columns:1fr auto;gap:0.5rem;border-bottom:1px solid var(--border-light);padding:0.75rem 0;">
          <div style="min-width:0;">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${subject}</div>
            <div style="font-size:0.9rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              De: ${sender} • Para: ${recipient} • Visibilidade: ${visibilityLabel}
            </div>
            <div style="font-size:0.85rem;color:var(--text-secondary);">Criado em: ${created}</div>
          </div>
          <div style="text-align:right;align-self:center;">
            <div style="margin-bottom:0.5rem;"><span class="badge">${statusLabel}</span></div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:flex-end;">
              ${actions.join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (container) container.innerHTML = html;
  } catch (err) {
    console.error('❌ Erro ao carregar recados:', err);
    if (container) {
      container.innerHTML = `
        <div class="alert alert-danger" role="alert">
          Falha ao listar recados
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
          ? `Tem certeza de que deseja excluir o recado "${subject}"?`
          : 'Tem certeza de que deseja excluir este recado?';

        if (!window.confirm(confirmation)) return;

        try {
          setButtonLoading(deleteButton, true, 'Excluindo...');

          if (!window.API || typeof window.API.deleteMessage !== 'function') {
            throw new Error('API indisponível para excluir recados.');
          }

          await window.API.deleteMessage(messageId);
          if (window.Toast?.success) {
            window.Toast.success('Recado excluído com sucesso.');
          }
          carregarRecados();
        } catch (err) {
          const msg = err?.message || 'Erro ao excluir recado.';
          if (window.Toast?.error) {
            window.Toast.error(msg);
          } else {
            console.error('[recados] Falha ao excluir recado:', err);
            alert(msg);
          }
        } finally {
          setButtonLoading(deleteButton, false);
        }
        return;
      }

      const resolveButton = event.target.closest('[data-action="resolve-message"]');
      if (resolveButton) {
        event.preventDefault();

        const messageId = resolveButton.getAttribute('data-message-id');
        if (!messageId) return;

        if (!window.confirm('Marcar este recado como resolvido?')) return;

        try {
          setButtonLoading(resolveButton, true, 'Resolvendo...');

          if (!window.API || typeof window.API.updateMessageStatus !== 'function') {
            throw new Error('API indisponível para resolver recados.');
          }

          await window.API.updateMessageStatus(messageId, { status: 'resolved' });
          if (window.Toast?.success) {
            window.Toast.success('Recado marcado como resolvido.');
          }
          carregarRecados();
        } catch (err) {
          const msg = err?.message || 'Erro ao resolver recado.';
          if (window.Toast?.error) {
            window.Toast.error(msg);
          } else {
            console.error('[recados] Falha ao resolver recado:', err);
            alert(msg);
          }
        } finally {
          setButtonLoading(resolveButton, false);
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
