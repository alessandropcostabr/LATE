// public/js/login.js
// LATE - Login (refatorado)
// Objetivo: enviar o login via fetch garantindo CSRF, cookies de sessão e UX mínima,
// sem alterar layout. Comentários em pt-BR; identificadores em inglês.

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form[action="/login"]');
    if (!form) return;

    const hiddenCsrfInput = form.querySelector('input[name="_csrf"]');
    let csrfToken = hiddenCsrfInput ? String(hiddenCsrfInput.value || '') : '';

    // Estado de envio / bloqueio de UI (somente comportamento; sem mudanças visuais)
    function setBusy(busy) {
      try {
        form.toggleAttribute('aria-busy', !!busy);
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = !!busy;
      } catch (_) {}
    }

    // Tenta obter/atualizar token CSRF via endpoint dedicado (se existir).
    // Mantém fallback no hidden input do form.
    async function refreshCsrfToken() {
      try {
        const resp = await fetch('/api/csrf', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include',
        });
        if (!resp.ok) return;
        const payload = await resp.json().catch(() => ({}));
        const token = payload && payload.data && payload.data.token;
        if (typeof token === 'string' && token.length > 0) {
          csrfToken = token;
          if (hiddenCsrfInput) hiddenCsrfInput.value = token;
        }
      } catch (_) {
        // Se falhar, seguimos com o token do form (hidden input).
      }
    }

    // Atualiza o token ao carregar (não quebra se o endpoint não existir).
    refreshCsrfToken();

    // Auxiliares
    function sanitizeEmail(v) {
      return String(v || '').trim().toLowerCase();
    }
    function parseJsonSafe(resp) {
      return resp.json().catch(() => ({}));
    }
    function humanRateLimitReset(hdr) {
      // Aceita timestamp UNIX em segundos; retorna string legível.
      const s = Number(hdr);
      if (!Number.isFinite(s)) return '';
      const d = new Date(s * 1000);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      const fd = new FormData(form);
      const email = sanitizeEmail(fd.get('email'));
      const password = String(fd.get('password') || '');
      const token = csrfToken || String(fd.get('_csrf') || '');

      if (!email || !password) {
        alert('Informe e-mail e senha.');
        return;
      }

      // Monta payload JSON e headers com CSRF + cookies
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (token) headers['X-CSRF-Token'] = token;

      const body = JSON.stringify({ email, password, _csrf: token });

      setBusy(true);
      try {
        const resp = await fetch('/login', {
          method: 'POST',
          headers,
          credentials: 'include', // imprescindível para enviar/receber cookie de sessão
          body,
          redirect: 'follow',
        });

        // Se o backend redirecionar, fetch seguirá e "resp.redirected" será true
        if (resp.redirected) {
          window.location.href = resp.url || '/';
          return;
        }

        if (resp.ok) {
          window.location.href = '/';
          return;
        }

        // Tratativas por status
        if (resp.status === 401) {
          const json = await parseJsonSafe(resp);
          alert(json.error || 'Credenciais inválidas');
          return;
        }

        if (resp.status === 403) {
          // Provável falha de CSRF; atualiza token e recarrega para sincronizar segredo.
          await refreshCsrfToken();
          alert('Falha de segurança (CSRF). A página será recarregada.');
          window.location.reload();
          return;
        }

        if (resp.status === 429) {
          const reset = humanRateLimitReset(resp.headers.get('X-RateLimit-Reset'));
          alert(reset ? `Muitas tentativas. Tente após ${reset}.` : 'Muitas tentativas. Tente mais tarde.');
          return;
        }

        // Demais erros
        const json = await parseJsonSafe(resp);
        const msg = json.error || json.message || `Erro no login (HTTP ${resp.status})`;
        alert(msg);
      } catch (err) {
        console.error('[login] network error:', err);
        alert('Erro de rede. Verifique sua conexão.');
      } finally {
        setBusy(false);
      }
    });
  });
})();