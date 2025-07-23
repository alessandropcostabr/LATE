const { body, query, param, validationResult } = require('express-validator');
const ALLOWED_STATUS    = ['pendente','em_andamento','resolvido'];
const ALLOWED_ORDER_BY  = ['criado_em','data_ligacao','situacao'];
const ALLOWED_ORDER_DIR = ['ASC','DESC'];

// Middleware para verificar erros de validação
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Dados inválidos',
            errors: errors.array()
        });
    }
    next();
};

// Validações para criar recado
const validateCreateRecado = [
    body('data_ligacao')
        .notEmpty()
        .withMessage('Data da ligação é obrigatória')
        .isDate()
        .withMessage('Data deve estar no formato válido (YYYY-MM-DD)'),
    
    body('hora_ligacao')
        .notEmpty()
        .withMessage('Hora da ligação é obrigatória')
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Hora deve estar no formato HH:MM'),
    
    body('destinatario')
        .notEmpty()
        .withMessage('Destinatário é obrigatório')
        .isLength({ min: 2, max: 255 })
        .withMessage('Destinatário deve ter entre 2 e 255 caracteres'),
    
    body('remetente_nome')
        .notEmpty()
        .withMessage('Nome do remetente é obrigatório')
        .isLength({ min: 2, max: 255 })
        .withMessage('Nome do remetente deve ter entre 2 e 255 caracteres'),
    
    body('remetente_telefone')
        .optional()
        .isLength({ max: 20 })
        .withMessage('Telefone deve ter no máximo 20 caracteres'),
    
    body('remetente_email')
        .optional()
        .isEmail()
        .withMessage('E-mail deve ter formato válido')
        .isLength({ max: 255 })
        .withMessage('E-mail deve ter no máximo 255 caracteres'),
    
    body('horario_retorno')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Horário de retorno deve ter no máximo 100 caracteres'),
    
    body('assunto')
        .notEmpty()
        .withMessage('Assunto é obrigatório')
        .isLength({ min: 5 })
        .withMessage('Assunto deve ter pelo menos 5 caracteres'),
    
    body('situacao')
        .optional()
        .isIn(['pendente', 'em_andamento', 'resolvido'])
        .withMessage('Situação deve ser: pendente, em_andamento ou resolvido'),
    
    body('observacoes')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Observações devem ter no máximo 1000 caracteres'),
    
    handleValidationErrors
];

// Validações para atualizar recado
const validateUpdateRecado = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID deve ser um número inteiro positivo'),
    
    ...validateCreateRecado.slice(0, -1), // Reutilizar validações, exceto o handler
    handleValidationErrors
];

// Validações para atualizar situação
const validateUpdateSituacao = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID deve ser um número inteiro positivo'),
    
    body('situacao')
        .notEmpty()
        .withMessage('Situação é obrigatória')
        .isIn(['pendente', 'em_andamento', 'resolvido'])
        .withMessage('Situação deve ser: pendente, em_andamento ou resolvido'),
    
    handleValidationErrors
];

// Validações para parâmetros de consulta (listagem)
const validateQueryRecados = [
    query('data_inicio')
        .optional()
        .isDate()
        .withMessage('Data de início deve estar no formato YYYY-MM-DD'),
    
    query('data_fim')
        .optional()
        .isDate()
        .withMessage('Data de fim deve estar no formato YYYY-MM-DD'),

    query('situacao').optional().isIn(ALLOWED_STATUS)
        .withMessage('Situação deve ser: pendente, em_andamento ou resolvido'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit deve ser um número entre 1 e 100'),
    
    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset deve ser um número não negativo'),

    query('orderBy').optional().isIn(ALLOWED_ORDER_BY),

    query('orderDir').optional().isIn(ALLOWED_ORDER_DIR),

    handleValidationErrors
];

// Validação para ID de parâmetro
const validateId = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID deve ser um número inteiro positivo'),
    
    handleValidationErrors
];

module.exports = {
  validateCreateRecado,
  validateUpdateRecado,
  validateUpdateSituacao,
  validateQueryRecados,
  validateId,
  handleValidationErrors
};
