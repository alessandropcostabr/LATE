// public/js/app.js
// Comentários em pt-BR; identificadores em inglês.
// Dashboard: atalhos de data + cards do CRM.

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

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function getLatestMonth(rows) {
  const months = rows.map((row) => row?.month).filter(Boolean);
  if (!months.length) return null;
  return months.reduce((max, value) => (value > max ? value : max), months[0]);
}

function sumTotals(rows) {
  return rows.reduce((sum, row) => sum + (Number(row?.total) || 0), 0);
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value;
}

async function carregarStatsCrm() {
  const oppsMonthEl = document.getElementById('crmOppsMonth');
  const oppsPeriodEl = document.getElementById('crmOppsPeriod');
  const activitiesPendingEl = document.getElementById('crmActivitiesPending');
  const activitiesTotalEl = document.getElementById('crmActivitiesTotal');

  if (!oppsMonthEl && !oppsPeriodEl && !activitiesPendingEl && !activitiesTotalEl) {
    return;
  }

  try {
    const resp = await request('/api/crm/stats');
    const data = resp?.data || {};
    const pipeline = Array.isArray(data.pipeline) ? data.pipeline : [];
    const activities = Array.isArray(data.activities) ? data.activities : [];

    const latestMonth = getLatestMonth(pipeline);
    const oppsMonthTotal = latestMonth
      ? pipeline.reduce((sum, row) => sum + (row.month === latestMonth ? Number(row.total || 0) : 0), 0)
      : 0;
    const oppsPeriodTotal = sumTotals(pipeline);

    const pendingActivities = activities
      .filter((row) => String(row?.status || '').toLowerCase() === 'pending')
      .reduce((sum, row) => sum + (Number(row?.total) || 0), 0);
    const totalActivities = sumTotals(activities);

    setText(oppsMonthEl, formatNumber(oppsMonthTotal));
    setText(oppsPeriodEl, formatNumber(oppsPeriodTotal));
    setText(activitiesPendingEl, formatNumber(pendingActivities));
    setText(activitiesTotalEl, formatNumber(totalActivities));
  } catch (err) {
    console.error('Erro ao carregar estatísticas do CRM:', err);
    setText(oppsMonthEl, '-');
    setText(oppsPeriodEl, '-');
    setText(activitiesPendingEl, '-');
    setText(activitiesTotalEl, '-');
  }
}

function initDashboard() {
  carregarStatsCrm();

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
