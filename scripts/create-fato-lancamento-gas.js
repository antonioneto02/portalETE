const { getPool } = require('../database/dbConfig');

async function main() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FATO_LANCAMENTO_GAS' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE [dw].[dbo].[FATO_LANCAMENTO_GAS] (
        [ID]          INT IDENTITY(1,1) PRIMARY KEY,
        [DataHora]    DATETIME2      NOT NULL,
        [Tipo]        VARCHAR(20)    NOT NULL,
        [Fornecedor]  VARCHAR(50)    NOT NULL,
        [Leitura]     INT            NULL,
        [Pressao]     INT            NULL
      );
    END
  `);
  console.log('OK: [dw].[dbo].[FATO_LANCAMENTO_GAS] verificada/criada.');
  process.exit(0);
}

main().catch(err => {
  console.error('Erro ao criar tabela FATO_LANCAMENTO_GAS:', err);
  process.exit(1);
});
