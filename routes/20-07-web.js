const express = require('express');
const path = require('path');
const router = express.Router();

// Middleware para servir arquivos estáticos
router.use(express.static(path.join(__dirname, '..', 'public')));

// Rota principal - Dashboard
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

// Rota para lista de recados
router.get('/recados', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'recados.html'));
});

// Rota para novo recado
router.get('/novo-recado', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'novo-recado.html'));
});

// Rota para editar recado
router.get('/editar-recado/:id', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'editar-recado.html'));
});

// Rota para visualizar recado
router.get('/visualizar-recado/:id', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'visualizar-recado.html'));
});

// Rota para relatórios
router.get('/relatorios', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'relatorios.html'));
});

// Middleware para capturar rotas não encontradas
router.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '..', 'views', '404.html'));
});

module.exports = router;

