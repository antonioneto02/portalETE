const sql = require('mssql');
const dotenv = require('dotenv');
dotenv.config({ override: true });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: { encrypt: true, trustServerCertificate: true },
  requestTimeout: 60000,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let _pool = null;

async function getPool() {
  if (_pool) return _pool;
  _pool = await sql.connect(config);
  return _pool;
}

module.exports = { config, getPool };
