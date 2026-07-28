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
        [Leitura_Inicial] INT            NULL,
        [Leitura_Final]   INT            NULL,
        [Diferenca]       INT            NULL,
        [Reservatorios]   INT            NULL,
        [DataCadastro]    DATETIME2      NOT NULL DEFAULT GETDATE(),
        [DataAlteracao]   DATETIME2      NULL
      );
    END

    IF EXISTS (
      SELECT 1 FROM sys.columns c
      JOIN sys.types t ON c.user_type_id = t.user_type_id
      WHERE c.object_id = OBJECT_ID('[dw].[dbo].[FATO_LANCAMENTO_CONSUMO]')
        AND c.name = 'Leitura_Inicial' AND t.name <> 'int'
    )
    BEGIN
      UPDATE [dw].[dbo].[FATO_LANCAMENTO_CONSUMO] SET [Leitura_Inicial] = ROUND([Leitura_Inicial], 0) WHERE [Leitura_Inicial] IS NOT NULL;
      UPDATE [dw].[dbo].[FATO_LANCAMENTO_CONSUMO] SET [Leitura_Final]   = ROUND([Leitura_Final], 0)   WHERE [Leitura_Final] IS NOT NULL;
      UPDATE [dw].[dbo].[FATO_LANCAMENTO_CONSUMO] SET [Diferenca]       = ROUND([Diferenca], 0)       WHERE [Diferenca] IS NOT NULL;

      ALTER TABLE [dw].[dbo].[FATO_LANCAMENTO_CONSUMO] ALTER COLUMN [Leitura_Inicial] INT NULL;
      ALTER TABLE [dw].[dbo].[FATO_LANCAMENTO_CONSUMO] ALTER COLUMN [Leitura_Final]   INT NULL;
      ALTER TABLE [dw].[dbo].[FATO_LANCAMENTO_CONSUMO] ALTER COLUMN [Diferenca]       INT NULL;
    END
  `);
  console.log('OK: [dw].[dbo].[FATO_LANCAMENTO_CONSUMO] verificada/criada.');
  process.exit(0);
}

main().catch(err => {
  console.error('Erro ao criar tabela FATO_LANCAMENTO_CONSUMO:', err);
  process.exit(1);
});
