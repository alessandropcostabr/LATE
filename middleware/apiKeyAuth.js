const db = require('../config/database');
const crypto = require('crypto');

module.exports = async function apiKeyAuth(req, res, next) {
  try {
    const apiKey = req.get('X-API-Key');
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'Chave de API ausente', code: 'API_KEY_MISSING' });
    }

    const tokenHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const { rows } = await db.query(
      'SELECT * FROM api_tokens WHERE token_hash = $1 AND is_active = true LIMIT 1',
      [tokenHash]
    );

    if (!rows[0]) {
      return res.status(403).json({ success: false, error: 'Chave de API inválida', code: 'API_KEY_INVALID' });
    }

    req.apiToken = rows[0];
    return next();
  } catch (err) {
    console.error('apiKeyAuth error', err);
    return res.status(500).json({ success: false, error: 'Erro de autenticação', code: 'API_KEY_ERROR' });
  }
};
