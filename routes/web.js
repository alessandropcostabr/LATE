const express = require('express');
const path = require('path');
const router = express.Router();

// Servir arquivos estáticos (assets, CSS, JS)
router.use(express.static(path.join(__dirname, '..', 'public')));

// Dashboard
router.get('/', (req, res) => {
  res.render('index', { title: 'Dashboard' });
});

// Lista de recados
router.get('/recados', (req, res) => {
  res.render('recados', { title: 'Recados' });
});

// Novo recado
router.get('/novo-recado', (req, res) => {
  res.render('novo-recado', { title: 'Novo Recado' });
});

// Editar recado
router.get('/editar-recado/:id', (req, res) => {
  res.render('editar-recado', {
    title: 'Editar Recado',
    id: req.params.id
  });
});

// Visualizar recado
router.get('/visualizar-recado/:id', (req, res) => {
  res.render('visualizar-recado', {
    title: 'Visualizar Recado',
    id: req.params.id
  });
});

// Relatórios
router.get('/relatorios', (req, res) => {
  res.render('relatorios', { title: 'Relatórios' });
});

// 404
router.use((req, res) => {
  res.status(404).render('404', { title: 'Página não encontrada' });
});

module.exports = router;
