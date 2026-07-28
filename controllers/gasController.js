const sql = require('mssql');
const { getPool } = require('../database/dbConfig');
const { generateCsrfToken } = require('../middleware/csrf');

async function computeGapGas(pool, tipo, leitura, excludeId) {
  if (!tipo || leitura == null) return null;
  const r = pool.request();
  r.input('Tipo', sql.VarChar(20), tipo);
  r.input('ExcludeId', sql.Int, excludeId ?? -1);
  const result = await r.query(`
    SELECT TOP 1 [Leitura]
    FROM [dw].[dbo].[FATO_LANCAMENTO_GAS]
    WHERE [Tipo] = @Tipo AND [ID] <> @ExcludeId AND [Leitura] IS NOT NULL
    ORDER BY [DataHora] DESC, [ID] DESC
  `);
  const last = result.recordset[0];
  return last ? (leitura - last.Leitura) : null;
}

async function cadastrarGas(req, res) {
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
    const toStr = v => (v !== undefined && v !== '' && v !== null) ? String(v).trim() : null;
    const toInt = v => (v !== undefined && v !== '' && v !== null) ? parseInt(v, 10) : null;

    r.input('Tipo',       sql.VarChar(20),  toStr(b.Tipo));
    r.input('Fornecedor', sql.VarChar(50),  toStr(b.Fornecedor));
    r.input('Operador',   sql.VarChar(100), req.session.username || null);
    r.input('Leitura',    sql.Int,          toInt(b.Leitura));
    r.input('Gap',        sql.Int,          await computeGapGas(pool, toStr(b.Tipo), toInt(b.Leitura), null));
    r.input('Pressao',    sql.Int,          toInt(b.Pressao));

    await r.query(`
      INSERT INTO [dw].[dbo].[FATO_LANCAMENTO_GAS]
        ([DataHora],[Tipo],[Fornecedor],[Operador],[Leitura],[Gap],[Pressao],[DataCadastro])
      VALUES
        (GETDATE(),@Tipo,@Fornecedor,@Operador,@Leitura,@Gap,@Pressao,GETDATE())
    `);

    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Gas] Erro ao cadastrar:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar o lançamento.' });
  }
}

async function atualizarGas(req, res) {
  const sessionToken = String(req.session?.csrfToken || '');
  const bodyToken    = String(req.body?._csrf || '');
  if (!sessionToken || !bodyToken || sessionToken !== bodyToken) {
    return res.status(403).json({ success: false, error: 'Token de segurança inválido. Recarregue a página.' });
  }
  req.session.csrfToken = null;

  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, error: 'Identificador do lançamento inválido.' });
  }

  try {
    const pool = await getPool();
    const r = pool.request();
    const b = req.body;
    const toStr = v => (v !== undefined && v !== '' && v !== null) ? String(v).trim() : null;
    const toInt = v => (v !== undefined && v !== '' && v !== null) ? parseInt(v, 10) : null;

    r.input('ID',          sql.Int,          id);
    r.input('Tipo',        sql.VarChar(20),  toStr(b.Tipo));
    r.input('Fornecedor',  sql.VarChar(50),  toStr(b.Fornecedor));
    r.input('Leitura',     sql.Int,          toInt(b.Leitura));
    r.input('Gap',         sql.Int,          await computeGapGas(pool, toStr(b.Tipo), toInt(b.Leitura), id));
    r.input('Pressao',     sql.Int,          toInt(b.Pressao));

    await r.query(`
      UPDATE [dw].[dbo].[FATO_LANCAMENTO_GAS]
      SET
        [Tipo] = @Tipo,
        [Fornecedor] = @Fornecedor,
        [Leitura] = @Leitura,
        [Gap] = @Gap,
        [Pressao] = @Pressao,
        [DataAlteracao] = GETDATE()
      WHERE [ID] = @ID
    `);

    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Gas] Erro ao atualizar:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar o lançamento.' });
  }
}

module.exports = { cadastrarGas, atualizarGas };
