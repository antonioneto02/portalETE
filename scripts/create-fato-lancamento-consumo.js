const { getPool } = require('../database/dbConfig');

async function main() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FATO_LANCAMENTO_CONSUMO' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE [dw].[dbo].[FATO_LANCAMENTO_CONSUMO] (
        [ID]              INT IDENTITY(1,1) PRIMARY KEY,
        [DataHora]        DATETIME2      NOT NULL,
        [Operador]        VARCHAR(100)   NULL,
        [Local]           VARCHAR(50)    NOT NULL,
        [Leitura_Inicial] FLOAT          NULL,
        [Leitura_Final]   FLOAT          NULL,
        [Diferenca]       FLOAT          NULL,
        [DataCadastro]    DATETIME2      NOT NULL DEFAULT GETDATE(),
        [DataAlteracao]   DATETIME2      NULL
      );
    END
  `);
  console.log('OK: [dw].[dbo].[FATO_LANCAMENTO_CONSUMO] verificada/criada.');
  process.exit(0);
}

main().catch(err => {
  console.error('Erro ao criar tabela FATO_LANCAMENTO_CONSUMO:', err);
  process.exit(1);
});
