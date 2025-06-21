// routes/direcciones.js
const express = require('express');
const router  = express.Router();
const { poolPromise, sql } = require('../db');

// Helper para extraer el usuario (reemplaza por tu middleware real)
function getUserId(req) {
  return req.user?.id || 1;
}

// GET /api/direcciones → lista las direcciones del usuario
router.get('/', async (req, res) => {
  try {
    const usuarioID = getUserId(req);
    const pool = await poolPromise;
    const result = await pool.request()
      .input('UsuarioID', sql.Int, usuarioID)
      .query(`
        SELECT DireccionID, Alias, Calle, Ciudad, EstadoRegion, CodigoPostal, Pais
        FROM dbo.Direcciones
        WHERE UsuarioID = @UsuarioID
        ORDER BY CreatedAt DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('GET /api/direcciones error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/direcciones → crea una nueva dirección
router.post('/', async (req, res) => {
  try {
    const usuarioID   = getUserId(req);
    const {
      Calle,
      Ciudad,
      CodigoPostal,
      EstadoRegion = '',   // valor por defecto
      Pais         = 'Perú',
      Alias        = ''
    } = req.body;

    if (!Calle || !Ciudad || !CodigoPostal) {
      return res.status(400).json({ error: 'Calle, Ciudad y Código Postal son requeridos' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('UsuarioID',    sql.Int,           usuarioID)
      .input('Alias',        sql.NVarChar(100), Alias)
      .input('Calle',        sql.NVarChar(200), Calle)
      .input('Ciudad',       sql.NVarChar(100), Ciudad)
      .input('EstadoRegion', sql.NVarChar(100), EstadoRegion)
      .input('CodigoPostal', sql.NVarChar(20),  CodigoPostal)
      .input('Pais',         sql.NVarChar(100), Pais)
      .query(`
        INSERT INTO dbo.Direcciones
          (UsuarioID, Alias, Calle, Ciudad, EstadoRegion, CodigoPostal, Pais, CreatedAt)
        OUTPUT INSERTED.*
        VALUES
          (@UsuarioID, @Alias, @Calle, @Ciudad, @EstadoRegion, @CodigoPostal, @Pais, GETDATE());
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('POST /api/direcciones error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
