const express = require('express');
const router = express.Router();
const RecadoModel = require('../models/recado');
const {
    validateCreateRecado,
    validateUpdateRecado,
    validateUpdateSituacao,
    validateQueryRecados,
    validateId,
    handleValidationErrors
} = require('../middleware/validation');

// Middleware para log de requisições da API
router.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// GET /api/recados - Listar recados com filtros
router.get('/recados',
  validateQueryRecados,
  handleValidationErrors,          // early-return 422 se houver falha
  (req, res) => {
	const filters = {
          ...req.query,
          limit:  Number(req.query.limit  ?? 20),
          offset: Number(req.query.offset ?? 0),
        };

        const recados = RecadoModel.findAll(filters);
        const total = RecadoModel.count(filters);

        res.json({
            success: true,
            data: recados,
            pagination: {
                total,
                limit: filters.limit,
                offset: filters.offset,
                hasMore: filters.limit ? (filters.offset || 0) + filters.limit < total : false
            }
        });

    } catch (err) {
        console.error('Erro ao listar recados:', err);
        res.status(500).json({ success:false, message:'Erro interno do servidor' });
    }
});

// GET /api/recados/:id - Obter recado específico
router.get('/recados/:id', validateId, async (req, res) => {
    try {
        const recado = RecadoModel.findById(req.params.id);
        
        if (!recado) {
            return res.status(404).json({
                success: false,
                message: 'Recado não encontrado'
            });
        }

        res.json({
            success: true,
            data: recado
        });
    } catch (error) {
        console.error('Erro ao buscar recado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/recados - Criar novo recado
router.post('/recados', validateCreateRecado, async (req, res) => {
    try {
        const recado = RecadoModel.create(req.body);
        
        res.status(201).json({
            success: true,
            message: 'Recado criado com sucesso',
            data: recado
        });
    } catch (error) {
        console.error('Erro ao criar recado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PUT /api/recados/:id - Atualizar recado
router.put('/recados/:id', validateUpdateRecado, async (req, res) => {
    try {
        const recado = RecadoModel.update(req.params.id, req.body);
        
        if (!recado) {
            return res.status(404).json({
                success: false,
                message: 'Recado não encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Recado atualizado com sucesso',
            data: recado
        });
    } catch (error) {
        console.error('Erro ao atualizar recado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PATCH /api/recados/:id/situacao - Atualizar apenas situação
router.patch('/recados/:id/situacao', validateUpdateSituacao, async (req, res) => {
    try {
        const success = RecadoModel.updateSituacao(req.params.id, req.body.situacao);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Recado não encontrado'
            });
        }

        const recado = RecadoModel.findById(req.params.id);

        res.json({
            success: true,
            message: 'Situação atualizada com sucesso',
            data: recado
        });
    } catch (error) {
        console.error('Erro ao atualizar situação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// DELETE /api/recados/:id - Excluir recado
router.delete('/recados/:id', validateId, async (req, res) => {
    try {
        const success = RecadoModel.delete(req.params.id);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Recado não encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Recado excluído com sucesso'
        });
    } catch (error) {
        console.error('Erro ao excluir recado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/stats/dashboard - Estatísticas gerais
router.get('/stats/dashboard', async (req, res) => {
    try {
        const stats = RecadoModel.getStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/stats/por-destinatario - Estatísticas por destinatário
router.get('/stats/por-destinatario', async (req, res) => {
    try {
        const stats = RecadoModel.getStatsByDestinatario();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Erro ao obter estatísticas por destinatário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/recados/recentes - Recados recentes
router.get('/recados-recentes', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const recados = RecadoModel.getRecentes(limit);
        
        res.json({
            success: true,
            data: recados
        });
    } catch (error) {
        console.error('Erro ao obter recados recentes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;

