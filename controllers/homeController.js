const { getPool } = require('../database/dbConfig');

const TURNO = { 1: 'Manhã', 2: 'Tarde', 3: 'Noite' };

// Valores armazenados como inteiro sem separador decimal.
// Regra: >=100 → ÷100 | 10–99 → ÷10 | <10 → valor direto
function adaptDiv(v) {
  if (v == null) return null;
  if (v >= 100) return v / 100;
  if (v >= 10)  return v / 10;
  return v;
}

// Expressão SQL equivalente para usar em queries
const sqlAdapt = col =>
  `CASE WHEN ${col}>=100 THEN ${col}/100.0 WHEN ${col}>=10 THEN ${col}/10.0 ELSE CAST(${col} AS FLOAT) END`;

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
        SELECT TOP 30
          CONVERT(VARCHAR(10),[Data],23) AS dia,
          AVG(${sqlAdapt('[pH]')})       AS ph,
          AVG(NULLIF(${sqlAdapt('[Turbidez]')},0)) AS turbidez,
          AVG(NULLIF(${sqlAdapt('[Cor_Visual]')},0)) AS cor,
          AVG(NULLIF(${sqlAdapt('[Ferro]')},0)) AS ferro,
          COUNT(*) AS registros
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
        GROUP BY [turno]
        ORDER BY [turno]
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
      pool.request().query(`
        SELECT COUNT(*) AS total FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        WHERE CONVERT(DATE,[Data]) = CONVERT(DATE,GETDATE())
      `),
      pool.request().query(`SELECT COUNT(*) AS total FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]`),
      pool.request().query(`
        SELECT
          CAST(100.0*SUM(CASE
            WHEN ${sqlAdapt('[pH]')} BETWEEN 6.5 AND 9.5 THEN 1 ELSE 0
          END)/NULLIF(COUNT(NULLIF([pH],0)),0) AS DECIMAL(5,1)) AS ph_conf,
          CAST(100.0*SUM(CASE
            WHEN ${sqlAdapt('[Turbidez]')} <= 1.0 THEN 1 ELSE 0
          END)/NULLIF(COUNT(NULLIF([Turbidez],0)),0) AS DECIMAL(5,1)) AS turb_conf
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
        pH:          adaptDiv(l.pH),
        Cloro:       adaptDiv(l.Cloro),
        Turbidez:    adaptDiv(l.Turbidez),
        Cor_Visual:  adaptDiv(l.Cor_Visual),
        Ferro:       adaptDiv(l.Ferro),
        Dureza:      adaptDiv(l.Dureza),
        Alcalinidade: adaptDiv(l.Alcalinidade),
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
