// public/js/visualizar-recado.js
// Código extraído de views/visualizar-recado.ejs

document.addEventListener('DOMContentLoaded', async () => {
  const id = location.pathname.split('/').pop();
  const container = document.getElementById('detalhesRecado');
  try {
    const { data: recado } = await API.getRecado(id);
    container.textContent = '';

    const dados = [
      ['Data/Hora:', `${recado.data_ligacao} ${recado.hora_ligacao}`],
      ['Destinatário:', recado.destinatario],
      ['Remetente:', recado.remetente_nome],
      ['Telefone:', recado.remetente_telefone || '-'],
      ['E-mail:', recado.remetente_email || '-'],
      ['Horário de Retorno:', recado.horario_retorno || '-'],
      ['Assunto:', recado.assunto],
      ['Situação:', recado.situacao],
      ['Observações:', recado.observacoes || '-']
    ];

    dados.forEach(([label, value]) => {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = label + ' ';
      p.appendChild(strong);
      p.append(document.createTextNode(value));
      container.appendChild(p);
    });

    const actions = document.createElement('div');
    actions.style.marginTop = '1rem';
    const edit = document.createElement('a');
    edit.href = `/editar-recado/${id}`;
    edit.className = 'btn btn-primary';
    edit.textContent = '✏️ Editar';
    const back = document.createElement('a');
    back.href = '/recados';
    back.className = 'btn btn-outline';
    back.textContent = 'Voltar';
    actions.appendChild(edit);
    actions.appendChild(back);
    container.appendChild(actions);
  } catch (e) {
    const message =
      e && typeof e.message === 'string' && e.message.includes('404')
        ? 'Recado não encontrado.'
        : 'Erro ao carregar recado.';
    container.textContent = message;
    if (typeof Toast !== 'undefined' && Toast.error) {
      Toast.error(message);
    }
  }
});

