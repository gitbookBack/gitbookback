// routes/autores.js
const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// GET /api/autores
router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM dbo.Autores');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/autores
router.post('/', async (req, res) => {
  const { NombreAutor, BioAutor } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('NombreAutor', sql.NVarChar, NombreAutor)
      .input('BioAutor', sql.NVarChar, BioAutor)
      .query(`
        INSERT INTO dbo.Autores (NombreAutor, BioAutor)
        VALUES (@NombreAutor, @BioAutor);
        SELECT * FROM dbo.Autores WHERE AutorID = SCOPE_IDENTITY();
      `);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
