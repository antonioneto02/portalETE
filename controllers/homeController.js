const { getPool } = require('../database/dbConfig');

const TURNO = { 1: 'Manhã', 2: 'Tarde', 3: 'Noite' };
const div100 = v => (v != null ? v / 100 : null);

async function renderHome(req, res) {
  let stats = { latest: null, trend: [], byTurno: [], phDist: [], totalHoje: 0, totalGeral: 0, conformidade: null };

  try {
    const pool = await getPool();
    const [latestR, trendR, byTurnoR, phDistR, todayR, totalR, confR] = await Promise.all([
      pool.request().query(`
        SELECT TOP 1
          CONVERT(VARCHAR(10),[Data],23) AS Data,
          [turno],[Operador],[LOCAL],
          [pH],[Cloro],[Turbidez],[Cor_Visual],[Ferro],[Dureza],[Alcalinidade]
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        ORDER BY [Data] DESC
      `),
      pool.request().query(`
        SELECT TOP 25
          CONVERT(VARCHAR(10),[Data],23)                     AS dia,
          AVG(CAST([pH]         AS FLOAT))/100.0             AS ph,
          AVG(CAST([Turbidez]   AS FLOAT))/100.0             AS turbidez,
          AVG(CAST([Cor_Visual] AS FLOAT))/100.0             AS cor,
          AVG(CAST([Ferro]      AS FLOAT))/100.0             AS ferro,
          COUNT(*)                                           AS registros
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
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
        GROUP BY [turno]
        ORDER BY [turno]
      `),
      pool.request().query(`
        SELECT
          CASE
            WHEN [pH] < 650  THEN '< 6,5'
            WHEN [pH] <= 699 THEN '6,5–7,0'
            WHEN [pH] <= 749 THEN '7,0–7,5'
            WHEN [pH] <= 799 THEN '7,5–8,0'
            WHEN [pH] <= 849 THEN '8,0–8,5'
            WHEN [pH] <= 950 THEN '8,5–9,5'
            ELSE '> 9,5'
          END AS faixa,
          COUNT(*) AS total,
          MIN([pH]) AS ordem
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        WHERE [pH] IS NOT NULL AND [pH] > 0
        GROUP BY
          CASE
            WHEN [pH] < 650  THEN '< 6,5'
            WHEN [pH] <= 699 THEN '6,5–7,0'
            WHEN [pH] <= 749 THEN '7,0–7,5'
            WHEN [pH] <= 799 THEN '7,5–8,0'
            WHEN [pH] <= 849 THEN '8,0–8,5'
            WHEN [pH] <= 950 THEN '8,5–9,5'
            ELSE '> 9,5'
          END
        ORDER BY MIN([pH])
      `),
      pool.request().query(`
        SELECT COUNT(*) AS total FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        WHERE CONVERT(DATE,[Data]) = CONVERT(DATE,GETDATE())
      `),
      pool.request().query(`SELECT COUNT(*) AS total FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]`),
      pool.request().query(`
        SELECT
          CAST(100.0*SUM(CASE WHEN [pH] BETWEEN 650 AND 950 THEN 1 ELSE 0 END)/COUNT(*) AS DECIMAL(5,1)) AS ph_conf,
          CAST(100.0*SUM(CASE WHEN [Turbidez] BETWEEN 0 AND 100 THEN 1 ELSE 0 END)/COUNT(*) AS DECIMAL(5,1)) AS turb_conf
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        WHERE [pH] IS NOT NULL AND [pH] > 0
      `),
    ]);

    const l = latestR.recordset[0];
    if (l) {
      stats.latest = {
        Data: l.Data,
        turnoLabel: TURNO[l.turno] || '—',
        Operador: l.Operador,
        LOCAL: l.LOCAL,
        pH:          div100(l.pH),
        Cloro:       div100(l.Cloro),
        Turbidez:    div100(l.Turbidez),
        Cor_Visual:  div100(l.Cor_Visual),
        Ferro:       div100(l.Ferro),
        Dureza:      div100(l.Dureza),
        Alcalinidade: div100(l.Alcalinidade),
      };
    }

    stats.trend       = trendR.recordset.reverse();
    stats.byTurno     = byTurnoR.recordset;
    stats.phDist      = phDistR.recordset;
    stats.totalHoje   = todayR.recordset[0]?.total  ?? 0;
    stats.totalGeral  = totalR.recordset[0]?.total  ?? 0;
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
