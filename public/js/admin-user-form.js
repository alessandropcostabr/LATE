// public/js/admin-user-form.js
// Tela de criação/edição de usuários: textos pt-BR, identificadores em inglês.

(function () {
  const container = document.querySelector('.container[data-page-mode]');
  if (!container) return;

  const mode = container.getAttribute('data-page-mode') || 'create';
  const userId = container.getAttribute('data-user-id') || '';
  const form = document.getElementById('userForm');
  const alertBox = document.getElementById('formAlert');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const passwordConfirmInput = document.getElementById('passwordConfirm');
  const roleSelect = document.getElementById('role');
  const activeSelect = document.getElementById('active');
  const sectorSelect = document.getElementById('sectorIds');

  function showAlert(message, type = 'danger') {
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.classList.remove('d-none');
  }

  function hideAlert() {
    if (!alertBox) return;
    alertBox.textContent = '';
    alertBox.classList.add('d-none');
    alertBox.className = 'alert d-none';
  }

  async function apiRequest(url, { method = 'GET', data } = {}) {
    const opts = {
      method,
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    };

    if (data !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }

    const res = await fetch(url, opts);
    let body;
    try {
      body = await res.json();
    } catch (err) {
      body = { success: false, error: 'Resposta inválida do servidor.' };
    }

    if (!res.ok || body.success === false) {
      const message = body?.error || body?.message || `Falha na requisição (${res.status})`;
      const error = new Error(message);
      error.status = res.status;
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
      if (Array.isArray(payload.data.items)) return payload.data.items;
      if (Array.isArray(payload.data.data)) return payload.data.data;
      if (Array.isArray(payload.data.sectors)) return payload.data.sectors;
    }
    if (payload && payload.success && payload.data && Array.isArray(payload.data.items)) {
      return payload.data.items;
    }
    return [];
  }

  function getSelectedSectorIds() {
    return Array.from(sectorSelect?.selectedOptions || []).map((opt) => Number(opt.value)).filter(Number.isFinite);
  }

  function validatePasswords() {
    if (mode !== 'create') return true;
    const password = passwordInput?.value || '';
    const confirm = passwordConfirmInput?.value || '';
    if (password.length < 8) {
      showAlert('A senha deve conter ao menos 8 caracteres.', 'danger');
      return false;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      showAlert('A senha deve conter letras e números.', 'danger');
      return false;
    }
    if (password !== confirm) {
      showAlert('As senhas informadas não conferem.', 'danger');
      return false;
    }
    return true;
  }

  async function loadSectors(selectedIds = []) {
    try {
      const payload = await apiRequest('/api/sectors?limit=100');
      const sectors = unpackList(payload);
      sectorSelect.innerHTML = '';
      if (!sectors.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Nenhum setor cadastrado';
        option.disabled = true;
        sectorSelect.appendChild(option);
        return;
      }
      sectors.forEach((sector) => {
        const option = document.createElement('option');
        option.value = sector.id;
        option.textContent = sector.name;
        if (selectedIds.includes(sector.id)) option.selected = true;
        sectorSelect.appendChild(option);
      });
    } catch (err) {
      console.error('[admin-user-form] Falha ao carregar setores:', err);
      showAlert('Não foi possível carregar a lista de setores.', 'danger');
    }
  }

  async function loadUser() {
    if (mode !== 'edit' || !userId) return;
    try {
      const [{ data }, sectorsResp] = await Promise.all([
        apiRequest(`/api/users/${userId}`),
        apiRequest(`/api/users/${userId}/sectors`),
      ]);
      const user = data?.user || {};
      if (nameInput) nameInput.value = user.name || '';
      if (emailInput) emailInput.value = user.email || '';
      if (roleSelect) roleSelect.value = user.role || 'OPERADOR';
      if (activeSelect) activeSelect.value = user.is_active ? 'true' : 'false';
      const selectedIds = unpackList(sectorsResp).map((s) => s.id);
      await loadSectors(selectedIds);
    } catch (err) {
      console.error('[admin-user-form] Erro ao carregar usuário:', err);
      showAlert('Não foi possível carregar os dados do usuário.', 'danger');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    hideAlert();

    if (!form.checkValidity()) {
      showAlert('Verifique os campos obrigatórios antes de continuar.', 'danger');
      return;
    }

    if (!validatePasswords()) {
      return;
    }

    const sectorIds = getSelectedSectorIds();
    if (!sectorIds.length) {
      showAlert('Selecione pelo menos um setor.', 'danger');
      return;
    }

    const payloadBase = {
      name: (nameInput?.value || '').trim(),
      email: (emailInput?.value || '').trim(),
      role: roleSelect?.value || 'OPERADOR',
      active: (activeSelect?.value || 'true') === 'true',
    };

    try {
      if (mode === 'create') {
        const payload = {
          ...payloadBase,
          password: passwordInput?.value || '',
          sectorIds,
        };
        await apiRequest('/api/users', { method: 'POST', data: payload });
        showAlert('Usuário criado com sucesso.', 'success');
        setTimeout(() => { window.location.href = '/admin/users'; }, 1200);
      } else {
        const payload = {
          name: payloadBase.name,
          email: payloadBase.email,
          role: payloadBase.role,
          active: payloadBase.active,
        };
        await apiRequest(`/api/users/${userId}`, { method: 'PUT', data: payload });
        await apiRequest(`/api/users/${userId}/sectors`, { method: 'PUT', data: { sectorIds } });
        showAlert('Usuário atualizado com sucesso.', 'success');
        setTimeout(() => { window.location.href = '/admin/users'; }, 1200);
      }
    } catch (err) {
      console.error('[admin-user-form] Falha ao salvar usuário:', err);
      const message = err?.message || 'Erro ao salvar usuário.';
      showAlert(message, 'danger');
    }
  }

  async function init() {
    if (mode === 'edit') {
      await loadUser();
    } else {
      await loadSectors();
    }
  }

  form?.addEventListener('submit', handleSubmit);
  document.addEventListener('DOMContentLoaded', init);
})();
