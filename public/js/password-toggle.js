// public/js/password-toggle.js
// Alternância mostrar/ocultar senha em inputs com data-password-toggle.

(function () {
  function setupPasswordToggles() {
    const buttons = document.querySelectorAll('[data-password-toggle]');
    if (!buttons.length) return;

    buttons.forEach((btn) => {
      const targetId = btn.getAttribute('data-password-toggle');
      if (!targetId) return;
      const input = document.getElementById(targetId);
      if (!input) return;

      const labelEl = btn.querySelector('[data-password-toggle-label]');

      function setVisualState(showing) {
        const text = showing ? 'Ocultar' : 'Mostrar';
        if (labelEl) {
          labelEl.textContent = text;
        } else {
          btn.textContent = text;
        }
        btn.setAttribute('aria-pressed', showing ? 'true' : 'false');
        btn.setAttribute('aria-label', `${text} senha`);
      }

      setVisualState(false);

      btn.addEventListener('click', () => {
        const currentType = input.getAttribute('type');
        const willShow = currentType === 'password';
        input.setAttribute('type', willShow ? 'text' : 'password');
        setVisualState(willShow);
        try {
          input.focus({ preventScroll: true });
        } catch (_) {
          input.focus();
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPasswordToggles);
  } else {
    setupPasswordToggles();
  }
})();
