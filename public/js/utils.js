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
  normalizeSituacao(value) {
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
        return "pendente";

      // em andamento
      case "emandamento":
      case "andamento":
      case "inprogress":
      case "progress":
      case "ongoing":
      case "working":
        return "em_andamento";

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
        return "resolvido";
    }

    // Se já veio em formato canônico, preserva
    if (value === "pendente" || value === "em_andamento" || value === "resolvido") {
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
    out.remetente_email    = Normalizer.toNullIfEmpty(out.remetente_email);
    out.remetente_telefone = Normalizer.toNullIfEmpty(out.remetente_telefone);
    out.horario_retorno    = Normalizer.toNullIfEmpty(out.horario_retorno);
    out.observacoes        = Normalizer.toNullIfEmpty(out.observacoes);

    // Situação: aceita rótulos e sinônimos
    if (out.situacao !== undefined) {
      out.situacao = Normalizer.normalizeSituacao(out.situacao);
    }

    return out;
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

// Expose globally
window.Form = Form;
window.Loading = Loading;
window.Normalizer = Normalizer;
