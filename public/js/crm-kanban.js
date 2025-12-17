/* public/js/crm-kanban.js */
(async function() {
  const board = document.getElementById('kanbanBoard');
  const pipelineSelect = document.getElementById('pipelineSelect');
  const ownerSelect = document.getElementById('ownerSelect');
  const stageSelect = document.getElementById('stageSelect');
  const searchInput = document.getElementById('searchInput');

  let pipelinesCache = [];

  async function fetchPipelines() {
    if (pipelinesCache.length) return pipelinesCache;
    const res = await fetch('/api/crm/pipelines');
    const json = await res.json();
    pipelinesCache = json.success ? json.data : [];
    return pipelinesCache;
  }

  async function fetchOpportunities({ pipelineId, owner, stageId, search }) {
    const params = new URLSearchParams();
    if (pipelineId) params.set('pipeline_id', pipelineId);
    if (owner === 'me') params.set('owner_id', 'me');
    if (stageId) params.set('stage_id', stageId);
    if (search) params.set('search', search.trim());
    params.set('limit', '500');
    const res = await fetch(`/api/crm/opportunities?${params.toString()}`);
    const json = await res.json();
    return json.success ? json.data : [];
  }

  function renderKanban(pipeline, opps) {
    board.innerHTML = '';
    if (!pipeline) {
      board.innerHTML = '<p class="muted">Selecione um pipeline.</p>';
      return;
    }
    pipeline.stages.forEach((stage) => {
      const col = document.createElement('div');
      col.className = 'kanban__column';
      col.dataset.stageId = stage.id;
      col.innerHTML = `<header class="kanban__column-header">${stage.name}</header><div class="kanban__items"></div>`;
      board.appendChild(col);
    });
    opps.forEach((opp) => {
      const col = board.querySelector(`[data-stage-id="${opp.stage_id}"] .kanban__items`);
      if (!col) return;
      const card = document.createElement('article');
      card.className = 'kanban__card';
      card.draggable = true;
      card.dataset.id = opp.id;
      card.dataset.stageId = opp.stage_id;
      const amount = opp.amount ? `R$ ${Number(opp.amount).toFixed(2)}` : '-';
      const close = opp.close_date ? new Date(opp.close_date).toLocaleDateString('pt-BR') : '-';
      card.innerHTML = `
        <strong>${opp.title}</strong>
        <p class="muted">${opp.contact_name || ''}</p>
        <p class="muted">Valor: ${amount} · Fecha: ${close}</p>
      `;
      card.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/plain', opp.id);
        ev.dataTransfer.setData('stage', opp.stage_id);
      });
      col.appendChild(card);
    });

    board.querySelectorAll('.kanban__column').forEach((col) => {
      col.addEventListener('dragover', (ev) => ev.preventDefault());
      col.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        const id = ev.dataTransfer.getData('text/plain');
        const fromStage = ev.dataTransfer.getData('stage');
        const toStage = col.dataset.stageId;
        if (!id || !toStage || fromStage === toStage) return;
        const res = await fetch(`/api/crm/opportunities/${id}/stage`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage_id: toStage }),
        });
        const json = await res.json();
        if (!json.success) {
          alert(json.error || 'Falha ao mover');
          return;
        }
        loadData();
      });
    });
  }

  function populateStages(pipeline) {
    stageSelect.innerHTML = '<option value="">Todas etapas</option>';
    if (!pipeline) return;
    pipeline.stages.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      stageSelect.appendChild(opt);
    });
  }

  async function loadData() {
    const pipelines = await fetchPipelines();
    if (pipelines.length && !pipelineSelect.dataset.loaded) {
      pipelines.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        pipelineSelect.appendChild(opt);
      });
      pipelineSelect.dataset.loaded = '1';
    }
    const selectedPipelineId = pipelineSelect.value || (pipelines[0] && pipelines[0].id);
    const pipeline = pipelines.find((p) => p.id === selectedPipelineId);
    pipelineSelect.value = selectedPipelineId || '';
    populateStages(pipeline);
    const opps = await fetchOpportunities({
      pipelineId: selectedPipelineId,
      owner: ownerSelect.value,
      stageId: stageSelect.value,
      search: searchInput.value,
    });
    renderKanban(pipeline, opps);
  }

  ['change', 'keyup'].forEach((evName) => searchInput.addEventListener(evName, () => {
    clearTimeout(searchInput._t);
    searchInput._t = setTimeout(loadData, 250);
  }));

  pipelineSelect.addEventListener('change', loadData);
  ownerSelect.addEventListener('change', loadData);
  stageSelect.addEventListener('change', loadData);

  loadData();
})();
