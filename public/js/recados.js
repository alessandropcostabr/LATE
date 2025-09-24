// public/js/recados.js
// Página de listagem de recados — uso resiliente da API e atualização da UI.

(() => {
  console.log('✅ Recados JS carregado');

  const q = (sel) => document.querySelector(sel);

  async function carregarRecados(filtros = {}) {
    try {
      const params = filtros && typeof filtros === 'object' ? filtros : {};
      const box = q('#listaRecados') || q('#recadosContainer');
      if (box) {
        box.innerHTML = `
          <div style="text-align:center;padding:2rem;color:var(--text-secondary);">
            <span class="loading"></span> Carregando recados...
          </div>`;
      }

      const resp = await API.listMessages(params);
      if (!resp || resp.success === false) {
        throw new Error(resp?.error || resp?.message || 'Falha ao listar recados.');
      }

      const lista = Array.isArray(resp?.data) ? resp.data : resp; // compat: alguns backends retornam objeto
      renderizarLista(lista);
    } catch (err) {
      console.error('❌ Erro ao carregar recados:', err?.message || err);
      const box = q('#listaRecados') || q('#recadosContainer');
      if (box) box.innerHTML = `<div class="alert alert-danger">${err?.message || 'Erro ao carregar recados.'}</div>`;
    }
  }

  function renderizarLista(itens) {
    const box = q('#listaRecados') || q('#recadosContainer');
    const totalEl = q('#totalResultados') || q('#totalRecados');

    if (!box) return;

    if (!Array.isArray(itens) || itens.length === 0) {
      box.innerHTML = `<div class="alert alert-info">Nenhum recado encontrado.</div>`;
      if (totalEl) totalEl.textContent = '0';
      return;
    }

    const rows = itens.map((r) => {
      const assunto = escapeHtml(r.subject || '(sem assunto)');
      const mensagem = escapeHtml((r.message || r.notes || '(sem mensagem)')).slice(0, 120);
      const criadoRaw = r.created_at || (r.call_date ? `${r.call_date} ${r.call_time || ''}` : '');
      const criadoFmt = criadoRaw && typeof Utils !== 'undefined' && Utils && typeof Utils.formatDateTime === 'function'
        ? Utils.formatDateTime(criadoRaw)
        : criadoRaw;
      const criado = escapeHtml(criadoFmt || '');
      return `
        <tr>
          <td>${assunto}</td>
          <td>${mensagem}</td>
          <td>${criado}</td>
          <td>
            <a href="/recados/${r.id}" class="btn btn-sm btn-primary">Abrir</a>
          </td>
        </tr>`;
    }).join('');

    box.innerHTML = `
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Assunto</th>
            <th>Mensagem</th>
            <th>Criado em</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

    if (totalEl) totalEl.textContent = String(itens.length);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function serializeFiltros(form) {
    if (!form) return {};

    const data = new FormData(form);
    const campos = ['start_date', 'end_date', 'recipient', 'status'];
    const filtros = {};

    campos.forEach((campo) => {
      if (!data.has(campo)) return;
      const valorBruto = data.get(campo);
      const valor = typeof valorBruto === 'string' ? valorBruto.trim() : valorBruto;
      if (valor) {
        filtros[campo] = valor;
      }
    });

    return filtros;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = q('#filtrosForm');

    if (form) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const filtros = serializeFiltros(form);
        carregarRecados(filtros);
      });

      form.addEventListener('reset', () => {
        // Aguarda o reset padrão do navegador antes de recarregar sem filtros.
        setTimeout(() => {
          carregarRecados();
        }, 0);
      });
    }

    const filtrosIniciais = form ? serializeFiltros(form) : {};
    carregarRecados(filtrosIniciais);
  });
})();

