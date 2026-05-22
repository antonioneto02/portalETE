'use strict';
const { QueryTypes } = require('sequelize');
const { generateCsrfToken } = require('../middleware/csrf');
const sequelize = require('../database/sequelize/dbSequelize');

async function renderMedidor(req, res) {
  try {
    const lancamentos = await sequelize.query(
      `SELECT TOP 500
        [Data],[turno],[matricula],[Operador],[LOCAL],
        [Inicial],[Final],[Deligado],[Ligado],
        [Aspecto_Visual],[Visual_Aparelho],
        [Cor_Visual],[Cor_Aparelho],
        [pH],[pH_Aparelho],[Cloro],[Cloro_Aparelho],
        [Alcalinidade],[Alcalinidade_Aparelho],
        [Turbidez],[Turbidez_Aparelho],[Ferro],[Ferro_Aparelho],
        [Dureza],[Dureza_Aparelho],[OBS]
      FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
      ORDER BY [Data] DESC`,
      { type: QueryTypes.SELECT }
    );
    const csrfToken = generateCsrfToken(req);
    res.render('Medidor/index', {
      username: req.session.username || req.session.userId || 'Usuário',
      isAdmin: req.session.isAdmin || false,
      currentPath: '/medidor',
      lancamentos,
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
  if (!sessionToken || !bodyToken || sessionToken !== bodyToken)
    return res.status(403).json({ success: false, error: 'Token de segurança inválido. Recarregue a página.' });
  req.session.csrfToken = null;

  try {
    const b = req.body;
    const toStr   = v => (v !== undefined && v !== '' && v !== null) ? String(v).trim() : null;
    const toInt   = v => (v !== undefined && v !== '' && v !== null) ? Math.round(parseFloat(v) * 100) : null;
    const toTurno = v => ({ 'Manhã': 1, 'Tarde': 2, 'Noite': 3 }[v] ?? null);

    await sequelize.query(
      `INSERT INTO [dw].[dbo].[FATO_LANCAMENTO_ETA]
        ([Data],[turno],[matricula],[Operador],[LOCAL],
         [Inicial],[Final],[Deligado],[Ligado],
         [Aspecto_Visual],[Visual_Aparelho],[Cor_Visual],[Cor_Aparelho],
         [pH],[pH_Aparelho],[Cloro],[Cloro_Aparelho],
         [Alcalinidade],[Alcalinidade_Aparelho],
         [Turbidez],[Turbidez_Aparelho],[Ferro],[Ferro_Aparelho],[Dureza],[Dureza_Aparelho],[OBS])
      VALUES
        (:Data,:turno,:matricula,:Operador,:LOCAL,
         :Inicial,:Final,:Deligado,:Ligado,
         :Aspecto_Visual,:Visual_Aparelho,:Cor_Visual,:Cor_Aparelho,
         :pH,:pH_Aparelho,:Cloro,:Cloro_Aparelho,
         :Alcalinidade,:Alcalinidade_Aparelho,
         :Turbidez,:Turbidez_Aparelho,:Ferro,:Ferro_Aparelho,:Dureza,:Dureza_Aparelho,:OBS)`,
      {
        replacements: {
          Data: b.Data || null, turno: toTurno(b.turno),
          matricula: toStr(b.matricula), Operador: toStr(b.Operador), LOCAL: toStr(b.LOCAL),
          Inicial: toStr(b.Inicial), Final: toStr(b.Final), Deligado: toStr(b.Deligado), Ligado: toStr(b.Ligado),
          Aspecto_Visual: toStr(b.Aspecto_Visual), Visual_Aparelho: toStr(b.Visual_Aparelho),
          Cor_Visual: toInt(b.Cor_Visual), Cor_Aparelho: toInt(b.Cor_Aparelho),
          pH: toInt(b.pH), pH_Aparelho: toInt(b.pH_Aparelho),
          Cloro: toInt(b.Cloro), Cloro_Aparelho: toInt(b.Cloro_Aparelho),
          Alcalinidade: toInt(b.Alcalinidade), Alcalinidade_Aparelho: toInt(b.Alcalinidade_Aparelho),
          Turbidez: toInt(b.Turbidez), Turbidez_Aparelho: toInt(b.Turbidez_Aparelho),
          Ferro: toInt(b.Ferro), Ferro_Aparelho: toInt(b.Ferro_Aparelho),
          Dureza: toInt(b.Dureza), Dureza_Aparelho: toInt(b.Dureza_Aparelho),
          OBS: toStr(b.OBS),
        },
        type: QueryTypes.INSERT,
      }
    );
    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Medidor] Erro ao cadastrar:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar o lançamento.' });
  }
}

async function getHomeStats(req, res) {
  try {
    const [latest, trend, total] = await Promise.all([
      sequelize.query(
        `SELECT TOP 1
          CONVERT(VARCHAR(10),[Data],23) AS Data,[turno],[Operador],[LOCAL],
          [pH],[Cloro],[Turbidez],[Cor_Visual],[Ferro],[Dureza],[Alcalinidade]
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA] ORDER BY [Data] DESC`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT CONVERT(VARCHAR(10),[Data],23) AS dia,
          AVG(TRY_CAST([pH] AS FLOAT)) AS ph,
          AVG(TRY_CAST([Cloro] AS FLOAT)) AS cloro,
          AVG(TRY_CAST([Turbidez] AS FLOAT)) AS turbidez,
          AVG(TRY_CAST([Cor_Visual] AS FLOAT)) AS cor
        FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        WHERE [Data] >= DATEADD(DAY,-30,GETDATE())
        GROUP BY CONVERT(VARCHAR(10),[Data],23)
        ORDER BY dia ASC`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COUNT(*) AS total FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
        WHERE CONVERT(DATE,[Data]) = CONVERT(DATE,GETDATE())`,
        { type: QueryTypes.SELECT }
      ),
    ]);
    res.json({ latest: latest[0] || null, trend, totalHoje: total[0]?.total ?? 0 });
  } catch (err) {
    console.error('[HomeStats] Erro:', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
}

async function getOperadores(req, res) {
  const q = String(req.query.q || '').trim();
  try {
    const result = await sequelize.query(
      `SELECT DISTINCT RTRIM(LTRIM(MATRICULA)) AS MATRICULA, RTRIM(LTRIM(NOME)) AS NOME
      FROM V_RECURSOS_HUMANOS
      WHERE MATRICULA IS NOT NULL AND MATRICULA <> '' AND NOME IS NOT NULL AND NOME <> ''
        AND UPPER(NOME) LIKE :q
      ORDER BY NOME`,
      { replacements: { q: '%' + q.toUpperCase() + '%' }, type: QueryTypes.SELECT }
    );
    res.json(result.map(r => ({ id: r.NOME, text: r.NOME.trim() + '  (' + r.MATRICULA.trim() + ')', matricula: r.MATRICULA.trim() })));
  } catch (err) {
    console.error('[getOperadores]', err);
    res.json([]);
  }
}

module.exports = { renderMedidor, cadastrarLancamento, getHomeStats, getOperadores };
