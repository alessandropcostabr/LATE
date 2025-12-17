/* public/js/crm-dashboard.js */
(function() {
  const pipelineChartEl = document.getElementById('pipelineChart');
  const activityChartEl = document.getElementById('activityChart');
  const recentListEl = document.getElementById('recentOpportunities');

  let pipelinesCache = [];
  let pipelineChart;
  let activityChart;

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) return { success: false, error: 'Falha na requisição' };
    return res.json();
  }

  async function loadPipelines() {
    if (pipelinesCache.length) return pipelinesCache;
    const json = await fetchJSON('/api/crm/pipelines');
    pipelinesCache = json.success ? json.data : [];
    return pipelinesCache;
  }

  function stageLabel(stageId) {
    const found = pipelinesCache.flatMap((p) => p.stages || []).find((s) => s.id === stageId);
    return found ? found.name : `Stage ${stageId}`;
  }

  function pipelineLabel(pipelineId) {
    const p = pipelinesCache.find((p) => p.id === pipelineId);
    return p ? p.name : `Pipeline ${pipelineId}`;
  }

  function randomColor(seed) {
    const base = Math.abs(seed * 9301 + 49297) % 233280;
    const r = (base % 255);
    const g = ((base / 2) % 255);
    const b = ((base / 3) % 255);
    return `rgba(${r}, ${g}, ${b}, 0.75)`;
  }

  async function renderPipelineChart() {
    await loadPipelines();
    const json = await fetchJSON('/api/crm/stats/pipeline');
    if (!json.success) return;
    const rows = json.data || [];

    const months = Array.from(new Set(rows.map((r) => r.month))).sort();
    const datasetMap = new Map();
    rows.forEach((row, idx) => {
      const key = `${row.pipeline_id}-${row.stage_id}`;
      if (!datasetMap.has(key)) {
        datasetMap.set(key, {
          label: `${pipelineLabel(row.pipeline_id)} · ${stageLabel(row.stage_id)}`,
          backgroundColor: randomColor(idx + 1),
          data: months.map(() => 0),
          stack: String(row.pipeline_id),
        });
      }
      const ds = datasetMap.get(key);
      const monthIndex = months.indexOf(row.month);
      if (monthIndex >= 0) ds.data[monthIndex] = row.total;
    });

    const data = {
      labels: months,
      datasets: Array.from(datasetMap.values())
    };

    if (pipelineChart) pipelineChart.destroy();
    pipelineChart = new Chart(pipelineChartEl, {
      type: 'bar',
      data,
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: false }
        },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
      }
    });
  }

  async function renderActivityChart() {
    const json = await fetchJSON('/api/crm/stats/activities');
    if (!json.success) return;
    const rows = json.data || [];
    const owners = Array.from(new Set(rows.map((r) => r.owner_id))).filter(Boolean).map(String);
    const statuses = Array.from(new Set(rows.map((r) => r.status))).map(String);

    const datasets = statuses.map((status, idx) => {
      const data = owners.map((owner) => {
        const row = rows.find((r) => String(r.owner_id) === owner && String(r.status) === status);
        return row ? row.total : 0;
      });
      return {
        label: status,
        data,
        backgroundColor: randomColor(idx + 100),
        stack: 'activities'
      };
    });

    if (activityChart) activityChart.destroy();
    activityChart = new Chart(activityChartEl, {
      type: 'bar',
      data: { labels: owners.length ? owners : ['-'], datasets },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
      }
    });
  }

  function formatCurrency(value) {
    const n = Number(value || 0);
    if (Number.isNaN(n)) return '-';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
  }

  async function loadRecentOpportunities() {
    const json = await fetchJSON('/api/crm/opportunities?limit=10');
    if (!json.success) return;
    const opps = json.data || [];
    recentListEl.innerHTML = '';
    if (!opps.length) {
      recentListEl.innerHTML = '<li class="muted">Nenhuma oportunidade recente.</li>';
      return;
    }
    opps.forEach((opp) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="flex-between">
          <div>
            <strong>${opp.title}</strong>
            <p class="muted">${opp.contact_name || ''}</p>
          </div>
          <div class="text-right">
            <div>${formatCurrency(opp.amount)}</div>
            <div class="muted">Fecha: ${formatDate(opp.close_date)}</div>
          </div>
        </div>
      `;
      recentListEl.appendChild(li);
    });
  }

  async function init() {
    await loadPipelines();
    renderPipelineChart();
    renderActivityChart();
    loadRecentOpportunities();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
