// routes/resenas.js
const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// GET /api/resenas/:libroID
router.get('/:libroID', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('LibroID', sql.Int, req.params.libroID)
      .query(`
        SELECT r.ResenaID, r.Calificacion, r.Comentario, r.FechaResena,
               u.NombreUsuario
        FROM dbo.Resenas r
        JOIN dbo.Usuarios u ON r.UsuarioID = u.UsuarioID
        WHERE r.LibroID = @LibroID
        ORDER BY r.FechaResena DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/resenas
router.post('/', async (req, res) => {
  const { libroID, calificacion, comentario } = req.body;
  const tokenUsuario = 1
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('LibroID', sql.Int, libroID)
      .input('UsuarioID', sql.Int, tokenUsuario)
      .input('Calificacion', sql.TinyInt, calificacion)
      .input('Comentario', sql.NVarChar, comentario)
      .query(`
        INSERT INTO dbo.Resenas (LibroID, UsuarioID, Calificacion, Comentario)
        VALUES (@LibroID, @UsuarioID, @Calificacion, @Comentario);
        SELECT * FROM dbo.Resenas WHERE ResenaID = SCOPE_IDENTITY();
      `);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
