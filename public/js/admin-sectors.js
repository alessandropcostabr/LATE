// public/js/admin-sectors.js

document.addEventListener('DOMContentLoaded', () => {
  // A partir daqui o Bootstrap já deve estar presente
  // (caso não esteja, exibe aviso e aborta para evitar erro no console)
  if (!window.bootstrap) {
    console.warn('[admin-sectors] Bootstrap não encontrado. Verifique a ordem de scripts no footer.');
    return;
  }

  (function () {
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    const tbody = $('#sectorsTableBody');
    const pag = $('#pagination');
    const searchForm = $('#searchForm');
    const qInput = $('#q');
    const btnNew = $('#btnNewSector');

    // Modal
    const modalEl = $('#sectorModal');
    const modal = new bootstrap.Modal(modalEl);
    const form = $('#sectorForm');
    const idInput = $('#sectorId');
    const nameInput = $('#sectorName');
    const emailInput = $('#sectorEmail');

    let state = { page: 1, limit: 10, q: '' };

    function toastOk(msg) { (window.Toast?.success || alert)(msg); }
    function toastErr(msg) { (window.Toast?.error || alert)(msg); }

    async function api(url, options = {}) {
      const res = await fetch(url, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', // envia cookie de sessão
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) throw new Error(json.error || 'Falha na operação');
      return json;
    }

    async function load() {
      tbody.innerHTML = `<tr><td colspan="4">Carregando...</td></tr>`;
      try {
        const { data } = await api(`/api/sectors?q=${encodeURIComponent(state.q)}&page=${state.page}&limit=${state.limit}`);
        renderTable(data.data);
        renderPagination(data.pagination);
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4">${err.message}</td></tr>`;
      }
    }

    function renderTable(items) {
      if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4">Nenhum setor encontrado.</td></tr>`;
        return;
      }
      tbody.innerHTML = items.map(s => `
        <tr data-id="${s.id}">
          <td>${escapeHtml(s.name)}</td>
          <td>${s.email ? escapeHtml(s.email) : '<span class="text-muted">—</span>'}</td>
          <td>${s.is_active ? '<span class="badge bg-success">Ativo</span>' : '<span class="badge bg-secondary">Inativo</span>'}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-primary me-1" data-action="edit">Editar</button>
            <button class="btn btn-sm btn-outline-${s.is_active ? 'warning' : 'success'} me-1" data-action="toggle">
              ${s.is_active ? 'Desativar' : 'Ativar'}
            </button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete">Excluir</button>
          </td>
        </tr>
      `).join('');
    }

    function renderPagination(p) {
      pag.innerHTML = '';
      if (!p || p.pages <= 1) return;
      const mk = (page, label, active = false) => `
        <li class="page-item ${active ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${page}">${label}</a>
        </li>`;
      const items = [];
      for (let i = 1; i <= p.pages; i++) items.push(mk(i, i, i === p.page));
      pag.innerHTML = items.join('');
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    pag.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-page]');
      if (!a) return;
      e.preventDefault();
      state.page = Number(a.dataset.page);
      load();
    });

    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      state.q = qInput.value.trim();
      state.page = 1;
      load();
    });

    btnNew.addEventListener('click', () => {
      idInput.value = '';
      nameInput.value = '';
      emailInput.value = '';
      $('#sectorModalLabel').textContent = 'Novo setor';
      modal.show();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = { name: nameInput.value.trim(), email: emailInput.value.trim() || undefined };
      try {
        if (idInput.value) {
          await api(`/api/sectors/${idInput.value}`, { method: 'PUT', body: payload });
          toastOk('Setor atualizado com sucesso');
        } else {
          await api('/api/sectors', { method: 'POST', body: payload });
          toastOk('Setor criado com sucesso');
        }
        modal.hide();
        load();
      } catch (err) {
        toastErr(err.message);
      }
    });

    document.querySelector('#sectorsTableBody').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const tr = btn.closest('tr');
      const id = tr?.dataset?.id;
      if (!id) return;

      const action = btn.dataset.action;
      if (action === 'edit') {
        const tds = tr.querySelectorAll('td');
        idInput.value = id;
        nameInput.value = tds[0].textContent.trim();
        emailInput.value = tds[1].textContent.includes('—') ? '' : tds[1].textContent.trim();
        $('#sectorModalLabel').textContent = 'Editar setor';
        modal.show();
        return;
      }
      if (action === 'toggle') {
        const active = btn.textContent.includes('Desativar');
        try {
          await api(`/api/sectors/${id}/toggle`, { method: 'PUT', body: { is_active: !active } });
          toastOk(!active ? 'Setor ativado' : 'Setor desativado');
          load();
        } catch (err) {
          toastErr(err.message);
        }
        return;
      }
      if (action === 'delete') {
        if (!confirm('Tem certeza que deseja excluir este setor?')) return;
        try {
          await api(`/api/sectors/${id}`, { method: 'DELETE' });
          toastOk('Setor excluído com sucesso');
          load();
        } catch (err) {
          toastErr(err.message);
        }
      }
    });

    // init
    load();
  })();
});

