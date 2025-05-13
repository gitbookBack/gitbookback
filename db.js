// db.js
require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,    
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

// Conectar y devolver siempre el pool si funciona, o propagar el error
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('🔌 Conectado a Azure SQL');
    return pool;                     // ← Muy importante
  })
  .catch(err => {
    console.error('❌ Conexión fallida a Azure SQL', err);
    // si no quieres que siga arrancando con pool undefined
    throw err;
  });

module.exports = {
  sql,
  poolPromise
};
