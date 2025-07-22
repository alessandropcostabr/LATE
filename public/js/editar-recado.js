// public/js/editar-recado.js
// Código extraído de views/editar-recado.ejs

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('formEditarRecado');
    const id = location.pathname.split('/').pop();
    try {
        const { data } = await API.getRecado(id);
        Form.populate(form, data);
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
            await API.updateRecado(id, payload);
            Toast.success('Recado atualizado com sucesso!');
            setTimeout(() => window.location.href = `/visualizar-recado/${id}`, 1000);
        } catch (err) {
            Toast.error(err.message || 'Erro ao atualizar recado');
        } finally {
            Loading.hide('btnSalvar');
        }
    });
});
