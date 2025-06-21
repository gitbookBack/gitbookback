const express = require('express');
const { poolPromise } = require('../db');
const router = express.Router();

// GET /api/metodospago
router.get('/', async (req, res) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .query(`SELECT MetodoPagoID, Nombre, Descripcion FROM dbo.MetodosPago`);
  res.json(result.recordset);
});

module.exports = router;
