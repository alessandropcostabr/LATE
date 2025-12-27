(() => {
  const root = document.querySelector('[data-error-operacional]');
  const btn = document.getElementById('report-btn');
  const feedback = document.getElementById('report-feedback');
  const errorCode = root?.dataset?.errorCode || '';
  const autoKey = `autoIncident:${errorCode || 'no-code'}`;
  if (!btn) return;

  function setStatus(message, variant) {
    if (!feedback) return;
    const colors = {
      success: 'var(--success, #0f9d58)',
      error: 'var(--danger, #c0392b)',
      warning: 'var(--warning, #f39c12)',
      info: 'var(--text-secondary)'
    };
    feedback.style.color = colors[variant] || colors.info;
    feedback.textContent = message;
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    setStatus('Enviando seu relato...', 'info');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/report-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: window.location.href,
          errorCode,
          userAgent: navigator.userAgent
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setStatus(data.message || 'Obrigado! Registramos seu relato.', 'success');
      } else if (res.status === 429) {
        setStatus(data?.message || 'Limite de relatos atingido. Tente novamente mais tarde.', 'warning');
      } else {
        setStatus(data?.message || 'Não foi possível registrar agora. Tente novamente.', 'error');
      }
    } catch (err) {
      const aborted = err?.name === 'AbortError';
      setStatus(aborted ? 'Demorou demais. Tente de novo em alguns segundos.' : 'Falha ao enviar. Verifique sua conexão e tente novamente.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  async function autoReportOnce() {
    if (sessionStorage.getItem(autoKey)) return;
    sessionStorage.setItem(autoKey, '1');
    if (feedback) setStatus('Registrando diagnóstico automático...', 'info');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/report-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: window.location.href,
          errorCode,
          auto: true,
          userAgent: navigator.userAgent
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setStatus(data.message || 'Diagnóstico automático disparado.', 'success');
      } else {
        setStatus(data?.message || 'Não foi possível registrar automaticamente.', 'warning');
      }
    } catch (err) {
      const aborted = err?.name === 'AbortError';
      setStatus(aborted ? 'Diagnóstico automático demorou; tente o botão.' : 'Falha no diagnóstico automático.', 'error');
    }
  }

  setTimeout(autoReportOnce, 600);
})();
