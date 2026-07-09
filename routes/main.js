const express = require('express');
const router = express.Router();
const { requireAuth } = require('../controllers/loginController');
const { renderHome }  = require('../controllers/homeController');
const {
  renderMedidor,
  cadastrarLancamento,
  atualizarLancamento,
  getHomeStats,
  getOperadores,
} = require('../controllers/medidorController');
const { cadastrarGas, atualizarGas } = require('../controllers/gasController');
const { cadastrarFiltro, atualizarFiltro } = require('../controllers/filtroController');

router.get('/home',    requireAuth, renderHome);
router.get('/medidor', requireAuth, renderMedidor);
router.post('/medidor/cadastrar', requireAuth, cadastrarLancamento);
router.post('/medidor/editar/:id', requireAuth, atualizarLancamento);
router.post('/medidor/gas/cadastrar', requireAuth, cadastrarGas);
router.post('/medidor/gas/editar/:id', requireAuth, atualizarGas);
router.post('/medidor/filtro/cadastrar', requireAuth, cadastrarFiltro);
router.post('/medidor/filtro/editar/:id', requireAuth, atualizarFiltro);
router.get('/api/home-stats',  requireAuth, getHomeStats);
router.get('/api/operadores',  requireAuth, getOperadores);

module.exports = router;
