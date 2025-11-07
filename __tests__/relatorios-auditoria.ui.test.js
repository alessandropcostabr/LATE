/** @jest-environment jsdom */

describe('relatórios · auditoria UI', () => {
  const buildDom = () => {
    document.body.innerHTML = `
      <div data-audit-root data-default-from="2025-11-03T10:00:00.000Z" data-default-to="2025-11-04T10:00:00.000Z" data-filter-key="test-audit-filters">
        <form id="auditFiltersForm">
          <input type="datetime-local" id="auditFrom" name="from" value="2025-11-03T10:00">
          <input type="datetime-local" id="auditTo" name="to" value="2025-11-04T10:00">
          <input type="text" id="auditEventType" name="event_type">
          <input type="text" id="auditEntityType" name="entity_type">
          <input type="text" id="auditEntityId" name="entity_id">
          <input type="text" id="auditActorName" name="actor_user_name" list="auditUsersOptions">
          <input type="hidden" id="auditActorId" name="actor_user_id" value="">
          <input type="text" id="auditSearch" name="search">
          <input type="number" id="auditLimit" name="limit" value="50">
          <button type="submit">Buscar</button>
        </form>
        <datalist id="auditUsersOptions">
          <option value="João Silva (#10)" data-id="10"></option>
        </datalist>
        <button id="auditResetFilters" type="button">Reset</button>
        <section>
          <ul id="auditEventLegend"></ul>
          <div id="auditSummaryCards"></div>
          <ul id="auditTopEvents"></ul>
          <ul id="auditDailyBreakdown"></ul>
        </section>
        <div id="auditTableStatus" class="alert d-none"></div>
        <button id="auditExportButton" type="button">Exportar</button>
        <table>
          <tbody id="auditTableBody"></tbody>
        </table>
        <button id="auditLoadMore" class="d-none" type="button">Load more</button>
      </div>
      <script type="application/json" id="auditUsersData">[{"id":10,"name":"João Silva"}]</script>
    `;
  };

  beforeEach(() => {
    jest.resetModules();
    buildDom();
    global.__LATE_DISABLE_AUTO_INIT__ = true;
    window.localStorage?.clear();
    global.API = {
      getEventLogsSummary: jest.fn().mockResolvedValue({
        data: {
          byType: [],
          daily: [],
        },
      }),
      getEventLogs: jest.fn().mockResolvedValue({
        data: {
          items: [],
          nextCursor: null,
        },
      }),
    };
  });

  afterEach(() => {
    delete global.__LATE_DISABLE_AUTO_INIT__;
    delete global.API;
    window.localStorage?.clear();
  });

  it('normaliza filtros convertendo datas para ISO', async () => {
    const module = require('../public/js/relatorios-auditoria.js');
    document.getElementById('auditActorName').value = 'João Silva (#10)';
    document.getElementById('auditActorId').value = '10';

    const payload = module.__internals.buildFiltersPayload(document.getElementById('auditFiltersForm'));
    expect(payload.from).toMatch(/Z$/);
    expect(payload.to).toMatch(/Z$/);
    expect(payload.limit).toBe(50);
    expect(payload.actor_user_id).toBe('10');
  });

  it('renderiza indicadores e tabela ao inicializar', async () => {
    global.API.getEventLogsSummary.mockResolvedValue({
      data: {
        byType: [
          { event_type: 'message.status_changed', count: 3 },
          { event_type: 'user.login', count: 2 },
        ],
        daily: [
          { date: '2025-11-04T00:00:00.000Z', count: 4 },
        ],
      },
    });
    global.API.getEventLogs.mockResolvedValue({
      data: {
        items: [
          {
            id: 'evt-1',
            event_type: 'message.status_changed',
            entity_type: 'message',
            entity_id: '123',
            actor_user: { id: 10, name: 'João Silva' },
            metadata: { from: 'pending', to: 'resolved' },
            created_at: '2025-11-04T12:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
    });

    const module = require('../public/js/relatorios-auditoria.js');
    await module.init();

    const primaryCard = document.querySelector('#auditSummaryCards .audit-summary__card-value');
    expect(primaryCard).not.toBeNull();
    expect(primaryCard.textContent).toBe('5'); // total de eventos

    const tableRows = document.querySelectorAll('#auditTableBody tr');
    expect(tableRows.length).toBe(1);
    expect(tableRows[0].textContent).toContain('João Silva');
    expect(tableRows[0].textContent).toContain('pending');
  });

  it('envia actor_user_id quando o filtro de responsável é aplicado', async () => {
    const module = require('../public/js/relatorios-auditoria.js');
    await module.init();

    global.API.getEventLogs.mockClear();
    global.API.getEventLogsSummary.mockClear();

    const actorInput = document.getElementById('auditActorName');
    actorInput.value = 'João Silva (#10)';
    actorInput.dispatchEvent(new Event('input', { bubbles: true }));

    const form = document.getElementById('auditFiltersForm');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(global.API.getEventLogs).toHaveBeenCalled();
    const lastCall = global.API.getEventLogs.mock.calls.at(-1)[0];
    expect(lastCall.actor_user_id).toBe('10');
  });
});
