// public/js/visualizar-recado.js
// Código extraído de views/visualizar-recado.ejs

document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('detalhesRecado');
  const container = document.getElementById('conteudoRecado');
  if (!wrapper || !container) return;

  const id = wrapper.dataset?.id || location.pathname.split('/').pop();
  const canUpdateMessage = wrapper.dataset?.canUpdate === 'true';
  const canEditOwn = wrapper.dataset?.canEditOwn === 'true';
  const editButton = wrapper.querySelector('[data-edit-button]');
  const backButton = wrapper.querySelector('[data-back-button]');
  const deleteButton = wrapper.querySelector('[data-delete-button]');
  const forwardButton = wrapper.querySelector('[data-forward-button]');
  const timelineButton = wrapper.querySelector('[data-timeline-button]');
  const progressButton = wrapper.querySelector('[data-progress-button]');
  const resolveButton = wrapper.querySelector('[data-resolve-button]');
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
      setupTimeline(recado);


      const isOwner = recado?.is_owner === true || recado?.isOwner === true;
      const isRecipient = recado?.is_recipient === true || recado?.isRecipient === true;
      const canManage = canUpdateMessage || (canEditOwn && (isOwner || isRecipient));

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

      if (recado?.created_by_name) {
        dados.splice(1, 0, ['Criado por:', recado.created_by_name]);
      }

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
        editButton.hidden = !canManage;
        editButton.disabled = !canManage;
      }

      if (progressButton) {
        progressButton.hidden = !canManage || recado?.status === 'in_progress';
        progressButton.disabled = progressButton.hidden;
      }

      if (resolveButton) {
        resolveButton.hidden = !canManage || recado?.status === 'resolved';
        resolveButton.disabled = resolveButton.hidden;
      }

      if (deleteButton && canDelete) {
        deleteButton.hidden = false;
        deleteButton.dataset.messageId = id;
        deleteButton.dataset.messageSubject = encodeURIComponent(recado?.subject || '');
      }

      if (forwardButton) {
        forwardButton.hidden = !canManage;
        forwardButton.disabled = forwardButton.hidden;
      }

      setupTimeline(recado);
    } catch (e) {
      currentMessage = null;
      const message = e?.status === 404
        ? 'Recado não encontrado.'
        : (e?.message || e?.body?.error || 'Erro ao carregar recado.');
      container.textContent = message;
      if (editButton) {
        editButton.hidden = true;
        editButton.disabled = true;
      }
      if (deleteButton) {
        deleteButton.hidden = true;
      }
      if (forwardButton) {
        forwardButton.disabled = true;
        forwardButton.hidden = true;
      }
      if (progressButton) {
        progressButton.disabled = true;
        progressButton.hidden = true;
      }
      if (resolveButton) {
        resolveButton.disabled = true;
        resolveButton.hidden = true;
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

  async function handleStatusUpdate(button, status) {
    if (!button || !currentMessage) return;

    const messages = status === 'in_progress'
      ? {
          confirm: 'Marcar este recado como em andamento?',
          loading: 'Atualizando...',
          success: 'Recado marcado como em andamento.',
          error: 'Erro ao atualizar recado.',
        }
      : {
          confirm: 'Marcar este recado como resolvido?',
          loading: 'Atualizando...',
          success: 'Recado marcado como resolvido.',
          error: 'Erro ao atualizar recado.',
        };

    if (!window.confirm(messages.confirm)) return;

    const originalText = button.textContent;
    try {
      button.disabled = true;
      button.textContent = messages.loading;

      await API.updateMessageStatus(currentMessage.id, { status });
      if (window.Toast?.success) {
        window.Toast.success(messages.success);
      }
      await loadMessage();
    } catch (err) {
      const msg = err?.message || messages.error;
      if (window.Toast?.error) {
        window.Toast.error(msg);
      } else {
        alert(msg);
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  progressButton?.addEventListener('click', (event) => {
    event.preventDefault();
    handleStatusUpdate(progressButton, 'in_progress');
  });

  resolveButton?.addEventListener('click', (event) => {
    event.preventDefault();
    handleStatusUpdate(resolveButton, 'resolved');
  });

  function setupTimeline(recado) {
    const timeline = Array.isArray(recado?.timeline) ? recado.timeline : recado?.timelineEvents;
    const button = timelineButton;
    const existing = document.getElementById('timeline-card');

    if (!button) return;

    if (!Array.isArray(timeline) || timeline.length === 0) {
      button.hidden = true;
      if (existing) existing.remove();
      return;
    }

    button.hidden = false;
    button.disabled = false;
    button.textContent = 'Histórico';

    if (existing) existing.remove();

    const timelineCard = document.createElement('div');
    timelineCard.className = 'card';
    timelineCard.id = 'timeline-card';
    timelineCard.style.marginTop = '1.5rem';
    timelineCard.hidden = true;

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = '<h3 class="card-title">Histórico</h3><p class="card-subtitle">Eventos registrados para este recado</p>';
    timelineCard.appendChild(header);

    const body = document.createElement('div');
    body.className = 'card-body';

    const list = document.createElement('ul');
    list.style.listStyle = 'disc';
    list.style.marginLeft = '1.25rem';
    list.style.lineHeight = '1.6';

    timeline.forEach((event) => {
      const item = document.createElement('li');
      const date = new Date(event.created_at);
      const stamp = Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR');

      let description = '';
      if (event.type === 'email_failure') {
        const email = event.payload?.email || 'destinatário desconhecido';
        const reason = event.payload?.reason || 'falha não informada';
        description = `Falha ao enviar e-mail para ${email} (${reason})`;
      } else {
        description = event.type;
      }

      item.innerHTML = `<strong>${stamp}:</strong> ${description}`;
      list.appendChild(item);
    });

    body.appendChild(list);
    timelineCard.appendChild(body);
    container.appendChild(timelineCard);

    button.onclick = (event) => {
      event.preventDefault();
      timelineCard.hidden = !timelineCard.hidden;
      button.textContent = timelineCard.hidden ? 'Histórico' : 'Ocultar histórico';
    };
  }

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
