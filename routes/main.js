const express = require('express');
const router = express.Router();
const { requireAuth } = require('../controllers/loginController');
const { renderHome }  = require('../controllers/homeController');
const { renderPainel } = require('../controllers/painelController');
const {
  renderMedidor,
  cadastrarLancamento,
  atualizarLancamento,
  getHomeStats,
} = require('../controllers/medidorController');
const { cadastrarGas, atualizarGas } = require('../controllers/gasController');
const { cadastrarFiltro, atualizarFiltro } = require('../controllers/filtroController');
const { cadastrarConsumo, atualizarConsumo } = require('../controllers/consumoController');
const { cadastrarTurno, atualizarTurno } = require('../controllers/turnoController');

router.get('/home',    requireAuth, renderHome);
router.get('/painel',  requireAuth, renderPainel);
router.get('/medidor', requireAuth, renderMedidor);
router.post('/medidor/cadastrar', requireAuth, cadastrarLancamento);
router.post('/medidor/editar/:id', requireAuth, atualizarLancamento);
router.post('/medidor/gas/cadastrar', requireAuth, cadastrarGas);
router.post('/medidor/gas/editar/:id', requireAuth, atualizarGas);
router.post('/medidor/filtro/cadastrar', requireAuth, cadastrarFiltro);
router.post('/medidor/filtro/editar/:id', requireAuth, atualizarFiltro);
router.post('/medidor/consumo/cadastrar', requireAuth, cadastrarConsumo);
router.post('/medidor/consumo/editar/:id', requireAuth, atualizarConsumo);
router.post('/medidor/turno/cadastrar', requireAuth, cadastrarTurno);
router.post('/medidor/turno/editar/:id', requireAuth, atualizarTurno);
router.get('/api/home-stats',  requireAuth, getHomeStats);

module.exports = router;
