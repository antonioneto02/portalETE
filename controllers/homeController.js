const { getPool } = require('../database/dbConfig');

const TURNO = { 1: 'Manhã', 2: 'Tarde', 3: 'Noite' };

function adaptDiv(v) {
  if (v == null) return null;
  if (v >= 100) return v / 100;
  if (v >= 10)  return v / 10;
  return v;
}

const sqlAdapt = col =>
  `CASE WHEN ${col}>=100 THEN ${col}/100.0 WHEN ${col}>=10 THEN ${col}/10.0 ELSE CAST(${col} AS FLOAT) END`;

const sqlAvgNN = col => `AVG(NULLIF(${sqlAdapt(col)}, 0))`;

async function renderHome(req, res) {
  let stats = {
    ultimoDia: null, trend: [], byTurno: [],
    phDist: [], totalGeral: 0, conformidade: null,
  };

  try {
    const pool = await getPool();
    const [ultimoDiaR, trendR, byTurnoR, phDistR, totalR, confR] = await Promise.all([

      pool.request().query(`
        SELECT
          CONVERT(VARCHAR(10),[Data],23) AS Data,
          COUNT(*)                       AS qtd,
          COUNT(DISTINCT [LOCAL])        AS locais,
          COUNT(DISTINCT [turno])        AS turnos,
          ${sqlAvgNN('[pH]')}            AS pH,
          ${sqlAvgNN('[Turbidez]')}      AS Turbidez,
          ${sqlAvgNN('[Ferro]')}         AS Ferro,
          ${sqlAvgNN('[Cor_Visual]')}    AS Cor,
          ${sqlAvgNN('[Cloro]')}         AS Cloro,
          ${sqlAvgNN('[Alcalinidade]')}  AS Alcalinidade,
          ${sqlAvgNN('[Dureza]')}        AS Dureza
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        WHERE CONVERT(DATE,[Data]) = (
          SELECT MAX(CONVERT(DATE,[Data]))
          FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
          WHERE [pH] IS NOT NULL AND [pH] > 0
        )
        GROUP BY CONVERT(VARCHAR(10),[Data],23)
      `),

      pool.request().query(`
        SELECT TOP 30
          CONVERT(VARCHAR(10),[Data],23) AS dia,
          AVG(${sqlAdapt('[pH]')})       AS ph,
          ${sqlAvgNN('[Turbidez]')}      AS turbidez,
          ${sqlAvgNN('[Cor_Visual]')}    AS cor,
          ${sqlAvgNN('[Ferro]')}         AS ferro,
          COUNT(*)                       AS registros
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        WHERE [pH] IS NOT NULL AND [pH] > 0
        GROUP BY CONVERT(VARCHAR(10),[Data],23)
        ORDER BY dia DESC
      `),

      pool.request().query(`
        SELECT
          CASE [turno]
            WHEN 1 THEN 'Manhã' WHEN 2 THEN 'Tarde' WHEN 3 THEN 'Noite'
            ELSE 'Outro'
          END AS turno,
          COUNT(*) AS total
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        GROUP BY [turno] ORDER BY [turno]
      `),

      pool.request().query(`
        SELECT
          CASE
            WHEN ${sqlAdapt('[pH]')} < 6.5  THEN '< 6,5'
            WHEN ${sqlAdapt('[pH]')} < 7.0  THEN '6,5–7,0'
            WHEN ${sqlAdapt('[pH]')} < 7.5  THEN '7,0–7,5'
            WHEN ${sqlAdapt('[pH]')} < 8.0  THEN '7,5–8,0'
            WHEN ${sqlAdapt('[pH]')} < 8.5  THEN '8,0–8,5'
            WHEN ${sqlAdapt('[pH]')} <= 9.5 THEN '8,5–9,5'
            ELSE '> 9,5'
          END AS faixa,
          COUNT(*) AS total,
          MIN(${sqlAdapt('[pH]')}) AS ordem
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        WHERE [pH] IS NOT NULL AND [pH] > 0
        GROUP BY
          CASE
            WHEN ${sqlAdapt('[pH]')} < 6.5  THEN '< 6,5'
            WHEN ${sqlAdapt('[pH]')} < 7.0  THEN '6,5–7,0'
            WHEN ${sqlAdapt('[pH]')} < 7.5  THEN '7,0–7,5'
            WHEN ${sqlAdapt('[pH]')} < 8.0  THEN '7,5–8,0'
            WHEN ${sqlAdapt('[pH]')} < 8.5  THEN '8,0–8,5'
            WHEN ${sqlAdapt('[pH]')} <= 9.5 THEN '8,5–9,5'
            ELSE '> 9,5'
          END
        ORDER BY MIN(${sqlAdapt('[pH]')})
      `),

      pool.request().query(`SELECT COUNT(*) AS total FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]`),

      pool.request().query(`
        SELECT
          CAST(100.0*SUM(CASE WHEN ${sqlAdapt('[pH]')} BETWEEN 6.5 AND 9.5 THEN 1 ELSE 0 END)
            / NULLIF(COUNT(NULLIF([pH],0)),0) AS DECIMAL(5,1)) AS ph_conf,
          CAST(100.0*SUM(CASE WHEN ${sqlAdapt('[Turbidez]')} BETWEEN 0.001 AND 1.0 THEN 1 ELSE 0 END)
            / NULLIF(COUNT(NULLIF([Turbidez],0)),0) AS DECIMAL(5,1)) AS turb_conf,
          CAST(100.0*SUM(CASE WHEN ${sqlAdapt('[Ferro]')} > 0 AND ${sqlAdapt('[Ferro]')} <= 0.3 THEN 1 ELSE 0 END)
            / NULLIF(COUNT(NULLIF([Ferro],0)),0) AS DECIMAL(5,1)) AS ferro_conf
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        WHERE [pH] IS NOT NULL AND [pH] > 0
      `),
    ]);

    const d = ultimoDiaR.recordset[0];
    if (d) {
      stats.ultimoDia = {
        Data: d.Data, qtd: d.qtd, locais: d.locais, turnos: d.turnos,
        pH:          d.pH,
        Turbidez:    d.Turbidez,
        Ferro:       d.Ferro,
        Cor:         d.Cor,
        Cloro:       d.Cloro,
        Alcalinidade: d.Alcalinidade,
        Dureza:      d.Dureza,
      };
    }

    stats.trend        = trendR.recordset.reverse();
    stats.byTurno      = byTurnoR.recordset;
    stats.phDist       = phDistR.recordset;
    stats.totalGeral   = totalR.recordset[0]?.total ?? 0;
    stats.conformidade = confR.recordset[0] || null;

  } catch (err) {
    console.error('[Home] Erro ao buscar stats:', err);
  }

  res.render('Home/index', {
    username:    req.session.username || req.session.userId || 'Usuário',
    isAdmin:     req.session.isAdmin || false,
    currentPath: '/home',
    stats,
    statsJson: JSON.stringify(stats),
  });
}

module.exports = { renderHome };
