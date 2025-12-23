// public/js/crm-opportunities.js
(function () {
  const form = document.getElementById('opportunityFilters');
  const tableBody = document.querySelector('table tbody');
  const createForm = document.getElementById('opportunityCreateForm');
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  const pipelines = window.CRM_OPP_PIPELINES || [];
  const stagesByPipeline = window.CRM_OPP_STAGES || {};
  const stageRequiredAlert = document.getElementById('oppStageRequiredAlert');

  const STANDARD_FIELD_MAP = {
    title: 'title',
    amount: 'amount',
    close_date: 'close_date',
    source: 'source',
    description: 'description',
    probability_override: 'probability_override',
    contact_name: 'contact_name',
    contact_email: 'contact_email',
    contact_phone: 'contact_phone',
    name: 'contact_name',
    email: 'contact_email',
    phone: 'contact_phone',
    pipeline_id: 'pipeline_id',
    stage_id: 'stage_id',
  };

  function collectCustomFields(formEl) {
    const custom = {};
    formEl.querySelectorAll('[name^="custom_fields["]').forEach((input) => {
      const key = input.name.slice('custom_fields['.length, -1);
      const value = input.type === 'checkbox' ? (input.checked ? true : '') : input.value;
      if (value !== '' && value !== null && value !== undefined) {
        custom[key] = value;
      }
    });
    return custom;
  }

  function renderStages(pipelineId) {
    const select = document.getElementById('oppStageSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Selecionar estágio</option>';
    (stagesByPipeline[pipelineId] || []).forEach((stage) => {
      const opt = document.createElement('option');
      opt.value = stage.id;
      opt.textContent = stage.name;
      select.appendChild(opt);
    });
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

  function getStageRule(pipelineId, stageId) {
    if (!pipelineId || !stageId) return null;
    const stages = stagesByPipeline[pipelineId] || [];
    return stages.find((s) => s.id === stageId) || null;
  }

  function resolveStageRequired(pipelineId, stageId) {
    const stage = getStageRule(pipelineId, stageId);
    const required = parseRequiredFields(stage?.required_fields);
    const standard = new Set();
    const custom = new Set();
    required.forEach((field) => {
      const key = normalizeKey(field);
      if (key.startsWith('custom:')) {
        custom.add(normalizeKey(key.slice(7)));
      } else if (STANDARD_FIELD_MAP[key]) {
        standard.add(STANDARD_FIELD_MAP[key]);
      } else if (STANDARD_FIELD_MAP[field]) {
        standard.add(STANDARD_FIELD_MAP[field]);
      }
    });
    return { standard, custom };
  }

  function updateStageRequiredBadges(pipelineId, stageId) {
    if (!createForm) return;
    const { standard, custom } = resolveStageRequired(pipelineId, stageId);

    createForm.querySelectorAll('[data-field-key]').forEach((wrapper) => {
      const key = wrapper.getAttribute('data-field-key');
      const input = wrapper.querySelector('.input');
      const label = wrapper.querySelector('label.form-label');
      const baseRequired = input?.required;
      const stageRequired = key ? standard.has(key) : false;
      if (label) {
        label.classList.toggle('required', Boolean(baseRequired || stageRequired));
      }
    });

    createForm.querySelectorAll('.custom-field').forEach((field) => {
      const baseRequired = field.dataset.requiredBase === '1';
      const idKey = normalizeKey(field.dataset.fieldId);
      const nameKey = normalizeKey(field.dataset.fieldName);
      const stageRequired = (idKey && custom.has(idKey)) || (nameKey && custom.has(nameKey));
      const label = field.querySelector('label.form-label');
      if (label) {
        label.classList.toggle('required', Boolean(baseRequired || stageRequired));
      }
    });
  }

  function validateStageRequired(pipelineId, stageId, { showErrors = false } = {}) {
    if (!createForm) return { ok: true, missing: [] };
    const { standard, custom } = resolveStageRequired(pipelineId, stageId);
    const missing = [];

    createForm.querySelectorAll('.input.is-error').forEach((el) => el.classList.remove('is-error'));
    createForm.querySelectorAll('.custom-field').forEach((field) => {
      field.classList.remove('is-error');
      const errorEl = field.querySelector('.custom-field-error');
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
      }
    });

    if (standard.size) {
      standard.forEach((key) => {
        const input = createForm.querySelector(`[name="${key}"]`);
        if (!input) return;
        const value = input.type === 'checkbox' ? (input.checked ? '1' : '') : String(input.value || '').trim();
        if (!value) {
          if (showErrors) input.classList.add('is-error');
          const label = createForm.querySelector(`[data-field-key="${key}"] label.form-label`);
          missing.push(label ? label.textContent.trim() : key);
        }
      });
    }

    createForm.querySelectorAll('.custom-field').forEach((field) => {
      const baseRequired = field.dataset.requiredBase === '1';
      const idKey = normalizeKey(field.dataset.fieldId);
      const nameKey = normalizeKey(field.dataset.fieldName);
      const stageRequired = (idKey && custom.has(idKey)) || (nameKey && custom.has(nameKey));
      if (!baseRequired && !stageRequired) return;
      const input = field.querySelector('.input');
      if (!input) return;
      const value = input.type === 'checkbox' ? (input.checked ? '1' : '') : String(input.value || '').trim();
      if (!value) {
        if (showErrors) {
          field.classList.add('is-error');
          input.classList.add('is-error');
          const errorEl = field.querySelector('.custom-field-error');
          if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent = 'Campo obrigatório para este estágio.';
          }
        }
        const label = field.querySelector('label.form-label');
        missing.push(label ? label.textContent.trim() : field.dataset.fieldName || field.dataset.fieldId || 'custom');
      }
    });

    if (stageRequiredAlert) {
      if (showErrors && missing.length) {
        stageRequiredAlert.hidden = false;
        stageRequiredAlert.textContent = `Campos obrigatórios no estágio: ${missing.join(', ')}`;
      } else {
        stageRequiredAlert.hidden = true;
        stageRequiredAlert.textContent = '';
      }
    }

    return { ok: missing.length === 0, missing };
  }

  function buildQuery(params) {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.scope) qs.set('scope', params.scope);
    qs.set('limit', '100');
    return qs.toString();
  }

  async function loadOpps() {
    const search = form?.search?.value?.trim() || '';
    const scope = form?.scope?.value || 'me';
    const qs = buildQuery({ search, scope });
    const res = await fetch(`/api/crm/opportunities?${qs}`);
    const json = await res.json();
    const opps = json.data || [];
    if (!tableBody) return;
    if (!opps.length) {
      tableBody.innerHTML = '<tr><td colspan="7" class="muted">Nenhuma oportunidade encontrada.</td></tr>';
      return;
    }
    tableBody.innerHTML = opps.map((opp) => `
      <tr>
        <td>${escapeHtml(opp.title)}</td>
        <td>${escapeHtml(opp.contact_name || '-')}</td>
        <td>${escapeHtml(opp.phone || '-')}</td>
        <td>${escapeHtml(`${opp.pipeline_id} / ${opp.stage_id}`)}</td>
        <td>${escapeHtml(opp.amount ? `R$ ${Number(opp.amount).toFixed(2)}` : '-')}</td>
        <td>${escapeHtml(opp.close_date ? new Date(opp.close_date).toLocaleDateString('pt-BR') : '-')}</td>
        <td>${escapeHtml(opp.source || '-')}</td>
      </tr>
    `).join('');
  }

  function hydrateFromUrl() {
    const qs = new URLSearchParams(window.location.search);
    if (form?.search && qs.has('search')) form.search.value = qs.get('search');
    if (form?.scope && qs.has('scope')) form.scope.value = qs.get('scope');
  }

  function syncUrl() {
    const qs = buildQuery({
      search: form?.search?.value?.trim(),
      scope: form?.scope?.value,
    });
    const target = qs ? `?${qs}` : '';
    if (target !== window.location.search) {
      window.history.replaceState({}, '', `${window.location.pathname}${target}`);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (form) {
      hydrateFromUrl();
      loadOpps();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        syncUrl();
        loadOpps();
      });
      const resetBtn = document.getElementById('opportunityFiltersReset');
      if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
          e.preventDefault();
          form.reset();
          syncUrl();
          loadOpps();
        });
      }
    }

    if (createForm) {
      const pipelineSelect = document.getElementById('oppPipelineSelect');
      const stageSelect = document.getElementById('oppStageSelect');
      if (pipelineSelect) {
        pipelineSelect.addEventListener('change', () => {
          renderStages(pipelineSelect.value);
          updateStageRequiredBadges(pipelineSelect.value, stageSelect?.value);
          validateStageRequired(pipelineSelect.value, stageSelect?.value);
        });
        const firstPipeline = pipelineSelect.value || pipelines?.[0]?.id;
        if (firstPipeline) {
          pipelineSelect.value = firstPipeline;
          renderStages(firstPipeline);
        }
      }
      if (stageSelect) {
        stageSelect.addEventListener('change', () => {
          updateStageRequiredBadges(pipelineSelect?.value, stageSelect.value);
          validateStageRequired(pipelineSelect?.value, stageSelect.value);
        });
      }
      updateStageRequiredBadges(pipelineSelect?.value, stageSelect?.value);

      createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const validation = validateStageRequired(pipelineSelect?.value, stageSelect?.value, { showErrors: true });
        if (!validation.ok) return;
        const data = Object.fromEntries(new FormData(createForm).entries());
        data.custom_fields = collectCustomFields(createForm);
        data.amount = data.amount ? Number(data.amount) : null;
        const payload = {
          title: data.title,
          pipeline_id: data.pipeline_id,
          stage_id: data.stage_id,
          amount: data.amount,
          close_date: data.close_date || null,
          source: data.source || 'desconhecida',
          description: data.description || null,
          phone: data.contact_phone || null,
          email: data.contact_email || null,
          contact_name: data.contact_name || null,
          contact_email: data.contact_email || null,
          contact_phone: data.contact_phone || null,
          custom_fields: data.custom_fields,
        };
        const res = await fetch('/api/crm/opportunities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
          },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) {
          alert(json.error || 'Erro ao criar oportunidade');
          return;
        }
        createForm.reset();
        loadOpps();
      });
    }
  });
})();
