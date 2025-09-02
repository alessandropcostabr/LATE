// public/js/editar-recado.js
// Código extraído de views/editar-recado.ejs

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('formEditarRecado');
  const id = location.pathname.split('/').pop();
  const fields = [
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

  try {
    const { data } = await API.getRecado(id);
    const safeData = {};
    fields.forEach(f => (safeData[f] = data[f] ?? ''));
    Form.populate(form, safeData);
    document.getElementById('btnCancelar').href = `/visualizar-recado/${id}`;
  } catch (e) {
    Toast.error('Erro ao carregar recado');
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errors = Form.validate(form);
    if (errors.length) return Toast.error(errors[0]);
    try {
      Loading.show('btnSalvar');
      const payload = Form.getData(form);
      fields.forEach(f => {
        if (!(f in payload)) payload[f] = '';
      });
      await API.updateRecado(id, payload);
      Toast.success('Recado atualizado com sucesso!');
      setTimeout(() => (window.location.href = `/visualizar-recado/${id}`), 1000);
    } catch (err) {
      Toast.error(err.message || 'Erro ao atualizar recado');
    } finally {
      Loading.hide('btnSalvar');
    }
  });
});
