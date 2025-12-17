(function () {
  const tbody = document.querySelector('#tbl-call-logs tbody');
  const statusSel = document.querySelector('#f-status');
  const callerInput = document.querySelector('#f-caller');
  const btnFiltrar = document.querySelector('#btn-filtrar');
  const btnPrev = document.querySelector('#prev-page');
  const btnNext = document.querySelector('#next-page');
  const pagingInfo = document.querySelector('#paging-info');

  let page = 1;
  const limit = 20;

  const didMap = {
    '3812': '11 3181-2119',
    '3814': '11 3181-4355',
    '2626': '11 2626-2334'
  };

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  function fmtDuration(seconds) {
    if (seconds == null) return '-';
    const s = Number(seconds) || 0;
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m === 0) return `${r}s`;
    return `${m}m ${r}s`;
  }

  function fmtTrunk(raw) {
    if (!raw) return '';
    const main = raw.split('-')[0];
    const part = main.split('/').pop();
    const digits = part.replace(/\D+/g, '');
    if (digits.length === 4 && didMap[digits]) return didMap[digits];
    if (digits.startsWith('did') && didMap[digits.replace('did','')]) return didMap[digits.replace('did','')];
    if (digits.length >= 10) {
      const n = digits.slice(-11);
      if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
      return n;
    }
    return part || raw;
  }

  function labelStatus(status) {
    const map = {
      answered: 'Atendida',
      'no-answer': 'Não atendida',
      busy: 'Ocupado',
      cancel: 'Cancelada',
      rejected: 'Rejeitada',
      congestion: 'Congestionada',
      ended: 'Encerrada',
    };
    return map[status] || (status || '—');
  }

  function badge(status) {
    const map = {
      answered: 'success',
      'no-answer': 'warning',
      busy: 'secondary',
      cancel: 'secondary',
      rejected: 'danger',
      congestion: 'danger',
      ended: 'info',
    };
    const cls = map[status] || 'light';
    return `<span class="badge bg-${cls}">${labelStatus(status)}</span>`;
  }

  async function load() {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', limit);
    if (statusSel.value) params.set('status', statusSel.value);
    if (callerInput.value) params.set('caller', callerInput.value);

    tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
      const resp = await fetch(`/api/call-logs?${params.toString()}`);
      const json = await resp.json();
      if (!json.success) throw new Error(json.error || 'Falha ao carregar');
      render(json.data);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan=\"7\">Erro: ${err.message}</td></tr>`;
    }
  }

  function render(data) {
    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhum registro</td></tr>';
    } else {
      tbody.innerHTML = data.items.map((row) => {
        const btn = `<button class="btn btn-sm btn-outline-primary" data-uniqueid="${row.uniqueid}" data-caller="${row.caller || row.caller_normalized || ''}" data-start="${row.started_at || ''}" data-trunk="${fmtTrunk(row.trunk)}" data-callee="${row.callee || ''}">Criar recado</button>`;
        return `
        <tr>
          <td>${fmtDate(row.started_at)}</td>
          <td>${badge(row.status)}</td>
          <td>${row.caller || ''}</td>
          <td>${row.callee || ''}</td>
          <td>${fmtDuration(row.duration_seconds)}</td>
          <td>${fmtTrunk(row.trunk)}</td>
          <td>${btn}</td>
        </tr>
      `; }).join('');
    }
    pagingInfo.textContent = `Página ${data.page} de ${data.totalPages} · ${data.total} registro(s)`;
    btnPrev.disabled = data.page <= 1;
    btnNext.disabled = data.page >= data.totalPages;
  }

  btnFiltrar.addEventListener('click', () => { page = 1; load(); });
  btnPrev.addEventListener('click', () => { if (page > 1) { page -= 1; load(); } });
  btnNext.addEventListener('click', () => { page += 1; load(); });

  tbody.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-uniqueid]');
    if (!btn) return;
    const caller = btn.getAttribute('data-caller') || '';
    const uid = btn.getAttribute('data-uniqueid') || '';
    const start = btn.getAttribute('data-start') || '';
    const trunk = btn.getAttribute('data-trunk') || '';
    const callee = btn.getAttribute('data-callee') || '';
    const params = new URLSearchParams({ caller, call_id: uid });
    if (start) params.set('start_ts', start);
    if (trunk) params.set('trunk', trunk);
    if (callee) params.set('callee', callee);
    window.location.href = `/novo-recado?${params.toString()}`;
  });

  load();
})();
