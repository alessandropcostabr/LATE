// public/js/visualizar-recado.js
// Controla o painel de detalhes do contato (abas, labels, checklists, comentários e watchers).

document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('detalhesRecado');
  if (!wrapper) return;

  const state = {
    id: wrapper.dataset?.id || extractIdFromPath(),
    userId: Number(wrapper.dataset?.userId) || null,
    role: wrapper.dataset?.userRole || 'reader',
    canUpdate: wrapper.dataset?.canUpdate === 'true',
    canDelete: wrapper.dataset?.canDelete === 'true',
    canEditOwn: wrapper.dataset?.canEditOwn === 'true',
    activeTab: 'details',
    currentMessage: null,
  };

  const elements = {
    details: wrapper.querySelector('[data-details]'),
    tabsButtons: wrapper.querySelectorAll('[data-tab-button]'),
    tabPanels: wrapper.querySelectorAll('[data-tab-section]'),
    labelsPanel: wrapper.querySelector('[data-labels-panel]'),
    labelsList: wrapper.querySelector('[data-labels-list]'),
    labelsEmpty: wrapper.querySelector('[data-labels-panel] [data-labels-empty]'),
    labelForm: wrapper.querySelector('[data-labels-form]'),
    labelInput: wrapper.querySelector('[data-label-input]'),
    checklistsPanel: wrapper.querySelector('[data-checklists-panel]'),
    checklistsList: wrapper.querySelector('[data-checklists-list]'),
    checklistsEmpty: wrapper.querySelector('[data-checklists-empty]'),
    checklistForm: wrapper.querySelector('[data-checklist-form]'),
    commentsPanel: wrapper.querySelector('[data-comments-panel]'),
    commentsList: wrapper.querySelector('[data-comments-list]'),
    commentsEmpty: wrapper.querySelector('[data-comments-empty]'),
    commentForm: wrapper.querySelector('[data-comment-form]'),
    commentInput: document.getElementById('commentBody'),
    watchersPanel: wrapper.querySelector('[data-watchers-panel]'),
    watchersList: wrapper.querySelector('[data-watchers-list]'),
    watchersEmpty: wrapper.querySelector('[data-watchers-empty]'),
    watcherForm: wrapper.querySelector('[data-watcher-form]'),
    watcherSelect: wrapper.querySelector('[data-watcher-select]'),
    historyContainer: wrapper.querySelector('[data-history]'),
    historyEmpty: wrapper.querySelector('[data-history-empty]'),
    editButton: wrapper.querySelector('[data-edit-button]'),
    backButton: wrapper.querySelector('[data-back-button]'),
    deleteButton: wrapper.querySelector('[data-delete-button]'),
    forwardButton: wrapper.querySelector('[data-forward-button]'),
    progressButton: wrapper.querySelector('[data-progress-button]'),
    resolveButton: wrapper.querySelector('[data-resolve-button]'),
    forwardModalEl: document.getElementById('forwardModal'),
    forwardForm: document.getElementById('forwardForm'),
    forwardType: document.getElementById('forwardRecipientType'),
    forwardUser: document.getElementById('forwardRecipientUserId'),
    forwardSector: document.getElementById('forwardRecipientSectorId'),
    forwardUserGroup: document.getElementById('forwardUserGroup'),
    forwardSectorGroup: document.getElementById('forwardSectorGroup'),
    forwardNote: document.getElementById('forwardNote'),
    forwardSubmit: document.getElementById('forwardSubmit'),
  };

  let forwardModal = null;

  function formatCallbackDisplay(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    try {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (_err) {
      return null;
    }
  }

  if (elements.backButton) {
    elements.backButton.href = '/recados';
  }

  initTabs();
  initForwardModal();
  initStatusButtons();
  initLabelHandlers();
  initChecklistHandlers();
  initCommentHandlers();
  initWatcherHandlers();

  loadMessage();

  async function loadMessage() {
    if (!state.id) {
      showToast('Identificador do contato não encontrado.', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await API.getMessage(state.id);
      const recado = response?.data;
      state.currentMessage = recado;
      renderAll(recado);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }

  function renderAll(recado) {
    if (!recado) return;
    renderDetails(recado);
    renderLabels(recado);
    renderChecklists(recado);
    renderComments(recado);
    renderWatchers(recado);
    renderHistory(recado);
    updateActionButtons(recado);
    activateTab(state.activeTab);
    maybeOpenForwardFromQuery(recado);
  }

  function renderDetails(recado) {
    if (!elements.details) return;

    const statusLabels = {
      pending: 'Pendente',
      in_progress: 'Em andamento',
      resolved: 'Resolvido',
    };

    const statusLabel = recado?.status_label || statusLabels[recado?.status] || recado?.status || '-';
    const lines = [
      ['Data/Hora', `${recado?.call_date || ''} ${recado?.call_time || ''}`.trim() || '—'],
      ['Destinatário', recado?.recipient || '—'],
      ['Remetente', recado?.sender_name || '—'],
      ['Telefone', recado?.sender_phone || '—'],
      ['E-mail', recado?.sender_email || '—'],
      ['Horário de retorno', recado?.callback_time || formatCallbackDisplay(recado?.callback_at) || '—'],
      ['Assunto', recado?.subject || '—'],
      ['Visibilidade', recado?.visibility === 'public' ? 'Público' : 'Privado'],
      ['Situação', statusLabel],
      ['Observações', recado?.notes || '—'],
    ];

    if (recado?.createdByName || recado?.created_by_name) {
      lines.splice(1, 0, ['Criado por', recado.createdByName || recado.created_by_name]);
    }

    const html = [
      '<dl class="details-grid">',
      ...lines.map(([label, value]) => `
        <div class="details-grid__row">
          <dt>${label}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>`),
      '</dl>',
    ].join('');

    elements.details.innerHTML = html;
  }

  function renderLabels(recado) {
    if (!elements.labelsList) return;

    const labels = Array.isArray(recado?.labels) ? recado.labels : [];
    const canManage = state.canUpdate || (state.canEditOwn && isOwnerOrRecipient(recado));

    if (!labels.length) {
      elements.labelsList.innerHTML = '<p class="text-muted mb-0">Nenhuma label aplicada.</p>';
    } else {
      elements.labelsList.innerHTML = labels.map((label) => `
        <span class="badge badge-label" data-label="${encodeAttr(label)}">
          <span>${escapeHtml(label)}</span>
          ${canManage ? `<button type="button" class="btn btn-link btn-link-danger" data-remove-label data-label-value="${encodeAttr(label)}" aria-label="Remover label ${escapeHtml(label)}">×</button>` : ''}
        </span>
      `).join(' ');
    }

    if (elements.labelForm) {
      elements.labelForm.classList.toggle('d-none', !canManage);
    }
  }

  function renderChecklists(recado) {
    if (!elements.checklistsList) return;

    const checklists = Array.isArray(recado?.checklists) ? recado.checklists : [];
    const canManage = state.canUpdate || (state.canEditOwn && isOwnerOrRecipient(recado));

    elements.checklistsEmpty.hidden = checklists.length > 0;
    elements.checklistsList.innerHTML = checklists.map((checklist) => {
      const progress = Number(checklist.progress_cached || 0);
      const items = Array.isArray(checklist.items) ? checklist.items : [];
      const checklistActions = canManage ? `
        <button type="button" class="btn btn-link btn-sm text-danger" data-remove-checklist data-checklist-id="${checklist.id}">Excluir</button>
      ` : '';

      const itemsHtml = items.length
        ? items.map((item) => `
            <li class="checklist-item" data-item-id="${item.id}" data-checklist-id="${checklist.id}">
              <label>
                <input type="checkbox" data-checklist-toggle data-item-id="${item.id}" ${item.done ? 'checked' : ''} ${canManage ? '' : 'disabled'}>
                <span class="${item.done ? 'done' : ''}">${escapeHtml(item.title)}</span>
              </label>
              ${canManage ? `<button type="button" class="btn btn-link btn-sm text-danger" data-remove-item data-item-id="${item.id}">Remover</button>` : ''}
            </li>
          `).join('')
        : '<li class="text-muted">Nenhum item cadastrado.</li>';

      const itemForm = canManage ? `
        <form class="checklist-item-form" data-checklist-item-form data-checklist-id="${checklist.id}">
          <div class="form-group">
            <label class="form-label" for="item-${checklist.id}">Novo item</label>
            <div class="d-flex gap-2">
              <input id="item-${checklist.id}" type="text" name="title" class="form-input" maxlength="200" placeholder="Descrição do item" required>
              <button type="submit" class="btn btn-secondary">Adicionar</button>
            </div>
          </div>
        </form>
      ` : '';

      return `
        <article class="checklist-card" data-checklist-id="${checklist.id}">
          <header class="checklist-card__header">
            <div>
              <h4>${escapeHtml(checklist.title)}</h4>
              <div class="progress">
                <div class="progress-bar" role="progressbar" style="width:${progress}%" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">${progress}%</div>
              </div>
            </div>
            ${checklistActions}
          </header>
          <ul class="checklist-items" data-checklist-items>
            ${itemsHtml}
          </ul>
          ${itemForm}
        </article>
      `;
    }).join('');

    if (elements.checklistForm) {
      elements.checklistForm.classList.toggle('d-none', !canManage);
    }
  }

  function renderComments(recado) {
    if (!elements.commentsList) return;

    const comments = Array.isArray(recado?.comments) ? recado.comments : [];
    elements.commentsEmpty.hidden = comments.length > 0;

    const canManage = (comment) => Number(comment.user_id) === state.userId || isAdmin();

    elements.commentsList.innerHTML = comments.map((comment) => {
      const name = comment.user_name || 'Usuário';
      const stamp = formatDateTime(comment.created_at);
      const body = escapeHtml(comment.body || '');
      const removeButton = canManage(comment)
        ? `<button type="button" class="btn btn-link btn-sm text-danger" data-remove-comment data-comment-id="${comment.id}">Remover</button>`
        : '';

      return `
        <li class="comment" data-comment-id="${comment.id}">
          <header class="comment__header">
            <strong>${escapeHtml(name)}</strong>
            <span class="comment__timestamp">${stamp}</span>
            ${removeButton}
          </header>
          <p class="comment__body">${body}</p>
        </li>
      `;
    }).join('');
  }

  function renderWatchers(recado) {
    if (!elements.watchersList) return;

    const watchers = Array.isArray(recado?.watchers) ? recado.watchers : [];
    const canManage = state.canUpdate || (state.canEditOwn && isOwnerOrRecipient(recado));

    elements.watchersEmpty.hidden = watchers.length > 0;
    elements.watchersList.innerHTML = watchers.map((watcher) => {
      const name = escapeHtml(watcher.user_name || watcher.user_email || 'Usuário');
      const email = watcher.user_email ? `<span class="watcher-email">${escapeHtml(watcher.user_email)}</span>` : '';
      const removeButton = canManage
        ? `<button type="button" class="btn btn-link btn-sm text-danger" data-remove-watcher data-user-id="${watcher.user_id}">Remover</button>`
        : '';
      return `
        <li class="watcher" data-user-id="${watcher.user_id}">
          <div>
            <strong>${name}</strong>
            ${email}
          </div>
          ${removeButton}
        </li>
      `;
    }).join('');

    if (elements.watcherForm) {
      elements.watcherForm.classList.toggle('d-none', !canManage);
      refreshWatcherSelect(watchers);
    }
  }

  function renderHistory(recado) {
    if (!elements.historyContainer) return;

    const timeline = Array.isArray(recado?.timeline) ? recado.timeline : recado?.timelineEvents;
    if (!timeline || !timeline.length) {
      elements.historyEmpty.hidden = false;
      elements.historyContainer.innerHTML = '';
      return;
    }

    elements.historyEmpty.hidden = true;
    const statusLabels = {
      pending: 'Pendente',
      in_progress: 'Em andamento',
      resolved: 'Resolvido',
    };

    const describeEvent = (event) => {
      const payload = event?.payload || {};
      const actor = payload.user_name || 'Usuário';

      switch (event?.type) {
        case 'created':
          return `Contato criado por ${actor}.`;
        case 'updated': {
          const changes = Array.isArray(payload.changes) ? payload.changes : [];
          if (!changes.length) return `${actor} atualizou o contato.`;
          const details = changes.map((change) => {
            const label = change.label || change.field;
            const from = formatValue(change.from);
            const to = formatValue(change.to);
            return `${label}: ${from} → ${to}`;
          }).join('; ');
          return `${actor} atualizou o contato (${details}).`;
        }
        case 'status_changed':
          return `${actor} alterou a situação de ${statusLabels[payload.from] || payload.from || '—'} para ${statusLabels[payload.to] || payload.to || '—'}.`;
        case 'forwarded': {
          const from = formatValue(payload.from?.recipient);
          const to = formatValue(payload.to?.recipient);
          return `${actor} encaminhou o contato (${from} → ${to}).`;
        }
        case 'adopted':
          return `${actor} assumiu o contato.`;
        case 'email_failure': {
          const email = payload.email || 'destinatário desconhecido';
          const reason = payload.reason || 'falha não informada';
          return `Falha ao enviar e-mail para ${email} (${reason}).`;
        }
        default:
          return event?.type || 'Evento';
      }
    };

    elements.historyContainer.innerHTML = timeline.map((event) => {
      const stamp = formatDateTime(event.created_at);
      const description = describeEvent(event);
      return `<p class="timeline-entry"><strong>${stamp}:</strong> ${escapeHtml(description)}</p>`;
    }).join('');
  }

  function updateActionButtons(recado) {
    const isOwner = recado?.is_owner === true || recado?.isOwner === true;
    const isRecipient = recado?.is_recipient === true || recado?.isRecipient === true;
    const canManage = state.canUpdate || (state.canEditOwn && (isOwner || isRecipient));

    if (elements.editButton) {
      elements.editButton.hidden = !canManage;
      elements.editButton.disabled = !canManage;
      elements.editButton.href = `/editar-recado/${state.id}`;
    }

    if (elements.forwardButton) {
      elements.forwardButton.hidden = !canManage;
      elements.forwardButton.disabled = !canManage;
    }

    if (elements.progressButton) {
      const hidden = !canManage || recado?.status === 'in_progress';
      elements.progressButton.hidden = hidden;
      elements.progressButton.disabled = hidden;
    }

    if (elements.resolveButton) {
      const hidden = !canManage || recado?.status === 'resolved';
      elements.resolveButton.hidden = hidden;
      elements.resolveButton.disabled = hidden;
    }

    if (elements.deleteButton) {
      elements.deleteButton.hidden = !state.canDelete;
      if (state.canDelete) {
        elements.deleteButton.dataset.messageId = state.id;
        elements.deleteButton.dataset.messageSubject = encodeAttr(recado?.subject || '');
      }
    }
  }

  function maybeOpenForwardFromQuery(recado) {
    if (!recado || !forwardModal) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('forward')) return;
    const canManage = state.canUpdate || (state.canEditOwn && isOwnerOrRecipient(recado));
    if (!canManage) return;
    forwardModal.show();
    params.delete('forward');
    const search = params.toString();
    const hash = window.location.hash || '';
    const newUrl = `${window.location.pathname}${search ? `?${search}` : ''}${hash}`;
    try {
      window.history.replaceState(null, document.title, newUrl);
    } catch (_err) {
      // ignore history API failures (ex.: browsers antigos)
    }
  }

  function initTabs() {
    if (!elements.tabsButtons?.length) return;

    elements.tabsButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.tabButton;
        if (!target) return;
        state.activeTab = target;
        activateTab(target);
      });
    });
  }

  function activateTab(tab) {
    elements.tabsButtons.forEach((button) => {
      const isActive = button.dataset.tabButton === tab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });
    elements.tabPanels.forEach((panel) => {
      const isActive = panel.dataset.tabSection === tab;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });
  }

  function initForwardModal() {
    if (!elements.forwardModalEl || !window.bootstrap?.Modal) return;
    forwardModal = new window.bootstrap.Modal(elements.forwardModalEl);

    toggleForwardRecipientFields();
    elements.forwardType?.addEventListener('change', toggleForwardRecipientFields);

    elements.forwardButton?.addEventListener('click', () => {
      resetForwardForm();
      forwardModal?.show();
    });

    if (elements.forwardForm) {
      elements.forwardForm.addEventListener('submit', handleForwardSubmit);
    }
  }

  function toggleForwardRecipientFields() {
    const type = (elements.forwardType?.value || 'user').toLowerCase();
    if (type === 'sector') {
      elements.forwardUserGroup?.classList.add('d-none');
      elements.forwardSectorGroup?.classList.remove('d-none');
      elements.forwardUser?.removeAttribute('required');
      elements.forwardSector?.setAttribute('required', 'required');
    } else {
      elements.forwardSectorGroup?.classList.add('d-none');
      elements.forwardUserGroup?.classList.remove('d-none');
      elements.forwardSector?.removeAttribute('required');
      elements.forwardUser?.setAttribute('required', 'required');
    }
  }

  function resetForwardForm() {
    if (elements.forwardType) elements.forwardType.value = 'user';
    if (elements.forwardUser) elements.forwardUser.value = '';
    if (elements.forwardSector) elements.forwardSector.value = '';
    if (elements.forwardNote) elements.forwardNote.value = '';
    toggleForwardRecipientFields();
  }

  async function handleForwardSubmit(event) {
    event.preventDefault();
    if (!state.currentMessage) return;

    const type = (elements.forwardType?.value || 'user').toLowerCase();
    const payload = { recipientType: type };

    if (type === 'sector') {
      const sectorId = Number(elements.forwardSector?.value || 0);
      if (!sectorId) {
        showToast('Selecione o setor destinatário.', 'error');
        return;
      }
      if (Number(state.currentMessage.recipient_sector_id) === sectorId) {
        showToast('Selecione um destinatário diferente do atual.', 'error');
        return;
      }
      payload.recipientSectorId = sectorId;
    } else {
      const userId = Number(elements.forwardUser?.value || 0);
      if (!userId) {
        showToast('Selecione o usuário destinatário.', 'error');
        return;
      }
      if (Number(state.currentMessage.recipient_user_id) === userId) {
        showToast('Selecione um destinatário diferente do atual.', 'error');
        return;
      }
      payload.recipientUserId = userId;
    }

    const note = elements.forwardNote?.value?.trim();
    if (note) payload.forwardNote = note;

    const originalText = elements.forwardSubmit?.textContent;
    try {
      if (elements.forwardSubmit) {
        elements.forwardSubmit.disabled = true;
        elements.forwardSubmit.textContent = 'Encaminhando...';
      }
      await API.forwardMessage(state.id, payload);
      showToast('Contato encaminhado com sucesso!', 'success');
      forwardModal?.hide();
      resetForwardForm();
      await loadMessage();
    } catch (err) {
      showToast(err?.message || err?.body?.error || 'Erro ao encaminhar contato.', 'error');
    } finally {
      if (elements.forwardSubmit) {
        elements.forwardSubmit.disabled = false;
        elements.forwardSubmit.textContent = originalText || '📤 Encaminhar';
      }
    }
  }

  function initStatusButtons() {
    elements.progressButton?.addEventListener('click', (event) => {
      event.preventDefault();
      handleStatusUpdate('in_progress');
    });
    elements.resolveButton?.addEventListener('click', (event) => {
      event.preventDefault();
      handleStatusUpdate('resolved');
    });

    elements.deleteButton?.addEventListener('click', handleDelete);
  }

  async function handleStatusUpdate(status) {
    if (!state.currentMessage) return;

    const button = status === 'in_progress' ? elements.progressButton : elements.resolveButton;
    if (!button) return;

    const messages = status === 'in_progress'
      ? {
          confirm: 'Marcar este contato como em andamento?',
          loading: 'Atualizando...',
          success: 'Contato marcado como em andamento.',
          error: 'Erro ao atualizar contato.',
        }
      : {
          confirm: 'Marcar este contato como resolvido?',
          loading: 'Atualizando...',
          success: 'Contato marcado como resolvido.',
          error: 'Erro ao atualizar contato.',
        };

    if (!window.confirm(messages.confirm)) return;

    const originalText = button.textContent;
    try {
      button.disabled = true;
      button.textContent = messages.loading;
      await API.updateMessageStatus(state.currentMessage.id, { status });
      showToast(messages.success, 'success');
      await loadMessage();
    } catch (err) {
      showToast(err?.message || messages.error, 'error');
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function handleDelete(event) {
    event.preventDefault();
    if (!state.canDelete) return;

    const subjectEncoded = elements.deleteButton?.dataset.messageSubject || '';
    let subject = '';
    try { subject = decodeAttr(subjectEncoded); } catch (_err) { subject = subjectEncoded; }

    const confirmation = subject
      ? `Tem certeza de que deseja excluir o contato "${subject}"?`
      : 'Tem certeza de que deseja excluir este contato?';

    if (!window.confirm(confirmation)) return;

    const originalText = elements.deleteButton.textContent;
    try {
      elements.deleteButton.disabled = true;
      elements.deleteButton.textContent = 'Excluindo...';
      await API.deleteMessage(state.id);
      showToast('Contato excluído com sucesso.', 'success');
      setTimeout(() => { window.location.href = '/recados'; }, 600);
    } catch (err) {
      showToast(err?.message || 'Erro ao excluir contato.', 'error');
      elements.deleteButton.disabled = false;
      elements.deleteButton.textContent = originalText;
    }
  }

  function initLabelHandlers() {
    if (elements.labelForm) {
      elements.labelForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const value = elements.labelInput?.value?.trim();
        if (!value) {
          showToast('Informe uma label válida.', 'error');
          return;
        }
        try {
          await API.addMessageLabel(state.id, value);
          elements.labelInput.value = '';
          await loadMessage();
        } catch (err) {
          showToast(err?.message || 'Erro ao adicionar label.', 'error');
        }
      });
    }

    elements.labelsList?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-remove-label]');
      if (!button) return;
      const label = decodeAttr(button.dataset.labelValue || '');
      if (!label) return;
      try {
        await API.removeMessageLabel(state.id, label);
        await loadMessage();
      } catch (err) {
        showToast(err?.message || 'Erro ao remover label.', 'error');
      }
    });
  }

  function initChecklistHandlers() {
    if (elements.checklistForm) {
      elements.checklistForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const titleInput = elements.checklistForm.querySelector('input[name="title"]');
        const title = titleInput?.value?.trim();
        if (!title) {
          showToast('Informe o título do checklist.', 'error');
          return;
        }
        setButtonLoading(elements.checklistForm.querySelector('button[type="submit"]'), true, 'Criando...');
        try {
          await API.createChecklist(state.id, { title });
          titleInput.value = '';
          await loadMessage();
        } catch (err) {
          showToast(err?.message || 'Erro ao criar checklist.', 'error');
        } finally {
          setButtonLoading(elements.checklistForm.querySelector('button[type="submit"]'), false);
        }
      });
    }

    elements.checklistsList?.addEventListener('submit', async (event) => {
      const form = event.target.closest('[data-checklist-item-form]');
      if (!form) return;
      event.preventDefault();
      const titleInput = form.querySelector('input[name="title"]');
      const title = titleInput?.value?.trim();
      if (!title) {
        showToast('Informe o título do item.', 'error');
        return;
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      setButtonLoading(submitBtn, true, 'Adicionando...');
      try {
        await API.createChecklistItem(state.id, form.dataset.checklistId, { title });
        titleInput.value = '';
        await loadMessage();
      } catch (err) {
        showToast(err?.message || 'Erro ao adicionar item.', 'error');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });

    elements.checklistsList?.addEventListener('change', async (event) => {
      const checkbox = event.target.closest('[data-checklist-toggle]');
      if (!checkbox) return;
      const itemId = checkbox.dataset.itemId;
      const checklistId = checkbox.closest('[data-checklist-id]')?.dataset.checklistId;
      if (!itemId || !checklistId) return;
      try {
        await API.updateChecklistItem(state.id, checklistId, itemId, { done: checkbox.checked });
        await loadMessage();
      } catch (err) {
        checkbox.checked = !checkbox.checked;
        showToast(err?.message || 'Erro ao atualizar item.', 'error');
      }
    });

    elements.checklistsList?.addEventListener('click', async (event) => {
      const removeChecklistBtn = event.target.closest('[data-remove-checklist]');
      if (removeChecklistBtn) {
        const checklistId = removeChecklistBtn.dataset.checklistId;
        if (!checklistId) return;
        if (!window.confirm('Excluir checklist e todos os itens?')) return;
        try {
          await API.removeChecklist(state.id, checklistId);
          await loadMessage();
        } catch (err) {
          showToast(err?.message || 'Erro ao remover checklist.', 'error');
        }
        return;
      }

      const removeItemBtn = event.target.closest('[data-remove-item]');
      if (removeItemBtn) {
        const itemId = removeItemBtn.dataset.itemId;
        const checklistId = removeItemBtn.closest('[data-checklist-id]')?.dataset.checklistId;
        if (!itemId || !checklistId) return;
        if (!window.confirm('Remover item do checklist?')) return;
        try {
        await API.removeChecklistItem(state.id, checklistId, itemId);
          await loadMessage();
        } catch (err) {
          showToast(err?.message || 'Erro ao remover item.', 'error');
        }
      }
    });
  }

  function initCommentHandlers() {
    elements.commentForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = elements.commentInput?.value?.trim();
      if (!body) {
        showToast('Escreva um comentário antes de enviar.', 'error');
        return;
      }
      const submitBtn = elements.commentForm.querySelector('button[type="submit"]');
      setButtonLoading(submitBtn, true, 'Publicando...');
      try {
        await API.createComment(state.id, { body });
        elements.commentInput.value = '';
        await loadMessage();
      } catch (err) {
        showToast(err?.message || 'Erro ao publicar comentário.', 'error');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });

    elements.commentsList?.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-remove-comment]');
      if (!btn) return;
      const commentId = btn.dataset.commentId;
      if (!commentId) return;
      if (!window.confirm('Remover este comentário?')) return;
      try {
        await API.removeComment(state.id, commentId);
        await loadMessage();
      } catch (err) {
        showToast(err?.message || 'Erro ao remover comentário.', 'error');
      }
    });
  }

  function initWatcherHandlers() {
    elements.watcherForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const userId = Number(elements.watcherSelect?.value || 0);
      if (!userId) {
        showToast('Selecione um usuário para acompanhar o contato.', 'error');
        return;
      }
      const submitBtn = elements.watcherForm.querySelector('button[type="submit"]');
      setButtonLoading(submitBtn, true, 'Adicionando...');
      try {
        await API.addWatcher(state.id, userId);
        elements.watcherSelect.value = '';
        await loadMessage();
      } catch (err) {
        showToast(err?.message || 'Erro ao adicionar observador.', 'error');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });

    elements.watchersList?.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-remove-watcher]');
      if (!btn) return;
      const userId = Number(btn.dataset.userId || 0);
      if (!userId) return;
      if (!window.confirm('Remover este observador?')) return;
      try {
        await API.removeWatcher(state.id, userId);
        await loadMessage();
      } catch (err) {
        showToast(err?.message || 'Erro ao remover observador.', 'error');
      }
    });
  }

  function refreshWatcherSelect(watchers) {
    if (!elements.watcherSelect) return;
    const watcherIds = new Set((watchers || []).map((watcher) => Number(watcher.user_id)));
    [...elements.watcherSelect.options].forEach((option) => {
      if (!option.value) return;
      const userId = Number(option.value);
      option.disabled = watcherIds.has(userId);
    });
  }

  function extractIdFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  }

  function isOwnerOrRecipient(recado) {
    const viewerId = state.userId;
    if (!viewerId) return false;
    if (recado?.created_by === viewerId || recado?.createdBy === viewerId) return true;
    if (recado?.recipient_user_id === viewerId || recado?.recipientUserId === viewerId) return true;
    return false;
  }

  function isAdmin() {
    return state.role === 'admin' || state.role === 'supervisor';
  }

  function setLoading(loading) {
    wrapper.classList.toggle('is-loading', loading);
  }

  function showError(err) {
    const message = err?.status === 404
      ? 'Contato não encontrado.'
      : (err?.message || err?.body?.error || 'Erro ao carregar contato.');

    if (elements.details) {
      elements.details.innerHTML = `<p class="text-danger">${escapeHtml(message)}</p>`;
    }
    showToast(message, 'error');
  }

  function showToast(message, type = 'info') {
    if (window.Toast?.[type]) {
      window.Toast[type](message);
    } else {
      console[type === 'error' ? 'error' : 'log'](message);
    }
  }

  function setButtonLoading(button, loading, textWhenLoading = 'Processando...') {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }
      button.disabled = true;
      button.textContent = textWhenLoading;
    } else {
      button.disabled = false;
      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function encodeAttr(value) {
    return encodeURIComponent(String(value ?? ''));
  }

  function decodeAttr(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (_err) {
      return value;
    }
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
    } catch (_err) {
      return date.toLocaleString('pt-BR');
    }
  }

  function formatValue(value) {
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }
});
