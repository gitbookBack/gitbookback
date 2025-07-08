// mongo.js
const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('❌ MONGO_URI no definido en .env');
  process.exit(1);
}

mongoose.set('strictQuery', true);
mongoose
  .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Conectado a MongoDB con Mongoose'))
  .catch(err => console.error('❌ Error al conectar a MongoDB:', err));

module.exports = mongoose;
