// controllers/passwordController.js
// Fluxos de alteração e recuperação de senha.

const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const UserModel = require('../models/user');
const PasswordResetTokenModel = require('../models/passwordResetToken');
const { sendMail } = require('../services/mailer');
const { validatePassword } = require('../utils/passwordPolicy');
const db = require('../config/database');

function buildBaseUrl(req) {
  const configured = process.env.APP_BASE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const protocol = req.protocol || 'http';
  const host = req.get('host');
  if (!host) return '';
  return `${protocol}://${host}`.replace(/\/+$/, '');
}

function escapeHtml(value) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(value ?? '').replace(/[&<>"']/g, (char) => map[char]);
}

exports.requestReset = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errors.array(),
    });
  }

  const email = String(req.body.email || '').trim().toLowerCase();
  const genericMessage = 'Se o e-mail informado estiver cadastrado, enviaremos instruções em instantes.';

  try {
    const user = await UserModel.findByEmail(email);

    if (!user || user.is_active === false) {
      return res.json({ success: true, message: genericMessage });
    }

    const { token, expiresAt } = await PasswordResetTokenModel.createForUser(user.id);
    const baseUrl = buildBaseUrl(req) || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/account/password/reset?token=${encodeURIComponent(token)}`;

    let expiresText;
    try {
      expiresText = expiresAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch (_err) {
      expiresText = expiresAt.toISOString();
    }

    const text = `Olá, ${user.name || 'colega'}!

Recebemos um pedido para redefinir sua senha no LATE.

Caso tenha solicitado, acesse o link abaixo e crie uma nova senha:
${resetUrl}

Este link expira em ${expiresText}.
Se você não fez essa solicitação, pode ignorar este e-mail.

— Equipe LATE`;

    const htmlName = escapeHtml(user.name || 'colega');
    const htmlResetUrl = escapeHtml(resetUrl);
    const htmlExpires = escapeHtml(expiresText);

    const html = `
<p>Olá, ${htmlName}!</p>
<p>Recebemos um pedido para redefinir sua senha no <strong>LATE</strong>.</p>
<p>Se você fez esta solicitação, clique no link abaixo para criar uma nova senha:</p>
<p><a href="${htmlResetUrl}">➜ Redefinir senha</a></p>
<p><em>O link expira em ${htmlExpires}.</em></p>
<p>Se você não solicitou a redefinição, basta ignorar esta mensagem.</p>
<p>— Equipe LATE</p>
`.trim();

    await sendMail({
      to: user.email,
      subject: '[LATE] Redefinição de senha',
      text,
      html,
    });

    return res.json({ success: true, message: genericMessage });
  } catch (err) {
    console.error('[password] erro ao solicitar redefinição:', err);
    return res.status(500).json({ success: false, error: 'Não foi possível enviar o e-mail agora. Tente novamente mais tarde.' });
  }
};

exports.resetWithToken = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errors.array(),
    });
  }

  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '').trim();
  const confirm = String(req.body.confirm || '').trim();

  if (!token) {
    return res.status(400).json({ success: false, error: 'Token inválido ou expirado.' });
  }

  if (password !== confirm) {
    return res.status(400).json({ success: false, error: 'As novas senhas não conferem.' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const tokenRecord = await PasswordResetTokenModel.findValidByToken(token, { client, forUpdate: true });
    if (!tokenRecord) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Token inválido ou expirado.' });
    }

    const user = await UserModel.findById(tokenRecord.user_id, { client });
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Token inválido ou expirado.' });
    }

    const { valid, errors: passwordErrors } = validatePassword(password, { email: user.email });
    if (!valid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: passwordErrors.join(' ') });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const updated = await UserModel.updatePassword(user.id, passwordHash, { client });

    if (!updated) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, error: 'Não foi possível atualizar a senha.' });
    }

    const marked = await PasswordResetTokenModel.markUsed(tokenRecord.id, { client });
    if (!marked) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Token inválido ou expirado.' });
    }

    await client.query('COMMIT');

    return res.json({ success: true, message: 'Senha atualizada com sucesso.' });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[password] falha ao desfazer transação:', rollbackErr);
    }
    console.error('[password] erro ao redefinir com token:', err);
    return res.status(500).json({ success: false, error: 'Não foi possível atualizar a senha.' });
  } finally {
    client.release();
  }
};

exports.changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errors.array(),
    });
  }

  const userSession = req.session?.user;
  if (!userSession) {
    return res.status(401).json({ success: false, error: 'Sessão expirada. Faça login novamente.' });
  }

  const currentPassword = String(req.body.currentPassword || '').trim();
  const newPassword = String(req.body.newPassword || '').trim();
  const confirmPassword = String(req.body.confirmPassword || '').trim();

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Informe todos os campos obrigatórios.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, error: 'As novas senhas não conferem.' });
  }

  try {
    const user = await UserModel.findByEmail(userSession.email);
    if (!user || user.is_active === false) {
      return res.status(401).json({ success: false, error: 'Sessão inválida. Faça login novamente.' });
    }

    const ok = await argon2.verify(user.password_hash, currentPassword);
    if (!ok) {
      return res.status(400).json({ success: false, error: 'Senha atual incorreta.' });
    }

    const { valid, errors: passwordErrors } = validatePassword(newPassword, { email: user.email });
    if (!valid) {
      return res.status(400).json({ success: false, error: passwordErrors.join(' ') });
    }

    const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    const updated = await UserModel.updatePassword(user.id, newHash);
    if (!updated) {
      return res.status(500).json({ success: false, error: 'Não foi possível atualizar a senha.' });
    }

    await PasswordResetTokenModel.invalidateForUser(user.id);

    return res.json({ success: true, message: 'Senha atualizada com sucesso.' });
  } catch (err) {
    console.error('[password] erro ao atualizar senha da conta:', err);
    return res.status(500).json({ success: false, error: 'Não foi possível atualizar a senha.' });
  }
};
