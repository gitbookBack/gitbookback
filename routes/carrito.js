// backend/routes/carrito.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { poolPromise, sql } = require('../db');

// POST /api/carrito — ya lo tienes
router.post('/', auth, async (req, res) => {
  const userId = req.user.id;
  const { libroID, cantidad } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('UsuarioID', sql.Int, userId)
      .input('LibroID',   sql.Int, libroID)
      .input('Cantidad',  sql.Int, cantidad)
      .query(`
        INSERT INTO ItemsCarrito (UsuarioID, LibroID, Cantidad, FechaAgregado)
        VALUES (@UsuarioID, @LibroID, @Cantidad, GETDATE());
        SELECT SCOPE_IDENTITY() AS ItemCarritoID;
      `);
    res.status(201).json({ itemCarritoID: result.recordset[0].ItemCarritoID });
  } catch (err) {
    console.error('Error POST /api/carrito', err);
    res.status(500).json({ error: 'Error al agregar al carrito' });
  }
});

// 🆕 GET /api/carrito — lista los ítems para el usuario actual
router.get('/', auth, async (req, res) => {
  const userId = req.user.id;
  try {
    const pool = await poolPromise;
    const { recordset } = await pool.request()
      .input('UsuarioID', sql.Int, userId)
      .query(`
        SELECT ic.ItemCarritoID,
               ic.Cantidad,
               l.LibroID,
               l.Titulo,
               l.UrlImagen,
               l.Precio
          FROM ItemsCarrito ic
          JOIN Libros l ON l.LibroID = ic.LibroID
         WHERE ic.UsuarioID = @UsuarioID
      `);
    res.json(recordset);
  } catch (err) {
    console.error('Error GET /api/carrito', err);
    res.status(500).json({ error: 'Error al cargar carrito' });
  }
});

module.exports = router;
