// public/js/login.js
// Handles login submission via fetch using email and password.

(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form[action="/login"]');
    if (!form) return;

    const hiddenCsrfInput = form.querySelector('input[name="_csrf"]');
    let csrfToken = hiddenCsrfInput ? hiddenCsrfInput.value : '';

    async function loadCsrfToken() {
      try {
        const response = await fetch('/api/csrf', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Falha ao obter token CSRF: ${response.status}`);
        }

        const payload = await response.json();
        const token = payload && payload.data ? payload.data.token : undefined;

        if (typeof token === 'string' && token) {
          csrfToken = token;
          if (hiddenCsrfInput) {
            hiddenCsrfInput.value = token;
          }
        }
      } catch (err) {
        console.error('Erro ao buscar token CSRF:', err);
      }
    }

    loadCsrfToken();

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(form));
      const token = csrfToken || formData._csrf || '';
      const data = {
        email: formData.email,
        password: formData.password,
        _csrf: token
      };

      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      };
      if (token) {
        headers['X-CSRF-Token'] = token;
      }

      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(data)
        });

        if (response.redirected) {
          window.location.href = response.url;
          return;
        }

        if (response.ok) {
          window.location.href = '/';
          return;
        }

        const result = await response.json().catch(() => ({}));
        alert(result.error || result.message || 'Falha no login');
      } catch (err) {
        console.error('Erro no login:', err);
        alert('Erro ao realizar login');
      }
    });
  });
})();
