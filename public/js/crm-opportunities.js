// public/js/crm-opportunities.js
(function () {
  const form = document.getElementById('opportunityFilters');
  const tableBody = document.querySelector('table tbody');

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
        <td>${opp.title}</td>
        <td>${opp.contact_name || '-'}</td>
        <td>${opp.phone || '-'}</td>
        <td>${opp.pipeline_id} / ${opp.stage_id}</td>
        <td>${opp.amount ? `R$ ${Number(opp.amount).toFixed(2)}` : '-'}</td>
        <td>${opp.close_date ? new Date(opp.close_date).toLocaleDateString('pt-BR') : '-'}</td>
        <td>${opp.source || '-'}</td>
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
  });
})();
