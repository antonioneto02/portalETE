const sql = require('mssql');
const { getPool } = require('../database/dbConfig');
const { generateCsrfToken } = require('../middleware/csrf');

const LOCAIS_VALIDOS = [
  'Poço 4', 'Poço 7', 'Acúmulo', 'Inox', 'Ef Industrial', 'Sanepar Ind', 'Sanepar Adm',
];

function parseBody(b) {
  const toStr   = v => (v !== undefined && v !== '' && v !== null) ? String(v).trim() : null;
  const toFloat = v => (v !== undefined && v !== '' && v !== null) ? parseFloat(v) : null;

  const local = toStr(b.Local);
  if (!local || !LOCAIS_VALIDOS.includes(local)) return { error: 'Local inválido.' };

  const inicial = toFloat(b.Leitura_Inicial);
  const final   = toFloat(b.Leitura_Final);
  const diferenca = (inicial != null && final != null) ? (final - inicial) : null;

  return { Local: local, Leitura_Inicial: inicial, Leitura_Final: final, Diferenca: diferenca };
}

async function cadastrarConsumo(req, res) {
  const sessionToken = String(req.session?.csrfToken || '');
  const bodyToken    = String(req.body?._csrf || '');
  if (!sessionToken || !bodyToken || sessionToken !== bodyToken) {
    return res.status(403).json({ success: false, error: 'Token de segurança inválido. Recarregue a página.' });
  }
  req.session.csrfToken = null;

  const data = parseBody(req.body);
  if (data.error) {
    return res.status(400).json({ success: false, error: data.error });
  }

  try {
    const pool = await getPool();
    const r = pool.request();

    r.input('Operador',        sql.VarChar(100), req.session.username || null);
    r.input('Local',           sql.VarChar(50),  data.Local);
    r.input('Leitura_Inicial', sql.Float,        data.Leitura_Inicial);
    r.input('Leitura_Final',   sql.Float,        data.Leitura_Final);
    r.input('Diferenca',       sql.Float,        data.Diferenca);

    await r.query(`
      INSERT INTO [dw].[dbo].[FATO_LANCAMENTO_CONSUMO]
        ([DataHora],[Operador],[Local],[Leitura_Inicial],[Leitura_Final],[Diferenca],[DataCadastro])
      VALUES
        (GETDATE(),@Operador,@Local,@Leitura_Inicial,@Leitura_Final,@Diferenca,GETDATE())
    `);

    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Consumo] Erro ao cadastrar:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar o lançamento.' });
  }
}

async function atualizarConsumo(req, res) {
  const sessionToken = String(req.session?.csrfToken || '');
  const bodyToken    = String(req.body?._csrf || '');
  if (!sessionToken || !bodyToken || sessionToken !== bodyToken) {
    return res.status(403).json({ success: false, error: 'Token de segurança inválido. Recarregue a página.' });
  }
  req.session.csrfToken = null;

  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, error: 'Identificador do lançamento inválido.' });
  }

  const data = parseBody(req.body);
  if (data.error) {
    return res.status(400).json({ success: false, error: data.error });
  }

  try {
    const pool = await getPool();
    const r = pool.request();

    r.input('ID',              sql.Int,          id);
    r.input('Local',           sql.VarChar(50),  data.Local);
    r.input('Leitura_Inicial', sql.Float,        data.Leitura_Inicial);
    r.input('Leitura_Final',   sql.Float,        data.Leitura_Final);
    r.input('Diferenca',       sql.Float,        data.Diferenca);

    await r.query(`
      UPDATE [dw].[dbo].[FATO_LANCAMENTO_CONSUMO]
      SET
        [Local] = @Local,
        [Leitura_Inicial] = @Leitura_Inicial,
        [Leitura_Final] = @Leitura_Final,
        [Diferenca] = @Diferenca,
        [DataAlteracao] = GETDATE()
      WHERE [ID] = @ID
    `);

    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Consumo] Erro ao atualizar:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar o lançamento.' });
  }
}

module.exports = { cadastrarConsumo, atualizarConsumo, LOCAIS_VALIDOS };
