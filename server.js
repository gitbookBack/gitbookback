// server.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// 1) Middlewares globales
app.use(cors());
app.use(express.json());
// permite leer bodies de tipo application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
app.use('/api/pedidos/:id/factura.pdf', express.static(path.join(__dirname, 'uploads/invoices')));
// 2) Servir tus vistas y assets estáticos
//    Asumiendo que:
//      /public
//        /views/Admin.html
//        /css/Admin.css
//        /js/Admin.js
app.use('/', express.static(path.join(__dirname, 'public')));

// 3) Routers relacionales
const categoriasRouter    = require('./routes/categorias');
const autoresRouter       = require('./routes/autores');
const librosRouter        = require('./routes/libros');
const resenasRouter       = require('./routes/resenas');
const carritoRouter       = require('./routes/carrito');
const authRouter          = require('./routes/auth');
const pedidosRouter = require('./routes/pedidos');
const direccionesRouter   = require('./routes/direcciones');
const metodospagoRouter   = require('./routes/metodospago');
// const pedidosRouter       = require('./routes/pedidos'); // Si decides usar pedidos

// 4) Routers NoSQL / sociales
const commentsRouter      = require('./routes/comments');
const reactionsRouter     = require('./routes/reactions');
const socialRouter        = require('./routes/social');
const newsletterRouter    = require('./routes/newsletter');
const searchHistoryRouter = require('./routes/searchHistory');
const notificationsRouter = require('./routes/notifications');
const analyticsRouter     = require('./routes/analytics');

// 5) Montar rutas API bajo /api
app.use('/api/categorias',     categoriasRouter);
app.use('/api/autores',        autoresRouter);
app.use('/api/libros',         librosRouter);
app.use('/api/resenas',        resenasRouter);
app.use('/api/carrito',        carritoRouter);
app.use('/api/auth',           authRouter);
app.use('/api/pedidos',       pedidosRouter);
app.use('/api/direcciones',   direccionesRouter);
app.use('/api/metodospago',   metodospagoRouter);
app.use('/api/comments',       commentsRouter);
app.use('/api/reactions',      reactionsRouter);
app.use('/api/social',         socialRouter);
app.use('/api/newsletter',     newsletterRouter);
app.use('/api/search-history', searchHistoryRouter);
app.use('/api/notifications',  notificationsRouter);
app.use('/api/analytics',      analyticsRouter);

// 6) Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'up', timestamp: new Date().toISOString() });
});

// 7) Fallo 404 para rutas no definidas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// 8) Handler global de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API escuchando en puerto ${PORT}`));
