const sql = require('mssql');
const { getPool } = require('../database/dbConfig');
const { generateCsrfToken } = require('../middleware/csrf');

async function computeGapAcumulo(pool, local, inicial, excludeId) {
  if (local !== 'Acumulo' || inicial == null) return null;
  const r = pool.request();
  r.input('ExcludeId', sql.Int, excludeId ?? -1);
  const result = await r.query(`
    SELECT TOP 1 [Inicial]
    FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
    WHERE [LOCAL] = 'Acumulo' AND [ID] <> @ExcludeId AND [Inicial] IS NOT NULL
    ORDER BY [Data] DESC, [ID] DESC
  `);
  const last = result.recordset[0];
  return last ? (inicial - last.Inicial) : null;
}

async function renderMedidor(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 500
        [ID],
        [Data], [turno], [Operador], [LOCAL],
        [Inicial], [Gap], [Inicio_Descanso], [Fim_Descanso], [Desligado], [Ligado],
        [Aspecto_Visual],
        [Cor_Visual],
        [pH],
        [Cloro],
        [Alcalinidade],
        [Turbidez],
        [Ferro],
        [Dureza],
        [Condutividade],
        [OBS],
        [DataCadastro], [DataAlteracao]
      FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
      ORDER BY [Data] DESC, [ID] DESC
    `);
    const resultGas = await pool.request().query(`
      SELECT TOP 500
        [ID], [DataHora], [Tipo], [Fornecedor], [Operador], [Leitura], [Gap], [Pressao],
        [DataCadastro], [DataAlteracao]
      FROM [dw].[dbo].[FATO_LANCAMENTO_GAS]
      ORDER BY [DataHora] DESC, [ID] DESC
    `);
    const resultFiltro = await pool.request().query(`
      SELECT TOP 500
        [ID], [DataHora], [Operador], [Filtro], [Tipo],
        [Turbidez], [Cor], [Alcalinidade], [Dureza],
        [DataCadastro], [DataAlteracao]
      FROM [dw].[dbo].[FATO_LANCAMENTO_FILTRO]
      ORDER BY [DataHora] DESC, [ID] DESC
    `);
    const resultConsumo = await pool.request().query(`
      SELECT TOP 500
        [ID], [DataHora], [Operador], [Local],
        [Leitura_Inicial], [Leitura_Final], [Diferenca], [Reservatorios],
        [DataCadastro], [DataAlteracao]
      FROM [dw].[dbo].[FATO_LANCAMENTO_CONSUMO]
      ORDER BY [DataHora] DESC, [ID] DESC
    `);
    const resultTurno = await pool.request().query(`
      SELECT TOP 500
        [ID], [Texto], [Operador], [OperadorId],
        [DataCadastro], [DataAlteracao]
      FROM [dw].[dbo].[FATO_TROCA_TURNO]
      ORDER BY [DataCadastro] DESC, [ID] DESC
    `);
    const csrfToken = generateCsrfToken(req);
    res.render('Medidor/index', {
      username: req.session.username || req.session.userId || 'Usuário',
      isAdmin: req.session.isAdmin || false,
      currentPath: '/medidor',
      currentUserId: req.session.userId ? String(req.session.userId) : null,
      lancamentos: result.recordset,
      lancamentosGas: resultGas.recordset,
      lancamentosFiltro: resultFiltro.recordset,
      lancamentosConsumo: resultConsumo.recordset,
      trocasTurno: resultTurno.recordset,
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
      currentUserId: req.session.userId ? String(req.session.userId) : null,
      lancamentos: [],
      lancamentosGas: [],
      lancamentosFiltro: [],
      lancamentosConsumo: [],
      trocasTurno: [],
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
    const operador = req.session.username || null;

    const r = pool.request();
    const b = req.body;
    const toStr      = v => (v !== undefined && v !== '' && v !== null) ? String(v).trim() : null;
    const toFloat    = v => (v !== undefined && v !== '' && v !== null) ? parseFloat(v) : null;
    const toInt      = v => (v !== undefined && v !== '' && v !== null) ? parseInt(v, 10) : null;
    const toDateTime = v => (v !== undefined && v !== '' && v !== null) ? new Date(v) : null;
    const toTurno    = v => ({ 'Manhã': 1, 'Tarde': 2, 'Noite': 3 }[v] ?? null);

    r.input('turno',                   sql.Int,        toTurno(b.turno));
    r.input('Operador',                sql.VarChar(100), operador);
    r.input('LOCAL',                   sql.VarChar(100), toStr(b.LOCAL));
    r.input('Inicial',                 sql.Int,          toInt(b.Inicial));
    r.input('Gap',                     sql.Int,          await computeGapAcumulo(pool, toStr(b.LOCAL), toInt(b.Inicial), null));
    r.input('Inicio_Descanso',         sql.DateTime2,    toDateTime(b.Inicio_Descanso));
    r.input('Fim_Descanso',            sql.DateTime2,    toDateTime(b.Fim_Descanso));
    r.input('Desligado',               sql.VarChar(10),  toStr(b.Desligado));
    r.input('Ligado',                  sql.VarChar(10),  toStr(b.Ligado));
    r.input('Aspecto_Visual',          sql.VarChar(100), toStr(b.Aspecto_Visual));
    r.input('Cor_Visual',              sql.Float,      toFloat(b.Cor_Visual));
    r.input('pH',                      sql.Float,      toFloat(b.pH));
    r.input('Cloro',                   sql.Float,      toFloat(b.Cloro));
    r.input('Alcalinidade',            sql.Float,      toFloat(b.Alcalinidade));
    r.input('Turbidez',                sql.Float,      toFloat(b.Turbidez));
    r.input('Ferro',                   sql.Float,      toFloat(b.Ferro));
    r.input('Dureza',                  sql.Float,      toFloat(b.Dureza));
    r.input('Condutividade',           sql.Float,      toFloat(b.Condutividade));
    r.input('OBS',                     sql.VarChar(500), toStr(b.OBS));

    await r.query(`
      INSERT INTO [dw].[dbo].[FATO_LANCAMENTO_ETA]
        ([Data],[turno],[Operador],[LOCAL],
         [Inicial],[Gap],[Inicio_Descanso],[Fim_Descanso],[Desligado],[Ligado],
         [Aspecto_Visual],[Cor_Visual],
         [pH],[Cloro],
         [Alcalinidade],
         [Turbidez],
         [Ferro],[Dureza],[Condutividade],[OBS],
         [DataCadastro])
      VALUES
        (GETDATE(),@turno,@Operador,@LOCAL,
         @Inicial,@Gap,@Inicio_Descanso,@Fim_Descanso,@Desligado,@Ligado,
         @Aspecto_Visual,@Cor_Visual,
         @pH,@Cloro,
         @Alcalinidade,
         @Turbidez,
         @Ferro,@Dureza,@Condutividade,@OBS,
         GETDATE())
    `);

    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Medidor] Erro ao cadastrar:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar o lançamento.' });
  }
}

async function atualizarLancamento(req, res) {
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
    const toStr      = v => (v !== undefined && v !== '' && v !== null) ? String(v).trim() : null;
    const toFloat    = v => (v !== undefined && v !== '' && v !== null) ? parseFloat(v) : null;
    const toInt      = v => (v !== undefined && v !== '' && v !== null) ? parseInt(v, 10) : null;
    const toDateTime = v => (v !== undefined && v !== '' && v !== null) ? new Date(v) : null;
    const toTurno    = v => ({ 'Manhã': 1, 'Tarde': 2, 'Noite': 3 }[v] ?? null);

    r.input('ID',                      sql.Int,        id);
    r.input('turno',                   sql.Int,        toTurno(b.turno));
    r.input('LOCAL',                   sql.VarChar(100), toStr(b.LOCAL));
    r.input('Inicial',                 sql.Int,          toInt(b.Inicial));
    r.input('Gap',                     sql.Int,          await computeGapAcumulo(pool, toStr(b.LOCAL), toInt(b.Inicial), id));
    r.input('Inicio_Descanso',         sql.DateTime2,    toDateTime(b.Inicio_Descanso));
    r.input('Fim_Descanso',            sql.DateTime2,    toDateTime(b.Fim_Descanso));
    r.input('Desligado',               sql.VarChar(10),  toStr(b.Desligado));
    r.input('Ligado',                  sql.VarChar(10),  toStr(b.Ligado));
    r.input('Aspecto_Visual',          sql.VarChar(100), toStr(b.Aspecto_Visual));
    r.input('Cor_Visual',              sql.Float,      toFloat(b.Cor_Visual));
    r.input('pH',                      sql.Float,      toFloat(b.pH));
    r.input('Cloro',                   sql.Float,      toFloat(b.Cloro));
    r.input('Alcalinidade',            sql.Float,      toFloat(b.Alcalinidade));
    r.input('Turbidez',                sql.Float,      toFloat(b.Turbidez));
    r.input('Ferro',                   sql.Float,      toFloat(b.Ferro));
    r.input('Dureza',                  sql.Float,      toFloat(b.Dureza));
    r.input('Condutividade',           sql.Float,      toFloat(b.Condutividade));
    r.input('OBS',                     sql.VarChar(500), toStr(b.OBS));

    await r.query(`
      UPDATE [dw].[dbo].[FATO_LANCAMENTO_ETA]
      SET
        [turno] = @turno,
        [LOCAL] = @LOCAL,
        [Inicial] = @Inicial,
        [Gap] = @Gap,
        [Inicio_Descanso] = @Inicio_Descanso,
        [Fim_Descanso] = @Fim_Descanso,
        [Desligado] = @Desligado,
        [Ligado] = @Ligado,
        [Aspecto_Visual] = @Aspecto_Visual,
        [Cor_Visual] = @Cor_Visual,
        [pH] = @pH,
        [Cloro] = @Cloro,
        [Alcalinidade] = @Alcalinidade,
        [Turbidez] = @Turbidez,
        [Ferro] = @Ferro,
        [Dureza] = @Dureza,
        [Condutividade] = @Condutividade,
        [OBS] = @OBS,
        [DataAlteracao] = GETDATE()
      WHERE [ID] = @ID
    `);

    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Medidor] Erro ao atualizar:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar o lançamento.' });
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

module.exports = { renderMedidor, cadastrarLancamento, atualizarLancamento, getHomeStats };
