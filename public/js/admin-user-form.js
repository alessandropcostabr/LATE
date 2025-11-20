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
  const viewScopeSelect = document.getElementById('viewScope');
  const scheduleToggle = document.getElementById('accessScheduleToggle');
  const scheduleContainer = document.getElementById('scheduleRangesContainer');
  const addScheduleRangeBtn = document.getElementById('addScheduleRangeBtn');
  const ipToggle = document.getElementById('accessIpToggle');
  const ipListContainer = document.getElementById('ipListContainer');
  const addIpButton = document.getElementById('addIpButton');

  const DAY_OPTIONS = [
    { value: 'mon', label: 'Segunda-feira' },
    { value: 'tue', label: 'Terça-feira' },
    { value: 'wed', label: 'Quarta-feira' },
    { value: 'thu', label: 'Quinta-feira' },
    { value: 'fri', label: 'Sexta-feira' },
    { value: 'sat', label: 'Sábado' },
    { value: 'sun', label: 'Domingo' },
  ];

  const accessRestrictionsState = {
    schedule: { enabled: false, ranges: [] },
    ip: { enabled: false, allowed: [] },
  };

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
      const message = body?.error || body?.data?.message || body?.message || `Falha na requisição (${res.status})`;
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

  function normalizeScheduleRange(range) {
    if (!range || typeof range !== 'object') return null;
    const day = String(range.day || '').trim().toLowerCase();
    if (!DAY_OPTIONS.some((option) => option.value === day)) return null;
    const start = String(range.start || '').trim();
    const end = String(range.end || '').trim();
    if (!start || !end || start >= end) return null;
    return { day, start, end };
  }

  function setAccessRestrictions(raw) {
    const scheduleRanges = Array.isArray(raw?.schedule?.ranges)
      ? raw.schedule.ranges.map(normalizeScheduleRange).filter(Boolean)
      : [];
    accessRestrictionsState.schedule = {
      enabled: Boolean(raw?.schedule?.enabled) && scheduleRanges.length > 0,
      ranges: scheduleRanges,
    };
    const allowedIps = Array.isArray(raw?.ip?.allowed)
      ? raw.ip.allowed.map((value) => String(value || '').trim()).filter((value) => value.length > 0)
      : [];
    accessRestrictionsState.ip = {
      enabled: Boolean(raw?.ip?.enabled) && allowedIps.length > 0,
      allowed: allowedIps,
    };
    renderAccessRestrictions();
  }

  function renderScheduleRanges() {
    if (!scheduleContainer) return;
    scheduleContainer.innerHTML = '';
    if (!accessRestrictionsState.schedule.enabled) {
      scheduleContainer.innerHTML = '<p class="text-muted mb-0">Sem restrições. Todos os dias e horários estão liberados.</p>';
      return;
    }
    if (!accessRestrictionsState.schedule.ranges.length) {
      accessRestrictionsState.schedule.ranges.push({ day: 'mon', start: '08:00', end: '18:00' });
    }
    accessRestrictionsState.schedule.ranges.forEach((range, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'row g-2 align-items-center mb-2';
      wrapper.dataset.scheduleIndex = index;
      wrapper.innerHTML = `
        <div class="col-12 col-md-4">
          <select class="form-select schedule-day-select" aria-label="Dia da semana">
            ${DAY_OPTIONS.map((option) => `<option value="${option.value}" ${option.value === range.day ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
        </div>
        <div class="col-6 col-md-3">
          <input type="time" class="form-control schedule-start-input" value="${range.start}" aria-label="Hora inicial">
        </div>
        <div class="col-6 col-md-3">
          <input type="time" class="form-control schedule-end-input" value="${range.end}" aria-label="Hora final">
        </div>
        <div class="col-12 col-md-2 text-md-end">
          <button type="button" class="btn btn-link text-danger p-0 schedule-remove-btn" data-remove-range aria-label="Remover faixa">
            Remover
          </button>
        </div>
      `;
      scheduleContainer.appendChild(wrapper);
    });
  }

  function renderIpList() {
    if (!ipListContainer) return;
    ipListContainer.innerHTML = '';
    if (!accessRestrictionsState.ip.enabled) {
      ipListContainer.innerHTML = '<p class="text-muted mb-0">Sem restrições. O usuário pode acessar de qualquer IP.</p>';
      return;
    }
    if (!accessRestrictionsState.ip.allowed.length) {
      accessRestrictionsState.ip.allowed.push('');
    }
    accessRestrictionsState.ip.allowed.forEach((ip, index) => {
      const row = document.createElement('div');
      row.className = 'row g-2 align-items-center mb-2';
      row.dataset.ipIndex = index;

      const colInput = document.createElement('div');
      colInput.className = 'col';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control ip-value-input';
      input.value = String(ip || '').trim();
      input.placeholder = 'Ex.: 191.9.115.129';
      input.setAttribute('aria-label', 'Endereço IP permitido');
      colInput.appendChild(input);

      const colActions = document.createElement('div');
      colActions.className = 'col-auto';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn-link text-danger p-0 ip-remove-btn';
      removeBtn.setAttribute('data-remove-ip', '');
      removeBtn.setAttribute('aria-label', 'Remover IP');
      removeBtn.textContent = 'Remover';
      colActions.appendChild(removeBtn);

      row.appendChild(colInput);
      row.appendChild(colActions);

      ipListContainer.appendChild(row);
    });
  }

  function renderAccessRestrictions() {
    if (scheduleToggle) {
      scheduleToggle.checked = Boolean(accessRestrictionsState.schedule.enabled);
      scheduleContainer?.classList.toggle('opacity-50', !scheduleToggle.checked);
    }
    if (ipToggle) {
      ipToggle.checked = Boolean(accessRestrictionsState.ip.enabled);
      ipListContainer?.classList.toggle('opacity-50', !ipToggle.checked);
    }
    renderScheduleRanges();
    renderIpList();
  }

  function buildAccessRestrictionsPayload() {
    const scheduleRanges = accessRestrictionsState.schedule.ranges
      .map(normalizeScheduleRange)
      .filter(Boolean);
    const allowedIps = accessRestrictionsState.ip.allowed
      .map((ip) => String(ip || '').trim())
      .filter((ip) => ip.length > 0);
    return {
      schedule: {
        enabled: Boolean(accessRestrictionsState.schedule.enabled) && scheduleRanges.length > 0,
        ranges: scheduleRanges,
      },
      ip: {
        enabled: Boolean(accessRestrictionsState.ip.enabled) && allowedIps.length > 0,
        allowed: allowedIps,
      },
    };
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
      if (viewScopeSelect) viewScopeSelect.value = user.view_scope || 'all';
      setAccessRestrictions(user.access_restrictions || {});
      renderAccessRestrictions();
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
      viewScope: viewScopeSelect?.value || 'all',
    };
    const accessRestrictionsPayload = buildAccessRestrictionsPayload();

    try {
      if (mode === 'create') {
        const payload = {
          ...payloadBase,
          password: passwordInput?.value || '',
          sectorIds,
          accessRestrictions: accessRestrictionsPayload,
        };
        await apiRequest('/api/users', { method: 'POST', data: payload });
        showAlert('Usuário criado com sucesso.', 'success');
        setTimeout(() => { window.location.href = '/admin/usuarios'; }, 1200);
      } else {
        const payload = {
          name: payloadBase.name,
          email: payloadBase.email,
          role: payloadBase.role,
          active: payloadBase.active,
          viewScope: payloadBase.viewScope,
          accessRestrictions: accessRestrictionsPayload,
        };
        await apiRequest(`/api/users/${userId}`, { method: 'PUT', data: payload });
        await apiRequest(`/api/users/${userId}/sectors`, { method: 'PUT', data: { sectorIds } });
        showAlert('Usuário atualizado com sucesso.', 'success');
        setTimeout(() => { window.location.href = '/admin/usuarios'; }, 1200);
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
      setAccessRestrictions({});
      renderAccessRestrictions();
      await loadSectors();
    }
  }

  scheduleToggle?.addEventListener('change', () => {
    accessRestrictionsState.schedule.enabled = scheduleToggle.checked;
    if (scheduleToggle.checked && accessRestrictionsState.schedule.ranges.length === 0) {
      accessRestrictionsState.schedule.ranges.push({ day: 'mon', start: '08:00', end: '18:00' });
    }
    renderAccessRestrictions();
  });

  addScheduleRangeBtn?.addEventListener('click', () => {
    accessRestrictionsState.schedule.enabled = true;
    accessRestrictionsState.schedule.ranges.push({ day: 'mon', start: '08:00', end: '18:00' });
    renderAccessRestrictions();
  });

  scheduleContainer?.addEventListener('input', (event) => {
    const row = event.target.closest('[data-schedule-index]');
    if (!row) return;
    const index = Number(row.dataset.scheduleIndex);
    if (!Number.isInteger(index)) return;
    if (event.target.classList.contains('schedule-day-select')) {
      accessRestrictionsState.schedule.ranges[index].day = event.target.value;
    }
    if (event.target.classList.contains('schedule-start-input')) {
      accessRestrictionsState.schedule.ranges[index].start = event.target.value;
    }
    if (event.target.classList.contains('schedule-end-input')) {
      accessRestrictionsState.schedule.ranges[index].end = event.target.value;
    }
  });

  scheduleContainer?.addEventListener('click', (event) => {
    if (event.target.closest('[data-remove-range]')) {
      const row = event.target.closest('[data-schedule-index]');
      if (!row) return;
      const index = Number(row.dataset.scheduleIndex);
      accessRestrictionsState.schedule.ranges.splice(index, 1);
      if (accessRestrictionsState.schedule.ranges.length === 0) {
        accessRestrictionsState.schedule.enabled = false;
      }
      renderAccessRestrictions();
    }
  });

  ipToggle?.addEventListener('change', () => {
    accessRestrictionsState.ip.enabled = ipToggle.checked;
    if (ipToggle.checked && accessRestrictionsState.ip.allowed.length === 0) {
      accessRestrictionsState.ip.allowed.push('');
    }
    renderAccessRestrictions();
  });

  addIpButton?.addEventListener('click', () => {
    accessRestrictionsState.ip.enabled = true;
    accessRestrictionsState.ip.allowed.push('');
    renderAccessRestrictions();
  });

  ipListContainer?.addEventListener('input', (event) => {
    const row = event.target.closest('[data-ip-index]');
    if (!row) return;
    const index = Number(row.dataset.ipIndex);
    if (!Number.isInteger(index)) return;
    if (event.target.classList.contains('ip-value-input')) {
      accessRestrictionsState.ip.allowed[index] = event.target.value;
    }
  });

  ipListContainer?.addEventListener('click', (event) => {
    if (event.target.closest('[data-remove-ip]')) {
      const row = event.target.closest('[data-ip-index]');
      if (!row) return;
      const index = Number(row.dataset.ipIndex);
      accessRestrictionsState.ip.allowed.splice(index, 1);
      if (accessRestrictionsState.ip.allowed.length === 0) {
        accessRestrictionsState.ip.enabled = false;
      }
      renderAccessRestrictions();
    }
  });

  form?.addEventListener('submit', handleSubmit);
  document.addEventListener('DOMContentLoaded', init);
})();
