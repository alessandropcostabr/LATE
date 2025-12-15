/* public/js/crm-calendar.js */
(function() {
  const el = document.getElementById('crmCalendar');
  if (!el) return;

  async function fetchActivities() {
    const res = await fetch('/api/crm/activities');
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

  async function init() {
    const events = await fetchActivities();
    const calendar = new FullCalendar.Calendar(el, {
      initialView: 'dayGridMonth',
      locale: 'pt-br',
      height: 'auto',
      events,
    });
    calendar.render();
  }

  init();
})();
