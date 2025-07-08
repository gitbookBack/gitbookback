require('dotenv').config();
const sql = require('mssql');
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Mongoose conectado a MongoDB'))
.catch(err => console.error('❌ Error al conectar con MongoDB:', err));

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME, 
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('🔌 Conectado a Azure SQL');
    return pool;
  })
  .catch(err => {
    console.error('❌ Conexión fallida:', err);
  });

module.exports = {
  sql, poolPromise
};
