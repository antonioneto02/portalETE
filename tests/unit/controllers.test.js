const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const consumo = require('../../controllers/consumoController');
const contagem = require('../../controllers/contagemController');
const filtro = require('../../controllers/filtroController');
const gas = require('../../controllers/gasController');
const home = require('../../controllers/homeController');
const login = require('../../controllers/loginController');
const medidor = require('../../controllers/medidorController');
const painel = require('../../controllers/painelController');
const turno = require('../../controllers/turnoController');

function assertFns(mod, names) {
  for (const fn of names) {
    assert.equal(typeof mod[fn], 'function', `${fn} deveria ser função`);
  }
}

describe('controllers', () => {
  test('consumoController exporta as funções esperadas', () => {
    assertFns(consumo, ['cadastrarConsumo', 'atualizarConsumo']);
    assert.ok(Array.isArray(consumo.LOCAIS_VALIDOS));
  });

  test('contagemController exporta as funções esperadas', () => {
    assertFns(contagem, ['renderContagem', 'cadastrarContagem', 'getProdutos', 'getEmpresas', 'getArmazens']);
  });

  test('filtroController exporta as funções esperadas', () => {
    assertFns(filtro, ['cadastrarFiltro', 'atualizarFiltro']);
  });

  test('gasController exporta as funções esperadas', () => {
    assertFns(gas, ['cadastrarGas', 'atualizarGas']);
  });

  test('homeController exporta as funções esperadas', () => {
    assertFns(home, ['renderHome']);
  });

  test('loginController exporta as funções esperadas', () => {
    assertFns(login, ['validaLogin', 'requireAuth', 'requireAdmin']);
  });

  test('medidorController exporta as funções esperadas', () => {
    assertFns(medidor, ['renderMedidor', 'cadastrarLancamento', 'atualizarLancamento', 'getHomeStats']);
  });

  test('painelController exporta as funções esperadas', () => {
    assertFns(painel, ['renderPainel']);
  });

  test('turnoController exporta as funções esperadas', () => {
    assertFns(turno, ['cadastrarTurno', 'atualizarTurno']);
  });
});
