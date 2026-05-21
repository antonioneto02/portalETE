const express = require('express');
const router = express.Router();
const { requireAuth } = require('../controllers/loginController');
const { renderHome }  = require('../controllers/homeController');
const {
  renderMedidor,
  cadastrarLancamento,
  getHomeStats,
} = require('../controllers/medidorController');

router.get('/home',    requireAuth, renderHome);
router.get('/medidor', requireAuth, renderMedidor);
router.post('/medidor/cadastrar', requireAuth, cadastrarLancamento);
router.get('/api/home-stats', requireAuth, getHomeStats);

module.exports = router;
