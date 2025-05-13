// db.js
require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,      // ej. tuinstancia.database.windows.net
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: false
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Aquí nos aseguramos de devolver `pool` en el then:
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('🔌 Conectado a Azure SQL');
    return pool;               // ← Muy importante
  })
  .catch(err => {
    console.error('❌ Conexión fallida:', err);
    throw err;
  });

module.exports = {
  sql,
  poolPromise
};
