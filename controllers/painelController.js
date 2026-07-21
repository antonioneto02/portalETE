const { getPool } = require('../database/dbConfig');

function buildDomainQueries(pool, { table, dateCol, groupCol }) {
  return Promise.all([
    pool.request().query(`
      SELECT COUNT(*) AS hoje, COUNT(DISTINCT [${groupCol}]) AS secundario
      FROM ${table}
      WHERE CONVERT(DATE,[${dateCol}]) = CONVERT(DATE,GETDATE())
    `),
    pool.request().query(`
      SELECT AVG(cnt*1.0) AS media FROM (
        SELECT COUNT(*) cnt FROM ${table}
        WHERE CONVERT(DATE,[${dateCol}]) >= CONVERT(DATE,DATEADD(DAY,-7,GETDATE()))
          AND CONVERT(DATE,[${dateCol}]) <  CONVERT(DATE,GETDATE())
        GROUP BY CONVERT(DATE,[${dateCol}])
      ) t
    `),
    pool.request().query(`
      SELECT
        SUM(CASE WHEN YEAR([${dateCol}])=YEAR(GETDATE()) AND MONTH([${dateCol}])=MONTH(GETDATE()) THEN 1 ELSE 0 END) AS mesAtual,
        SUM(CASE WHEN YEAR([${dateCol}])=YEAR(DATEADD(MONTH,-1,GETDATE())) AND MONTH([${dateCol}])=MONTH(DATEADD(MONTH,-1,GETDATE())) THEN 1 ELSE 0 END) AS mesAnterior
      FROM ${table}
    `),
    pool.request().query(`
      SELECT TOP 5 ISNULL([${groupCol}],'—') AS label, COUNT(*) AS total
      FROM ${table}
      WHERE [${dateCol}] >= DATEADD(DAY,-30,GETDATE())
      GROUP BY [${groupCol}]
      ORDER BY total DESC
    `),
  ]);
}

function pct(num, den) {
  if (!den || den <= 0) return null;
  return Math.round((num / den) * 100);
}

async function buildDomainStats(pool, config) {
  const [hojeR, mediaR, mesR, rankR] = await buildDomainQueries(pool, config);
  const hoje = hojeR.recordset[0]?.hoje ?? 0;
  const secundario = hojeR.recordset[0]?.secundario ?? 0;
  const media = mediaR.recordset[0]?.media ?? null;
  const mesAtual = mesR.recordset[0]?.mesAtual ?? 0;
  const mesAnterior = mesR.recordset[0]?.mesAnterior ?? 0;
  const ranking = rankR.recordset;
  const totalRanking = ranking.reduce((a, r) => a + r.total, 0);

  return {
    hoje,
    secundario,
    media,
    pctMedia: pct(hoje, media),
    mesAtual,
    mesAnterior,
    pctMes: pct(mesAtual, mesAnterior),
    ranking,
    totalRanking,
  };
}

async function renderPainel(req, res) {
  let stats = { agua: null, gas: null, filtros: null };

  try {
    const pool = await getPool();
    const [agua, gas, filtros] = await Promise.all([
      buildDomainStats(pool, {
        table: '[dw].[dbo].[FATO_LANCAMENTO_ETA]',
        dateCol: 'Data',
        groupCol: 'LOCAL',
      }),
      buildDomainStats(pool, {
        table: '[dw].[dbo].[FATO_LANCAMENTO_GAS]',
        dateCol: 'DataHora',
        groupCol: 'Fornecedor',
      }),
      buildDomainStats(pool, {
        table: '[dw].[dbo].[FATO_LANCAMENTO_FILTRO]',
        dateCol: 'DataHora',
        groupCol: 'Filtro',
      }),
    ]);
    stats = { agua, gas, filtros };
  } catch (err) {
    console.error('[Painel] Erro ao buscar stats:', err);
  }

  res.render('Painel/index', {
    username:    req.session.username || req.session.userId || 'Usuário',
    isAdmin:     req.session.isAdmin || false,
    currentPath: '/painel',
    stats,
  });
}

module.exports = { renderPainel };
