// routes/carrito.js
const express = require('express');
const router  = express.Router();
const { poolPromise, sql } = require('../db');

// POST /api/carrito
// Body esperado: { libroID: number, cantidad: number }
router.post('/', async (req, res) => {
  const { libroID, cantidad } = req.body;
  // Aquí asumo UsuarioCreaID = 1; cámbialo según tu lógica de usuarios
  const usuarioID = 1;

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('UsuarioID', sql.Int, usuarioID)
      .input('LibroID',   sql.Int, libroID)
      .input('Cantidad',  sql.Int, cantidad)
      .query(`
        INSERT INTO dbo.ItemsCarrito (UsuarioID, LibroID, Cantidad)
        VALUES (@UsuarioID, @LibroID, @Cantidad);
        SELECT SCOPE_IDENTITY() AS ItemCarritoID;
      `);

    const nuevoID = result.recordset[0].ItemCarritoID;
    // Devuelvo 201 CREATED y la nueva clave
    res.status(201).json({ itemCarritoID: nuevoID });
  } catch (err) {
    console.error('Error en POST /api/carrito:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
