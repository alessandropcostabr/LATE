// public/js/visualizar-recado.js
// Código extraído de views/visualizar-recado.ejs

document.addEventListener('DOMContentLoaded', async () => {
  const wrapper = document.getElementById('detalhesRecado');
  const container = document.getElementById('conteudoRecado');
  if (!wrapper || !container) return;

  const id = wrapper.dataset?.id || location.pathname.split('/').pop();
  const editButton = wrapper.querySelector('[data-edit-button]');
  const backButton = wrapper.querySelector('[data-back-button]');
  const deleteButton = wrapper.querySelector('[data-delete-button]');
  const canDelete = wrapper.dataset?.canDelete === 'true';

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
      ['Visibilidade:', recado?.visibility === 'public' ? 'Público' : 'Privado'],
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
    if (deleteButton && canDelete) {
      deleteButton.hidden = false;
      deleteButton.dataset.messageId = id;
      deleteButton.dataset.messageSubject = encodeURIComponent(recado?.subject || '');
    }
  } catch (e) {
    const message = e?.status === 404
      ? 'Recado não encontrado.'
      : (e?.message || e?.body?.error || 'Erro ao carregar recado.');
    container.textContent = message;
    if (editButton) {
      editButton.hidden = true;
    }
    if (deleteButton) {
      deleteButton.hidden = true;
    }
    if (typeof Toast !== 'undefined' && Toast.error) {
      Toast.error(message);
    }
  }

  if (deleteButton && canDelete) {
    deleteButton.addEventListener('click', async (event) => {
      event.preventDefault();
      const messageId = deleteButton.dataset.messageId || id;
      if (!messageId) return;

      const subjectEncoded = deleteButton.dataset.messageSubject || '';
      let subject = '';
      try { subject = decodeURIComponent(subjectEncoded); } catch (_err) { subject = subjectEncoded; }

      const confirmation = subject
        ? `Tem certeza de que deseja excluir o recado "${subject}"?`
        : 'Tem certeza de que deseja excluir este recado?';

      if (!window.confirm(confirmation)) return;

      const originalText = deleteButton.textContent;
      try {
        deleteButton.disabled = true;
        deleteButton.textContent = 'Excluindo...';
        await API.deleteMessage(messageId);
        if (window.Toast?.success) {
          window.Toast.success('Recado excluído com sucesso.');
        }
        setTimeout(() => { window.location.href = '/recados'; }, 600);
      } catch (err) {
        deleteButton.disabled = false;
        deleteButton.textContent = originalText;
        const msg = err?.message || 'Erro ao excluir recado.';
        if (window.Toast?.error) {
          window.Toast.error(msg);
        } else {
          alert(msg);
        }
      }
    });
  }
});
