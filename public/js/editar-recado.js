// public/js/editar-recado.js
// Código extraído de views/editar-recado.ejs

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('formEditarRecado');
  const id = location.pathname.split('/').pop();
  const allFields = [
    'data_ligacao',
    'hora_ligacao',
    'destinatario',
    'remetente_nome',
    'remetente_telefone',
    'remetente_email',
    'horario_retorno',
    'assunto',
    'situacao',
    'observacoes'
  ];

  let safeData = {};
  let fields = [];
  try {
    const { data } = await API.getRecado(id);
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
      payload.situacao = (payload.situacao || '').toLowerCase().replace(/\s+/g, '_');
      await API.updateRecado(id, payload);
      Toast.success('Recado atualizado com sucesso!');
      setTimeout(() => (window.location.href = `/visualizar-recado/${id}`), 1000);
    } catch (err) {
      const msg = err.details?.[0]?.msg || err.details?.[0]?.message || err.message || 'Erro ao atualizar recado';
      Toast.error(msg);
    } finally {
      Loading.hide('btnSalvar');
    }
  });
});
