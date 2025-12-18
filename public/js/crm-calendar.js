/* public/js/crm-calendar.js */
(function() {
  const el = document.getElementById('crmCalendar');
  if (!el) return;

  function buildQuery() {
    const params = new URLSearchParams();
    const scopeSel = document.getElementById('scope');
    const scope = scopeSel?.value || 'me';
    params.set('scope', scope);
    return params.toString();
  }

  async function fetchActivities() {
    const qs = buildQuery();
    const res = await fetch(`/api/crm/activities${qs ? `?${qs}` : ''}`);
    const json = await res.json();
    if (!json.success) return [];
    return (json.data || []).map((a) => ({
      id: a.id,
      title: a.subject,
      start: a.starts_at || a.created_at,
      end: a.ends_at || a.starts_at,
      extendedProps: a,
    }));
  }

  async function renderCalendar() {
    const events = await fetchActivities();
    calendar?.destroy();
    calendar = new FullCalendar.Calendar(el, {
      initialView: 'dayGridMonth',
      locale: 'pt-br',
      height: 'auto',
      events,
    });
    calendar.render();
  }

  let calendar;

  function hydrateFromUrl() {
    const qs = new URLSearchParams(window.location.search);
    const scopeSel = document.getElementById('scope');
    if (scopeSel && qs.has('scope')) scopeSel.value = qs.get('scope');
  }

  function syncUrl() {
    const qs = buildQuery();
    const target = qs ? `?${qs}` : '';
    if (target !== window.location.search) {
      window.history.replaceState({}, '', `${window.location.pathname}${target}`);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    hydrateFromUrl();
    renderCalendar();
    const scopeSel = document.getElementById('scope');
    if (scopeSel) {
      scopeSel.addEventListener('change', () => {
        syncUrl();
        renderCalendar();
      });
    }
  });
})();
