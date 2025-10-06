// public/js/admin-users.js
// Comentários em pt-BR; identificadores em inglês.

(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const api = {
    csrf() {
      return $('meta[name="csrf-token"]')?.getAttribute('content') || '';
    },
    async list(q = '') {
      const url = q ? `/api/users?q=${encodeURIComponent(q)}` : '/api/users';
      const r = await fetch(url, { credentials: 'same-origin' });
      return r.json();
    },
    async get(id) {
      const r = await fetch(`/api/users/${id}`, { credentials: 'same-origin' });
      return r.json();
    },
    async create(payload) {
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': api.csrf()
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      return r.json();
    },
    async update(id, payload) {
      const r = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': api.csrf()
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      return r.json();
    },
    async setActive(id, active) {
      const r = await fetch(`/api/users/${id}/active`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': api.csrf()
        },
        credentials: 'same-origin',
        body: JSON.stringify({ active })
      });
      return r.json();
    },
    async resetPassword(id, password) {
      const r = await fetch(`/api/users/${id}/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': api.csrf()
        },
        credentials: 'same-origin',
        body: JSON.stringify({ password })
      });
      return r.json();
    },
    async remove(id) {
      const r = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': api.csrf() },
        credentials: 'same-origin'
      });
      return r.json();
    }
  };

  const tbl = $('#tbl-users tbody');
  const btnNew = $('#btn-new');
  const search = $('#search');

  // Modal helpers
  const modalEl = $('#user-modal');
  const modal = new bootstrap.Modal(modalEl);
  const form = $('#user-form');
  const fId = $('#user-id');
  const fName = $('#user-name');
  const fEmail = $('#user-email');
  const fRole = $('#user-role');
  const fPass = $('#user-password');
  const passWrap = $('#password-wrap');
  const title = $('#user-modal-title');

  function rowHtml(u) {
    const badge = u.is_active ? '<span class="badge bg-success">Ativo</span>' : '<span class="badge bg-secondary">Inativo</span>';
    return `
      <tr data-id="${u.id}">
        <td>${u.id}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${badge}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary act-edit">Editar</button>
          <button class="btn btn-sm btn-outline-warning act-reset">Redefinir senha</button>
          <button class="btn btn-sm btn-outline-${u.is_active ? 'secondary' : 'success'} act-toggle">
            ${u.is_active ? 'Desativar' : 'Ativar'}
          </button>
          <button class="btn btn-sm btn-outline-danger act-del">Remover</button>
        </td>
      </tr>`;
  }

  async function refresh(q='') {
    const r = await api.list(q);
    if (!r.success) {
      tbl.innerHTML = `<tr><td colspan="6" class="text-danger">${r.error || 'Falha ao listar usuários'}</td></tr>`;
      return;
    }
    tbl.innerHTML = r.data.map(rowHtml).join('');
  }

  // Novo
  btnNew.addEventListener('click', () => {
    fId.value = '';
    fName.value = '';
    fEmail.value = '';
    fRole.value = 'OPERADOR';
    fPass.value = '';
    passWrap.style.display = '';
    title.textContent = 'Novo usuário';
    modal.show();
  });

  // Pesquisar com debounce simples
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => refresh(search.value.trim()), 300);
  });

  // Editar / Toggle / Delete / Reset
  tbl.addEventListener('click', async (ev) => {
    const tr = ev.target.closest('tr[data-id]');
    if (!tr) return;
    const id = Number(tr.dataset.id);
    if (ev.target.classList.contains('act-edit')) {
      const r = await api.get(id);
      if (r.success) {
        fId.value = r.data.id;
        fName.value = r.data.name;
        fEmail.value = r.data.email;
        fRole.value = r.data.role;
        fPass.value = '';
        passWrap.style.display = 'none';
        title.textContent = `Editar usuário #${id}`;
        modal.show();
      }
    } else if (ev.target.classList.contains('act-toggle')) {
      const isActive = tr.querySelector('.badge.bg-success') !== null;
      await api.setActive(id, !isActive);
      refresh(search.value.trim());
    } else if (ev.target.classList.contains('act-del')) {
      if (confirm('Remover este usuário?')) {
        await api.remove(id);
        refresh(search.value.trim());
      }
    } else if (ev.target.classList.contains('act-reset')) {
      const pwd = prompt('Nova senha do usuário:');
      if (pwd && pwd.length >= 6) {
        await api.resetPassword(id, pwd);
        alert('Senha redefinida com sucesso.');
      } else if (pwd) {
        alert('A senha deve ter pelo menos 6 caracteres.');
      }
    }
  });

  // Submit (create/update)
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const payload = {
      name: fName.value.trim(),
      email: fEmail.value.trim().toLowerCase(),
      role: fRole.value.trim().toUpperCase(),
    };
    const id = fId.value ? Number(fId.value) : 0;
    let r;
    if (id) {
      r = await api.update(id, payload);
    } else {
      payload.password = fPass.value.trim();
      r = await api.create(payload);
    }
    if (r.success) {
      modal.hide();
      refresh(search.value.trim());
    } else {
      alert(r.error || 'Falha ao salvar usuário.');
    }
  });

  // inicializa
  refresh();
})();
