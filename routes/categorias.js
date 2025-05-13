// routes/categorias.js
const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// GET /api/categorias
router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM dbo.Categorias')
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categorias
router.post('/', async (req, res) => {
  const { NombreCategoria, Descripcion } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('NombreCategoria', sql.NVarChar, NombreCategoria)
      .input('Descripcion', sql.NVarChar, Descripcion)
      .query(`
        INSERT INTO dbo.Categorias (NombreCategoria, Descripcion)
        VALUES (@NombreCategoria, @Descripcion);
        SELECT * FROM dbo.Categorias WHERE CategoriaID = SCOPE_IDENTITY();
      `);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
