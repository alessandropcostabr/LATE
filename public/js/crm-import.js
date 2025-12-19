(() => {
  const data = window.CRM_IMPORT_DATA || { pipelines: [], stagesByPipeline: {} };
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

  const form = document.getElementById('crmImportForm');
  const pipelineSelect = document.getElementById('pipelineId');
  const stageSelect = document.getElementById('stageId');
  const summaryEl = document.getElementById('crmImportSummary');
  const mappingEl = document.getElementById('crmImportMapping');
  const tableBody = document.querySelector('#crmImportTable tbody');
  const btnPreview = document.getElementById('btnPreview');
  const btnDryRun = document.getElementById('btnDryRun');

  function renderStages(pipelineId) {
    const stages = data.stagesByPipeline?.[pipelineId] || [];
    stageSelect.innerHTML = '<option value="">Selecionar estágio</option>';
    stages.forEach((stage) => {
      const option = document.createElement('option');
      option.value = stage.id;
      option.textContent = stage.name;
      stageSelect.appendChild(option);
    });
  }

  function getFormData(extra = {}) {
    const fd = new FormData(form);
    Object.entries(extra).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      fd.set(key, value);
    });
    return fd;
  }

  async function postForm(path, extra = {}) {
    const fd = getFormData(extra);
    const headers = {};
    if (csrf) headers['X-CSRF-Token'] = csrf;
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      body: fd,
      headers,
      credentials: 'include',
    });
    let body = {};
    try { body = await res.json(); } catch (_err) { body = {}; }
    if (!res.ok || !body.success) {
      const msg = body.error || 'Falha na requisição';
      throw new Error(msg);
    }
    return body.data;
  }

  function renderSummary(text, dataObj) {
    summaryEl.textContent = text;
    if (dataObj?.mapping) {
      mappingEl.textContent = `Mapeamento aplicado: ${JSON.stringify(dataObj.mapping)}`;
    } else {
      mappingEl.textContent = '';
    }
  }

  function renderRows(rows = []) {
    tableBody.innerHTML = '';
    if (!rows.length) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="6" class="muted">Sem linhas para exibir.</td>';
      tableBody.appendChild(row);
      return;
    }
    rows.forEach((item, idx) => {
      const mapped = item.mapped || item.data || {};
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td>${mapped.name || '-'}</td>
        <td>${mapped.phone || '-'}</td>
        <td>${mapped.email || '-'}</td>
        <td>${mapped.title || '-'}</td>
        <td>${item.duplicate ? 'sim' : '-'}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  async function handlePreview() {
    renderSummary('Processando preview...', null);
    try {
      const data = await postForm('/crm/leads/preview-csv', { limit: 50 });
      renderSummary(`Pré-visualização: ${data.total} linhas (${data.duplicates} duplicadas).`, data);
      renderRows(data.rows || []);
    } catch (err) {
      renderSummary(`Erro: ${err.message}`, null);
    }
  }

  async function handleDryRun() {
    renderSummary('Processando simulação...', null);
    try {
      const data = await postForm('/crm/leads/dry-run');
      renderSummary(
        `Dry-run: ${data.total} linhas · ${data.created} novas · ${data.updated} mescladas · ${data.skipped} puladas · ${data.errors} erros.`,
        data
      );
      renderRows(data.items || []);
    } catch (err) {
      renderSummary(`Erro: ${err.message}`, null);
    }
  }

  async function handleImport() {
    renderSummary('Executando importação...', null);
    try {
      const data = await postForm('/crm/leads/import-csv');
      renderSummary(
        `Importação concluída: ${data.total} linhas · ${data.created} novas · ${data.updated} mescladas · ${data.skipped} puladas · ${data.errors} erros.`,
        data
      );
      renderRows([]);
    } catch (err) {
      renderSummary(`Erro: ${err.message}`, null);
    }
  }

  if (pipelineSelect) {
    pipelineSelect.addEventListener('change', () => {
      renderStages(pipelineSelect.value);
    });
  }

  if (btnPreview) btnPreview.addEventListener('click', handlePreview);
  if (btnDryRun) btnDryRun.addEventListener('click', handleDryRun);
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      handleImport();
    });
  }
})();
