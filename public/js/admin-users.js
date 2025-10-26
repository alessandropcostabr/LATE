// public/js/admin-users.js
// Regras do projeto: identificadores em inglês, textos exibidos em pt-BR.

(function () {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function showToast(message, type = 'info') {
    console.log(`[toast/${type}]`, message);
    if (window?.Toast?.show) {
      window.Toast.show(message, type);
    }
  }

  async function apiRequest(url, { method = 'GET', data } = {}) {
    const options = {
      method,
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    };

    if (data !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    let body;
    try {
      body = await response.json();
    } catch (_err) {
      body = { success: false, error: 'Resposta inválida do servidor.' };
    }

    if (!response.ok || body.success === false) {
      const message = body?.error || body?.data?.message || body?.message || `Falha na requisição (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.body = body;
      throw error;
    }

    return body;
  }

  function unpackList(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && payload.data) {
      if (Array.isArray(payload.data)) return payload.data;
      if (Array.isArray(payload.data.users)) return payload.data.users;
      if (Array.isArray(payload.data.items)) return payload.data.items;
      if (Array.isArray(payload.data.data)) return payload.data.data;
      if (Array.isArray(payload.data.sectors)) return payload.data.sectors;
    }
    if (payload && payload.success && payload.data && Array.isArray(payload.data.items)) {
      return payload.data.items;
    }
    return [];
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  const state = {
    users: [],
    filters: {
      q: '',
      role: '',
      status: '',
    },
  };

  const tbody = $('#usersTbody');
  const searchForm = $('#user-search-form');
  const qInput = $('#user-q');
  const roleSelect = $('#user-role');
  const statusSelect = $('#user-status');

  async function loadUsers() {
    tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
      const params = new URLSearchParams();
      if (state.filters.q) params.set('q', state.filters.q);
      if (state.filters.role) params.set('role', state.filters.role);
      if (state.filters.status) params.set('status', state.filters.status);
      params.set('limit', '100');

      const qs = params.toString();
      const url = qs ? `/api/users?${qs}` : '/api/users';
      const data = await apiRequest(url);
      const list = unpackList(data);
      renderUsers(list);
    } catch (err) {
      console.error('[admin-users] Falha ao carregar usuários:', err);
      tbody.innerHTML = '<tr><td colspan="7">Falha ao carregar usuários.</td></tr>';
      showToast(err.message || 'Falha ao carregar usuários.', 'error');
    }
  }

  function renderUsers(users) {
    state.users = Array.isArray(users) ? users.slice() : [];

    if (!state.users.length) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhum usuário encontrado.</td></tr>';
      return;
    }

    const viewScopeLabels = {
      all: 'Todos os recados',
      own: 'Recados destinados',
    };

    const rows = state.users.map((user) => {
      const badge = user.is_active
        ? '<span class="badge bg-success">ATIVO</span>'
        : '<span class="badge bg-secondary">INATIVO</span>';
      const role = (user.role || '').toUpperCase();
      const toggleLabel = user.is_active ? 'Inativar' : 'Ativar';
      const toggleClass = user.is_active ? 'link-warning' : 'link-success';
      const scope = String(user.view_scope || 'all').toLowerCase();
      const scopeLabel = viewScopeLabels[scope] || 'Todos os recados';

      return `
        <tr data-user-id="${user.id}" data-user-name="${escapeHtml(user.name || '')}" data-user-email="${escapeHtml(user.email || '')}" data-user-role="${role}" data-user-active="${user.is_active ? 'true' : 'false'}" data-user-view-scope="${scope}">
          <td>${user.id}</td>
          <td>${escapeHtml(user.name || '')}</td>
          <td>${escapeHtml(user.email || '')}</td>
          <td>${role}</td>
          <td>${scopeLabel}</td>
          <td class="js-status-cell">${badge}</td>
          <td class="d-flex flex-wrap gap-2 align-items-center">
            <a href="/admin/users/${user.id}/edit" class="link-primary">Editar</a>
            <button type="button" class="btn btn-link p-0 link-secondary js-reset-password">Redefinir senha</button>
            <button type="button" class="btn btn-link p-0 ${toggleClass} js-toggle-status">${toggleLabel}</button>
            <button type="button" class="btn btn-link p-0 link-danger js-remove-user">Remover</button>
            <button type="button" class="btn btn-link p-0 link-dark js-open-sectors">Setores</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rows;
  }

  async function toggleUserStatus(row) {
    if (!row) return;
    const userId = row.getAttribute('data-user-id');
    const isActive = row.getAttribute('data-user-active') === 'true';
    const nextState = !isActive;

    try {
      await apiRequest(`/api/users/${userId}/status`, { method: 'PUT', data: { active: nextState } });
      row.setAttribute('data-user-active', nextState ? 'true' : 'false');
      updateRowStatus(row, nextState);
      showToast(nextState ? 'Usuário ativado com sucesso.' : 'Usuário desativado com sucesso.', 'success');
    } catch (err) {
      console.error('[admin-users] Falha ao atualizar status:', err);
      showToast(err.message || 'Erro ao atualizar status.', 'error');
    }
  }

  function updateRowStatus(row, isActive) {
    const statusCell = row.querySelector('.js-status-cell');
    if (statusCell) {
      statusCell.innerHTML = isActive
        ? '<span class="badge bg-success">ATIVO</span>'
        : '<span class="badge bg-secondary">INATIVO</span>';
    }
    const toggleBtn = row.querySelector('.js-toggle-status');
    if (toggleBtn) {
      toggleBtn.textContent = isActive ? 'Inativar' : 'Ativar';
      toggleBtn.classList.toggle('link-warning', isActive);
      toggleBtn.classList.toggle('link-success', !isActive);
    }
  }

  // ----------------------- Pesquisa -----------------------
  searchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    state.filters.q = qInput?.value.trim() || '';
    state.filters.role = roleSelect?.value || '';
    state.filters.status = statusSelect?.value || '';
    loadUsers();
  });

  // ------------------ Modal de setores --------------------
  const userSectorsModalEl = $('#userSectorsModal');
  const userSectorsUserIdEl = $('#userSectorsUserId');
  const userSectorsUserNameEl = $('#userSectorsUserName');
  const userSectorsListEl = $('#userSectorsList');
  const userSectorsAlertEl = $('#userSectorsAlert');
  let sectorsModalInstance = null;

  function openUserSectorsModal(userId, userName) {
    if (!window.bootstrap) {
      showToast('Componente de modal indisponível.', 'error');
      return;
    }
    userSectorsUserIdEl.value = String(userId);
    userSectorsUserNameEl.textContent = userName || '';
    userSectorsAlertEl.classList.add('d-none');
    userSectorsAlertEl.textContent = '';
    userSectorsListEl.innerHTML = '<div class="text-muted">Carregando setores...</div>';

    sectorsModalInstance = new bootstrap.Modal(userSectorsModalEl);
    sectorsModalInstance.show();

    loadUserSectors(userId).catch((err) => {
      console.error('[admin-users] Falha ao carregar setores:', err);
      userSectorsListEl.innerHTML = '<div class="text-danger">Não foi possível carregar os setores.</div>';
      userSectorsAlertEl.textContent = 'Não foi possível carregar os setores.';
      userSectorsAlertEl.classList.remove('d-none');
    });
  }

  async function loadUserSectors(userId) {
    const allResp = await apiRequest('/api/sectors?limit=100');
    const userResp = await apiRequest(`/api/users/${userId}/sectors`);
    const all = unpackList(allResp);
    const current = new Set(unpackList(userResp).map((sector) => sector.id));

    if (!all.length) {
      userSectorsListEl.innerHTML = '<div class="text-muted">Nenhum setor cadastrado.</div>';
      return;
    }

    userSectorsListEl.innerHTML = all.map((sector) => {
      const checked = current.has(sector.id) ? 'checked' : '';
      return `
        <label class="list-group-item d-flex align-items-center gap-2">
          <input class="form-check-input me-2 js-sector-check" type="checkbox" value="${sector.id}" ${checked}>
          <div class="flex-grow-1">
            <div class="fw-semibold">${escapeHtml(sector.name || '')}</div>
            <div class="text-muted small">${escapeHtml(sector.email || '') || '&nbsp;'}</div>
          </div>
          ${sector.is_active ? '<span class="badge bg-success">ATIVO</span>' : '<span class="badge bg-secondary">INATIVO</span>'}
        </label>
      `;
    }).join('');
  }

  $('#userSectorsForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const userId = userSectorsUserIdEl.value;
    const sectorIds = $$('.js-sector-check').filter((chk) => chk.checked).map((chk) => Number(chk.value));

    if (!sectorIds.length) {
      userSectorsAlertEl.textContent = 'Selecione pelo menos um setor.';
      userSectorsAlertEl.classList.remove('d-none');
      return;
    }

    try {
      await apiRequest(`/api/users/${userId}/sectors`, { method: 'PUT', data: { sectorIds } });
      showToast('Setores atualizados com sucesso.', 'success');
      sectorsModalInstance?.hide();
    } catch (err) {
      console.error('[admin-users] Falha ao salvar setores:', err);
      userSectorsAlertEl.textContent = err?.message || 'Falha ao salvar setores.';
      userSectorsAlertEl.classList.remove('d-none');
    }
  });

  // --------------- Modal de redefinição de senha ---------------
  const resetPasswordModalEl = $('#resetPasswordModal');
  const resetPasswordUserIdEl = $('#resetPasswordUserId');
  const resetPasswordUserNameEl = $('#resetPasswordUserName');
  const resetPasswordInput = $('#resetPassword');
  const resetPasswordConfirmInput = $('#resetPasswordConfirm');
  const resetPasswordAlertEl = $('#resetPasswordAlert');
  let resetPasswordModalInstance = null;

  function openResetPasswordModal(userId, userName) {
    if (!window.bootstrap) {
      showToast('Componente de modal indisponível.', 'error');
      return;
    }
    resetPasswordUserIdEl.value = String(userId);
    resetPasswordUserNameEl.textContent = userName || '';
    resetPasswordInput.value = '';
    resetPasswordConfirmInput.value = '';
    resetPasswordAlertEl.classList.add('d-none');
    resetPasswordAlertEl.textContent = '';

    resetPasswordModalInstance = new bootstrap.Modal(resetPasswordModalEl);
    resetPasswordModalInstance.show();
  }

  function validateResetPassword() {
    const password = resetPasswordInput.value || '';
    const confirm = resetPasswordConfirmInput.value || '';
    if (password.length < 8) {
      resetPasswordAlertEl.textContent = 'A senha deve ter pelo menos 8 caracteres.';
      resetPasswordAlertEl.classList.remove('d-none');
      return false;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      resetPasswordAlertEl.textContent = 'A senha deve conter letras e números.';
      resetPasswordAlertEl.classList.remove('d-none');
      return false;
    }
    if (password !== confirm) {
      resetPasswordAlertEl.textContent = 'As senhas informadas não conferem.';
      resetPasswordAlertEl.classList.remove('d-none');
      return false;
    }
    resetPasswordAlertEl.classList.add('d-none');
    resetPasswordAlertEl.textContent = '';
    return true;
  }

  $('#resetPasswordForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetPasswordAlertEl.classList.add('d-none');

    if (!validateResetPassword()) return;

    const userId = resetPasswordUserIdEl.value;
    const password = resetPasswordInput.value || '';

    try {
      await apiRequest(`/api/users/${userId}/password`, { method: 'PUT', data: { password } });
      showToast('Senha redefinida com sucesso.', 'success');
      resetPasswordModalInstance?.hide();
    } catch (err) {
      console.error('[admin-users] Falha ao redefinir senha:', err);
      resetPasswordAlertEl.textContent = err?.message || 'Erro ao redefinir senha.';
      resetPasswordAlertEl.classList.remove('d-none');
    }
  });

  // ---------------- Modal de remoção de usuário ----------------
  const removeUserModalEl = $('#removeUserModal');
  const removeUserIdEl = $('#removeUserId');
  const removeUserNameEl = $('#removeUserName');
  const removeUserAlertEl = $('#removeUserAlert');
  let removeUserModalInstance = null;

  function openRemoveUserModal(userId, userName) {
    if (!window.bootstrap) {
      showToast('Componente de modal indisponível.', 'error');
      return;
    }
    removeUserIdEl.value = String(userId);
    removeUserNameEl.textContent = userName || '';
    removeUserAlertEl.classList.add('d-none');
    removeUserAlertEl.textContent = '';

    removeUserModalInstance = new bootstrap.Modal(removeUserModalEl);
    removeUserModalInstance.show();
  }

  $('#removeUserConfirmBtn')?.addEventListener('click', async () => {
    const userId = removeUserIdEl.value;
    if (!userId) return;

    try {
      await apiRequest(`/api/users/${userId}`, { method: 'DELETE' });
      showToast('Usuário removido com sucesso.', 'success');
      removeUserModalInstance?.hide();
      const row = tbody.querySelector(`tr[data-user-id="${userId}"]`);
      row?.remove();
      if (!tbody.querySelector('tr')) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhum usuário encontrado.</td></tr>';
      }
    } catch (err) {
      console.error('[admin-users] Falha ao remover usuário:', err);

      const message = err?.message || '';
      const conflict = err?.status === 409 || /não pode ser excluído/i.test(message);

      if (conflict) {
        const promptMessage = `${message || 'Usuário possui recados associados e não pode ser excluído.'}\n\nDeseja inativar este usuário agora?`;
        const shouldInactivate = window.confirm(promptMessage);

        if (shouldInactivate) {
          try {
            await apiRequest(`/api/users/${userId}/status`, { method: 'PUT', data: { active: false } });
            showToast('Usuário inativado com sucesso.', 'success');
            removeUserModalInstance?.hide();
            try {
              await loadUsers();
            } catch (reloadErr) {
              console.error('[admin-users] Falha ao recarregar usuários após inativação:', reloadErr);
            }
          } catch (inactiveErr) {
            console.error('[admin-users] Falha ao inativar usuário após conflito de remoção:', inactiveErr);
            removeUserAlertEl.textContent = inactiveErr?.message || 'Erro ao inativar usuário.';
            removeUserAlertEl.classList.remove('d-none');
          }
        } else {
          removeUserAlertEl.textContent = message || 'Usuário possui recados associados e não pode ser excluído.';
          removeUserAlertEl.classList.remove('d-none');
        }

        return;
      }

      removeUserAlertEl.textContent = message || 'Erro ao remover usuário.';
      removeUserAlertEl.classList.remove('d-none');
    }
  });

  // -------------------- Delegação de cliques -------------------
  tbody?.addEventListener('click', (event) => {
    const resetBtn = event.target.closest('.js-reset-password');
    if (resetBtn) {
      event.preventDefault();
      const row = resetBtn.closest('tr');
      if (!row) return;
      openResetPasswordModal(row.getAttribute('data-user-id'), row.getAttribute('data-user-name'));
      return;
    }

    const toggleBtn = event.target.closest('.js-toggle-status');
    if (toggleBtn) {
      event.preventDefault();
      const row = toggleBtn.closest('tr');
      toggleUserStatus(row);
      return;
    }

    const removeBtn = event.target.closest('.js-remove-user');
    if (removeBtn) {
      event.preventDefault();
      const row = removeBtn.closest('tr');
      if (!row) return;
      openRemoveUserModal(row.getAttribute('data-user-id'), row.getAttribute('data-user-name'));
      return;
    }

    const sectorsBtn = event.target.closest('.js-open-sectors');
    if (sectorsBtn) {
      event.preventDefault();
      const row = sectorsBtn.closest('tr');
      if (!row) return;
      openUserSectorsModal(row.getAttribute('data-user-id'), row.getAttribute('data-user-name'));
    }
  });

  // ------------------------- Init ------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.bootstrap) {
      console.warn('[admin-users] Bootstrap não encontrado; modais podem não funcionar.');
    }
    state.filters.q = qInput?.value.trim() || '';
    state.filters.role = roleSelect?.value || '';
    state.filters.status = statusSelect?.value || '';

    loadUsers().catch((err) => {
      console.error('[admin-users] Erro na inicialização:', err);
      tbody.innerHTML = '<tr><td colspan="7">Falha ao carregar usuários.</td></tr>';
    });
  });
})();
