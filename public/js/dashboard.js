// public/js/dashboard.js

export function initDashboard() {
  initQuickFilters();
  carregarEstatisticas();
  carregarRecadosRecentes();
  setInterval(() => {
    carregarEstatisticas();
    carregarRecadosRecentes();
  }, 30000);
}

function initQuickFilters() {
  const btnHoje = document.getElementById('btnHoje');
  const btnSemana = document.getElementById('btnSemana');
  if (btnHoje && btnSemana) {
    const hoje = Utils.getCurrentDate();
    const semanaAtras = new Date();
    semanaAtras.setDate(semanaAtras.getDate() - 7);
    const semanaStr = semanaAtras.toISOString().split('T')[0];
    btnHoje.href = `/recados?data_inicio=${hoje}&data_fim=${hoje}`;
    btnSemana.href = `/recados?data_inicio=${semanaStr}&data_fim=${hoje}`;
  }
}

export async function carregarEstatisticas() {
  try {
    const { data: stats } = await API.getStats();
    document.getElementById('totalRecados').textContent = stats.total ?? '-';
    document.getElementById('totalPendentes').textContent = stats.pendente ?? '-';
    document.getElementById('totalAndamento').textContent = stats.em_andamento ?? '-';
    document.getElementById('totalResolvidos').textContent = stats.resolvido ?? '-';
  } catch {
    Toast.error('Erro ao carregar estatísticas');
  }
}

export async function carregarRecadosRecentes(limit = 10) {
  const container = document.getElementById('recadosRecentes');
  if (!container) return;

  container.textContent = '';

  try {
    const { data: recados } = await API.getRecadosRecentes(limit);

    if (!recados.length) {
      const noData = document.createElement('div');
      noData.className = 'no-data';
      noData.style.textAlign = 'center';
      noData.style.padding = '2rem';
      noData.style.color = 'var(--text-secondary)';
      noData.textContent = '📝 Nenhum recado encontrado';
      container.appendChild(noData);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'table-container';

    const table = document.createElement('table');
    table.className = 'table';

    const caption = document.createElement('caption');
    caption.className = 'sr-only';
    caption.textContent = 'Recados Recentes';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Data/Hora', 'Destinatário', 'Remetente', 'Assunto', 'Situação', 'Ações'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');

    recados.forEach(recado => {
      const tr = document.createElement('tr');

      const tdData = document.createElement('td');
      const dateDiv = document.createElement('div');
      dateDiv.style.fontWeight = '500';
      dateDiv.textContent = Utils.formatDate(recado.data_ligacao);
      const timeDiv = document.createElement('div');
      timeDiv.style.fontSize = '0.75rem';
      timeDiv.style.color = 'var(--text-secondary)';
      timeDiv.textContent = recado.hora_ligacao;
      tdData.appendChild(dateDiv);
      tdData.appendChild(timeDiv);
      tr.appendChild(tdData);

      const tdDest = document.createElement('td');
      tdDest.style.fontWeight = '500';
      tdDest.textContent = recado.destinatario;
      tr.appendChild(tdDest);

      const tdRem = document.createElement('td');
      tdRem.textContent = recado.remetente_nome;
      tr.appendChild(tdRem);

      const tdAssunto = document.createElement('td');
      tdAssunto.textContent = Utils.truncateText(recado.assunto, 40);
      tr.appendChild(tdAssunto);

      const tdSit = document.createElement('td');
      const sitSpan = document.createElement('span');
      const statusClasses = {
        pendente: 'badge-pendente',
        em_andamento: 'badge-andamento',
        resolvido: 'badge-resolvido',
      };
      sitSpan.className = `badge ${statusClasses[recado.situacao] || ''}`;
      sitSpan.textContent = getSituacaoLabel(recado.situacao);
      tdSit.appendChild(sitSpan);
      tr.appendChild(tdSit);

      const tdAcoes = document.createElement('td');
      const actionDiv = document.createElement('div');
      actionDiv.style.display = 'flex';
      actionDiv.style.gap = '0.5rem';

      const viewLink = document.createElement('a');
      viewLink.href = `/visualizar-recado/${recado.id}`;
      viewLink.className = 'btn btn-outline btn-sm';
      viewLink.textContent = '👁️';

      const editLink = document.createElement('a');
      editLink.href = `/editar-recado/${recado.id}`;
      editLink.className = 'btn btn-outline btn-sm';
      editLink.textContent = '✏️';

      actionDiv.appendChild(viewLink);
      actionDiv.appendChild(editLink);
      tdAcoes.appendChild(actionDiv);
      tr.appendChild(tdAcoes);

      tbody.appendChild(tr);
    });

    table.appendChild(caption);
    table.appendChild(thead);
    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
  } catch {
    Toast.error('Erro ao carregar recados recentes');
  }
}
