(function() {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  const headers = csrf ? { 'Content-Type': 'application/json', 'CSRF-Token': csrf } : { 'Content-Type': 'application/json' };

  document.querySelectorAll('.js-save-stage').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const row = btn.closest('tr');
      const stageId = btn.dataset.id;
      const name = row.querySelector('[name="name"]').value;
      const probability = row.querySelector('[name="probability"]').value;
      const color = row.querySelector('[name="color"]').value;
      const forbid_jump = row.querySelector('[name="forbid_jump"]').checked;
      const forbid_back = row.querySelector('[name="forbid_back"]').checked;
      const required_fields = row.querySelector('[name="required_fields"]').value.split(',').map((s) => s.trim()).filter(Boolean);
      const sla_minutes = row.querySelector('[name="sla_minutes"]').value;
      // update stage
      await fetch(`/api/crm/stages/${stageId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name, probability, color, sla_minutes })
      });
      // update rule
      const res = await fetch(`/api/crm/stages/${stageId}/rule`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ required_fields, forbid_jump, forbid_back })
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || 'Falha ao salvar');
      } else {
        alert('Salvo');
      }
    });
  });

  const form = document.getElementById('newFieldForm');
  const fieldIdInput = document.getElementById('customFieldId');
  const submitBtn = document.getElementById('customFieldSubmit');
  const cancelBtn = document.getElementById('customFieldCancel');
  const filterSelect = document.getElementById('customFieldFilter');
  const optionsInput = form?.querySelector('[name="options"]');

  function normalizeOptions(raw) {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return raw.split(',').map((v) => v.trim()).filter(Boolean); }
  }

  function resetForm() {
    if (!form) return;
    form.reset();
    if (fieldIdInput) fieldIdInput.value = '';
    if (submitBtn) submitBtn.textContent = 'Adicionar';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  function setEditMode(row) {
    if (!row || !form) return;
    form.querySelector('[name="entity"]').value = row.dataset.entity || 'opportunity';
    form.querySelector('[name="name"]').value = row.dataset.name || '';
    form.querySelector('[name="type"]').value = row.dataset.type || 'text';
    form.querySelector('[name="position"]').value = row.dataset.position || 0;
    form.querySelector('[name="required"]').checked = row.dataset.required === '1';
    if (optionsInput) optionsInput.value = row.dataset.options ? row.dataset.options.replace(/&quot;/g, '"') : '';
    if (fieldIdInput) fieldIdInput.value = row.dataset.id || '';
    if (submitBtn) submitBtn.textContent = 'Salvar alterações';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
  }

  function applyFilter() {
    const val = filterSelect?.value || '';
    document.querySelectorAll('table tbody tr[data-id]').forEach((row) => {
      if (!val || row.dataset.entity === val) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      data.required = form.querySelector('[name="required"]').checked;
      data.options = normalizeOptions(data.options);
      data.position = Number(data.position || 0);
      const fieldId = fieldIdInput?.value || '';
      const method = fieldId ? 'PATCH' : 'POST';
      const url = fieldId ? `/api/crm/custom-fields/${fieldId}` : '/api/crm/custom-fields';
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        alert(fieldId ? 'Campo atualizado' : 'Campo criado');
        window.location.reload();
      } else {
        alert(json.error || 'Falha ao criar campo');
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => resetForm());
  }

  document.querySelectorAll('.js-edit-custom-field').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setEditMode(btn.closest('tr'));
    });
  });

  document.querySelectorAll('.js-delete-custom-field').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const row = btn.closest('tr');
      const id = row?.dataset?.id;
      if (!id) return;
      if (!confirm('Excluir este campo customizado?')) return;
      const res = await fetch(`/api/crm/custom-fields/${id}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json();
      if (json.success) {
        row.remove();
        resetForm();
      } else {
        alert(json.error || 'Falha ao remover campo');
      }
    });
  });

  if (filterSelect) {
    filterSelect.addEventListener('change', applyFilter);
    applyFilter();
  }
})();
