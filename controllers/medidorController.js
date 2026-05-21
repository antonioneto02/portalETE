const sql = require('mssql');
const { getPool } = require('../database/dbConfig');
const { generateCsrfToken } = require('../middleware/csrf');

async function renderMedidor(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 500
        [Data], [turno], [matricula], [Operador], [LOCAL],
        [Inicial], [Final], [Deligado], [Ligado],
        [Aspecto_Visual], [Visual_Aparelho],
        [Cor_Visual], [Cor_Aparelho],
        [pH], [pH_Aparelho],
        [Cloro], [Cloro_Aparelho],
        [Alcalinidade], [Alcalinidade_Aparelho],
        [Turbidez], [Turbidez_Aparelho],
        [Ferro], [Ferro_Aparelho],
        [Dureza], [Dureza_Aparelho],
        [OBS]
      FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
      ORDER BY [Data] DESC
    `);
    const csrfToken = generateCsrfToken(req);
    res.render('Medidor/index', {
      username: req.session.username || req.session.userId || 'Usuário',
      isAdmin: req.session.isAdmin || false,
      currentPath: '/medidor',
      lancamentos: result.recordset,
      csrfToken,
      dbError: null,
    });
  } catch (err) {
    console.error('[Medidor] Erro ao buscar lançamentos:', err);
    const csrfToken = generateCsrfToken(req);
    res.render('Medidor/index', {
      username: req.session.username || req.session.userId || 'Usuário',
      isAdmin: req.session.isAdmin || false,
      currentPath: '/medidor',
      lancamentos: [],
      csrfToken,
      dbError: 'Não foi possível carregar os dados. Tente novamente.',
    });
  }
}

async function cadastrarLancamento(req, res) {
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
    // Valores armazenados como inteiro sem separador decimal (7.32 → 732)
    const toInt  = v => (v !== undefined && v !== '' && v !== null) ? Math.round(parseFloat(v) * 100) : null;
    const toTurno = v => ({ 'Manhã': 1, 'Tarde': 2, 'Noite': 3 }[v] ?? null);

    r.input('Data',                    sql.Date,       b.Data || null);
    r.input('turno',                   sql.Int,        toTurno(b.turno));
    r.input('matricula',               sql.VarChar(50),  toStr(b.matricula));
    r.input('Operador',                sql.VarChar(100), toStr(b.Operador));
    r.input('LOCAL',                   sql.VarChar(100), toStr(b.LOCAL));
    r.input('Inicial',                 sql.VarChar(10),  toStr(b.Inicial));
    r.input('Final',                   sql.VarChar(10),  toStr(b.Final));
    r.input('Deligado',                sql.VarChar(10),  toStr(b.Deligado));
    r.input('Ligado',                  sql.VarChar(10),  toStr(b.Ligado));
    r.input('Aspecto_Visual',          sql.VarChar(100), toStr(b.Aspecto_Visual));
    r.input('Visual_Aparelho',         sql.VarChar(100), toStr(b.Visual_Aparelho));
    r.input('Cor_Visual',              sql.Int,        toInt(b.Cor_Visual));
    r.input('Cor_Aparelho',            sql.Int,        toInt(b.Cor_Aparelho));
    r.input('pH',                      sql.Int,        toInt(b.pH));
    r.input('pH_Aparelho',             sql.Int,        toInt(b.pH_Aparelho));
    r.input('Cloro',                   sql.Int,        toInt(b.Cloro));
    r.input('Cloro_Aparelho',          sql.Int,        toInt(b.Cloro_Aparelho));
    r.input('Alcalinidade',            sql.Int,        toInt(b.Alcalinidade));
    r.input('Alcalinidade_Aparelho',   sql.Int,        toInt(b.Alcalinidade_Aparelho));
    r.input('Turbidez',                sql.Int,        toInt(b.Turbidez));
    r.input('Turbidez_Aparelho',       sql.Int,        toInt(b.Turbidez_Aparelho));
    r.input('Ferro',                   sql.Int,        toInt(b.Ferro));
    r.input('Ferro_Aparelho',          sql.Int,        toInt(b.Ferro_Aparelho));
    r.input('Dureza',                  sql.Int,        toInt(b.Dureza));
    r.input('Dureza_Aparelho',         sql.Int,        toInt(b.Dureza_Aparelho));
    r.input('OBS',                     sql.VarChar(500), toStr(b.OBS));

    await r.query(`
      INSERT INTO [dw].[dbo].[FATO_LANCAMENTO_ETA]
        ([Data],[turno],[matricula],[Operador],[LOCAL],
         [Inicial],[Final],[Deligado],[Ligado],
         [Aspecto_Visual],[Visual_Aparelho],[Cor_Visual],[Cor_Aparelho],
         [pH],[pH_Aparelho],[Cloro],[Cloro_Aparelho],
         [Alcalinidade],[Alcalinidade_Aparelho],
         [Turbidez],[Turbidez_Aparelho],
         [Ferro],[Ferro_Aparelho],[Dureza],[Dureza_Aparelho],[OBS])
      VALUES
        (@Data,@turno,@matricula,@Operador,@LOCAL,
         @Inicial,@Final,@Deligado,@Ligado,
         @Aspecto_Visual,@Visual_Aparelho,@Cor_Visual,@Cor_Aparelho,
         @pH,@pH_Aparelho,@Cloro,@Cloro_Aparelho,
         @Alcalinidade,@Alcalinidade_Aparelho,
         @Turbidez,@Turbidez_Aparelho,
         @Ferro,@Ferro_Aparelho,@Dureza,@Dureza_Aparelho,@OBS)
    `);

    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Medidor] Erro ao cadastrar:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar o lançamento.' });
  }
}

async function getHomeStats(req, res) {
  try {
    const pool = await getPool();
    const [latest, trend, total] = await Promise.all([
      pool.request().query(`
        SELECT TOP 1
          CONVERT(VARCHAR(10),[Data],23) AS Data, [turno],[Operador],[LOCAL],
          [pH],[Cloro],[Turbidez],[Cor_Visual],[Ferro],[Dureza],[Alcalinidade]
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        ORDER BY [Data] DESC
      `),
      pool.request().query(`
        SELECT
          CONVERT(VARCHAR(10),[Data],23) AS dia,
          AVG(TRY_CAST([pH]       AS FLOAT)) AS ph,
          AVG(TRY_CAST([Cloro]    AS FLOAT)) AS cloro,
          AVG(TRY_CAST([Turbidez] AS FLOAT)) AS turbidez,
          AVG(TRY_CAST([Cor_Visual] AS FLOAT)) AS cor
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        WHERE [Data] >= DATEADD(DAY,-30,GETDATE())
        GROUP BY CONVERT(VARCHAR(10),[Data],23)
        ORDER BY dia ASC
      `),
      pool.request().query(`
        SELECT COUNT(*) AS total
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        WHERE CONVERT(DATE,[Data]) = CONVERT(DATE,GETDATE())
      `),
    ]);
    res.json({
      latest:     latest.recordset[0] || null,
      trend:      trend.recordset,
      totalHoje:  total.recordset[0]?.total ?? 0,
    });
  } catch (err) {
    console.error('[HomeStats] Erro:', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
}

async function getOperadores(req, res) {
  const q = String(req.query.q || '').trim();
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('Q', sql.VarChar(200), '%' + q.toUpperCase() + '%')
      .query(`
        SELECT DISTINCT
          RTRIM(LTRIM(MATRICULA)) AS MATRICULA,
          RTRIM(LTRIM(NOME))      AS NOME
        FROM V_RECURSOS_HUMANOS
        WHERE MATRICULA IS NOT NULL AND MATRICULA <> ''
          AND NOME IS NOT NULL AND NOME <> ''
          AND UPPER(NOME) LIKE @Q
        ORDER BY NOME
      `);
    res.json(result.recordset.map(r => ({
      id:        r.NOME,
      text:      r.NOME.trim() + '  (' + r.MATRICULA.trim() + ')',
      matricula: r.MATRICULA.trim(),
    })));
  } catch (err) {
    console.error('[getOperadores]', err);
    res.json([]);
  }
}

module.exports = { renderMedidor, cadastrarLancamento, getHomeStats, getOperadores };
