(async function() {
  const dupList = document.getElementById('dupList');
  const headers = { 'Content-Type': 'application/json' };

  async function load() {
    dupList.innerHTML = 'Carregando...';
    const res = await fetch('/api/crm/dedupe/contacts');
    const json = await res.json();
    if (!json.success) { dupList.innerHTML = 'Erro ao carregar'; return; }
    const rows = json.data || [];
    if (!rows.length) { dupList.innerHTML = '<p class="muted">Sem duplicados.</p>'; return; }
    dupList.innerHTML = '';
    rows.forEach((r) => renderGroup(r));
  }

  function renderGroup(group) {
    const container = document.createElement('div');
    container.className = 'card';
    const header = document.createElement('header');
    header.className = 'card__header';
    header.innerHTML = '<strong>Telefone:</strong> ' + (group.phone_normalized || '-') + ' · <strong>Email:</strong> ' + (group.email_normalized || '-') + ' · <strong>Total:</strong> ' + group.total;
    container.appendChild(header);

    const body = document.createElement('div');
    body.className = 'card__body';
    const select = document.createElement('select');
    select.className = 'input';
    (group.ids || []).forEach((id, idx) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id + (idx === 0 ? ' (alvo)' : '');
      select.appendChild(opt);
    });
    body.appendChild(select);

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Merge (demais -> alvo)';
    btn.addEventListener('click', () => {
      const target = select.value;
      const sources = (group.ids || []).filter((i) => i !== target);
      mergeGroup(target, sources);
    });
    body.appendChild(btn);
    container.appendChild(body);
    dupList.appendChild(container);
  }

  async function mergeGroup(target, sources) {
    if (!target || !sources.length) return;
    for (const s of sources) {
      await fetch('/api/crm/dedupe/contacts/merge', {
        method: 'POST',
        headers,
        body: JSON.stringify({ source_id: s, target_id: target })
      });
    }
    alert('Merge concluído');
    load();
  }

  document.getElementById('btnReload').addEventListener('click', load);
  load();
})();
