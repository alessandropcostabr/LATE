// public/js/account-password.js
// Troca de senha autenticada (conta do usuário).

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('passwordChangeForm');
    if (!form || !window.API) return;

    const alertBox = document.getElementById('passwordAlert');
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
      alertBox.classList.remove('d-none', 'alert-success', 'alert-danger');
      const cls = variant === 'success' ? 'alert-success' : 'alert-danger';
      alertBox.classList.add('alert', cls);
    }

    function clearAlert() {
      if (!alertBox) return;
      alertBox.textContent = '';
      alertBox.classList.add('d-none');
    }

    function hasLetterAndNumber(value) {
      return /[a-zA-Z]/.test(value) && /\d/.test(value);
    }

    const banned = ['senha', 'password', 'teste', 'qwerty', 'admin'];

    const sequenceRegex = /(0123|1234|2345|3456|4567|5678|6789|7890|0987|9876|8765|7654|6543|5432|4321|3210|0000|1111|2222|3333|4444|5555|6666|7777|8888|9999)/;

    function basicPasswordChecks(password, email) {
      const value = String(password || '').trim();
      const errors = [];

      if (value.length < 8) errors.push('A nova senha deve ter pelo menos 8 caracteres.');
      if (!hasLetterAndNumber(value)) errors.push('A nova senha precisa misturar letras e números.');

      const lower = value.toLowerCase();
      if (banned.some((item) => lower.includes(item)) || sequenceRegex.test(lower)) {
        errors.push('Evite palavras comuns ou sequências previsíveis.');
      }

      if (email) {
        const emailLower = String(email).toLowerCase();
        const [local] = emailLower.split('@');
        const parts = new Set([local, ...(local ? local.split(/[\W_]+/) : []), ...emailLower.split(/[\W_]+/)]);
        Array.from(parts).filter((piece) => piece && piece.length >= 3).forEach((piece) => {
          if (lower.includes(piece)) {
            errors.push('A nova senha não pode aproveitar partes do seu e-mail.');
          }
        });
      }

      return errors;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const currentPassword = form.querySelector('#currentPassword')?.value || '';
      const newPassword = form.querySelector('#newPassword')?.value || '';
      const confirmPassword = form.querySelector('#confirmPassword')?.value || '';
      const userEmail = form.dataset?.userEmail || '';

      clearAlert();

      if (!currentPassword || !newPassword || !confirmPassword) {
        showAlert('danger', 'Preencha todos os campos obrigatórios.');
        return;
      }

      if (newPassword !== confirmPassword) {
        showAlert('danger', 'As novas senhas informadas não conferem.');
        return;
      }

      const validationErrors = basicPasswordChecks(newPassword, userEmail);
      if (validationErrors.length) {
        showAlert('danger', validationErrors[0]);
        return;
      }

      setBusy(true);
      try {
        const payload = {
          currentPassword,
          newPassword,
          confirmPassword,
        };

        if (csrfInput?.value) {
          payload._csrf = csrfInput.value;
        }

        const response = await window.API.request('/account/password', {
          method: 'POST',
          data: payload,
        });

        showAlert('success', response?.message || 'Senha atualizada com sucesso.');
        form.reset();
      } catch (err) {
        if (err?.status === 401) {
          window.location.href = '/login';
          return;
        }
        showAlert('danger', err?.message || 'Não foi possível atualizar a senha.');
      } finally {
        setBusy(false);
      }
    });
  });
})();
