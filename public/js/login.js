// public/js/login.js
// Handles login submission via fetch using email and password.

(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form[action="/login"]');
    if (!form) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(form));
      const data = {
        email: formData.email,
        password: formData.password,
        _csrf: formData._csrf
      };

      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
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
        alert(result.error || 'Falha no login');
      } catch (err) {
        console.error('Erro no login:', err);
        alert('Erro ao realizar login');
      }
    });
  });

})();

