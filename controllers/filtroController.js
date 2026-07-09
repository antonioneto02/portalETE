const sql = require('mssql');
const { getPool } = require('../database/dbConfig');
const { generateCsrfToken } = require('../middleware/csrf');

const FILTRO_TIPO_MAP = {
  'Areia Novo':       'Retrolavagem',
  'Areia':            'Retrolavagem',
  'Abrandador VEXER': 'Regeneramento',
  'Abrandador':       'Regeneramento',
};

function deriveTipo(filtro) {
  return FILTRO_TIPO_MAP[filtro] || null;
}

function parseBody(b) {
  const toStr      = v => (v !== undefined && v !== '' && v !== null) ? String(v).trim() : null;
  const toFloat    = v => (v !== undefined && v !== '' && v !== null) ? parseFloat(v) : null;
  const toDateTime = v => (v !== undefined && v !== '' && v !== null) ? new Date(v) : null;

  const filtro = toStr(b.Filtro);
  const tipo = deriveTipo(filtro);
  if (!tipo) return { error: 'Filtro inválido.' };

  const isRetro = tipo === 'Retrolavagem';
  return {
    DataHora:     toDateTime(b.DataHora),
    Operador:     toStr(b.Operador),
    Filtro:       filtro,
    Tipo:         tipo,
    Turbidez:     isRetro ? toFloat(b.Turbidez) : null,
    Cor:          isRetro ? toFloat(b.Cor) : null,
    Alcalinidade: isRetro ? null : toFloat(b.Alcalinidade),
    Dureza:       isRetro ? null : toFloat(b.Dureza),
  };
}

async function cadastrarFiltro(req, res) {
  const sessionToken = String(req.session?.csrfToken || '');
  const bodyToken    = String(req.body?._csrf || '');
  if (!sessionToken || !bodyToken || sessionToken !== bodyToken) {
    return res.status(403).json({ success: false, error: 'Token de segurança inválido. Recarregue a página.' });
  }
  req.session.csrfToken = null;

  const data = parseBody(req.body);
  if (data.error) {
    return res.status(400).json({ success: false, error: data.error });
  }

  try {
    const pool = await getPool();
    const r = pool.request();

    r.input('DataHora',     sql.DateTime2,    data.DataHora);
    r.input('Operador',     sql.VarChar(100), data.Operador);
    r.input('Filtro',       sql.VarChar(30),  data.Filtro);
    r.input('Tipo',         sql.VarChar(20),  data.Tipo);
    r.input('Turbidez',     sql.Float,        data.Turbidez);
    r.input('Cor',          sql.Float,        data.Cor);
    r.input('Alcalinidade', sql.Float,        data.Alcalinidade);
    r.input('Dureza',       sql.Float,        data.Dureza);

    await r.query(`
      INSERT INTO [dw].[dbo].[FATO_LANCAMENTO_FILTRO]
        ([DataHora],[Operador],[Filtro],[Tipo],[Turbidez],[Cor],[Alcalinidade],[Dureza],[DataCadastro])
      VALUES
        (@DataHora,@Operador,@Filtro,@Tipo,@Turbidez,@Cor,@Alcalinidade,@Dureza,GETDATE())
    `);

    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Filtro] Erro ao cadastrar:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar o lançamento.' });
  }
}

async function atualizarFiltro(req, res) {
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

  const data = parseBody(req.body);
  if (data.error) {
    return res.status(400).json({ success: false, error: data.error });
  }

  try {
    const pool = await getPool();
    const r = pool.request();

    r.input('ID',           sql.Int,          id);
    r.input('DataHora',     sql.DateTime2,    data.DataHora);
    r.input('Operador',     sql.VarChar(100), data.Operador);
    r.input('Filtro',       sql.VarChar(30),  data.Filtro);
    r.input('Tipo',         sql.VarChar(20),  data.Tipo);
    r.input('Turbidez',     sql.Float,        data.Turbidez);
    r.input('Cor',          sql.Float,        data.Cor);
    r.input('Alcalinidade', sql.Float,        data.Alcalinidade);
    r.input('Dureza',       sql.Float,        data.Dureza);

    await r.query(`
      UPDATE [dw].[dbo].[FATO_LANCAMENTO_FILTRO]
      SET
        [DataHora] = @DataHora,
        [Operador] = @Operador,
        [Filtro] = @Filtro,
        [Tipo] = @Tipo,
        [Turbidez] = @Turbidez,
        [Cor] = @Cor,
        [Alcalinidade] = @Alcalinidade,
        [Dureza] = @Dureza,
        [DataAlteracao] = GETDATE()
      WHERE [ID] = @ID
    `);

    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Filtro] Erro ao atualizar:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar o lançamento.' });
  }
}

module.exports = { cadastrarFiltro, atualizarFiltro };
