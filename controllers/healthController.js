// controllers/healthController.js
// Health-check simples consultando o PostgreSQL (PG-only).

const db = require('../config/database'); // Pool do pg

exports.check = async (_req, res) => {
  try {
    await db.query('SELECT 1');
    return res.status(200).json({ success: true, data: { status: 'ok' } });
  } catch (err) {
    console.error('[health] Falha ao consultar o banco:', err);
    return res.status(500).json({ success: false, error: 'Banco de dados indisponível' });
  }
};

