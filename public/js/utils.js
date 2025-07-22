// public/js/utils.js

/** Form utility */
const Form = {
  getData(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      data[key] = typeof value === 'string' ? value.trim() : value;
    });
    return data;
  },

  validate(form) {
    const errors = [];
    form.querySelectorAll('[required]').forEach(field => {
      if (!field.value.trim()) {
        const label = field.dataset.label || field.name || 'Campo';
        errors.push(`${label} é obrigatório`);
      }
    });
    form.querySelectorAll('input[type="email"]').forEach(field => {
      if (field.value && !Form.isValidEmail(field.value)) {
        const label = field.dataset.label || field.name || 'E-mail';
        errors.push(`${label} inválido`);
      }
    });
    return errors;
  },

  populate(form, data) {
    Object.keys(data || {}).forEach(key => {
      const field = form.querySelector(`[name="${key}"]`);
      if (field) field.value = data[key];
    });
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
};

/** Loading utility */
const Loading = {
  show(id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="loading"></span> ${btn.textContent.trim()}`;
  },
  hide(id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.innerHTML = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
  }
};

/** Toast notifications */
const Toast = {
  container: null,
  _create(message, type) {
    if (!Toast.container) {
      Toast.container = document.createElement('div');
      Toast.container.className = 'toast-container';
      document.body.appendChild(Toast.container);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    Toast.container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      el.addEventListener('transitionend', () => el.remove());
    }, 3000);
  },
  success(msg) { Toast._create(msg, 'success'); },
  warning(msg) { Toast._create(msg, 'warning'); },
  error(msg) { Toast._create(msg, 'error'); },
  info(msg) { Toast._create(msg, 'info'); }
};

// Expose globally
window.Form = Form;
window.Loading = Loading;
window.Toast = Toast;
