// public/js/novo-recado.js
// Página "Novo Recado" — coleta do formulário, normalização e envio para a API.
// Por quê: garantir JSON válido e presença de 'message' (fallback de 'notes').

(() => {
  console.log('✅ Novo Recado JS carregado');

  // Helper seguro para capturar valor de input/textarea
  const val = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return '';
    return String(el.value || '').trim();
  };

  function coletarDados() {
    const call_date = val('#call_date');
    const call_time = val('#call_time');
    const recipientIdRaw = val('#recipientId');
    const recipientId = recipientIdRaw ? recipientIdRaw : null;
    const selectRecipient = document.querySelector('#recipientId');
    let recipientName = '';
    if (selectRecipient && selectRecipient.selectedIndex > 0) {
      const option = selectRecipient.options[selectRecipient.selectedIndex];
      recipientName = String(option?.text || '').trim();
    }
    const sender_name = val('#sender_name');
    const sender_phone = val('#sender_phone');
    const sender_email = val('#sender_email');
    const subject = val('#subject');
    const status = val('#status') || 'pending';
    const callback_time = val('#callback_time');
    const notes = val('#notes');

    // 'message' pode não existir no template atual; tentamos capturar, senão criamos fallback
    const messageRaw = val('#message'); // se não existir, retorna ''
    const message = (messageRaw || notes || '(sem mensagem)');

    const basePayload = {
      call_date,
      call_time,
      recipientId,
      recipient: recipientName || null,
      sender_name,
      sender_phone,
      sender_email,
      subject,
      message,            // <- obrigatório no banco; garantimos aqui
      status,
      callback_time,
      notes
    };

    const payload = (typeof Form !== 'undefined' && Form && typeof Form.prepareMessagePayload === 'function')
      ? Form.prepareMessagePayload(basePayload)
      : basePayload;

    console.log('✅ Dados coletados:', payload);
    return payload;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    try {
      const recado = coletarDados();

      // Validação mínima no front para UX (backend também valida)
      const faltando = [];
      if (!recado.call_date) faltando.push('Data da ligação');
      if (!recado.call_time) faltando.push('Hora da ligação');
      if (!recado.recipientId) faltando.push('Destinatário');
      if (!recado.sender_name) faltando.push('Remetente');
      if (!recado.subject) faltando.push('Assunto');
      if (!recado.message) faltando.push('Mensagem');

      if (faltando.length) {
        alert(`Preencha os campos obrigatórios: ${faltando.join(', ')}`);
        return;
      }

      const resp = await API.createMessage(recado);
      console.log('✅ Recado criado:', resp);

      // Redireciona para lista/detalhe após criar (ajuste conforme sua navegação)
      if (resp?.success) {
        window.location.href = '/recados';
      } else {
        alert('Não foi possível criar o recado.');
      }
    } catch (err) {
      console.error('❌ Erro do servidor:', err?.message || err);
      alert(err?.message || 'Erro ao salvar recado. Tente novamente.');
    }
  }

  function iniciar() {
    const form = document.querySelector('#formNovoRecado') || document.querySelector('#form-novo-recado') || document.querySelector('form');
    if (!form) {
      console.warn('⚠️ Formulário de novo recado não encontrado.');
      return;
    }
    form.addEventListener('submit', handleSubmit);
    console.log('✅ Manipuladores de evento configurados para Novo Recado');
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();

