// public/js/editar-recado.js
// Código extraído de views/editar-recado.ejs

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('formEditarRecado');
  const id = location.pathname.split('/').pop();
  const deleteButton = document.getElementById('btnExcluir');
  const allFields = [
    'call_date',
    'call_time',
    'recipient',
    'recipientType',
    'recipientUserId',
    'recipientSectorId',
    'sender_name',
    'sender_phone',
    'sender_email',
    'callback_at',
    'subject',
    'status',
    'visibility',
    'notes',
    'message',
    'parent_message_id'
  ];

  const recipientTypeSelect = document.getElementById('recipientType');
  const recipientUserSelect = document.getElementById('recipientUserId');
  const recipientSectorSelect = document.getElementById('recipientSectorId');
  const recipientHiddenInput = document.getElementById('recipient');
  const recipientUserGroup = document.getElementById('recipientUserGroup');
  const recipientSectorGroup = document.getElementById('recipientSectorGroup');
  const visibilitySelect = document.getElementById('visibility');
  const parentInput = document.getElementById('parent_message_id');

  function formatCallbackInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function updateRecipientHidden() {
    const type = (recipientTypeSelect?.value || 'user').toLowerCase();
    let text = '';
    if (type === 'sector' && recipientSectorSelect && recipientSectorSelect.selectedIndex > 0) {
      text = recipientSectorSelect.options[recipientSectorSelect.selectedIndex].text || '';
    } else if (recipientUserSelect && recipientUserSelect.selectedIndex > 0) {
      text = recipientUserSelect.options[recipientUserSelect.selectedIndex].text || '';
    }
    if (recipientHiddenInput) {
      recipientHiddenInput.value = text.trim();
    }
  }

  function toggleRecipientFields() {
    const type = (recipientTypeSelect?.value || 'user').toLowerCase();
    if (type === 'sector') {
      recipientUserGroup?.classList.add('d-none');
      recipientSectorGroup?.classList.remove('d-none');
      recipientUserSelect?.removeAttribute('required');
      recipientSectorSelect?.setAttribute('required', 'required');
    } else {
      recipientSectorGroup?.classList.add('d-none');
      recipientUserGroup?.classList.remove('d-none');
      recipientSectorSelect?.removeAttribute('required');
      recipientUserSelect?.setAttribute('required', 'required');
    }
    updateRecipientHidden();
  }

  recipientTypeSelect?.addEventListener('change', () => {
    toggleRecipientFields();
  });
  recipientUserSelect?.addEventListener('change', updateRecipientHidden);
  recipientSectorSelect?.addEventListener('change', updateRecipientHidden);

  toggleRecipientFields();

  let safeData = {};
  let fields = [];
  try {
    const response = await API.getMessage(id);
    const data = response?.data || {};
    allFields.forEach(f => {
      if (data[f] !== undefined) safeData[f] = data[f] ?? '';
    });
    if (data.callback_at) {
      safeData.callback_at = formatCallbackInput(data.callback_at);
    }
    Form.populate(form, safeData);
    const recipientType = (data.recipient_sector_id ? 'sector' : 'user');
    if (recipientTypeSelect) {
      recipientTypeSelect.value = recipientType;
    }
    if (recipientType === 'sector') {
      if (recipientSectorSelect) recipientSectorSelect.value = data.recipient_sector_id || '';
      if (recipientUserSelect) recipientUserSelect.value = '';
    } else {
      if (recipientUserSelect) recipientUserSelect.value = data.recipient_user_id || '';
      if (recipientSectorSelect) recipientSectorSelect.value = '';
    }
    if (recipientHiddenInput) {
      recipientHiddenInput.value = data.recipient || '';
    }
    if (parentInput) {
      parentInput.value = data.parent_message_id || '';
    }
    if (visibilitySelect) {
      visibilitySelect.value = (data.visibility || 'private');
    }
    toggleRecipientFields();
    const formFields = Array.from(form.querySelectorAll('[name]')).map(el => el.name);
    fields = Array.from(new Set([...formFields, ...Object.keys(safeData)]));
    const cancel = document.getElementById('btnCancelar');
    if (cancel) cancel.href = `/visualizar-recado/${id}`;
    if (deleteButton) {
      deleteButton.dataset.messageSubject = encodeURIComponent(safeData.subject || '');
    }
  } catch (e) {
    Toast.error('Erro ao carregar registro');
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errors = Form.validate(form);
    if (errors.length) return Toast.error(errors[0]);
    try {
      Loading.show('btnSalvar');
      updateRecipientHidden();
      const formData = Form.getData(form);
      const payload = {};
      fields.forEach(f => {
        if (f === 'parent_message_id') {
          if (formData[f] !== undefined) {
            const numericParent = Number(formData[f]);
            payload[f] = Number.isInteger(numericParent) && numericParent > 0 ? numericParent : null;
          } else if (safeData[f] !== undefined) {
            payload[f] = safeData[f];
          }
          return;
        }
        if (formData[f] !== undefined && formData[f] !== '') {
          payload[f] = formData[f];
        } else if (safeData[f] !== undefined) {
          payload[f] = safeData[f];
        }
      });
      if (typeof Form !== 'undefined' && Form && typeof Form.prepareMessagePayload === 'function') {
        Object.assign(payload, Form.prepareMessagePayload(payload));
      } else if (payload.status) {
        payload.status = (payload.status || '').toLowerCase().replace(/\s+/g, '_');
      }
      await API.updateMessage(id, payload);
      Toast.success('Registro atualizado com sucesso!');
      setTimeout(() => (window.location.href = `/visualizar-recado/${id}`), 1000);
    } catch (err) {
      const validationError = err.body?.data?.details?.[0]
        || err.body?.details?.[0]
        || err.details?.[0]
        || err.body?.errors?.[0]
        || err.errors?.[0];
      const msg = validationError?.msg || validationError?.message || err.message || 'Erro ao atualizar registro';
      Toast.error(msg);
    } finally {
      Loading.hide('btnSalvar');
    }
  });

  if (deleteButton) {
    deleteButton.addEventListener('click', async (event) => {
      event.preventDefault();
      const subjectEncoded = deleteButton.dataset.messageSubject || '';
      let subject = '';
      try { subject = decodeURIComponent(subjectEncoded); } catch (_err) { subject = subjectEncoded; }
      const confirmation = subject
        ? `Tem certeza de que deseja excluir o registro "${subject}"?`
        : 'Tem certeza de que deseja excluir este registro?';

      if (!window.confirm(confirmation)) return;

      const originalLabel = deleteButton.textContent;
      try {
        deleteButton.disabled = true;
        deleteButton.textContent = 'Excluindo...';
        await API.deleteMessage(id);
        if (window.Toast?.success) {
        window.Toast.success('Registro excluído com sucesso.');
        }
        setTimeout(() => (window.location.href = '/recados'), 600);
      } catch (err) {
        deleteButton.disabled = false;
        deleteButton.textContent = originalLabel;
        const msg = err?.message || 'Erro ao excluir registro.';
        if (window.Toast?.error) {
          window.Toast.error(msg);
        } else {
          alert(msg);
        }
      }
    });
  }
});
