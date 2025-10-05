// public/js/recados.js
// Comentários em pt-BR; identificadores em inglês.
// Lista de recados com filtros; tolera formatos de payload da API.

// Helpers (iguais ao app.js — duplicados localmente para evitar dependências implícitas)
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

// Constrói query string a partir do formulário de filtros
function buildQueryFromForm(form) {
  const p = new URLSearchParams();
  const start = form.start_date?.value?.trim();
  const end   = form.end_date?.value?.trim();
  const rec   = form.recipient?.value?.trim();
  const st    = form.status?.value?.trim();

  if (start) p.set('start_date', start);
  if (end)   p.set('end_date', end);
  if (rec)   p.set('recipient', rec);
  if (st)    p.set('status', st);
  p.set('limit', '10');
  return p.toString();
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
    // Se houver form, reinicializa a partir dele (usuario pode ter alterado)
    const query = form ? buildQueryFromForm(form) : qs.toString();

    const resp = await request(`/api/messages${query ? `?${query}` : ''}`);
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

      return `
        <div class="list-item" style="display:grid;grid-template-columns:1fr auto;gap:0.5rem;border-bottom:1px solid var(--border-light);padding:0.75rem 0;">
          <div style="min-width:0;">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${subject}</div>
            <div style="font-size:0.9rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              De: ${sender} • Para: ${recipient}
            </div>
            <div style="font-size:0.85rem;color:var(--text-secondary);">Criado em: ${created}</div>
          </div>
          <div style="text-align:right;align-self:center;">
            <div style="margin-bottom:0.5rem;"><span class="badge">${statusLabel}</span></div>
            <a class="btn btn-outline btn-sm" href="/recados/${m.id}">Ver</a>
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

  // Inicial
  carregarRecados();

  // Filtros
  const form = document.getElementById('filtrosForm');
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
});

