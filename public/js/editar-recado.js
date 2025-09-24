// public/js/editar-recado.js
// Código extraído de views/editar-recado.ejs

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('formEditarRecado');
  const id = location.pathname.split('/').pop();
  const allFields = [
    'call_date',
    'call_time',
    'recipient',
    'sender_name',
    'sender_phone',
    'sender_email',
    'callback_time',
    'subject',
    'status',
    'notes',
    'message'
  ];

  let safeData = {};
  let fields = [];
  try {
    const response = await API.getMessage(id);
    const data = response?.data || {};
    allFields.forEach(f => {
      if (data[f] !== undefined) safeData[f] = data[f] ?? '';
    });
    Form.populate(form, safeData);
    const formFields = Array.from(form.querySelectorAll('[name]')).map(el => el.name);
    fields = Array.from(new Set([...formFields, ...Object.keys(safeData)]));
    const cancel = document.getElementById('btnCancelar');
    if (cancel) cancel.href = `/visualizar-recado/${id}`;
  } catch (e) {
    Toast.error('Erro ao carregar recado');
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errors = Form.validate(form);
    if (errors.length) return Toast.error(errors[0]);
    try {
      Loading.show('btnSalvar');
      const formData = Form.getData(form);
      const payload = {};
      fields.forEach(f => {
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
      Toast.success('Recado atualizado com sucesso!');
      setTimeout(() => (window.location.href = `/visualizar-recado/${id}`), 1000);
    } catch (err) {
      const validationError = err.body?.errors?.[0] || err.errors?.[0];
      const msg = validationError?.msg || validationError?.message || err.message || 'Erro ao atualizar recado';
      Toast.error(msg);
    } finally {
      Loading.hide('btnSalvar');
    }
  });
});
