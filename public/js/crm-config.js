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
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      data.required = form.querySelector('[name="required"]').checked;
      if (data.options) {
        try { data.options = JSON.parse(data.options); } catch { data.options = []; }
      }
      data.position = Number(data.position || 0);
      const res = await fetch('/api/crm/custom-fields', {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        alert('Campo criado');
        window.location.reload();
      } else {
        alert(json.error || 'Falha ao criar campo');
      }
    });
  }
})();
