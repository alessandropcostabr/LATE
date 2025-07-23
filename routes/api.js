const express = require('express');
const router  = express.Router();

const RecadoModel = require('../models/recado');
const {
  validateCreateRecado,
  validateUpdateRecado,
  validateUpdateSituacao,
  validateQueryRecados,
  validateId,
  handleValidationErrors,
} = require('../middleware/validation');

/**
 * Helper que envolve handlers síncronos para propagar erros ao middleware de erro do Express.
 */
const wrap = fn => (req, res, next) => {
  try {
    fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

// ───────────────────────────────────────────────────────────
// Middleware de log simples
// ───────────────────────────────────────────────────────────
router.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl}`);
  next();
});

// ───────────────────────────────────────────────────────────
// GET /api/recados  – listagem com filtros, paginação e ordenação
// ───────────────────────────────────────────────────────────
router.get(
  '/recados',
  validateQueryRecados,
  handleValidationErrors,
  wrap((req, res) => {
    const { limit = 20, offset = 0, ...filters } = req.query;

    const parsedFilters = {
      ...filters,
      limit:  Number(limit),
      offset: Number(offset),
    };

    const data  = RecadoModel.findAll(parsedFilters);
    const total = RecadoModel.count(parsedFilters);

    res.json({
      success: true,
      data,
      pagination: {
        total,
        limit:  parsedFilters.limit,
        offset: parsedFilters.offset,
        hasMore: parsedFilters.offset + parsedFilters.limit < total,
      },
    });
  })
);

// ───────────────────────────────────────────────────────────
// GET /api/recados/:id – obter recado específico
// ───────────────────────────────────────────────────────────
router.get(
  '/recados/:id',
  validateId,
  handleValidationErrors,
  wrap((req, res) => {
    const recado = RecadoModel.findById(Number(req.params.id));
    if (!recado) {
      return res.status(404).json({ success: false, message: 'Recado não encontrado' });
    }
    res.json({ success: true, data: recado });
  })
);

// ───────────────────────────────────────────────────────────
// POST /api/recados – criar novo recado
// ───────────────────────────────────────────────────────────
router.post(
  '/recados',
  validateCreateRecado,
  handleValidationErrors,
  wrap((req, res) => {
    const recado = RecadoModel.create(req.body);
    res.status(201).json({ success: true, data: recado });
  })
);

// ───────────────────────────────────────────────────────────
// PUT /api/recados/:id – atualizar recado inteiro
// ───────────────────────────────────────────────────────────
router.put(
  '/recados/:id',
  validateUpdateRecado,
  handleValidationErrors,
  wrap((req, res) => {
    const recado = RecadoModel.update(Number(req.params.id), req.body);
    if (!recado) {
      return res.status(404).json({ success: false, message: 'Recado não encontrado' });
    }
    res.json({ success: true, data: recado });
  })
);

// ───────────────────────────────────────────────────────────
// PATCH /api/recados/:id/situacao – atualizar somente o status
// ───────────────────────────────────────────────────────────
router.patch(
  '/recados/:id/situacao',
  validateUpdateSituacao,
  handleValidationErrors,
  wrap((req, res) => {
    const ok = RecadoModel.updateSituacao(Number(req.params.id), req.body.situacao);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Recado não encontrado' });
    }
    const recado = RecadoModel.findById(Number(req.params.id));
    res.json({ success: true, data: recado });
  })
);

// ───────────────────────────────────────────────────────────
// DELETE /api/recados/:id – remover recado
// ───────────────────────────────────────────────────────────
router.delete(
  '/recados/:id',
  validateId,
  handleValidationErrors,
  wrap((req, res) => {
    const ok = RecadoModel.delete(Number(req.params.id));
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Recado não encontrado' });
    }
    res.json({ success: true });
  })
);

// ───────────────────────────────────────────────────────────
// GET /api/stats/dashboard – estatísticas gerais
// ───────────────────────────────────────────────────────────
router.get('/stats/dashboard', wrap((_, res) => {
  const data = RecadoModel.getStats();
  res.json({ success: true, data });
}));

// ───────────────────────────────────────────────────────────
// GET /api/stats/por-destinatario – estatísticas agrupadas
// ───────────────────────────────────────────────────────────
router.get('/stats/por-destinatario', wrap((_, res) => {
  const data = RecadoModel.getStatsByDestinatario();
  res.json({ success: true, data });
}));

// ───────────────────────────────────────────────────────────
// GET /api/recados-recentes – últimos N recados (default 10)
// ───────────────────────────────────────────────────────────
router.get('/recados-recentes', wrap((req, res) => {
  const limit = Number(req.query.limit) || 10;
  const data  = RecadoModel.getRecentes(limit);
  res.json({ success: true, data });
}));

// ───────────────────────────────────────────────────────────
// Health‑check simples
// ───────────────────────────────────────────────────────────
router.get('/healthz', (_, res) => res.json({ ok: true }));

module.exports = router;
