// public/js/novo-recado.js
// Código extraído de views/novo-recado.ejs

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formNovoRecado');
    // Configurar data e hora atuais
    const dataInput = form.querySelector('input[name="data_ligacao"]');
    const horaInput = form.querySelector('input[name="hora_ligacao"]');
    if (!dataInput.value) dataInput.value = Utils.getCurrentDate();
    if (!horaInput.value) horaInput.value = Utils.getCurrentTime();

    // Máscara de telefone
    const telefoneInput = form.querySelector('input[name="remetente_telefone"]');
    telefoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length <= 11) {
            if (value.length <= 2) value = value.replace(/(\d{0,2})/, '($1');
            else if (value.length <= 6) value = value.replace(/(\d{2})(\d{0,4})/, '($1) $2');
            else if (value.length <= 10) value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
            else value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
        }
        e.target.value = value;
    });

    // Submissão do formulário
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errors = Form.validate(form);
        if (errors.length) return Toast.error(errors[0]);
        try {
            Loading.show('btnSalvar');
            const data = Form.getData(form);
            const response = await API.createRecado(data);
            Toast.success('Recado criado com sucesso!');
            setTimeout(() => {
                window.location.href = `/visualizar-recado/${response.data.id}`;
            }, 1000);
        } catch (error) {
            console.error('Erro ao criar recado:', error);
            Toast.error(error.message || 'Erro ao criar recado');
        } finally {
            Loading.hide('btnSalvar');
        }
    });

    // Validação em tempo real
    const requiredFields = form.querySelectorAll('[required]');
    requiredFields.forEach(field => {
        field.addEventListener('blur', () => {
            field.classList.toggle('error', !field.value.trim());
        });
        field.addEventListener('input', () => {
            if (field.value.trim()) field.classList.remove('error');
        });
    });

    // Validação de email em tempo real
    const emailField = form.querySelector('input[type="email"]');
    if (emailField) {
        emailField.addEventListener('blur', () => {
            if (emailField.value && !Form.isValidEmail(emailField.value)) {
                emailField.classList.add('error');
                Toast.warning('E-mail deve ter formato válido');
            } else {
                emailField.classList.remove('error');
            }
        });
    }

    // Auto-save de rascunho
    const saveInterval = setInterval(() => {
        localStorage.setItem('rascunho_recado', JSON.stringify(Form.getData(form)));
    }, 30000);
    const rascunho = localStorage.getItem('rascunho_recado');
    if (rascunho) {
        try {
            const data = JSON.parse(rascunho);
            if (confirm('Encontramos um rascunho salvo. Deseja recuperá-lo?')) {
                Form.populate(form, data);
                Toast.info('Rascunho recuperado com sucesso');
            }
        } catch (error) {
            console.error('Erro ao recuperar rascunho:', error);
        }
    }

    // Limpar rascunho ao sair
    window.addEventListener('beforeunload', () => {
        localStorage.removeItem('rascunho_recado');
        clearInterval(saveInterval);
    });
});
