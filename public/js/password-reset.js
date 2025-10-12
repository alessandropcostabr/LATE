// public/js/password-reset.js
// Redefinição de senha via token enviado por e-mail.

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('passwordResetForm');
    if (!form || !window.API) return;

    const alertBox = document.getElementById('resetAlert');
    const submitBtn = form.querySelector('button[type="submit"]');
    const csrfInput = form.querySelector('input[name="_csrf"]');
    const tokenInput = document.getElementById('resetToken');

    const token = tokenInput?.value || form.dataset?.token || '';

    function showAlert(variant, message) {
      if (!alertBox) return;
      alertBox.textContent = message;
      alertBox.classList.remove('d-none', 'alert-success', 'alert-danger');
      const css = variant === 'success' ? 'alert-success' : 'alert-danger';
      alertBox.classList.add('alert', css);
    }

    function clearAlert() {
      if (!alertBox) return;
      alertBox.textContent = '';
      alertBox.classList.add('d-none');
    }

    function setBusy(state) {
      if (!submitBtn) return;
      submitBtn.disabled = !!state;
      submitBtn.setAttribute('aria-busy', state ? 'true' : 'false');
    }

    if (!token) {
      showAlert('danger', 'Token ausente ou inválido. Solicite uma nova redefinição de senha.');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const password = form.querySelector('#resetPassword')?.value || '';
      const confirm = form.querySelector('#resetConfirm')?.value || '';

      clearAlert();

      if (!password || !confirm) {
        showAlert('danger', 'Informe e confirme a nova senha.');
        return;
      }

      if (password.length < 8) {
        showAlert('danger', 'A nova senha deve ter pelo menos 8 caracteres.');
        return;
      }

      if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        showAlert('danger', 'Misture letras e números na nova senha.');
        return;
      }

      if (password !== confirm) {
        showAlert('danger', 'As senhas informadas não conferem.');
        return;
      }

      setBusy(true);
      try {
        const payload = { token, password, confirm };
        if (csrfInput?.value) payload._csrf = csrfInput.value;

        const response = await window.API.request('/password/reset', {
          method: 'POST',
          data: payload,
        });

        showAlert('success', response?.message || 'Senha atualizada com sucesso. Você já pode fazer login.');
        form.reset();

        setTimeout(() => {
          window.location.href = '/login';
        }, 2500);
      } catch (err) {
        showAlert('danger', err?.message || 'Não foi possível redefinir a senha.');
      } finally {
        setBusy(false);
      }
    });
  });
})();
