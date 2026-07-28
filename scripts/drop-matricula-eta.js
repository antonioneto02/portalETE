const { getPool } = require('../database/dbConfig');

async function main() {
  const pool = await getPool();
  await pool.request().query(`
    IF EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('[dw].[dbo].[FATO_LANCAMENTO_ETA]')
        AND name = 'matricula'
    )
    BEGIN
      ALTER TABLE [dw].[dbo].[FATO_LANCAMENTO_ETA] DROP COLUMN [matricula];
    END
  `);
  console.log('OK: coluna [matricula] removida de FATO_LANCAMENTO_ETA.');
  process.exit(0);
}

main().catch(err => {
  console.error('Erro ao remover coluna matricula:', err);
  process.exit(1);
});
