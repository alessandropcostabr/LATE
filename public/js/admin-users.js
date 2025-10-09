// public/js/admin-users.js
// Regras de idioma do projeto:
// - Identificadores em inglês
// - Textos exibidos ao usuário em pt-BR
// - Comentários em pt-BR

(function () {
  // Utilitários DOM
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // Toast simples usando alert() como fallback
  function showToast(msg, type = 'info') {
    // Se quiser integrar com um Toast Bootstrap no futuro, troque aqui.
    console.log(`[toast/${type}]`, msg);
  }

  // Cliente API (sempre espera JSON { success, data } ou { items } etc.)
  async function apiGet(url) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' });
    if (!res.ok) throw new Error(`Falha HTTP ${res.status}`);
    return res.json();
  }

  async function apiPut(url, body) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error(`Falha HTTP ${res.status}`);
    return res.json();
  }

  // Normaliza payloads (a API pode retornar {data:{items}}, {items}, {data:[]}, ou um array direto)
  function unpackList(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && payload.data) {
      if (Array.isArray(payload.data)) return payload.data;
      if (Array.isArray(payload.data.items)) return payload.data.items;
    }
    // Às vezes sua API vem como { success, data: { items, total } }
    if (payload && payload.success && payload.data && Array.isArray(payload.data.items)) {
      return payload.data.items;
    }
    return [];
  }

  // -----------------------
  // Listagem de usuários
  // -----------------------
  const tbody = $('#usersTbody');
  const searchInput = $('#searchInput');
  const searchBtn = $('#searchBtn');

  async function loadUsers(query = '') {
    try {
      // Mantém limites “seguros” para não bater em validações
      const params = new URLSearchParams();
      if (query && query.trim()) params.set('q', query.trim());
      params.set('limit', '100');

      const data = await apiGet(`/api/users?${params.toString()}`);
      const list = unpackList(data);

      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6">Nenhum usuário encontrado.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(u => {
        const badge = u.is_active ? `<span class="badge bg-success">ATIVO</span>`
                                  : `<span class="badge bg-secondary">INATIVO</span>`;
        const role = (u.role || '').toUpperCase();
        return `
          <tr data-user-id="${u.id}" data-user-name="${escapeHtml(u.name || '')}">
            <td>${u.id}</td>
            <td>${escapeHtml(u.name || '')}</td>
            <td>${escapeHtml(u.email || '')}</td>
            <td>${role}</td>
            <td>${badge}</td>
            <td class="d-flex gap-2 flex-wrap">
              <a href="#" class="link-primary js-not-impl" data-action="edit">Editar</a>
              <a href="#" class="link-secondary js-not-impl" data-action="resetpwd">Redefinir senha</a>
              <a href="#" class="link-warning js-not-impl" data-action="toggle">Desativar</a>
              <a href="#" class="link-danger js-not-impl" data-action="remove">Remover</a>
              <a href="#" class="link-dark js-open-sectors">Setores</a>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('[users] load erro:', err);
      tbody.innerHTML = `<tr><td colspan="6">Falha ao carregar usuários.</td></tr>`;
      showToast('Falha ao carregar usuários.', 'error');
    }
  }

  // Pesquisa
  searchBtn?.addEventListener('click', () => loadUsers(searchInput.value));
  searchInput?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') loadUsers(searchInput.value);
  });

  // Ações não implementadas nesta tela
  document.addEventListener('click', (ev) => {
    const link = ev.target.closest('.js-not-impl');
    if (!link) return;
    ev.preventDefault();
    showToast('Esta ação ainda não está disponível nesta tela.', 'info');
  });

  // -----------------------
  // Modal: setores do usuário
  // -----------------------
  const userSectorsModalEl = $('#userSectorsModal');
  const userSectorsUserIdEl = $('#userSectorsUserId');
  const userSectorsUserNameEl = $('#userSectorsUserName');
  const userSectorsListEl = $('#userSectorsList');
  const userSectorsAlertEl = $('#userSectorsAlert');
  let bsModal = null;

  function openUserSectorsModal(userId, userName) {
    if (!window.bootstrap) {
      showToast('Componente de modal indisponível.', 'error');
      return;
    }
    userSectorsUserIdEl.value = String(userId);
    userSectorsUserNameEl.textContent = userName || '';

    userSectorsAlertEl.classList.add('d-none');
    userSectorsAlertEl.textContent = '';

    userSectorsListEl.innerHTML = `<div class="text-muted">Carregando setores...</div>`;

    bsModal = new bootstrap.Modal(userSectorsModalEl);
    bsModal.show();

    // carrega listas (todos os setores + setores do usuário)
    loadUserSectors(userId).catch(err => {
      console.error('[user/sectors] load falhou:', err);
      userSectorsListEl.innerHTML = `<div class="text-danger">Não foi possível carregar os setores.</div>`;
      userSectorsAlertEl.textContent = 'Não foi possível carregar os setores.';
      userSectorsAlertEl.classList.remove('d-none');
    });
  }

  async function loadUserSectors(userId) {
    // Pega até 100 setores (evita 400 de validação de limite)
    const allResp = await apiGet('/api/sectors?limit=100');
    const userResp = await apiGet(`/api/users/${userId}/sectors`);
    const all = unpackList(allResp);
    const current = new Set(unpackList(userResp).map(s => s.id));

    if (!all.length) {
      userSectorsListEl.innerHTML = `<div class="text-muted">Nenhum setor cadastrado.</div>`;
      return;
    }

    userSectorsListEl.innerHTML = all.map(s => {
      const checked = current.has(s.id) ? 'checked' : '';
      const disabled = (String(s.name || '').toLowerCase() === 'geral') ? '' : '';
      return `
        <label class="list-group-item d-flex align-items-center gap-2">
          <input class="form-check-input me-2 js-sector-check" type="checkbox" value="${s.id}" ${checked} ${disabled}>
          <div class="flex-grow-1">
            <div class="fw-semibold">${escapeHtml(s.name || '')}</div>
            <div class="text-muted small">${escapeHtml(s.email || '') || '&nbsp;'}</div>
          </div>
          ${s.is_active ? '<span class="badge bg-success">ATIVO</span>' : '<span class="badge bg-secondary">INATIVO</span>'}
        </label>
      `;
    }).join('');
  }

  // Abrir modal ao clicar em “Setores”
  tbody.addEventListener('click', (ev) => {
    const a = ev.target.closest('.js-open-sectors');
    if (!a) return;
    ev.preventDefault();
    const tr = a.closest('tr');
    const userId = tr?.getAttribute('data-user-id');
    const userName = tr?.getAttribute('data-user-name') || '';
    if (!userId) return;
    openUserSectorsModal(userId, userName);
  });

  // Submit do modal
  $('#userSectorsForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const userId = userSectorsUserIdEl.value;
    const ids = $$('.js-sector-check').filter(chk => chk.checked).map(chk => Number(chk.value));

    if (!ids.length) {
      userSectorsAlertEl.textContent = 'Selecione pelo menos um setor.';
      userSectorsAlertEl.classList.remove('d-none');
      return;
    }

    try {
      await apiPut(`/api/users/${userId}/sectors`, { sectorIds: ids });
      showToast('Setores atualizados com sucesso.', 'success');
      bsModal?.hide();
      // recarregar a lista para refletir status (se quiser)
      // loadUsers(searchInput.value);
    } catch (err) {
      console.error('[user/sectors] save erro:', err);
      userSectorsAlertEl.textContent = 'Falha ao salvar setores.';
      userSectorsAlertEl.classList.remove('d-none');
    }
  });

  // HTML escape
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  // init
  document.addEventListener('DOMContentLoaded', () => {
    // garante Bootstrap (para o modal)
    if (!window.bootstrap) console.warn('[admin-users] Bootstrap não encontrado; modal será desativado.');
    loadUsers().catch(err => {
      console.error('[users] init erro:', err);
      tbody.innerHTML = `<tr><td colspan="6">Falha ao carregar usuários.</td></tr>`;
    });
  });
})();

