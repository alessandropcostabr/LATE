// public/js/novo-recado.js
// Página "Novo Registro" — coleta do formulário, normalização e envio para a API.
// Por quê: garantir JSON válido e presença de 'message' (fallback de 'notes').

(() => {
  console.log('✅ Novo Registro JS carregado');

  // Helper seguro para capturar valor de input/textarea
  const val = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return '';
    return String(el.value || '').trim();
  };

  const form = document.getElementById('formNovoRecado') || document.querySelector('#form-novo-recado') || document.querySelector('form');
  const saveButton = document.getElementById('btnSalvar');
  const recipientTypeSelect = document.getElementById('recipientType');
  const recipientUserSelect = document.getElementById('recipientUserId');
  const recipientSectorSelect = document.getElementById('recipientSectorId');
  const recipientUserGroup = document.getElementById('recipientUserGroup');
  const recipientSectorGroup = document.getElementById('recipientSectorGroup');
  const visibilitySelect = document.getElementById('visibility');
  const parentMessageInput = document.getElementById('parent_message_id');
  const originalButtonLabel = saveButton ? saveButton.innerHTML : null;
  let isSubmitting = false;

  function toggleSubmitState(locked) {
    if (!saveButton) return;
    if (locked) {
      saveButton.disabled = true;
      saveButton.setAttribute('aria-busy', 'true');
      saveButton.classList.add('is-loading');
      saveButton.innerHTML = '⏳ Salvando...';
    } else {
      saveButton.disabled = false;
      saveButton.removeAttribute('aria-busy');
      saveButton.classList.remove('is-loading');
      if (originalButtonLabel !== null) {
        saveButton.innerHTML = originalButtonLabel;
      }
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
  }

  recipientTypeSelect?.addEventListener('change', toggleRecipientFields);
  toggleRecipientFields();

  function coletarDados() {
    const call_date = val('#call_date');
    const call_time = val('#call_time');
    const recipientType = (recipientTypeSelect?.value || 'user').toLowerCase();
    let recipientUserId = null;
    let recipientSectorId = null;
    let recipientName = '';

    if (recipientType === 'sector') {
      const recipientSectorRaw = recipientSectorSelect ? recipientSectorSelect.value : '';
      const parsedSector = recipientSectorRaw ? Number(recipientSectorRaw) : null;
      recipientSectorId = Number.isFinite(parsedSector) && parsedSector > 0 ? parsedSector : null;
      if (recipientSectorSelect && recipientSectorSelect.selectedIndex > 0) {
        const option = recipientSectorSelect.options[recipientSectorSelect.selectedIndex];
        recipientName = String(option?.text || '').trim();
      }
    } else {
      const recipientUserRaw = recipientUserSelect ? recipientUserSelect.value : '';
      const parsedUser = recipientUserRaw ? Number(recipientUserRaw) : null;
      recipientUserId = Number.isFinite(parsedUser) && parsedUser > 0 ? parsedUser : null;
      if (recipientUserSelect && recipientUserSelect.selectedIndex > 0) {
        const option = recipientUserSelect.options[recipientUserSelect.selectedIndex];
        recipientName = String(option?.text || '').trim();
      }
    }
    const sender_name = val('#sender_name');
    const sender_phone = val('#sender_phone');
    const sender_email = val('#sender_email');
    const subject = val('#subject');
    const status = val('#status') || 'pending';
    const callback_time = val('#callback_time');
    const notes = val('#notes');
    const parentMessageId = parentMessageInput ? Number(parentMessageInput.value) : null;

    // 'message' pode não existir no template atual; tentamos capturar, senão criamos fallback
    const messageRaw = val('#message'); // se não existir, retorna ''
    const message = (messageRaw || notes || '(sem mensagem)');

    const basePayload = {
      call_date,
      call_time,
      recipientType,
      recipientUserId,
      recipientSectorId,
      recipient: recipientName || null,
      sender_name,
      sender_phone,
      sender_email,
      subject,
      message,            // <- obrigatório no banco; garantimos aqui
      status,
      callback_time,
      visibility: (visibilitySelect?.value || 'private').toLowerCase(),
      notes,
      parent_message_id: Number.isInteger(parentMessageId) && parentMessageId > 0 ? parentMessageId : null
    };

    const payload = (typeof Form !== 'undefined' && Form && typeof Form.prepareMessagePayload === 'function')
      ? Form.prepareMessagePayload(basePayload)
      : basePayload;

    console.log('✅ Dados coletados:', payload);
    return payload;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (isSubmitting) {
      return;
    }
    let keepLocked = false;
    try {
      isSubmitting = true;
      toggleSubmitState(true);
      const recado = coletarDados();

      // Validação mínima no front para UX (backend também valida)
      const faltando = [];
      if (!recado.call_date) faltando.push('Data da ligação');
      if (!recado.call_time) faltando.push('Hora da ligação');
      if (recado.recipientType === 'sector' && !recado.recipientSectorId) faltando.push('Setor destinatário');
      if (recado.recipientType !== 'sector' && !recado.recipientUserId) faltando.push('Usuário destinatário');
      if (!recado.sender_name) faltando.push('Remetente');
      if (!recado.subject) faltando.push('Assunto');
      if (!recado.message) faltando.push('Mensagem');

      if (faltando.length) {
        alert(`Preencha os campos obrigatórios: ${faltando.join(', ')}`);
        return;
      }

      const resp = await API.createMessage(recado);
      console.log('✅ Registro criado:', resp);

      // Redireciona para lista/detalhe após criar (ajuste conforme sua navegação)
      if (resp?.success) {
        keepLocked = true;
        window.location.href = '/recados';
        return;
      } else {
        alert('Não foi possível criar o registro.');
      }
    } catch (err) {
      console.error('❌ Erro do servidor:', err?.message || err);
      alert(err?.message || 'Erro ao salvar registro. Tente novamente.');
    } finally {
      if (!keepLocked) {
        toggleSubmitState(false);
      }
      isSubmitting = keepLocked;
    }
  }

  function iniciar() {
    if (!form) {
      console.warn('⚠️ Formulário de novo contato não encontrado.');
      return;
    }
    form.addEventListener('submit', handleSubmit);
    console.log('✅ Manipuladores de evento configurados para Novo Registro');
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
