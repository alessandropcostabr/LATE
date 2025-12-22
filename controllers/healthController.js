// controllers/healthController.js
// Health-check simples consultando o PostgreSQL (PG-only).

const Diagnostics = require('../models/diagnostics');

async function ensureDatabaseConnection() {
  const result = await Diagnostics.ping();
  return { latencyMs: result.latency_ms };
}

// Compatível com testes legados: retorna { success: true, data: 'ok' }
exports.getHealth = async (_req, res) => {
  try {
    await Diagnostics.ping();
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, data: 'ok' });
  } catch (err) {
    console.error('[health] Falha ao consultar o banco:', err);
    res.set('Cache-Control', 'no-store');
    return res.status(500).json({ success: false, error: 'Banco de dados indisponível' });
  }
};

// Rota com dados adicionais (latência) — mas mantendo shape compatível
exports.check = async (req, res) => {
  try {
    const dbResult = await ensureDatabaseConnection();
    // Respeita contratos de testes: data = 'ok'
    const base = { success: true, data: 'ok' };
    // Se quiser meta, anexamos em dev
    if (req.query && req.query.verbose === '1') {
      base.meta = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: { latency_ms: dbResult.latencyMs },
      };
    }
    res.set('Cache-Control', 'no-store');
    return res.status(200).json(base);
  } catch (err) {
    console.error('[health] Falha ao consultar o banco:', err);
    res.set('Cache-Control', 'no-store');
    return res.status(500).json({ success: false, error: 'Banco de dados indisponível' });
  }
};
