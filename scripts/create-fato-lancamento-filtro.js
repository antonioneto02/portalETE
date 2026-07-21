const { getPool } = require('../database/dbConfig');

async function main() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FATO_LANCAMENTO_FILTRO' AND schema_id = SCHEMA_ID('dbo'))
    BEGIN
      CREATE TABLE [dw].[dbo].[FATO_LANCAMENTO_FILTRO] (
        [ID]             INT IDENTITY(1,1) PRIMARY KEY,
        [DataHora]       DATETIME2      NOT NULL,
        [Operador]       VARCHAR(100)   NULL,
        [Filtro]         VARCHAR(30)    NOT NULL,
        [Tipo]           VARCHAR(30)    NOT NULL,
        [Turbidez]       FLOAT          NULL,
        [Cor]            FLOAT          NULL,
        [Alcalinidade]   FLOAT          NULL,
        [Dureza]         FLOAT          NULL,
        [DataCadastro]   DATETIME2      NOT NULL DEFAULT GETDATE(),
        [DataAlteracao]  DATETIME2      NULL
      );
    END

    IF EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('[dw].[dbo].[FATO_LANCAMENTO_FILTRO]')
        AND name = 'Tipo' AND max_length < 30
    )
    BEGIN
      ALTER TABLE [dw].[dbo].[FATO_LANCAMENTO_FILTRO] ALTER COLUMN [Tipo] VARCHAR(30) NOT NULL;
    END
  `);
  console.log('OK: [dw].[dbo].[FATO_LANCAMENTO_FILTRO] verificada/criada.');
  process.exit(0);
}

main().catch(err => {
  console.error('Erro ao criar tabela FATO_LANCAMENTO_FILTRO:', err);
  process.exit(1);
});
