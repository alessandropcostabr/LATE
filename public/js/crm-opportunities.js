// public/js/crm-opportunities.js
(function () {
  const form = document.getElementById('opportunityFilters');
  const tableBody = document.querySelector('table tbody');
  const createForm = document.getElementById('opportunityCreateForm');
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  const pipelines = window.CRM_OPP_PIPELINES || [];
  const stagesByPipeline = window.CRM_OPP_STAGES || {};

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
      if (pipelineSelect) {
        pipelineSelect.addEventListener('change', () => {
          renderStages(pipelineSelect.value);
        });
        const firstPipeline = pipelineSelect.value || pipelines?.[0]?.id;
        if (firstPipeline) {
          pipelineSelect.value = firstPipeline;
          renderStages(firstPipeline);
        }
      }

      createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
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
