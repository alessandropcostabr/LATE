// public/js/app.js
// Comentários em pt-BR; identificadores em inglês.
// Este arquivo agora cuida APENAS de "Recados Recentes" no Dashboard.
// As estatísticas de cards ficam a cargo do utils.js para evitar chamadas duplicadas.

// Helpers de requisição (compatível com a API atual)
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
    throw new Error((json && json.error) || 'Falha na requisição');
  }
  return json;
}

// Normaliza vetor de itens aceitando { data: [...] } OU { items: [...], total }
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

const STATUS_META = {
  pending: {
    label: 'Pendente',
    badgeClass: 'badge badge-pendente',
  },
  in_progress: {
    label: 'Em andamento',
    badgeClass: 'badge badge-andamento',
  },
  resolved: {
    label: 'Resolvido',
    badgeClass: 'badge badge-resolvido',
  },
};

// ---- Recados Recentes (somente) ----
async function carregarRecadosRecentes() {
  const container = document.getElementById('recadosRecentes');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
      <div class="loading" style="margin: 0 auto 1rem;"></div>
      Carregando recados...
    </div>
  `;

  try {
    // Busca últimos 10 (o back já ordena por created_at desc)
    const resp = await request('/api/messages?limit=10');
    const list = asItems(resp);

    if (!list.length) {
      container.innerHTML = `
        <div style="text-align:center; padding: 1.5rem; color: var(--text-secondary);">
          Nenhum recado encontrado.
        </div>`;
      return;
    }

    const html = list.map((m) => {
      const created = m.created_label || formatDateTimeBR(m.createdAt || m.created_at);
      const subject = m.subject || '(Sem assunto)';
      const sender  = m.sender_name || m.sender_email || '—';
      const recipient = m.recipient || 'Não informado';
      const meta = STATUS_META[m.status] || { label: m.status || '—', badgeClass: 'badge' };
      const statusLabel = m.status_label || meta.label;

      return `
        <a class="recent-message" href="/visualizar-recado/${m.id}" aria-label="Abrir recado ${escapeHtml(subject)}">
          <div style="min-width:0;">
            <div class="recent-message__title">${escapeHtml(subject)}</div>
            <div class="recent-message__meta">De: ${escapeHtml(sender)} • Para: ${escapeHtml(recipient)}</div>
            <div class="recent-message__meta">Criado em: ${escapeHtml(created)}</div>
          </div>
          <span class="${meta.badgeClass}">${escapeHtml(statusLabel)}</span>
        </a>
      `;
    }).join('');

    container.innerHTML = html;
  } catch (err) {
    console.error('Erro ao carregar recados recentes:', err);
    container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        Erro ao carregar recados recentes
      </div>`;
  }
}

function initDashboard() {
  // ⚠️ NÃO chamar estatísticas aqui para evitar duplicidade com utils.js
  carregarRecadosRecentes();

  // Links rápidos "Hoje / Semana" (mantidos)
  const btnHoje   = document.getElementById('btnHoje');
  const btnSemana = document.getElementById('btnSemana');
  try {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const dd   = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;

    if (btnHoje)   btnHoje.href   = `/recados?start_date=${today}&end_date=${today}`;

    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay(); // 0 dom - 6 sáb
    const diff = (day + 6) % 7;       // segunda como início
    startOfWeek.setDate(now.getDate() - diff);
    const y2 = startOfWeek.getFullYear();
    const m2 = String(startOfWeek.getMonth() + 1).padStart(2, '0');
    const d2 = String(startOfWeek.getDate()).padStart(2, '0');
    if (btnSemana) btnSemana.href = `/recados?start_date=${y2}-${m2}-${d2}&end_date=${today}`;
  } catch (_e) {/* noop */}
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  // Executa apenas no Dashboard
  const h1 = document.querySelector('main h1, h1');
  const isDashboard = h1 && /dashboard/i.test(h1.textContent || '');
  if (isDashboard) initDashboard();
});
