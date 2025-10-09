// public/js/visualizar-recado.js
// Código extraído de views/visualizar-recado.ejs

document.addEventListener('DOMContentLoaded', async () => {
  const wrapper = document.getElementById('detalhesRecado');
  const container = document.getElementById('conteudoRecado');
  if (!wrapper || !container) return;

  const id = wrapper.dataset?.id || location.pathname.split('/').pop();
  const editButton = wrapper.querySelector('[data-edit-button]');
  const backButton = wrapper.querySelector('[data-back-button]');

  if (backButton) backButton.href = '/recados';

  try {
    const response = await API.getMessage(id);
    const recado = response?.data;
    container.innerHTML = '';

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
      strong.textContent = `${label} `;
      p.appendChild(strong);
      p.append(document.createTextNode(value || '-'));
      container.appendChild(p);
    });

    if (editButton) {
      editButton.href = `/editar-recado/${id}`;
      editButton.hidden = false;
    }
  } catch (e) {
    const message = e?.status === 404
      ? 'Recado não encontrado.'
      : (e?.message || e?.body?.error || 'Erro ao carregar recado.');
    container.textContent = message;
    if (editButton) {
      editButton.hidden = true;
    }
    if (typeof Toast !== 'undefined' && Toast.error) {
      Toast.error(message);
    }
  }
});

