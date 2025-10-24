// controllers/notificationController.js
// Gerencia configuração de notificações automáticas (admin).

const NotificationSettings = require('../models/notificationSettings');

exports.showSettings = async (req, res) => {
  try {
    const settings = await NotificationSettings.getSettings();
    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
    res.render('notificacoes', {
      title: 'Configurações de Notificações',
      user: req.session.user || null,
      csrfToken,
      settings,
    });
  } catch (err) {
    console.error('[notifications] erro ao carregar configurações:', err);
    res.status(500).render('500', { title: 'Erro interno', user: req.session.user || null });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const payload = {
      pending_enabled: req.body.pending_enabled === 'on' || req.body.pending_enabled === 'true',
      pending_interval_hours: Number(req.body.pending_interval_hours),
      in_progress_enabled: req.body.in_progress_enabled === 'on' || req.body.in_progress_enabled === 'true',
      in_progress_interval_hours: Number(req.body.in_progress_interval_hours),
    };

    await NotificationSettings.updateSettings(payload);

    if (req.accepts('json') && !req.accepts('html')) {
      return res.json({ success: true });
    }

    req.flash?.('success', 'Configurações salvas com sucesso.');
    return res.redirect('/notificacoes');
  } catch (err) {
    console.error('[notifications] erro ao atualizar configurações:', err);
    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(500).json({ success: false, error: 'Falha ao atualizar configurações' });
    }
    req.flash?.('error', 'Falha ao atualizar configurações. Tente novamente.');
    return res.redirect('/notificacoes');
  }
};
