(function auditModule(global) {
  const AUTO_INIT_DISABLED = Boolean(global.__LATE_DISABLE_AUTO_INIT__);
  const state = {
    filters: null,
    cursor: null,
    loading: false,
    defaults: {
      fromIso: null,
      toIso: null,
      fromInput: '',
      toInput: '',
    },
    users: [],
    storageKey: null,
  };

  const elements = {
    root: null,
    form: null,
    resetButton: null,
    loadMore: null,
    summaryCards: null,
    topEvents: null,
    dailyList: null,
    tableBody: null,
    status: null,
    exportButton: null,
    legend: null,
    actorOptions: [],
    inputs: {},
  };

  const EVENT_DEFINITIONS = {
    'message.created': {
      label: 'Registro criado',
      description: 'Abertura manual ou via intake.',
    },
    'message.status_changed': {
      label: 'Mudança de status',
      description: 'Transição com origem/destino registrados.',
    },
    'message.resolved': {
      label: 'Resolução concluída',
      description: 'Encerramento com comentário obrigatório.',
    },
    'message.forwarded': {
      label: 'Encaminhamento',
      description: 'Repassado para outro usuário ou setor.',
    },
    'comment.created': {
      label: 'Comentário registrado',
      description: 'Inclui follow-up obrigatório.',
    },
    'automation.fired': {
      label: 'Automação executada',
      description: 'Alertas, lembretes e fluxos automáticos.',
    },
    'user.login': {
      label: 'Login realizado',
      description: 'Sessão criada via web ou API.',
    },
    'user.logout': {
      label: 'Logout / sessão encerrada',
      description: 'Saída manual ou invalidação por política.',
    },
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toIso(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  function formatInputFromIso(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (v) => String(v).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatEventTypeLabel(value) {
    if (!value) return 'Evento';
    const normalized = String(value).toLowerCase();
    if (EVENT_DEFINITIONS[normalized]) return EVENT_DEFINITIONS[normalized].label;
    const parts = value.split('.');
    if (parts.length === 1) return capitalize(parts[0]);
    return `${capitalize(parts[0])} · ${parts.slice(1).join(' / ')}`;
  }

  function capitalize(value) {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  function normalizeMultiValue(raw) {
    if (!raw) return '';
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .join(',');
  }

  function parseUsersData() {
    try {
      const script = document.getElementById('auditUsersData');
      if (!script || !script.textContent) return [];
      const parsed = JSON.parse(script.textContent);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((user) => Number.isInteger(user.id) && user.name);
    } catch (err) {
      console.warn('[audit-ui] falha ao ler usuários disponíveis:', err);
      return [];
    }
  }

  function resolveActorValue(label) {
    if (!label) return null;
    const trimmed = String(label).trim();
    if (!trimmed) return null;
    const lowerValue = trimmed.toLowerCase();

    if (elements.actorOptions?.length) {
      const option = elements.actorOptions.find(
        (opt) => opt.value && opt.value.toLowerCase() === lowerValue
      );
      if (option?.dataset?.id) {
        const parsedOptionId = Number(option.dataset.id);
        if (Number.isFinite(parsedOptionId)) {
          return parsedOptionId;
        }
      }
    }

    const hashMatch = trimmed.match(/#(\d+)/);
    if (hashMatch) return Number(hashMatch[1]);

    const numeric = Number(trimmed);
    if (Number.isInteger(numeric) && numeric > 0) return numeric;

    const found = state.users.find((user) => user.name?.toLowerCase() === lowerValue);
    return found ? Number(found.id) : null;
  }

  function getStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
    } catch (err) {
      console.warn('[audit-ui] localStorage indisponível:', err);
    }
    return null;
  }

  function getStoredFilters() {
    const storage = getStorage();
    if (!storage || !state.storageKey) return null;
    try {
      const raw = storage.getItem(state.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('[audit-ui] falha ao carregar filtros salvos:', err);
      return null;
    }
  }

  function persistFilters(filters) {
    const storage = getStorage();
    if (!storage || !state.storageKey) return;
    try {
      const payload = {
        ...filters,
        actor_user_name: elements.inputs.actorName?.value || '',
      };
      storage.setItem(state.storageKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('[audit-ui] falha ao salvar filtros:', err);
    }
  }

  function clearStoredFilters() {
    const storage = getStorage();
    if (!storage || !state.storageKey) return;
    try {
      storage.removeItem(state.storageKey);
    } catch (err) {
      console.warn('[audit-ui] falha ao limpar filtros salvos:', err);
    }
  }

  function applyStoredFilters() {
    const stored = getStoredFilters();
    if (!stored) return;
    if (stored.from && elements.inputs.from) {
      elements.inputs.from.value = formatInputFromIso(stored.from) || elements.inputs.from.value;
    }
    if (stored.to && elements.inputs.to) {
      elements.inputs.to.value = formatInputFromIso(stored.to) || elements.inputs.to.value;
    }
    if (stored.event_type && elements.inputs.eventType) {
      elements.inputs.eventType.value = stored.event_type;
    }
    if (stored.entity_type && elements.inputs.entityType) {
      elements.inputs.entityType.value = stored.entity_type;
    }
    if (stored.entity_id && elements.inputs.entityId) {
      elements.inputs.entityId.value = stored.entity_id;
    }
    if (stored.search && elements.inputs.search) {
      elements.inputs.search.value = stored.search;
    }
    if (stored.limit && elements.inputs.limit) {
      elements.inputs.limit.value = stored.limit;
    }
    if (elements.inputs.actorName && stored.actor_user_name) {
      elements.inputs.actorName.value = stored.actor_user_name;
    }
    if (elements.inputs.actorId) {
      elements.inputs.actorId.value = stored.actor_user_id ? String(stored.actor_user_id) : '';
    }
    syncActorHidden();
  }

  function syncActorHidden() {
    const { actorName, actorId } = elements.inputs;
    if (!actorName || !actorId) return;
    const resolved = resolveActorValue(actorName.value);
    actorId.value = resolved ? String(resolved) : '';
  }

  function setupActorField() {
    const { actorName } = elements.inputs;
    if (!actorName) return;
    const handler = () => syncActorHidden();
    actorName.addEventListener('input', handler);
    actorName.addEventListener('change', handler);
    syncActorHidden();
  }

  function renderEventLegend() {
    if (!elements.legend) return;
    const entries = Object.entries(EVENT_DEFINITIONS);
    if (!entries.length) {
      elements.legend.innerHTML = '<li class="text-muted">Nenhum evento mapeado ainda.</li>';
      return;
    }
    elements.legend.innerHTML = entries
      .map(([type, def]) => `
        <li>
          <strong>${escapeHtml(def.label)}</strong>
          <span>${escapeHtml(def.description)}</span>
          <code class="audit-legend__code">${escapeHtml(type)}</code>
        </li>
      `)
      .join('');
  }

  function setupExportButton() {
    if (!elements.exportButton) return;
    elements.exportButton.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = '/relatorios/exportacoes';
    });
  }

  function buildFiltersPayload(form) {
    const formData = new FormData(form);
    const actorLabel = (formData.get('actor_user_name') || '').trim();
    let actorUserId = (formData.get('actor_user_id') || '').trim();
    if (!actorUserId && actorLabel) {
      const resolvedActor = resolveActorValue(actorLabel);
      actorUserId = resolvedActor ? String(resolvedActor) : '';
    }

    const payload = {
      from: toIso(formData.get('from')),
      to: toIso(formData.get('to')),
      event_type: normalizeMultiValue(formData.get('event_type')),
      entity_type: (formData.get('entity_type') || '').trim() || null,
      entity_id: (formData.get('entity_id') || '').trim() || null,
      actor_user_id: actorUserId || null,
      search: (formData.get('search') || '').trim() || null,
      limit: Number(formData.get('limit')) || 50,
    };

    if (!payload.from || !payload.to) {
      throw new Error('Selecione um intervalo de datas válido.');
    }

    return payload;
  }

  function setStatus(message, variant = 'info') {
    if (!elements.status) return;
    if (!message) {
      elements.status.classList.add('d-none');
      elements.status.textContent = '';
      return;
    }

    elements.status.classList.remove('d-none', 'alert-info', 'alert-danger', 'alert-success');
    elements.status.classList.add(`alert-${variant}`);
    elements.status.textContent = message;
  }

  function setPlaceholder(message) {
    if (!elements.tableBody) return;
    elements.tableBody.innerHTML = `
      <tr class="table-placeholder">
        <td colspan="5">${escapeHtml(message)}</td>
      </tr>
    `;
  }

  function metadataSummary(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      return '<span class="text-muted">Sem detalhes</span>';
    }
    const entries = Object.entries(metadata);
    if (!entries.length) {
      return '<span class="text-muted">Sem detalhes</span>';
    }
    const summary = entries.slice(0, 3).map(([key, value]) => {
      const normalizedValue = typeof value === 'object' ? JSON.stringify(value) : value;
      return `<span><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(normalizedValue))}</span>`;
    }).join('<span class="audit-metadata__dot">·</span>');
    return `<div class="audit-metadata__summary">${summary}</div>`;
  }

  function metadataDetails(metadata) {
    if (!metadata || typeof metadata !== 'object') return '';
    const pretty = escapeHtml(JSON.stringify(metadata, null, 2));
    return `
      <details class="audit-metadata__details">
        <summary>JSON completo</summary>
        <pre>${pretty}</pre>
      </details>
    `;
  }

  function describeActor(actor) {
    if (!actor) return '<span class="text-muted">Não identificado</span>';
    if (actor.name) {
      return `<span>${escapeHtml(actor.name)} <small class="text-muted">#${actor.id}</small></span>`;
    }
    return `<span>ID ${escapeHtml(String(actor.id))}</span>`;
  }

  function renderTable(items, { append = false } = {}) {
    if (!elements.tableBody) return;
    if (!append) {
      elements.tableBody.innerHTML = '';
    }

    if (!items.length && !append) {
      setPlaceholder('Nenhum evento encontrado para este filtro.');
      return;
    }

    items.forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="audit-table__date">${escapeHtml(formatDateTime(item.created_at))}</div>
        </td>
        <td>
          <div class="audit-table__event">
            <strong>${escapeHtml(formatEventTypeLabel(item.event_type))}</strong>
            <div class="text-muted">${escapeHtml(item.event_type || '')}</div>
          </div>
        </td>
        <td>
          <div>
            <div class="text-uppercase small text-muted">${escapeHtml(item.entity_type || '-')}</div>
            <code>${escapeHtml(item.entity_id || '-')}</code>
          </div>
        </td>
        <td>
          ${describeActor(item.actor_user)}
        </td>
        <td>
          <div class="audit-metadata">
            ${metadataSummary(item.metadata)}
            ${metadataDetails(item.metadata)}
          </div>
        </td>
      `;
      elements.tableBody.appendChild(row);
    });
  }

  function renderSummary(summary) {
    if (!elements.summaryCards) return;
    const byType = summary?.byType || [];
    const daily = summary?.daily || [];
    const total = byType.reduce((acc, row) => acc + Number(row.count || 0), 0);
    const mostFrequent = byType[0];
    const avg = daily.length ? Math.round(total / daily.length) : 0;

    const cards = [
      {
        label: 'Eventos no período',
        value: total,
        description: `${byType.length} tipos diferentes`,
      },
      {
        label: 'Evento mais frequente',
        value: mostFrequent ? mostFrequent.count : 0,
        description: mostFrequent ? formatEventTypeLabel(mostFrequent.event_type) : 'Sem registros',
      },
      {
        label: 'Dias com atividade',
        value: daily.length,
        description: avg ? `Média diária de ${avg}` : 'Sem média disponível',
      },
      {
        label: 'Filtro aplicado',
        value: formatDateRange(state.filters?.from, state.filters?.to),
        description: 'Horário local',
      },
    ];

    elements.summaryCards.innerHTML = cards.map((card) => `
      <article class="audit-summary__card">
        <p class="audit-summary__card-label">${escapeHtml(card.label)}</p>
        <p class="audit-summary__card-value">${escapeHtml(String(card.value ?? '0'))}</p>
        <p class="audit-summary__card-desc text-muted">${escapeHtml(card.description || '')}</p>
      </article>
    `).join('');

    renderTopEvents(byType);
    renderDailyBreakdown(daily);
  }

  function formatDateRange(fromIso, toIso) {
    if (!fromIso || !toIso) return '-';
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '-';
    return `${formatter.format(from)} → ${formatter.format(to)}`;
  }

  function renderTopEvents(entries) {
    if (!elements.topEvents) return;
    if (!entries.length) {
      elements.topEvents.innerHTML = '<li class="text-muted">Sem dados para o filtro atual.</li>';
      return;
    }
    elements.topEvents.innerHTML = entries.slice(0, 6).map((row) => `
      <li>
        <span class="audit-chip">${escapeHtml(formatEventTypeLabel(row.event_type))}</span>
        <strong>${escapeHtml(String(row.count))}</strong> eventos
      </li>
    `).join('');
  }

  function renderDailyBreakdown(entries) {
    if (!elements.dailyList) return;
    if (!entries.length) {
      elements.dailyList.innerHTML = '<li class="text-muted">Sem atividade registrada.</li>';
      return;
    }
    elements.dailyList.innerHTML = entries
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 7)
      .map((row) => `
        <li>
          <span>${escapeHtml(new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(row.date)))}</span>
          <strong>${escapeHtml(String(row.count))}</strong>
        </li>
      `)
      .join('');
  }

  async function refresh({ append = false } = {}) {
    if (state.loading) return;
    state.loading = true;

    if (!append) {
      syncActorHidden();
      setStatus('Carregando eventos...', 'info');
      setPlaceholder('Carregando eventos...');
    }

    let filters;
    try {
      filters = append ? state.filters : buildFiltersPayload(elements.form);
    } catch (err) {
      state.loading = false;
      setStatus(err.message || 'Parâmetros inválidos.', 'danger');
      return;
    }

    if (!filters) {
      state.loading = false;
      setStatus('Parâmetros inválidos.', 'danger');
      return;
    }

    if (!append) {
      state.filters = filters;
      state.cursor = null;
      persistFilters(filters);
    }

    const listParams = {
      from: filters.from,
      to: filters.to,
      limit: filters.limit,
      event_type: filters.event_type,
      entity_type: filters.entity_type,
      entity_id: filters.entity_id,
      actor_user_id: filters.actor_user_id,
      search: filters.search,
    };

    if (append && state.cursor) {
      listParams.cursor = state.cursor;
    }

    try {
      const summaryPromise = append ? Promise.resolve(null) : API.getEventLogsSummary({
        from: filters.from,
        to: filters.to,
        event_type: filters.event_type,
      });
      const [summaryResponse, listResponse] = await Promise.all([
        summaryPromise,
        API.getEventLogs(listParams),
      ]);

      if (!append && summaryResponse?.data) {
        renderSummary(summaryResponse.data);
      }

      const items = listResponse?.data?.items || [];
      renderTable(items, { append });

      state.cursor = listResponse?.data?.nextCursor || null;
      toggleLoadMore(state.cursor);
      setStatus(items.length || append ? null : 'Nenhum evento encontrado para este filtro.', 'info');
    } catch (error) {
      console.error('[audit-ui] falha ao consultar auditoria:', error);
      setStatus(error.message || 'Erro ao consultar auditoria.', 'danger');
    } finally {
      state.loading = false;
    }
  }

  function toggleLoadMore(hasCursor) {
    if (!elements.loadMore) return;
    if (hasCursor) {
      elements.loadMore.classList.remove('d-none');
      elements.loadMore.disabled = false;
      elements.loadMore.textContent = 'Carregar mais eventos';
    } else {
      elements.loadMore.classList.add('d-none');
    }
  }

  function handleLoadMore() {
    if (!state.cursor || state.loading) return;
    elements.loadMore.disabled = true;
    elements.loadMore.textContent = 'Carregando...';
    refresh({ append: true }).finally(() => {
      elements.loadMore.disabled = false;
      elements.loadMore.textContent = 'Carregar mais eventos';
    });
  }

  function hydrateDefaults() {
    state.defaults.fromIso = elements.root?.dataset.defaultFrom || state.defaults.fromIso;
    state.defaults.toIso = elements.root?.dataset.defaultTo || state.defaults.toIso;
    state.defaults.fromInput = formatInputFromIso(state.defaults.fromIso) || elements.inputs.from?.value || '';
    state.defaults.toInput = formatInputFromIso(state.defaults.toIso) || elements.inputs.to?.value || '';

    if (elements.inputs.from && state.defaults.fromInput) {
      elements.inputs.from.value = state.defaults.fromInput;
    }
    if (elements.inputs.to && state.defaults.toInput) {
      elements.inputs.to.value = state.defaults.toInput;
    }

    applyStoredFilters();
    syncActorHidden();
  }

  function resetFilters() {
    if (!elements.form) return;
    elements.form.reset();
    if (elements.inputs.from) {
      elements.inputs.from.value = state.defaults.fromInput || '';
    }
    if (elements.inputs.to) {
      elements.inputs.to.value = state.defaults.toInput || '';
    }
    if (elements.inputs.eventType) elements.inputs.eventType.value = '';
    if (elements.inputs.entityType) elements.inputs.entityType.value = '';
    if (elements.inputs.entityId) elements.inputs.entityId.value = '';
    if (elements.inputs.search) elements.inputs.search.value = '';
    if (elements.inputs.limit) elements.inputs.limit.value = '50';
    if (elements.inputs.actorName) elements.inputs.actorName.value = '';
    if (elements.inputs.actorId) elements.inputs.actorId.value = '';
    clearStoredFilters();
    syncActorHidden();
    refresh({ append: false });
  }

  function bindEvents() {
    if (elements.form) {
      elements.form.addEventListener('submit', (event) => {
        event.preventDefault();
        refresh({ append: false });
      });
    }
    if (elements.resetButton) {
      elements.resetButton.addEventListener('click', resetFilters);
    }
    if (elements.loadMore) {
      elements.loadMore.addEventListener('click', handleLoadMore);
    }
  }

  function mapElements() {
    elements.root = document.querySelector('[data-audit-root]');
    if (!elements.root) return false;
    elements.form = document.getElementById('auditFiltersForm');
    elements.resetButton = document.getElementById('auditResetFilters');
    elements.loadMore = document.getElementById('auditLoadMore');
    elements.summaryCards = document.getElementById('auditSummaryCards');
    elements.topEvents = document.getElementById('auditTopEvents');
    elements.dailyList = document.getElementById('auditDailyBreakdown');
    elements.tableBody = document.getElementById('auditTableBody');
    elements.status = document.getElementById('auditTableStatus');
    elements.exportButton = document.getElementById('auditExportButton');
    elements.legend = document.getElementById('auditEventLegend');
    elements.inputs = {
      from: document.getElementById('auditFrom'),
      to: document.getElementById('auditTo'),
      eventType: document.getElementById('auditEventType'),
      entityType: document.getElementById('auditEntityType'),
      entityId: document.getElementById('auditEntityId'),
      actorName: document.getElementById('auditActorName'),
      actorId: document.getElementById('auditActorId'),
      search: document.getElementById('auditSearch'),
      limit: document.getElementById('auditLimit'),
    };
    elements.actorOptions = Array.from(
      document.querySelectorAll('#auditUsersOptions option')
    );
    state.storageKey = elements.root.dataset.filterKey || null;
    state.users = parseUsersData();
    return Boolean(elements.form && elements.tableBody);
  }

  async function init() {
    if (!mapElements()) return null;
    hydrateDefaults();
    setupActorField();
    bindEvents();
    renderEventLegend();
    setupExportButton();
    await refresh({ append: false });
    return { filters: state.filters };
  }

  const exported = {
    init,
    __internals: {
      escapeHtml,
      buildFiltersPayload,
      formatEventTypeLabel,
      formatDateTime,
      metadataSummary,
    },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  } else {
    global.LATE = global.LATE || {};
    global.LATE.auditReports = exported;
  }

  if (!AUTO_INIT_DISABLED && typeof document !== 'undefined') {
    const boot = () => {
      init().catch((err) => console.error('[audit-ui] falha ao inicializar:', err));
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
