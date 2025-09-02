// public/js/relatorios.js
// Código extraído de views/relatorios.ejs

document.addEventListener('DOMContentLoaded', async () => {
  const totalEl = document.getElementById('relTotal');
  const pendEl  = document.getElementById('relPendente');
  const andEl   = document.getElementById('relAndamento');
  const resEl   = document.getElementById('relResolvido');
  const tbody   = document.getElementById('relPorDestinatario');

  // Estatísticas gerais
  try {
    const stats = (await API.getStats()).data;
    totalEl.textContent = stats.total;
    pendEl.textContent  = stats.pendente;
    andEl.textContent   = stats.em_andamento;
    resEl.textContent   = stats.resolvido;
  } catch (e) {
    console.error('Erro ao carregar estatísticas:', e);
    totalEl.textContent = pendEl.textContent =
      andEl.textContent = resEl.textContent = 'Não disponível';
  }

  // Estatísticas por destinatário
  try {
    const porDest = (await API.getStatsByDestinatario()).data;
    if (porDest.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = 'Sem dados disponíveis';
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      porDest.forEach(r => {
        const tr = document.createElement('tr');

        const destTd  = document.createElement('td');
        destTd.textContent  = r.destinatario;
        const totalTd = document.createElement('td');
        totalTd.textContent = r.total;
        const pendTd  = document.createElement('td');
        pendTd.textContent  = r.pendente ?? '-';
        const andTd   = document.createElement('td');
        andTd.textContent   = r.em_andamento ?? '-';
        const resTd   = document.createElement('td');
        resTd.textContent   = r.resolvido ?? '-';

        tr.appendChild(destTd);
        tr.appendChild(totalTd);
        tr.appendChild(pendTd);
        tr.appendChild(andTd);
        tr.appendChild(resTd);

        tbody.appendChild(tr);
      });
    }
  } catch (e) {
    console.error('Erro ao carregar estatísticas por destinatário:', e);
    tbody.innerHTML = '<tr><td colspan="5">Não foi possível carregar dados.</td></tr>';
  }
});

