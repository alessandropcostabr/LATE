/* public/js/crm-kanban.js */
(async function() {
  const board = document.getElementById('kanbanBoard');
  const pipelineSelect = document.getElementById('pipelineSelect');
  const ownerSelect = document.getElementById('ownerSelect');
  const stageSelect = document.getElementById('stageSelect');
  const searchInput = document.getElementById('searchInput');
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  const modalEl = document.getElementById('customFieldsModal');
  const modalForm = document.getElementById('customFieldsForm');
  const modalTitle = document.getElementById('customFieldsModalTitle');
  const modalContainer = document.getElementById('customFieldsContainer');
  const modalAlert = document.getElementById('customFieldsRequiredAlert');
  const customFieldsCache = { opportunity: null };
  let currentModalOppId = null;
  let currentModalRequiredCustom = new Set();
  let modalInstance = null;

  let pipelinesCache = [];

  async function fetchPipelines() {
    if (pipelinesCache.length) return pipelinesCache;
    const res = await fetch('/api/crm/pipelines');
    const json = await res.json();
    pipelinesCache = json.success ? json.data : [];
    return pipelinesCache;
  }

  async function fetchCustomFields(entity) {
    if (customFieldsCache[entity]) return customFieldsCache[entity];
    const res = await fetch(`/api/crm/custom-fields?entity=${entity}`);
    const json = await res.json();
    const fields = json.success ? json.data : [];
    customFieldsCache[entity] = fields;
    return fields;
  }

  async function fetchCustomFieldValues(entity, entityId) {
    const res = await fetch(`/api/crm/custom-fields/values?entity_type=${entity}&entity_id=${entityId}`);
    const json = await res.json();
    return json.success ? json.data : [];
  }

  function parseRequiredFields(raw) {
    if (Array.isArray(raw)) {
      return raw.map((v) => String(v || '').trim()).filter(Boolean);
    }
    if (typeof raw === 'string') {
      return raw.split(',').map((v) => v.trim()).filter(Boolean);
    }
    return [];
  }

  function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getStageRuleById(stageId) {
    if (!stageId) return null;
    for (const pipeline of pipelinesCache) {
      const stage = (pipeline.stages || []).find((s) => s.id === stageId);
      if (stage) return stage;
    }
    return null;
  }

  function resolveStageRequiredCustom(stageId) {
    const stage = getStageRuleById(stageId);
    const required = parseRequiredFields(stage?.required_fields);
    const custom = new Set();
    required.forEach((field) => {
      const key = normalizeKey(field);
      if (key.startsWith('custom:')) {
        custom.add(normalizeKey(key.slice(7)));
      }
    });
    return custom;
  }

  function buildCustomFieldInput(field, value) {
    const safeValue = value ?? '';
    if (field.type === 'select') {
      const options = (field.options || []).map((opt) => (
        `<option value="${escapeAttr(opt)}" ${String(opt) === String(safeValue) ? 'selected' : ''}>${escapeHtml(opt)}</option>`
      )).join('');
      return `<select class="input" name="custom_fields[${escapeAttr(field.id)}]">
        <option value="">Selecionar</option>${options}
      </select>`;
    }
    if (field.type === 'number') {
      return `<input class="input" type="number" name="custom_fields[${escapeAttr(field.id)}]" value="${escapeAttr(safeValue)}">`;
    }
    if (field.type === 'boolean') {
      return `<input type="checkbox" name="custom_fields[${escapeAttr(field.id)}]" value="true" ${safeValue ? 'checked' : ''}>`;
    }
    if (field.type === 'date') {
      return `<input class="input" type="date" name="custom_fields[${escapeAttr(field.id)}]" value="${escapeAttr(safeValue)}">`;
    }
    return `<input class="input" type="text" name="custom_fields[${escapeAttr(field.id)}]" value="${escapeAttr(safeValue)}">`;
  }

  function renderCustomFields(fields, valuesMap, requiredCustom) {
    if (!fields.length) {
      return '<p class="muted">Nenhum campo customizado disponível.</p>';
    }
    return `
      <div class="grid">
        ${fields.map((f) => {
          const idKey = normalizeKey(f.id);
          const nameKey = normalizeKey(f.name);
          const stageRequired = (idKey && requiredCustom.has(idKey)) || (nameKey && requiredCustom.has(nameKey));
          const isRequired = Boolean(f.required || stageRequired);
          const labelClass = isRequired ? 'form-label required' : 'form-label';
          return `
            <div class="custom-field" data-field-id="${escapeAttr(f.id)}" data-field-name="${escapeAttr(f.name)}" data-required-base="${f.required ? '1' : '0'}">
              <label class="${labelClass}">${escapeHtml(f.name)}</label>
              ${buildCustomFieldInput(f, valuesMap[f.id])}
              <div class="form-error custom-field-error" hidden></div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function validateModalRequired() {
    if (!modalForm) return true;
    const missing = [];
    modalForm.querySelectorAll('.custom-field').forEach((field) => {
      field.classList.remove('is-error');
      const input = field.querySelector('.input');
      if (input) input.classList.remove('is-error');
      const errorEl = field.querySelector('.custom-field-error');
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
      }

      const baseRequired = field.dataset.requiredBase === '1';
      const idKey = normalizeKey(field.dataset.fieldId);
      const nameKey = normalizeKey(field.dataset.fieldName);
      const stageRequired = (idKey && currentModalRequiredCustom.has(idKey))
        || (nameKey && currentModalRequiredCustom.has(nameKey));
      if (!baseRequired && !stageRequired) return;
      if (!input) return;
      const value = input.type === 'checkbox' ? (input.checked ? '1' : '') : String(input.value || '').trim();
      if (!value) {
        field.classList.add('is-error');
        if (input) input.classList.add('is-error');
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = 'Campo obrigatório para este estágio.';
        }
        const label = field.querySelector('label.form-label');
        missing.push(label ? label.textContent.trim() : field.dataset.fieldName || 'custom');
      }
    });

    if (modalAlert) {
      if (missing.length) {
        modalAlert.hidden = false;
        modalAlert.textContent = `Campos obrigatórios no estágio: ${missing.join(', ')}`;
      } else {
        modalAlert.hidden = true;
        modalAlert.textContent = '';
      }
    }

    return missing.length === 0;
  }

  async function openCustomFieldsModal(opp) {
    if (!modalEl || !modalForm || !modalContainer) return;
    currentModalOppId = opp.id;
    modalTitle.textContent = `${opp.title || 'Oportunidade'}`;
    await fetchPipelines();
    currentModalRequiredCustom = resolveStageRequiredCustom(opp.stage_id);
    const [fields, values] = await Promise.all([
      fetchCustomFields('opportunity'),
      fetchCustomFieldValues('opportunity', opp.id),
    ]);
    const valuesMap = {};
    values.forEach((row) => { valuesMap[row.field_id] = row.value; });
    modalContainer.innerHTML = renderCustomFields(fields, valuesMap, currentModalRequiredCustom);
    modalInstance = modalInstance || new bootstrap.Modal(modalEl);
    modalInstance.show();
  }

  async function fetchOpportunities({ pipelineId, owner, stageId, search }) {
    const params = new URLSearchParams();
    if (pipelineId) params.set('pipeline_id', pipelineId);
    if (owner === 'me') params.set('owner_id', 'me');
    if (stageId) params.set('stage_id', stageId);
    if (search) params.set('search', search.trim());
    params.set('limit', '500');
    const res = await fetch(`/api/crm/opportunities?${params.toString()}`);
    const json = await res.json();
    return json.success ? json.data : [];
  }

  function renderKanban(pipeline, opps) {
    board.innerHTML = '';
    if (!pipeline) {
      board.innerHTML = '<p class="muted">Selecione um pipeline.</p>';
      return;
    }
    pipeline.stages.forEach((stage) => {
      const col = document.createElement('div');
      col.className = 'kanban__column';
      col.dataset.stageId = stage.id;
      col.innerHTML = `<header class="kanban__column-header">${escapeHtml(stage.name)}</header><div class="kanban__items"></div>`;
      board.appendChild(col);
    });
    opps.forEach((opp) => {
      const col = board.querySelector(`[data-stage-id="${opp.stage_id}"] .kanban__items`);
      if (!col) return;
      const card = document.createElement('article');
      card.className = 'kanban__card';
      card.draggable = true;
      card.dataset.id = opp.id;
      card.dataset.stageId = opp.stage_id;
      const amount = opp.amount ? `R$ ${Number(opp.amount).toFixed(2)}` : '-';
      const close = opp.close_date ? new Date(opp.close_date).toLocaleDateString('pt-BR') : '-';
      card.innerHTML = `
        <strong>${escapeHtml(opp.title)}</strong>
        <p class="muted">${escapeHtml(opp.contact_name || '')}</p>
        <p class="muted">Valor: ${escapeHtml(amount)} · Fecha: ${escapeHtml(close)}</p>
      `;
      card.addEventListener('click', () => openCustomFieldsModal(opp));
      card.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/plain', opp.id);
        ev.dataTransfer.setData('stage', opp.stage_id);
      });
      col.appendChild(card);
    });

    board.querySelectorAll('.kanban__column').forEach((col) => {
      col.addEventListener('dragover', (ev) => ev.preventDefault());
      col.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        const id = ev.dataTransfer.getData('text/plain');
        const fromStage = ev.dataTransfer.getData('stage');
        const toStage = col.dataset.stageId;
        if (!id || !toStage || fromStage === toStage) return;
        const res = await fetch(`/api/crm/opportunities/${id}/stage`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage_id: toStage }),
        });
        const json = await res.json();
        if (!json.success) {
          alert(json.error || 'Falha ao mover');
          return;
        }
        loadData();
      });
    });
  }

  function populateStages(pipeline) {
    stageSelect.innerHTML = '<option value="">Todas etapas</option>';
    if (!pipeline) return;
    pipeline.stages.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      stageSelect.appendChild(opt);
    });
  }

  async function loadData() {
    const pipelines = await fetchPipelines();
    if (pipelines.length && !pipelineSelect.dataset.loaded) {
      pipelines.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        pipelineSelect.appendChild(opt);
      });
      pipelineSelect.dataset.loaded = '1';
    }
    const selectedPipelineId = pipelineSelect.value || (pipelines[0] && pipelines[0].id);
    const pipeline = pipelines.find((p) => p.id === selectedPipelineId);
    pipelineSelect.value = selectedPipelineId || '';
    populateStages(pipeline);
    const opps = await fetchOpportunities({
      pipelineId: selectedPipelineId,
      owner: ownerSelect.value,
      stageId: stageSelect.value,
      search: searchInput.value,
    });
    renderKanban(pipeline, opps);
  }

  ['change', 'keyup'].forEach((evName) => searchInput.addEventListener(evName, () => {
    clearTimeout(searchInput._t);
    searchInput._t = setTimeout(loadData, 250);
  }));

  pipelineSelect.addEventListener('change', loadData);
  ownerSelect.addEventListener('change', loadData);
  stageSelect.addEventListener('change', loadData);

  if (modalForm) {
    modalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentModalOppId) return;
      if (!validateModalRequired()) return;
      const inputs = modalForm.querySelectorAll('[name^="custom_fields["]');
      for (const input of inputs) {
        const fieldId = input.name.slice('custom_fields['.length, -1);
        const value = input.type === 'checkbox' ? (input.checked ? true : '') : input.value;
        await fetch(`/api/crm/custom-fields/${fieldId}/value`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
          },
          body: JSON.stringify({
            entity_type: 'opportunity',
            entity_id: currentModalOppId,
            value,
          }),
        });
      }
      modalInstance?.hide();
    });
  }

  loadData();
})();
