// server.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Routers relacionales
const categoriasRouter   = require('./routes/categorias');
const autoresRouter      = require('./routes/autores');
const librosRouter       = require('./routes/libros');
const resenasRouter      = require('./routes/resenas');
const carritoRouter      = require('./routes/carrito');
const authRouter         = require('./routes/auth');

// Routers NoSQL / sociales
const commentsRouter     = require('./routes/comments');
const reactionsRouter    = require('./routes/reactions');
const socialRouter       = require('./routes/social');
const newsletterRouter   = require('./routes/newsletter');
const searchHistoryRouter= require('./routes/searchHistory');
const notificationsRouter= require('./routes/notifications');
const analyticsRouter    = require('./routes/analytics');

// Montar rutas relacionales
app.use('/api/categorias',      categoriasRouter);
app.use('/api/autores',         autoresRouter);
app.use('/api/libros',          librosRouter);
app.use('/api/resenas',         resenasRouter);
app.use('/api/carrito',         carritoRouter);

// Montar rutas de autenticación
app.use('/api/auth',            authRouter);

// Montar rutas NoSQL / sociales
app.use('/api/comments',        commentsRouter);
app.use('/api/reactions',       reactionsRouter);
app.use('/api/social',          socialRouter);
app.use('/api/newsletter',      newsletterRouter);
app.use('/api/search-history',  searchHistoryRouter);
app.use('/api/notifications',   notificationsRouter);
app.use('/api/analytics',       analyticsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'up', timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API en puerto ${PORT}`));
