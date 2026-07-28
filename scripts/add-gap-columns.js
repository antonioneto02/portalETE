const { getPool } = require('../database/dbConfig');

async function main() {
  const pool = await getPool();

  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('[dw].[dbo].[FATO_LANCAMENTO_ETA]')
        AND name = 'Gap'
    )
    BEGIN
      ALTER TABLE [dw].[dbo].[FATO_LANCAMENTO_ETA] ADD [Gap] INT NULL;
    END
  `);

  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('[dw].[dbo].[FATO_LANCAMENTO_GAS]')
        AND name = 'Gap'
    )
    BEGIN
      ALTER TABLE [dw].[dbo].[FATO_LANCAMENTO_GAS] ADD [Gap] INT NULL;
    END
  `);

  console.log('OK: coluna [Gap] verificada/criada em FATO_LANCAMENTO_ETA e FATO_LANCAMENTO_GAS.');

  const resultEta = await pool.request().query(`
    ;WITH cte AS (
      SELECT [ID], [Inicial],
        LAG([Inicial]) OVER (ORDER BY [Data], [ID]) AS PrevInicial
      FROM [dw].[dbo].[FATO_LANCAMENTO_ETA]
      WHERE [LOCAL] = 'Acumulo'
    )
    UPDATE e
    SET e.[Gap] = cte.[Inicial] - cte.PrevInicial
    FROM [dw].[dbo].[FATO_LANCAMENTO_ETA] e
    JOIN cte ON cte.[ID] = e.[ID]
    WHERE cte.PrevInicial IS NOT NULL AND cte.[Inicial] IS NOT NULL;
  `);
  console.log(`OK: Gap recalculado para ${resultEta.rowsAffected[resultEta.rowsAffected.length - 1]} registro(s) de FATO_LANCAMENTO_ETA (Local = Acumulo).`);

  const resultGas = await pool.request().query(`
    ;WITH cte AS (
      SELECT [ID], [Leitura],
        LAG([Leitura]) OVER (PARTITION BY [Tipo] ORDER BY [DataHora], [ID]) AS PrevLeitura
      FROM [dw].[dbo].[FATO_LANCAMENTO_GAS]
    )
    UPDATE g
    SET g.[Gap] = cte.[Leitura] - cte.PrevLeitura
    FROM [dw].[dbo].[FATO_LANCAMENTO_GAS] g
    JOIN cte ON cte.[ID] = g.[ID]
    WHERE cte.PrevLeitura IS NOT NULL AND cte.[Leitura] IS NOT NULL;
  `);
  console.log(`OK: Gap recalculado para ${resultGas.rowsAffected[resultGas.rowsAffected.length - 1]} registro(s) de FATO_LANCAMENTO_GAS.`);

  process.exit(0);
}

main().catch(err => {
  console.error('Erro ao adicionar/preencher coluna Gap:', err);
  process.exit(1);
});
