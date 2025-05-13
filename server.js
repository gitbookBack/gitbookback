// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const categoriasRouter = require('./routes/categorias');
const autoresRouter    = require('./routes/autores');
const librosRouter     = require('./routes/libros');
const resenasRouter    = require('./routes/resenas');
const carritoRouter = require('./routes/carrito');

// ... otros routers (auth, carrito, pedidos...)

const app = express();
app.use(cors());
app.use(express.json());

// Montar rutas
app.use('/api/categorias', categoriasRouter);
app.use('/api/autores', autoresRouter);
app.use('/api/libros', librosRouter);
app.use('/api/resenas', resenasRouter);
app.use('/api/carrito', carritoRouter);
// ... carrito, pedidos, pagos, auth...
app.get('/api/health', (req, res) => {
  res.json({ status: 'up', timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API en puerto ${PORT}`));
