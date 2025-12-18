// public/js/crm-leads.js
(function () {
  const form = document.getElementById('leadFilters');
  const tableBody = document.querySelector('table tbody');

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
    if (!tableBody) return;
    if (!leads.length) {
      tableBody.innerHTML = '<tr><td colspan="7" class="muted">Nenhum lead encontrado.</td></tr>';
      return;
    }
    tableBody.innerHTML = leads.map((lead) => `
      <tr>
        <td>${lead.contact_name || '-'}</td>
        <td>${lead.phone || lead.phone_normalized || '-'}</td>
        <td>${lead.email || '-'}</td>
        <td>${lead.status || '-'}</td>
        <td>${lead.pipeline_id ? lead.pipeline_id : '-'}</td>
        <td>${lead.score || 0}</td>
        <td>${lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : '-'}</td>
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
    if (!form) return;
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
  });
})();
