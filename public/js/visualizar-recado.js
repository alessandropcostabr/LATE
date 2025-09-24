// public/js/visualizar-recado.js
// Código extraído de views/visualizar-recado.ejs

document.addEventListener('DOMContentLoaded', async () => {
  const id = location.pathname.split('/').pop();
  const container = document.getElementById('detalhesRecado');
  try {
    const response = await API.getMessage(id);
    const recado = response?.data;
    container.textContent = '';

    const statusLabel = recado?.status_label
      || (typeof getStatusLabel === 'function'
        ? getStatusLabel(recado?.status)
        : (typeof getSituacaoLabel === 'function' ? getSituacaoLabel(recado?.status) : recado?.status));

    const dados = [
      ['Data/Hora:', `${recado?.call_date || ''} ${recado?.call_time || ''}`.trim()],
      ['Destinatário:', recado?.recipient || '-'],
      ['Remetente:', recado?.sender_name || '-'],
      ['Telefone:', recado?.sender_phone || '-'],
      ['E-mail:', recado?.sender_email || '-'],
      ['Horário de Retorno:', recado?.callback_time || '-'],
      ['Assunto:', recado?.subject || '-'],
      ['Situação:', statusLabel || '-'],
      ['Observações:', recado?.notes || '-']
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
    const message = e?.status === 404
      ? 'Recado não encontrado.'
      : (e?.message || 'Erro ao carregar recado.');
    container.textContent = message;
    if (typeof Toast !== 'undefined' && Toast.error) {
      Toast.error(message);
    }
  }
});

