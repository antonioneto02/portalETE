'use strict';
const { Sequelize } = require('sequelize');
const { registerDialectHooks } = require('../sqlHelper');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_DATABASE, process.env.DB_USER, process.env.DB_PASSWORD,
  {
    host: process.env.DB_SERVER,
    dialect: process.env.DB_DIALECT || 'mssql',
    dialectOptions: { options: { encrypt: true, trustServerCertificate: true, requestTimeout: 60000, connectTimeout: 30000 } },
    pool: { max: 10, min: 0, acquire: 60000, idle: 10000 },
    logging: false,
  }
);
registerDialectHooks(sequelize);
module.exports = sequelize;
