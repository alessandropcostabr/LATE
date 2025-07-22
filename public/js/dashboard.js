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

  try {
    const { data: recados } = await API.getRecadosRecentes(limit);

    if (!recados.length) {
      container.innerHTML = `
        <div class="no-data" style="text-align:center;padding:2rem;color:var(--text-secondary);">
          📝 Nenhum recado encontrado
        </div>`;
      return;
    }

    const rows = recados.map(recado => `
      <tr>
        <td>
          <div style="font-weight:500;">${Utils.formatDate(recado.data_ligacao)}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);">${Utils.escapeHTML(recado.hora_ligacao)}</div>
        </td>
        <td style="font-weight:500;">${Utils.escapeHTML(recado.destinatario)}</td>
        <td>${Utils.escapeHTML(recado.remetente_nome)}</td>
        <td>${Utils.escapeHTML(Utils.truncateText(recado.assunto, 40))}</td>
        <td>
          <span class="badge badge-${recado.situacao.replace('_','')}">
            ${getSituacaoLabel(recado.situacao)}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:0.5rem;">
            <a href="/visualizar-recado/${recado.id}" class="btn btn-outline btn-sm">👁️</a>
            <a href="/editar-recado/${recado.id}" class="btn btn-outline btn-sm">✏️</a>
          </div>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <caption class="sr-only">Recados Recentes</caption>
          <thead>
            <tr><th>Data/Hora</th><th>Destinatário</th><th>Remetente</th><th>Assunto</th><th>Situação</th><th>Ações</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch {
    Toast.error('Erro ao carregar recados recentes');
  }
}
