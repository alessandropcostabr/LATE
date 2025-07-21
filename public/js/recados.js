// public/js/recados.js

let currentPage = 1;
let currentFilters = {};
const itemsPerPagina = 20;

// Fallback para Toast.error
if (typeof window.Toast !== 'object') {
  window.Toast = { error: msg => console.error(msg) };
}

/**
 * Inicializa filtros a partir da URL e preenche o formulário
 */
function initFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  ['data_inicio', 'data_fim', 'destinatario', 'situacao'].forEach(key => {
    if (params.has(key)) {
      const value = params.get(key);
      if (value) {
        currentFilters[key] = value;
        const el = document.getElementById(key);
        if (el) el.value = value;
      }
    }
  });
}

/**
 * Lê o formulário e atualiza filtros de busca
 */
function aplicarFiltros() {
  const form = document.getElementById('filtrosForm');
  if (!form) return;
  const formData = new FormData(form);
  currentFilters = {};
  for (let [key, value] of formData.entries()) {
    if (value.trim()) currentFilters[key] = value.trim();
  }
  // Atualiza URL sem reload
  const query = new URLSearchParams(currentFilters).toString();
  window.history.replaceState({}, '', '/recados' + (query ? `?${query}` : ''));
  carregarRecados(1);
}

/**
 * Limpa filtros, formulário e URL, e recarrega lista completa
 */
function limparFiltros() {
  const form = document.getElementById('filtrosForm');
  if (form) form.reset();
  currentFilters = {};
  window.history.replaceState({}, '', '/recados');
  carregarRecados(1);
}

/**
 * Carrega recados com base em filtros e paginação
 */
async function carregarRecados(page = 1) {
  const container = document.getElementById('listaRecados');
  const pagContainer = document.getElementById('paginacao');
  if (!container) return;

  // Exibe loader
  container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-secondary);"><span class="loading"></span> Carregando recados...</div>`;
  if (pagContainer) pagContainer.innerHTML = '';

  try {
    const resp = await API.getRecados({
      ...currentFilters,
      limit: itemsPorPagina,
      offset: (page - 1) * itemsPorPagina
    });
    let recados = [];
    let pagination = { total: 0 };
    if (Array.isArray(resp)) {
      recados = resp;
      pagination.total = recados.length;
    } else if (resp.data) {
      recados = resp.data;
      pagination = resp.pagination || { total: recados.length };
    } else if (resp.recados) {
      recados = resp.recados;
      pagination = resp.pagination || { total: recados.length };
    } else {
      throw new Error('Formato de resposta inesperado');
    }

    renderizarRecados(recados);
    renderizarPaginacao(pagination, page);
    atualizarTotalResultados(pagination.total);
    currentPage = page;
  } catch (err) {
    console.error('Erro ao carregar recados:', err);
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--error);">❌ Erro ao carregar recados</div>`;
  }
}

/**
 * Monta e insere o HTML da lista de recados
 */
function renderizarRecados(recados) {
  const container = document.getElementById('listaRecados');
  if (!recados.length) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-secondary);">📝 Nenhum recado encontrado</div>`;
    return;
  }
  const rows = recados.map(r => `
    <tr>
      <td>
        <div style="font-weight:500;">${Utils.formatDate(r.data_ligacao)}</div>
        <div style="font-size:0.75rem;color:var(--text-secondary);">${r.hora_ligacao}</div>
      </td>
      <td style="font-weight:500;">${r.destinatario}</td>
      <td>
        <div>${r.remetente_nome}</div>
        ${r.remetente_telefone ? `<div style="font-size:0.75rem;color:var(--text-secondary);">${r.remetente_telefone}</div>` : ''}
      </td>
      <td>${Utils.truncateText(r.assunto,50)}</td>
      <td><span class="badge badge-${r.situacao.replace('_','')}">${getSituacaoLabel(r.situacao)}</span></td>
      <td>
        <div style="display:flex;gap:0.5rem;">
          <a href="/visualizar-recado/${r.id}" class="btn btn-outline btn-sm">👁️</a>
          <a href="/editar-recado/${r.id}" class="btn btn-outline btn-sm">✏️</a>
          <button class="btn btn-error btn-sm" onclick="excluirRecado(${r.id})">🗑️</button>
        </div>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr><th>Data/Hora</th><th>Destinatário</th><th>Remetente</th><th>Assunto</th><th>Situação</th><th>Ações</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/**
 * Renderiza paginação
 */
function renderizarPaginacao(pagination, page) {
  const container = document.getElementById('paginacao');
  if (!container) return;
  container.innerHTML = '';
  const totalPages = Math.ceil(pagination.total / itemsPorPagina);
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  // Anterior
  container.innerHTML += page > 1
    ? `<a href="#" class="pagination-btn" onclick="carregarRecados(${page-1})">‹ Anterior</a>`
    : `<span class="pagination-btn disabled">‹ Anterior</span>`;
  // Num páginas
  if (start > 1) {
    container.innerHTML += `<a href="#" class="pagination-btn" onclick="carregarRecados(1)">1</a>`;
    if (start > 2) container.innerHTML += `<span class="pagination-btn disabled">...</span>`;
  }
  for (let i = start; i <= end; i++) {
    container.innerHTML += i === page
      ? `<span class="pagination-btn active">${i}</span>`
      : `<a href="#" class="pagination-btn" onclick="carregarRecados(${i})">${i}</a>`;
  }
  if (end < totalPages) {
    if (end < totalPages - 1) container.innerHTML += `<span class="pagination-btn disabled">...</span>`;
    container.innerHTML += `<a href="#" class="pagination-btn" onclick="carregarRecados(${totalPages})">${totalPages}</a>`;
  }
  // Próximo
  container.innerHTML += page < totalPages
    ? `<a href="#" class="pagination-btn" onclick="carregarRecados(${page+1})">Próximo ›</a>`
    : `<span class="pagination-btn disabled">Próximo ›</span>`;
}

/**
 * Atualiza subtítulo com total de resultados
 */
function atualizarTotalResultados(total) {
  const el = document.getElementById('totalResultados');
  if (el) el.textContent = `${total} recado${total!==1?'s':''} encontrado${total!==1?'s':''}`;
}

// Expõe globalmente
window.aplicarFiltros      = aplicarFiltros;
window.limparFiltros       = limparFiltros;
window.carregarRecados     = carregarRecados;

// Inicialização da página
document.addEventListener('DOMContentLoaded', () => {
  initFiltersFromUrl();
  const form = document.getElementById('filtrosForm');
  if (form) {
    form.addEventListener('submit', e => { e.preventDefault(); aplicarFiltros(); });
    form.addEventListener('reset', e => { e.preventDefault(); limparFiltros(); });
  }
  carregarRecados(1);
});
