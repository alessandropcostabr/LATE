// public/js/password-recover.js
// Solicitação de redefinição de senha (esqueci minha senha).

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('passwordRecoverForm');
    if (!form || !window.API) return;

    const alertBox = document.getElementById('recoverAlert');
    const submitBtn = form.querySelector('button[type="submit"]');
    const csrfInput = form.querySelector('input[name="_csrf"]');

    function setBusy(state) {
      if (!submitBtn) return;
      submitBtn.disabled = !!state;
      submitBtn.setAttribute('aria-busy', state ? 'true' : 'false');
    }

    function showAlert(variant, message) {
      if (!alertBox) return;
      alertBox.textContent = message;
      alertBox.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-info');
      const css = variant === 'success' ? 'alert-success' : (variant === 'info' ? 'alert-info' : 'alert-danger');
      alertBox.classList.add('alert', css);
    }

    function clearAlert() {
      if (!alertBox) return;
      alertBox.textContent = '';
      alertBox.classList.add('d-none');
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const email = form.querySelector('#recoverEmail')?.value || '';
      clearAlert();

      if (!email) {
        showAlert('danger', 'Informe o e-mail cadastrado.');
        return;
      }

      setBusy(true);
      try {
        const payload = { email };
        if (csrfInput?.value) payload._csrf = csrfInput.value;

        const response = await window.API.request('/password/recover', {
          method: 'POST',
          data: payload,
        });

        const successMessage = response?.data?.message || response?.message || 'Se encontrarmos o e-mail informado, enviaremos as instruções em instantes.';
        showAlert('success', successMessage);
        form.reset();
      } catch (err) {
        showAlert('danger', err?.message || 'Não foi possível processar a solicitação agora.');
      } finally {
        setBusy(false);
      }
    });
  });
})();
