// public/js/utils.js

/** Helpers de normalização */
const Normalizer = {
  stripAccents(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  },
  simplify(s) {
    return Normalizer.stripAccents(String(s || ""))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ""); // remove espaços, _, -, etc
  },
  normalizeStatus(value) {
    const key = Normalizer.simplify(value);

    // mapeia variações e sinônimos
    switch (key) {
      // pendente
      case "pendente":
      case "pend":
      case "novo":
      case "aberto":
      case "open":
      case "todo":
      case "pending":
        return "pending";

      // em andamento
      case "emandamento":
      case "andamento":
      case "inprogress":
      case "progress":
      case "ongoing":
      case "working":
      case "in_progress":
        return "in_progress";

      // resolvido
      case "resolvido":
      case "resolvida":
      case "concluido":
      case "concluida":
      case "finalizado":
      case "finalizada":
      case "fechado":
      case "done":
      case "ok":
      case "resolved":
        return "resolved";
    }

    // Se já veio em formato canônico, preserva
    if (value === "pending" || value === "in_progress" || value === "resolved") {
      return value;
    }

    // Sem valor => não altera
    if (!value) return value;

    // Valor desconhecido: mantém original (deixa o back validar)
    return value;
  },
  toNullIfEmpty(v) {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  }
};

/** Form utility */
const Form = {
  getData(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      data[key] = typeof value === 'string' ? value.trim() : value;
    });
    return data;
  },

  /** Normaliza payload antes de enviar ao back */
  prepareRecadoPayload(data) {
    const out = { ...data };

    // Campos opcionais: vazio -> null
    out.sender_email    = Normalizer.toNullIfEmpty(out.sender_email);
    out.sender_phone   = Normalizer.toNullIfEmpty(out.sender_phone);
    out.callback_time  = Normalizer.toNullIfEmpty(out.callback_time);
    out.notes          = Normalizer.toNullIfEmpty(out.notes);

    // Situação: aceita rótulos e sinônimos
    if (out.status !== undefined) {
      out.status = Normalizer.normalizeStatus(out.status);
    }

    if (Object.prototype.hasOwnProperty.call(out, 'message')) {
      const msg = typeof out.message === 'string' ? out.message.trim() : out.message;
      out.message = msg ? msg : '(sem mensagem)';
    }

    return out;
  },

  prepareMessagePayload(data) {
    return Form.prepareRecadoPayload(data);
  },

  validate(form) {
    const errors = [];
    form.querySelectorAll('[required]').forEach(field => {
      if (!String(field.value || '').trim()) {
        const label = field.dataset.label || field.name || 'Campo';
        errors.push(`${label} é obrigatório`);
      }
    });
    form.querySelectorAll('input[type="email"]').forEach(field => {
      const val = String(field.value || '').trim();
      // e-mail vazio passa (opcional); se tiver valor, valida formato
      if (val && !Form.isValidEmail(val)) {
        const label = field.dataset.label || field.name || 'E-mail';
        errors.push(`${label} inválido`);
      }
    });
    return errors;
  },

  populate(form, data) {
    Object.keys(data || {}).forEach(key => {
      const field = form.querySelector(`[name="${key}"]`);
      if (!field) return;
      const val = data[key];
      // Se vier null/undefined do back, coloca string vazia para evitar "null" na UI
      field.value = val == null ? "" : val;
    });
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
  }
};

/** Loading utility */
const Loading = {
  _resolveTarget(target) {
    return typeof target === 'string'
      ? document.getElementById(target)
      : target instanceof HTMLElement
        ? target
        : null;
  },
  show(target) {
    const btn = Loading._resolveTarget(target);
    if (!btn) return;
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="loading"></span> ${btn.textContent.trim()}`;
  },
  hide(target) {
    const btn = Loading._resolveTarget(target);
    if (!btn) return;
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.innerHTML = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
  }
};

// Aliases de compatibilidade
Normalizer.normalizeSituacao = Normalizer.normalizeStatus;
Form.prepareMessagePayload = Form.prepareRecadoPayload;

// Expose globally
window.Form = Form;
window.Loading = Loading;
window.Normalizer = Normalizer;
