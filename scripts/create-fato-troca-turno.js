const { getPool } = require('../database/dbConfig');

async function main() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FATO_TROCA_TURNO' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE [dw].[dbo].[FATO_TROCA_TURNO] (
        [ID]             INT IDENTITY(1,1) PRIMARY KEY,
        [Texto]          VARCHAR(1000)  NOT NULL,
        [Operador]       VARCHAR(100)   NOT NULL,
        [OperadorId]     VARCHAR(100)   NOT NULL,
        [DataCadastro]   DATETIME2      NOT NULL DEFAULT GETDATE(),
        [DataAlteracao]  DATETIME2      NULL
      );
    END
  `);
  console.log('OK: [dw].[dbo].[FATO_TROCA_TURNO] verificada/criada.');
  process.exit(0);
}

main().catch(err => {
  console.error('Erro ao criar tabela FATO_TROCA_TURNO:', err);
  process.exit(1);
});
