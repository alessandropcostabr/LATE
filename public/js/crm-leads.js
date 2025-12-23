// public/js/crm-leads.js
(function () {
  const form = document.getElementById('leadFilters');
  const tableBody = document.querySelector('table tbody');
  const createForm = document.getElementById('leadCreateForm');
  const permissionsEl = document.querySelector('[data-crm-permissions]');
  const canUpdate = permissionsEl?.dataset?.canUpdate === 'true';
  const canDelete = permissionsEl?.dataset?.canDelete === 'true';
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  const editModalEl = document.getElementById('leadEditModal');
  const editForm = document.getElementById('leadEditForm');
  let editModal;
  const leadCache = new Map();

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

  function buildQuery(params) {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.scope) qs.set('scope', params.scope);
    qs.set('limit', '100');
    return qs.toString();
  }

  async function loadLeads() {
    const search = form?.search?.value?.trim() || '';
    const scope = form?.scope?.value || 'me';
    const qs = buildQuery({ search, scope });
    const res = await fetch(`/api/crm/leads?${qs}`);
    const json = await res.json();
    const leads = json.data || [];
    leadCache.clear();
    leads.forEach((lead) => leadCache.set(String(lead.id), lead));
    if (!tableBody) return;
    if (!leads.length) {
      tableBody.innerHTML = '<tr><td colspan="8" class="muted">Nenhum lead encontrado.</td></tr>';
      return;
    }
    tableBody.innerHTML = leads.map((lead) => `
      <tr>
        <td>${escapeHtml(lead.contact_name || '-')}</td>
        <td>${escapeHtml(lead.phone || lead.phone_normalized || '-')}</td>
        <td>${escapeHtml(lead.email || '-')}</td>
        <td>${escapeHtml(lead.status || '-')}</td>
        <td>${escapeHtml(lead.pipeline_name || lead.pipeline_id || '-')}</td>
        <td>${escapeHtml(lead.score || 0)}</td>
        <td>${escapeHtml(lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : '-')}</td>
        <td>
          ${canUpdate ? `<button class="btn btn-sm btn-outline" data-action="edit" data-id="${lead.id}">Editar</button>` : ''}
          ${canDelete ? `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${lead.id}">Excluir</button>` : ''}
        </td>
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
    if (editModalEl && window.bootstrap) {
      editModal = new bootstrap.Modal(editModalEl);
    }
    if (form) {
      hydrateFromUrl();
      loadLeads();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        syncUrl();
        loadLeads();
      });
      const resetBtn = document.getElementById('leadFiltersReset');
      if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
          e.preventDefault();
          form.reset();
          syncUrl();
          loadLeads();
        });
      }
    }
    if (createForm) {
      createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(createForm).entries());
        data.custom_fields = collectCustomFields(createForm);
        const res = await fetch('/api/crm/leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
          },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.success) {
          alert(json.error || 'Erro ao criar lead');
          return;
        }
        createForm.reset();
        loadLeads();
      });
    }
    if (tableBody) {
      tableBody.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        const leadId = button.dataset.id;
        if (!leadId) return;
        const lead = leadCache.get(String(leadId));
        if (!lead) return;

        if (action === 'edit') {
          if (!editForm) return;
          editForm.lead_id.value = lead.id;
          editForm.contact_name.value = lead.contact_name || '';
          editForm.contact_email.value = lead.email || '';
          editForm.contact_phone.value = lead.phone || lead.phone_normalized || '';
          editForm.status.value = lead.status || '';
          editForm.pipeline_id.value = lead.pipeline_id || '';
          editForm.score.value = lead.score ?? '';
          editForm.source.value = lead.source || '';
          editForm.notes.value = lead.notes || '';
          editModal?.show();
        }

        if (action === 'delete') {
          const depRes = await fetch(`/api/crm/leads/${leadId}/dependencies`);
          const depJson = await depRes.json();
          const counts = depJson?.data?.counts || {};
          const activities = counts.activities || 0;
          if (activities > 0) {
            alert(`Não é possível excluir. Atividades vinculadas: ${activities}.`);
            return;
          }
          if (!confirm('Confirmar exclusão do lead?')) return;
          const res = await fetch(`/api/crm/leads/${leadId}`, {
            method: 'DELETE',
            headers: { ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
          });
          const json = await res.json();
          if (!json.success) {
            alert(json.error || 'Erro ao excluir lead');
            return;
          }
          loadLeads();
        }
      });
    }
    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const leadId = editForm.lead_id.value;
        if (!leadId) return;
        const original = leadCache.get(String(leadId)) || {};
        const data = {};
        const contactName = editForm.contact_name.value.trim();
        if (contactName && contactName !== (original.contact_name || '')) data.contact_name = contactName;
        const contactEmail = editForm.contact_email.value.trim();
        if (contactEmail && contactEmail !== (original.email || '')) data.contact_email = contactEmail;
        const contactPhone = editForm.contact_phone.value.trim();
        if (contactPhone && contactPhone !== (original.phone || original.phone_normalized || '')) data.contact_phone = contactPhone;
        const status = editForm.status.value.trim();
        if (status && status !== (original.status || '')) data.status = status;
        const pipelineId = editForm.pipeline_id.value;
        if (pipelineId && pipelineId !== (original.pipeline_id || '')) data.pipeline_id = pipelineId;
        const score = editForm.score.value;
        if (score !== '' && String(score) !== String(original.score ?? '')) data.score = score;
        const source = editForm.source.value.trim();
        if (source && source !== (original.source || '')) data.source = source;
        const notes = editForm.notes.value.trim();
        if (notes && notes !== (original.notes || '')) data.notes = notes;

        if (!Object.keys(data).length) {
          alert('Nenhuma alteração informada.');
          return;
        }
        const res = await fetch(`/api/crm/leads/${leadId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
          },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.success) {
          alert(json.error || 'Erro ao atualizar lead');
          return;
        }
        editModal?.hide();
        loadLeads();
      });
    }
  });
})();
