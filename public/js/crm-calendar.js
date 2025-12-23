/* public/js/crm-calendar.js */
(function() {
  const el = document.getElementById('crmCalendar');
  if (!el) return;
  const form = document.getElementById('activityCreateForm');
  const permissionsEl = document.querySelector('[data-crm-permissions]');
  const canUpdate = permissionsEl?.dataset?.canUpdate === 'true';
  const canDelete = permissionsEl?.dataset?.canDelete === 'true';
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  const editModalEl = document.getElementById('activityEditModal');
  const editForm = document.getElementById('activityEditForm');
  const deleteBtn = document.getElementById('activityDeleteBtn');
  let editModal;
  let selectedActivityId = null;

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

  function formatDateTimeInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  async function renderCalendar() {
    const events = await fetchActivities();
    calendar?.destroy();
    calendar = new FullCalendar.Calendar(el, {
      initialView: 'dayGridMonth',
      locale: 'pt-br',
      height: 'auto',
      events,
      eventClick: (info) => {
        if (!canUpdate && !canDelete) return;
        const activity = info.event.extendedProps || {};
        selectedActivityId = activity.id || info.event.id;
        if (!selectedActivityId || !editForm) return;
        editForm.activity_id.value = selectedActivityId;
        editForm.type.value = activity.type || 'task';
        editForm.subject.value = activity.subject || '';
        editForm.starts_at.value = formatDateTimeInput(activity.starts_at || activity.created_at);
        editForm.ends_at.value = formatDateTimeInput(activity.ends_at || '');
        editForm.status.value = activity.status || 'pending';
        editForm.related_type.value = activity.related_type || '';
        editForm.related_id.value = activity.related_id || '';
        editForm.location.value = activity.location || '';
        editModal?.show();
      },
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
    if (editModalEl && window.bootstrap) {
      editModal = new bootstrap.Modal(editModalEl);
    }
    if (deleteBtn && !canDelete) {
      deleteBtn.style.display = 'none';
    }
    hydrateFromUrl();
    renderCalendar();
    const scopeSel = document.getElementById('scope');
    if (scopeSel) {
      scopeSel.addEventListener('change', () => {
        syncUrl();
        renderCalendar();
      });
    }
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        data.custom_fields = collectCustomFields(form);
        const res = await fetch('/api/crm/activities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
          },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.success) {
          alert(json.error || 'Erro ao criar atividade');
          return;
        }
        form.reset();
        renderCalendar();
      });
    }

    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const activityId = editForm.activity_id.value;
        if (!activityId) return;
        const raw = Object.fromEntries(new FormData(editForm).entries());
        const data = {};
        Object.entries(raw).forEach(([key, value]) => {
          if (key === 'activity_id') return;
          if (value === '') return;
          data[key] = value;
        });
        const res = await fetch(`/api/crm/activities/${activityId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
          },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.success) {
          alert(json.error || 'Erro ao atualizar atividade');
          return;
        }
        editModal?.hide();
        renderCalendar();
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!selectedActivityId) return;
        if (!confirm('Confirmar exclusão da atividade?')) return;
        const res = await fetch(`/api/crm/activities/${selectedActivityId}`, {
          method: 'DELETE',
          headers: { ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        });
        const json = await res.json();
        if (!json.success) {
          alert(json.error || 'Erro ao excluir atividade');
          return;
        }
        editModal?.hide();
        renderCalendar();
      });
    }
  });
})();
