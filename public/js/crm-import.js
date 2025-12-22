(() => {
  const data = window.CRM_IMPORT_DATA || { pipelines: [], stagesByPipeline: {} };
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

  const form = document.getElementById('crmImportForm');
  const stepsList = document.getElementById('crmImportSteps');
  const stepSections = Array.from(document.querySelectorAll('.wizard-step'));
  const pipelineSelect = document.getElementById('pipelineId');
  const stageSelect = document.getElementById('stageId');
  const targetTypeSelect = document.getElementById('targetType');
  const mappingInput = document.getElementById('mapping');
  const mappingTable = document.getElementById('mappingTable');
  const mappingAlerts = document.getElementById('mappingAlerts');
  const summaryEl = document.getElementById('crmImportSummary');
  const mappingEl = document.getElementById('crmImportMapping');
  const tableBody = document.querySelector('#crmImportTable tbody');
  const progressBar = document.getElementById('crmImportProgress');
  const progressWrap = document.querySelector('.wizard-progress');

  const btnStep1Next = document.getElementById('btnStep1Next');
  const btnStep2Next = document.getElementById('btnStep2Next');
  const btnStep3Next = document.getElementById('btnStep3Next');
  const btnStep4Next = document.getElementById('btnStep4Next');
  const btnWizardBack = document.getElementById('btnWizardBack');
  const btnDryRun = document.getElementById('btnDryRun');
  const btnDownloadJson = document.getElementById('btnDownloadJson');
  const btnDownloadCsv = document.getElementById('btnDownloadCsv');

  let currentStep = 1;
  let currentHeaders = [];
  let currentMapping = {};
  let lastDryRun = null;
  const flowState = {
    previewReady: false,
    dryRunReady: false,
  };

  const TARGET_FIELDS = {
    lead: [
      'name', 'email', 'phone', 'source', 'notes', 'status', 'score'
    ],
    opportunity: [
      'title', 'amount', 'close_date', 'description',
      'pipeline_id', 'pipeline_name', 'stage_id', 'stage_name',
      'name', 'email', 'phone', 'source', 'probability_override'
    ]
  };

  const REQUIRED_GROUPS = {
    lead: [
      { label: 'telefone ou e-mail', fields: ['phone', 'email'] },
    ],
    opportunity: [
      { label: 'título ou nome do contato', fields: ['title', 'name'] },
      { key: 'pipeline', label: 'pipeline (ID ou nome)', fields: ['pipeline_id', 'pipeline_name'] },
      { key: 'stage', label: 'estágio (ID ou nome)', fields: ['stage_id', 'stage_name'] },
      { label: 'telefone ou e-mail do contato', fields: ['phone', 'email'] },
    ],
  };

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

  function toggleOpportunityFields() {
    const isOpp = targetTypeSelect?.value === 'opportunity';
    document.querySelectorAll('.js-opportunity-field').forEach((el) => {
      el.style.display = isOpp ? '' : 'none';
    });
  }

  function placeBackButton() {
    if (!btnWizardBack) return;
    const activeStep = form?.querySelector('.wizard-step.is-active');
    const actions = activeStep?.querySelector('.form-actions');
    btnWizardBack.hidden = currentStep <= 1 || !actions;
    if (!btnWizardBack.hidden && actions && !actions.contains(btnWizardBack)) {
      actions.insertBefore(btnWizardBack, actions.firstChild);
    }
  }

  function setStep(step) {
    currentStep = step;
    stepSections.forEach((section) => {
      section.classList.toggle('is-active', Number(section.dataset.step) === step);
    });
    if (stepsList) {
      stepsList.querySelectorAll('li').forEach((item) => {
        item.classList.toggle('is-active', Number(item.dataset.step) === step);
      });
    }

    if (progressBar && progressWrap) {
      const total = Math.max(stepSections.length, 1);
      const percent = total <= 1 ? 100 : Math.round(((step - 1) / (total - 1)) * 100);
      progressBar.style.width = `${percent}%`;
      progressWrap.setAttribute('aria-valuenow', String(percent));
    }

    placeBackButton();
  }

  function getSelectedFile() {
    const input = document.getElementById('csvFile');
    return input?.files?.[0] || null;
  }

  function isOpportunityTarget() {
    return targetTypeSelect?.value === 'opportunity';
  }

  function validateStep1() {
    if (!getSelectedFile()) {
      return { ok: false, message: 'CSV obrigatório.' };
    }
    if (isOpportunityTarget()) {
      if (!pipelineSelect?.value) {
        return { ok: false, message: 'Selecione o pipeline para oportunidades.' };
      }
      if (!stageSelect?.value) {
        return { ok: false, message: 'Selecione o estágio para oportunidades.' };
      }
    }
    return { ok: true };
  }

  function updateControls() {
    const mappingStatus = validateMapping();
    const step1Valid = validateStep1().ok;
    if (btnStep1Next) btnStep1Next.disabled = !step1Valid;
    if (btnStep2Next) btnStep2Next.disabled = !step1Valid || mappingStatus.hasErrors;
    if (btnStep3Next) btnStep3Next.disabled = !flowState.previewReady;
    if (btnDryRun) btnDryRun.disabled = !flowState.previewReady;
    if (btnStep4Next) btnStep4Next.disabled = !flowState.dryRunReady;
    if (btnDownloadJson) btnDownloadJson.disabled = !flowState.dryRunReady;
    if (btnDownloadCsv) btnDownloadCsv.disabled = !flowState.dryRunReady;
  }

  function resetFlowState() {
    flowState.previewReady = false;
    flowState.dryRunReady = false;
    lastDryRun = null;
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
        <td>${escapeHtml(mapped.name || '-')}</td>
        <td>${escapeHtml(mapped.phone || '-')}</td>
        <td>${escapeHtml(mapped.email || '-')}</td>
        <td>${escapeHtml(mapped.title || '-')}</td>
        <td>${item.duplicate ? 'sim' : '-'}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  function buildMappingTable() {
    if (!mappingTable) return;
    if (!currentHeaders.length) {
      mappingTable.innerHTML = '<p class="muted">Nenhuma coluna detectada.</p>';
      return;
    }
    const targetType = targetTypeSelect?.value || 'lead';
    const fields = TARGET_FIELDS[targetType] || [];
    const rows = currentHeaders.map((header) => {
      const selected = currentMapping[header] || '';
      const options = [''].concat(fields).map((field) => {
        const label = field ? field : 'ignorar';
        const value = field;
        return `<option value="${escapeAttr(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
      }).join('');
      return `
        <tr class="mapping-row" data-header="${escapeAttr(header)}">
          <td>${escapeHtml(header)}</td>
          <td>
            <select class="input" data-header="${escapeAttr(header)}">
              ${options}
            </select>
            <div class="mapping-hint" data-hint="${escapeAttr(header)}"></div>
          </td>
        </tr>
      `;
    }).join('');

    mappingTable.innerHTML = `
      <table class="table">
        <thead><tr><th>Coluna CSV</th><th>Mapear para</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    mappingTable.querySelectorAll('select[data-header]').forEach((select) => {
      select.addEventListener('change', (event) => {
        const key = event.target.getAttribute('data-header');
        const value = event.target.value;
        if (value) {
          currentMapping[key] = value;
        } else {
          delete currentMapping[key];
        }
        mappingInput.value = JSON.stringify(currentMapping);
        validateMapping();
      });
    });
    validateMapping();
  }

  function validateMapping() {
    const targetType = targetTypeSelect?.value || 'lead';
    const groups = REQUIRED_GROUPS[targetType] || [];
    const mappedTargets = Object.values(currentMapping || {}).filter(Boolean);
    const targetCounts = mappedTargets.reduce((acc, field) => {
      acc[field] = (acc[field] || 0) + 1;
      return acc;
    }, {});

    const missing = [];
    const hasPipeline = pipelineSelect?.value || mappedTargets.includes('pipeline_id') || mappedTargets.includes('pipeline_name');
    const hasStage = stageSelect?.value || mappedTargets.includes('stage_id') || mappedTargets.includes('stage_name');

    groups.forEach((group) => {
      if (group.key === 'pipeline' && hasPipeline) return;
      if (group.key === 'stage' && hasStage) return;
      const ok = group.fields.some((field) => mappedTargets.includes(field));
      if (!ok) missing.push(group.label);
    });

    const rowWarnings = {};
    Object.entries(currentMapping || {}).forEach(([header, target]) => {
      if (!target) return;
      if (targetCounts[target] > 1) {
        rowWarnings[header] = `Campo duplicado: ${target}`;
      }
    });

    const hasErrors = missing.length > 0;
    if (mappingAlerts) {
      mappingAlerts.classList.remove('is-error', 'is-warning');
      mappingAlerts.textContent = '';
      if (hasErrors) {
        mappingAlerts.classList.add('is-error');
        mappingAlerts.textContent = `Campos obrigatórios ausentes: ${missing.join(', ')}.`;
      } else if (Object.keys(rowWarnings).length) {
        mappingAlerts.classList.add('is-warning');
        mappingAlerts.textContent = 'Alguns campos estão mapeados mais de uma vez.';
      }
    }

    if (mappingTable) {
      mappingTable.querySelectorAll('.mapping-row').forEach((row) => {
        row.classList.remove('is-error', 'is-warning');
        const header = row.getAttribute('data-header');
        const hint = row.querySelector('.mapping-hint');
        if (rowWarnings[header]) {
          row.classList.add('is-warning');
          if (hint) hint.textContent = rowWarnings[header];
        } else if (hint) {
          hint.textContent = '';
        }
      });
    }

    return { hasErrors };
  }

  async function handlePreview({ advanceTo = 3 } = {}) {
    const validation = validateStep1();
    if (!validation.ok) {
      renderSummary(`Erro: ${validation.message}`, null);
      updateControls();
      return;
    }
    renderSummary('Processando preview...', null);
    try {
      mappingInput.value = JSON.stringify(currentMapping || {});
      const data = await postForm('/crm/leads/preview-csv', { limit: 50 });
      currentHeaders = data.headers || currentHeaders;
      currentMapping = data.mapping || currentMapping;
      mappingInput.value = JSON.stringify(currentMapping || {});
      buildMappingTable();
      renderSummary(`Pré-visualização: ${data.total} linhas (${data.duplicates} duplicadas).`, data);
      renderRows(data.rows || []);
      flowState.previewReady = true;
      flowState.dryRunReady = false;
      updateControls();
      setStep(advanceTo);
    } catch (err) {
      flowState.previewReady = false;
      flowState.dryRunReady = false;
      updateControls();
      renderSummary(`Erro: ${err.message}`, null);
    }
  }

  async function handleDryRun() {
    if (!flowState.previewReady) {
      renderSummary('Erro: execute a pré-visualização antes do dry-run.', null);
      return;
    }
    renderSummary('Processando simulação...', null);
    try {
      mappingInput.value = JSON.stringify(currentMapping || {});
      const data = await postForm('/crm/leads/dry-run');
      lastDryRun = data;
      renderSummary(
        `Dry-run: ${data.total} linhas · ${data.created} novas · ${data.updated} mescladas · ${data.skipped} puladas · ${data.errors} erros.`,
        data
      );
      renderRows(data.items || []);
      flowState.dryRunReady = true;
      updateControls();
      setStep(4);
    } catch (err) {
      flowState.dryRunReady = false;
      updateControls();
      renderSummary(`Erro: ${err.message}`, null);
    }
  }

  async function handleImport() {
    if (!flowState.dryRunReady) {
      renderSummary('Erro: execute o dry-run antes de importar.', null);
      return;
    }
    renderSummary('Executando importação...', null);
    try {
      mappingInput.value = JSON.stringify(currentMapping || {});
      const data = await postForm('/crm/leads/import-csv');
      renderSummary(
        `Importação concluída: ${data.total} linhas · ${data.created} novas · ${data.updated} mescladas · ${data.skipped} puladas · ${data.errors} erros.`,
        data
      );
      renderRows([]);
      setStep(5);
    } catch (err) {
      renderSummary(`Erro: ${err.message}`, null);
    }
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function dryRunToCsv(data) {
    if (!data) return '';
    const header = ['action', 'contact_id', 'error', 'data'];
    const lines = [header.join(',')];
    (data.items || []).forEach((item) => {
      const row = [
        item.action || '',
        item.contact_id || '',
        item.error || '',
        JSON.stringify(item.data || {}).replace(/\"/g, '""'),
      ].map((v) => {
        const s = String(v);
        return s.includes(',') ? `"${s}"` : s;
      });
      lines.push(row.join(','));
    });
    return lines.join('\n');
  }

  if (pipelineSelect) {
    pipelineSelect.addEventListener('change', () => {
      renderStages(pipelineSelect.value);
      updateControls();
    });
  }

  if (targetTypeSelect) {
    targetTypeSelect.addEventListener('change', () => {
      toggleOpportunityFields();
      updateControls();
    });
  }

  toggleOpportunityFields();

  document.querySelectorAll('[data-step-back]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prev = Math.max(1, currentStep - 1);
      setStep(prev);
    });
  });

  if (btnStep1Next) {
    btnStep1Next.addEventListener('click', () => {
      handlePreview({ advanceTo: 2 });
    });
  }

  if (btnStep2Next) btnStep2Next.addEventListener('click', () => handlePreview({ advanceTo: 3 }));
  if (btnStep3Next) btnStep3Next.addEventListener('click', handleDryRun);
  if (btnStep4Next) btnStep4Next.addEventListener('click', () => setStep(5));
  if (btnDryRun) btnDryRun.addEventListener('click', handleDryRun);

  if (btnDownloadJson) {
    btnDownloadJson.addEventListener('click', () => {
      if (!lastDryRun) return;
      downloadFile(JSON.stringify(lastDryRun, null, 2), 'crm_import_dry_run.json', 'application/json');
    });
  }

  if (btnDownloadCsv) {
    btnDownloadCsv.addEventListener('click', () => {
      if (!lastDryRun) return;
      downloadFile(dryRunToCsv(lastDryRun), 'crm_import_dry_run.csv', 'text/csv');
    });
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      handleImport();
    });
  }

  if (form) {
    form.addEventListener('change', () => {
      resetFlowState();
      updateControls();
    });
    form.addEventListener('input', () => {
      resetFlowState();
      updateControls();
    });
  }

  setStep(1);
  updateControls();
})();
