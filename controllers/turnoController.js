const sql = require('mssql');
const { getPool } = require('../database/dbConfig');
const { generateCsrfToken } = require('../middleware/csrf');

async function cadastrarTurno(req, res) {
  const sessionToken = String(req.session?.csrfToken || '');
  const bodyToken    = String(req.body?._csrf || '');
  if (!sessionToken || !bodyToken || sessionToken !== bodyToken) {
    return res.status(403).json({ success: false, error: 'Token de segurança inválido. Recarregue a página.' });
  }
  req.session.csrfToken = null;

  const texto = String(req.body?.Texto || '').trim();
  if (!texto) {
    return res.status(400).json({ success: false, error: 'Digite uma observação antes de salvar.' });
  }

  const operadorId = req.session.userId ? String(req.session.userId) : null;
  if (!operadorId) {
    return res.status(401).json({ success: false, error: 'Sessão inválida. Faça login novamente.' });
  }

  try {
    const pool = await getPool();
    const r = pool.request();

    r.input('Texto',      sql.VarChar(1000), texto);
    r.input('Operador',   sql.VarChar(100),  req.session.username || null);
    r.input('OperadorId', sql.VarChar(100),  operadorId);

    await r.query(`
      INSERT INTO [dw].[dbo].[FATO_TROCA_TURNO]
        ([Texto],[Operador],[OperadorId],[DataCadastro])
      VALUES
        (@Texto,@Operador,@OperadorId,GETDATE())
    `);

    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Turno] Erro ao cadastrar:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar a observação.' });
  }
}

async function atualizarTurno(req, res) {
  const sessionToken = String(req.session?.csrfToken || '');
  const bodyToken    = String(req.body?._csrf || '');
  if (!sessionToken || !bodyToken || sessionToken !== bodyToken) {
    return res.status(403).json({ success: false, error: 'Token de segurança inválido. Recarregue a página.' });
  }
  req.session.csrfToken = null;

  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, error: 'Identificador da observação inválido.' });
  }

  const texto = String(req.body?.Texto || '').trim();
  if (!texto) {
    return res.status(400).json({ success: false, error: 'Digite uma observação antes de salvar.' });
  }

  const operadorId = req.session.userId ? String(req.session.userId) : null;
  if (!operadorId) {
    return res.status(401).json({ success: false, error: 'Sessão inválida. Faça login novamente.' });
  }

  try {
    const pool = await getPool();

    const existing = await pool.request()
      .input('ID', sql.Int, id)
      .query('SELECT [OperadorId] FROM [dw].[dbo].[FATO_TROCA_TURNO] WHERE [ID] = @ID');

    if (!existing.recordset.length) {
      return res.status(404).json({ success: false, error: 'Observação não encontrada.' });
    }
    if (String(existing.recordset[0].OperadorId) !== operadorId) {
      return res.status(403).json({ success: false, error: 'Você só pode editar observações que você mesmo criou.' });
    }

    const r = pool.request();
    r.input('ID',    sql.Int,          id);
    r.input('Texto', sql.VarChar(1000), texto);

    await r.query(`
      UPDATE [dw].[dbo].[FATO_TROCA_TURNO]
      SET
        [Texto] = @Texto,
        [DataAlteracao] = GETDATE()
      WHERE [ID] = @ID
    `);

    const newCsrf = generateCsrfToken(req);
    res.json({ success: true, csrfToken: newCsrf });
  } catch (err) {
    console.error('[Turno] Erro ao atualizar:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar a observação.' });
  }
}

module.exports = { cadastrarTurno, atualizarTurno };
