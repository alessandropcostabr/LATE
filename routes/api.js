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

const isPlainObject = v => v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

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
    const q = req.query;
    let plain = {};
    if (isPlainObject(q)) {
      plain = { ...q };
    } else if (q && typeof q[Symbol.iterator] === 'function') {
      plain = Object.fromEntries(q);
    } else if (q && typeof q === 'object') {
      plain = Object.fromEntries(Object.entries(q));
    }

    const limit = parseInt(plain.limit, 10);
    const offset = parseInt(plain.offset, 10);
    delete plain.limit;
    delete plain.offset;

    const parsedFilters = {
      ...plain,
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0,
    };

    const data = RecadoModel.findAll(parsedFilters);
    // O método count() pode não existir se o modelo estiver desatualizado.
    // Utilizamos data.length como fallback para manter a aplicação funcional.
    let total = 0;
    if (typeof RecadoModel.count === 'function') {
      try {
        total = RecadoModel.count(parsedFilters);
      } catch (err) {
        console.error('Erro ao contar recados:', err);
        total = Array.isArray(data) ? data.length : 0;
      }
    } else {
      console.warn('RecadoModel.count não disponível. Usando data.length como fallback.');
      total = Array.isArray(data) ? data.length : 0;
    }

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
// GET /api/stats – estatísticas gerais
// ───────────────────────────────────────────────────────────
router.get('/stats', wrap((_, res) => {
  const data = RecadoModel.getStats();
  res.json({ success: true, data });
}));

// ───────────────────────────────────────────────────────────
// GET /api/stats/por-destinatario – estatísticas agrupadas
// ───────────────────────────────────────────────────────────
router.get('/stats/por-destinatario', wrap((_, res) => {
  const rows = RecadoModel.getStatsByDestinatario();
  const data = rows.map(r => ({
    destinatario: r.destinatario,
    total: r.total,
    pendente: r.pendente,
    em_andamento: r.em_andamento,
    resolvido: r.resolvido,
  }));
  res.json({ success: true, data });
}));

// ───────────────────────────────────────────────────────────
// GET /api/stats/por-mes – estatísticas agrupadas por mês
// ───────────────────────────────────────────────────────────
router.get('/stats/por-mes', wrap((_, res) => {
  const data = RecadoModel.reportByMonth();
  res.json({ success: true, data });
}));

// ───────────────────────────────────────────────────────────
// GET /api/stats/por-status – estatísticas agrupadas por status
// ───────────────────────────────────────────────────────────
router.get('/stats/por-status', wrap((_, res) => {
  const data = RecadoModel.reportByStatus();
  res.json({ success: true, data });
}));

// ───────────────────────────────────────────────────────────
// GET /api/stats/por-responsavel – estatísticas por usuário responsável
// ───────────────────────────────────────────────────────────
router.get('/stats/por-responsavel', wrap((_, res) => {
  const data = RecadoModel.reportByResponsavel();
  res.json({ success: true, data });
}));

// ───────────────────────────────────────────────────────────
// Endpoints para gráficos do Chart.js
// ───────────────────────────────────────────────────────────
router.get('/relatorios/por-mes', wrap((_, res) => {
  const rows = RecadoModel.reportByMonth();
  res.json({
    labels: rows.map(r => r.month),
    data: rows.map(r => r.total)
  });
}));

router.get('/relatorios/por-status', wrap((_, res) => {
  const rows = RecadoModel.reportByStatus();
  res.json({
    labels: rows.map(r => r.status),
    data: rows.map(r => r.total)
  });
}));

router.get('/relatorios/por-destinatario', wrap((_, res) => {
  const rows = RecadoModel.getStatsByDestinatario();
  res.json({
    labels: rows.map(r => r.destinatario),
    data: rows.map(r => r.total)
  });
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
