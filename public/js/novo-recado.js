// /public/js/novo-recado.js
// Script de Novo Recado — intercepta submissão do formulário e evita duplos envios

document.addEventListener('DOMContentLoaded', function () {
  console.log('✅ Novo Recado JS carregado');

  // Procura pelo formulário usando os possíveis IDs historicamente utilizados
  const form = document.getElementById('formNovoRecado') || document.getElementById('novoRecadoForm');
  if (!form) {
    console.log('⚠️  Formulário de recado não encontrado');
    return;
  }

  // Obtém o botão de submit dentro do formulário
  const submitBtn = form.querySelector('button[type="submit"]');

  // Flag para evitar envios duplicados
  let isSubmitting = false;

  /**
   * Função responsável por processar o envio do formulário.
   * Coleta dados, valida campos obrigatórios e envia via fetch.
   * Pode ser chamada pelo evento submit ou pelo clique no botão.
   */
  async function handleSubmit(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (isSubmitting) {
      console.log('⚠️  Já está enviando, ignorando submit duplicado');
      return false;
    }
    isSubmitting = true;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Salvando...';
    }

    try {
      const formData = new FormData(form);
      const data = {};
      for (const [key, value] of formData.entries()) {
        data[key] = typeof value === 'string' ? value.trim() : value;
      }
      console.log('✅ Dados coletados:', data);

      // Validação básica dos campos obrigatórios
      const requiredFields = [
        { key: 'destinatario', message: 'Destinatário é obrigatório.' },
        { key: 'remetente_nome', message: 'Remetente é obrigatório.' },
        { key: 'assunto', message: 'Assunto é obrigatório.' },
        { key: 'data_ligacao', message: 'Data da ligação é obrigatória.' },
        { key: 'hora_ligacao', message: 'Hora da ligação é obrigatória.' }
      ];

      const missing = requiredFields
        .filter(field => !data[field.key])
        .map(field => field.message);

      if (missing.length > 0) {
        alert(missing.join('\n'));
        return;
      }

      const response = await fetch('/api/recados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });
      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ Recado criado com sucesso');
        alert('Recado criado com sucesso!');
        form.reset();
        setTimeout(() => {
          window.location.href = '/recados';
        }, 1000);
      } else {
        console.error('❌ Erro do servidor:', result.message);
        alert('Erro ao salvar recado: ' + (result.message || 'Erro interno do servidor'));
      }
    } catch (error) {
      console.error('❌ Erro na requisição:', error);
      alert('Erro ao salvar recado. Verifique sua conexão e tente novamente.');
    } finally {
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar Recado';
      }
    }
  }

  // Listener padrão de submit
  form.addEventListener('submit', handleSubmit);

  // Fallback para clique no botão
  if (submitBtn) {
    submitBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      handleSubmit(event);
    });
  }

  console.log('✅ Manipuladores de evento configurados para Novo Recado');
});
