// public/js/recados.js
// Página de listagem de recados — uso resiliente da API e atualização da UI.

(() => {
  console.log('✅ Recados JS carregado');

  const q = (sel) => document.querySelector(sel);

  async function carregarRecados() {
    try {
      const resp = await API.listarRecados();
      if (!resp || resp.sucesso === false) {
        throw new Error(resp?.erro || 'Falha ao listar recados.');
      }

      const lista = Array.isArray(resp?.dados) ? resp.dados : resp; // compat: alguns backends retornam objeto
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
      const assunto = escapeHtml(r.assunto || '(sem assunto)');
      const mensagem = escapeHtml((r.mensagem || r.observacoes || '(sem mensagem)')).slice(0, 120);
      const criado = escapeHtml(r.criado_em || '');
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

  document.addEventListener('DOMContentLoaded', carregarRecados);
})();

