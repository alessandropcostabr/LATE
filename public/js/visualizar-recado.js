// public/js/visualizar-recado.js
// Código extraído de views/visualizar-recado.ejs

document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('detalhesRecado');
  const container = document.getElementById('conteudoRecado');
  if (!wrapper || !container) return;

  const id = wrapper.dataset?.id || location.pathname.split('/').pop();
  const editButton = wrapper.querySelector('[data-edit-button]');
  const backButton = wrapper.querySelector('[data-back-button]');
  const deleteButton = wrapper.querySelector('[data-delete-button]');
  const forwardButton = wrapper.querySelector('[data-forward-button]');
  const canDelete = wrapper.dataset?.canDelete === 'true';

  const forwardModalEl = document.getElementById('forwardModal');
  const forwardForm = document.getElementById('forwardForm');
  const forwardRecipientType = document.getElementById('forwardRecipientType');
  const forwardRecipientUserId = document.getElementById('forwardRecipientUserId');
  const forwardRecipientSectorId = document.getElementById('forwardRecipientSectorId');
  const forwardUserGroup = document.getElementById('forwardUserGroup');
  const forwardSectorGroup = document.getElementById('forwardSectorGroup');
  const forwardNote = document.getElementById('forwardNote');
  const forwardSubmit = document.getElementById('forwardSubmit');

  let currentMessage = null;
  let forwardModal = null;

  if (backButton) backButton.href = '/recados';

  if (forwardModalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
    forwardModal = new window.bootstrap.Modal(forwardModalEl);
  }

  function toggleForwardRecipientFields() {
    if (!forwardRecipientType) return;
    const type = (forwardRecipientType.value || 'user').toLowerCase();
    if (type === 'sector') {
      forwardUserGroup?.classList.add('d-none');
      forwardSectorGroup?.classList.remove('d-none');
      forwardRecipientUserId?.removeAttribute('required');
      if (forwardRecipientSectorId) forwardRecipientSectorId.setAttribute('required', 'required');
    } else {
      forwardSectorGroup?.classList.add('d-none');
      forwardUserGroup?.classList.remove('d-none');
      forwardRecipientSectorId?.removeAttribute('required');
      if (forwardRecipientUserId) forwardRecipientUserId.setAttribute('required', 'required');
    }
  }

  function resetForwardForm() {
    if (forwardRecipientType) forwardRecipientType.value = 'user';
    if (forwardRecipientUserId) forwardRecipientUserId.value = '';
    if (forwardRecipientSectorId) forwardRecipientSectorId.value = '';
    if (forwardNote) forwardNote.value = '';
    toggleForwardRecipientFields();
  }

  async function loadMessage() {
    try {
      const response = await API.getMessage(id);
      const recado = response?.data;
      currentMessage = recado;
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

      if (forwardButton) {
        forwardButton.disabled = false;
      }
    } catch (e) {
      currentMessage = null;
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
      if (forwardButton) {
        forwardButton.disabled = true;
      }
      if (typeof Toast !== 'undefined' && Toast.error) {
        Toast.error(message);
      }
    }
  }

  toggleForwardRecipientFields();

  forwardRecipientType?.addEventListener('change', toggleForwardRecipientFields);

  forwardButton?.addEventListener('click', () => {
    resetForwardForm();
    if (forwardModal) {
      forwardModal.show();
    }
  });

  if (forwardForm) {
    forwardForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const type = (forwardRecipientType?.value || 'user').toLowerCase();
      const payload = { recipientType: type };
      let selectedUserId = null;
      let selectedSectorId = null;

      if (type === 'sector') {
        const value = forwardRecipientSectorId?.value || '';
        if (!value) {
          return window.Toast?.error
            ? Toast.error('Selecione o setor destinatário.')
            : alert('Selecione o setor destinatário.');
        }
        selectedSectorId = Number(value);
        payload.recipientSectorId = selectedSectorId;
        if (currentMessage?.recipient_sector_id && Number(currentMessage.recipient_sector_id) === selectedSectorId) {
          return window.Toast?.error
            ? Toast.error('Selecione um destinatário diferente do atual.')
            : alert('Selecione um destinatário diferente do atual.');
        }
      } else {
        const value = forwardRecipientUserId?.value || '';
        if (!value) {
          return window.Toast?.error
            ? Toast.error('Selecione o usuário destinatário.')
            : alert('Selecione o usuário destinatário.');
        }
        selectedUserId = Number(value);
        payload.recipientUserId = selectedUserId;
        if (currentMessage?.recipient_user_id && Number(currentMessage.recipient_user_id) === selectedUserId) {
          return window.Toast?.error
            ? Toast.error('Selecione um destinatário diferente do atual.')
            : alert('Selecione um destinatário diferente do atual.');
        }
      }

      const noteValue = forwardNote?.value?.trim();
      if (noteValue) {
        payload.forwardNote = noteValue;
      }

      const originalText = forwardSubmit?.textContent;
      try {
        if (forwardSubmit) {
          forwardSubmit.disabled = true;
          forwardSubmit.textContent = 'Encaminhando...';
        }
        await API.forwardMessage(id, payload);
        if (window.Toast?.success) {
          window.Toast.success('Recado encaminhado com sucesso!');
        }
        if (forwardModal) {
          forwardModal.hide();
        }
        resetForwardForm();
        await loadMessage();
      } catch (err) {
        const msg = err?.message || err?.body?.error || 'Erro ao encaminhar recado.';
        if (window.Toast?.error) {
          window.Toast.error(msg);
        } else {
          alert(msg);
        }
      } finally {
        if (forwardSubmit) {
          forwardSubmit.disabled = false;
          forwardSubmit.textContent = originalText || '📤 Encaminhar';
        }
      }
    });
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

  loadMessage();
});
