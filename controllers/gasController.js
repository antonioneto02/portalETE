const sql = require('mssql');
const { getPool } = require('../database/dbConfig');
const { generateCsrfToken } = require('../middleware/csrf');

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
    const toDateTime = v => (v !== undefined && v !== '' && v !== null) ? new Date(v) : null;

    r.input('DataHora',   sql.DateTime2,    toDateTime(b.DataHora));
    r.input('Tipo',       sql.VarChar(20),  toStr(b.Tipo));
    r.input('Fornecedor', sql.VarChar(50),  toStr(b.Fornecedor));
    r.input('Leitura',    sql.Int,          toInt(b.Leitura));
    r.input('Pressao',    sql.Int,          toInt(b.Pressao));

    await r.query(`
      INSERT INTO [dw].[dbo].[FATO_LANCAMENTO_GAS]
        ([DataHora],[Tipo],[Fornecedor],[Leitura],[Pressao])
      VALUES
        (@DataHora,@Tipo,@Fornecedor,@Leitura,@Pressao)
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
    const toDateTime = v => (v !== undefined && v !== '' && v !== null) ? new Date(v) : null;

    r.input('ID',          sql.Int,          id);
    r.input('DataHora',    sql.DateTime2,    toDateTime(b.DataHora));
    r.input('Tipo',        sql.VarChar(20),  toStr(b.Tipo));
    r.input('Fornecedor',  sql.VarChar(50),  toStr(b.Fornecedor));
    r.input('Leitura',     sql.Int,          toInt(b.Leitura));
    r.input('Pressao',     sql.Int,          toInt(b.Pressao));

    await r.query(`
      UPDATE [dw].[dbo].[FATO_LANCAMENTO_GAS]
      SET
        [DataHora] = @DataHora,
        [Tipo] = @Tipo,
        [Fornecedor] = @Fornecedor,
        [Leitura] = @Leitura,
        [Pressao] = @Pressao
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
