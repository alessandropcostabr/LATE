// public/js/relatorios.js

document.addEventListener('DOMContentLoaded', async () => {
  const totalEl = document.getElementById('relTotal');
  const pendEl  = document.getElementById('relPendente');
  const andEl   = document.getElementById('relAndamento');
  const resEl   = document.getElementById('relResolvido');

  // Estatísticas gerais numéricas
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

  // Gráficos
  await Promise.all([
    renderChart('/relatorios/por-destinatario', 'graficoPorDestinatario', 'Recados por Destinatário'),
    renderChart('/relatorios/por-status', 'graficoPorStatus', 'Recados por Status', 'pie'),
    renderChart('/relatorios/por-mes', 'graficoPorMes', 'Recados por Mês', 'line')
  ]);
});

async function renderChart(endpoint, canvasId, label, type = 'bar') {
  try {
    const { labels, data } = await API.request(endpoint);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const colors = generateColors(data.length);
    new Chart(ctx, {
      type,
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            backgroundColor: type === 'line' ? colors[0] : colors,
            borderColor: colors,
            borderWidth: 1,
            tension: type === 'line' ? 0.1 : undefined
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  } catch (e) {
    console.error('Erro ao carregar gráfico', endpoint, e);
  }
}

function generateColors(count) {
  const palette = ['#36a2eb', '#ff6384', '#ff9f40', '#4bc0c0', '#9966ff', '#c9cbcf'];
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(palette[i % palette.length]);
  }
  return colors;
}

