// server.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
const auth    = require('./middleware/auth');
const mongoose = require('./mongo');
const app = express();

// 1) Middlewares globales
app.use(helmet());
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2) Servir estáticos
app.use(express.static(path.join(__dirname, 'public')));



// 4) Routers “core” (SQL)
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/categorias',   require('./routes/categorias'));
app.use('/api/autores',      require('./routes/autores'));
app.use('/api/libros',       require('./routes/libros'));

app.use('/api/reviews',      require('./routes/reviews'));
app.use('/api/carrito',      require('./routes/carrito'));
app.use('/api/pedidos',      require('./routes/pedidos'));
app.use('/api/direcciones',  require('./routes/direcciones'));
app.use('/api/metodospago',  require('./routes/metodospago'));

// 5) Routers “social” (Mongo)
app.use('/api/comments',       require('./routes/comments'));
app.use('/api/favorites',      require('./routes/favorites'));
app.use('/api/shares',         require('./routes/shares'));
app.use('/api/reactions',      require('./routes/reactions'));
app.use('/api/comunidad',      require('./routes/comunidad'));
app.use('/api/newsletter',     require('./routes/newsletter'));
app.use('/api/search-history', require('./routes/searchHistory'));
app.use('/api/notifications',  require('./routes/notifications'));

// 6) Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'up', timestamp: new Date().toISOString() });
});

// 7) 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// 8) Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API escuchando en puerto ${PORT}`));
