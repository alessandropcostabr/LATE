// controllers/metaController.js
// Endpoints utilitários para metadados do ambiente.

exports.version = (_req, res) => {
  const rawEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  const env = rawEnv === 'production' ? 'production' : 'development';
  const commit = process.env.GIT_COMMIT ? String(process.env.GIT_COMMIT).trim() || null : null;

  return res.json({
    success: true,
    data: {
      env,
      commit,
    },
  });
};
