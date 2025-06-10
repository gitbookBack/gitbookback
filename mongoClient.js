// mongoClient.js
const { MongoClient } = require('mongodb');

if (!process.env.MONGO_URI) {
  throw new Error('Debes definir MONGO_URI en tu .env');
}

const client = new MongoClient(process.env.MONGO_URI);
let dbInstance = null;

async function connect() {
  // Si aún no estamos conectados, haz connect() una vez
  if (!dbInstance) {
    await client.connect();
    console.log('🔌 Conectado a MongoDB Atlas');
    dbInstance = client.db('gitbook-social');
  }
  return dbInstance;
}

module.exports = { connect };
