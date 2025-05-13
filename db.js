// db.js
require('dotenv').config();
const sql = require('mssql');

// Imprime las variables críticas

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,    // e.g. "miserver.database.windows.net"
  database: process.env.DB_NAME,
  options: {
    encrypt: true,                  // Azure SQL exige TLS
    trustServerCertificate: false   // Pon true sólo si tu servidor usa certificado autofirmado
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Construimos el pool
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('🔌 Conectado a Azure SQL');
    return pool;
  })
  .catch(err => {
    console.error('❌ Falló conexión a Azure SQL:', err);
    // Si falla, abortamos el proceso para no seguir con pool undefined
    process.exit(1);
  });

module.exports = {
  sql,
  poolPromise
};
