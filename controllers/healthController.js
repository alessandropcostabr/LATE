// controllers/healthController.js
// Health-check simples consultando o PostgreSQL.

const dbManager = require('../config/database');

exports.check = async (_req, res) => {
  try {
    const db = dbManager.getDatabase();
    await db.exec('SELECT 1');
    return res.status(200).json({ success: true, data: { status: 'ok' } });
  } catch (err) {
    console.error('[health] Falha ao consultar o banco:', err);
    return res.status(500).json({ success: false, error: 'Banco de dados indisponível' });
  }
};
