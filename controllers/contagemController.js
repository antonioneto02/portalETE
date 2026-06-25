const sql = require('mssql');
const { getPool } = require('../database/dbConfig');
const { generateCsrfToken } = require('../middleware/csrf');

async function renderContagem(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        [ID],[CODPROD],[PRODUTO],[FAMILIA],
        [CODFIL],[FILIAL],[CODEMP],[EMPRESA],
        [ARM_COD],[ARMAZEM],
        [PALETIZACAO],[FARDOS],[QTDE_PALLET],
        [DATA_PRODUZIDA],[DIAS_VALIDADE],[DATA_VALIDADE],
        DATEDIFF(DAY, GETDATE(), [DATA_VALIDADE]) AS DIAS_PARA_VENCER,
        [DATA_CONTAGEM],[OBS]
      FROM [dw].[dbo].[CONTAGEM_PRODUTOS_FABRICA]
      ORDER BY [DATA_VALIDADE] ASC
    `);
    const csrfToken = generateCsrfToken(req);
    res.render('Contagem/index', {
      username: req.session.username || req.session.userId || 'Usuário',
      isAdmin: req.session.isAdmin || false,
      currentPath: '/contagem',
      registros: result.recordset,
      csrfToken,
      dbError: null,
    });
  } catch (err) {
    console.error('[Contagem] Erro ao buscar registros:', err);
    const csrfToken = generateCsrfToken(req);
    res.render('Contagem/index', {
      username: req.session.username || req.session.userId || 'Usuário',
      isAdmin: req.session.isAdmin || false,
      currentPath: '/contagem',
      registros: [],
      csrfToken,
      dbError: 'Não foi possível carregar os dados. Tente novamente.',
    });
  }
}

async function cadastrarContagem(req, res) {
  const sessionToken = String(req.session?.csrfToken || '');
  const bodyToken    = String(req.body?._csrf || '');
  if (!sessionToken || !bodyToken || sessionToken !== bodyToken) {
    return res.status(403).json({ success: false, error: 'Token de segurança inválido. Recarregue a página.' });
  }
  req.session.csrfToken = null;

  try {
    const pool = await getPool();
    const r = pool.request();
    const b = req.body;
    const toStr  = v => (v !== undefined && v !== '' && v !== null) ? String(v).trim() : null;
    const toInt  = v => (v !== undefined && v !== '' && v !== null) ? Math.round(parseFloat(v)) : null;
    const toDate = v => (v !== undefined && v !== '' && v !== null) ? v : null;
    const paletizacao = toInt(b.PALETIZACAO);
    const fardos       = toInt(b.FARDOS);
    const qtdePallet   = (paletizacao && fardos != null) ? (fardos / paletizacao) : null;
    const dataProduzida = toDate(b.DATA_PRODUZIDA);
    const diasValidade  = toInt(b.DIAS_VALIDADE);
    let dataValidade = null;
    if (dataProduzida && diasValidade != null) {
      const d = new Date(dataProduzida);
      d.setDate(d.getDate() + diasValidade);
      dataValidade = d.toISOString().split('T')[0];
    }

    r.input('CODPROD',          sql.VarChar(20),   toStr(b.CODPROD));
    r.input('PRODUTO',          sql.VarChar(150),  toStr(b.PRODUTO));
    r.input('FAMILIA',          sql.VarChar(100),  toStr(b.FAMILIA));
    r.input('CODFIL',           sql.VarChar(10),   toStr(b.CODFIL));
    r.input('FILIAL',           sql.VarChar(100),  toStr(b.FILIAL));
    r.input('CODEMP',           sql.VarChar(10),   toStr(b.CODEMP));
    r.input('EMPRESA',          sql.VarChar(100),  toStr(b.EMPRESA));
    r.input('ARM_COD',          sql.VarChar(10),   toStr(b.ARM_COD));
    r.input('ARMAZEM',          sql.VarChar(100),  toStr(b.ARMAZEM));
    r.input('PALETIZACAO',      sql.Int,           paletizacao);
    r.input('FARDOS',           sql.Int,           fardos);
    r.input('QTDE_PALLET',      sql.Decimal(10,4), qtdePallet);
    r.input('DATA_PRODUZIDA',   sql.Date,          dataProduzida);
    r.input('DIAS_VALIDADE',    sql.Int,           diasValidade);
    r.input('DATA_VALIDADE',    sql.Date,          dataValidade);
    r.input('DATA_CONTAGEM',    sql.Date,          toDate(b.DATA_CONTAGEM));
    r.input('OBS',              sql.VarChar(500),  toStr(b.OBS));
    r.input('USUARIO_CADASTRO', sql.VarChar(100),  toStr(req.session.username || req.session.userId));

    await r.query(`
      INSERT INTO [dw].[dbo].[CONTAGEM_PRODUTOS_FABRICA]
        ([CODPROD],[PRODUTO],[FAMILIA],[CODFIL],[FILIAL],[CODEMP],[EMPRESA],
         [ARM_COD],[ARMAZEM],[PALETIZACAO],[FARDOS],[QTDE_PALLET],
         [DATA_PRODUZIDA],[DIAS_VALIDADE],[DATA_VALIDADE],[DATA_CONTAGEM],[OBS],[USUARIO_CADASTRO])
      VALUES
        (@CODPROD,@PRODUTO,@FAMILIA,@CODFIL,@FILIAL,@CODEMP,@EMPRESA,
         @ARM_COD,@ARMAZEM,@PALETIZACAO,@FARDOS,@QTDE_PALLET,
         @DATA_PRODUZIDA,@DIAS_VALIDADE,@DATA_VALIDADE,@DATA_CONTAGEM,@OBS,@USUARIO_CADASTRO)
    `);

    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Contagem] Erro ao cadastrar:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar o registro.' });
  }
}

async function getProdutos(req, res) {
  const q = String(req.query.q || '').trim();
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('Q', sql.VarChar(200), '%' + q.toUpperCase() + '%')
      .query(`
        SELECT TOP 20 [SEQ],[FAMILIA],[CODPROD],[PRODUTO]
        FROM [dw].[dbo].[V_PRODUTOS_ATIVOS]
        WHERE [PRODUTO] IS NOT NULL AND UPPER([PRODUTO]) LIKE @Q
        ORDER BY [PRODUTO]
      `);
    res.json(result.recordset.map(r => ({
      id:      r.CODPROD,
      text:    r.PRODUTO.trim() + '  (' + String(r.CODPROD).trim() + ')',
      codprod: String(r.CODPROD).trim(),
      produto: r.PRODUTO.trim(),
      familia: (r.FAMILIA || '').trim(),
    })));
  } catch (err) {
    console.error('[getProdutos]', err);
    res.json([]);
  }
}

async function getEmpresas(req, res) {
  const q = String(req.query.q || '').trim();
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('Q', sql.VarChar(200), '%' + q.toUpperCase() + '%')
      .query(`
        SELECT TOP 20 [RECNO],[CODFIL],[FILIAL],[CODEMP],[EMPRESA],[NOMEEMP_SOC]
        FROM [dw].[dbo].[DIM_FILIAIS]
        WHERE UPPER([FILIAL]) LIKE @Q OR UPPER([EMPRESA]) LIKE @Q
        ORDER BY [FILIAL]
      `);
    res.json(result.recordset.map(r => ({
      id:          r.CODFIL,
      text:        r.FILIAL.trim(),
      codfil:      String(r.CODFIL).trim(),
      codemp:      (r.CODEMP || '').trim(),
      empresa:     (r.EMPRESA || '').trim(),
      filial:      (r.FILIAL || '').trim(),
      nomeempsoc:  (r.NOMEEMP_SOC || '').trim(),
    })));
  } catch (err) {
    console.error('[getEmpresas]', err);
    res.json([]);
  }
}

async function getArmazens(req, res) {
  const q      = String(req.query.q || '').trim();
  const codFil = String(req.query.codfil || '').trim();
  try {
    const pool = await getPool();
    const request = pool.request().input('Q', sql.VarChar(200), '%' + q.toUpperCase() + '%');
    let where = `UPPER([ARMAZEM]) LIKE @Q`;
    if (codFil) {
      request.input('CodFil', sql.VarChar(10), codFil);
      where += ` AND [CODFIL] = @CodFil`;
    }
    const result = await request.query(`
      SELECT TOP 20 [CODFIL],[COD],[ARMAZEM]
      FROM [dw].[dbo].[DIM_LOCAIS_ESTOQUE]
      WHERE ${where}
      ORDER BY [ARMAZEM]
    `);
    res.json(result.recordset.map(r => ({
      id:      r.COD,
      text:    r.ARMAZEM.trim(),
      cod:     String(r.COD).trim(),
      armazem: r.ARMAZEM.trim(),
      codfil:  String(r.CODFIL).trim(),
    })));
  } catch (err) {
    console.error('[getArmazens]', err);
    res.json([]);
  }
}

module.exports = {
  renderContagem,
  cadastrarContagem,
  getProdutos,
  getEmpresas,
  getArmazens,
};
