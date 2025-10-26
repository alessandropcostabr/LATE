// controllers/healthController.js
// Health-check simples consultando o PostgreSQL (PG-only).

const db = require('../config/database'); // Pool do pg

async function ensureDatabaseConnection() {
  await db.query('SELECT 1');
}

exports.check = async (_req, res) => {
  try {
    await ensureDatabaseConnection();
    return res.status(200).json({ success: true, data: { status: 'ok' } });
  } catch (err) {
    console.error('[health] Falha ao consultar o banco:', err);
    return res.status(500).json({ success: false, error: 'Banco de dados indisponível' });
  }
};

exports.apiCheck = async (_req, res) => {
  try {
    await ensureDatabaseConnection();
    return res.status(200).json({ success: true, data: 'ok' });
  } catch (err) {
    console.error('[health] Falha ao consultar o banco (API):', err);
    return res.status(500).json({ success: false, error: 'Banco de dados indisponível' });
  }
};
