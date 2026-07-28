const { getPool } = require('../database/dbConfig');

async function main() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('[dw].[dbo].[FATO_LANCAMENTO_CONSUMO]')
        AND name = 'Reservatorios'
    )
    BEGIN
      ALTER TABLE [dw].[dbo].[FATO_LANCAMENTO_CONSUMO] ADD [Reservatorios] INT NULL;
    END
  `);
  console.log('OK: coluna [Reservatorios] verificada/criada em FATO_LANCAMENTO_CONSUMO.');
  process.exit(0);
}

main().catch(err => {
  console.error('Erro ao adicionar coluna Reservatorios:', err);
  process.exit(1);
});
