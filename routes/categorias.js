// routes/categorias.js
const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');

// GET /api/categorias → lista todas
router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM dbo.Categorias ORDER BY NombreCategoria');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/categorias/:id → lee una sola
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM dbo.Categorias WHERE CategoriaID = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categorias → crea nueva
router.post('/', async (req, res) => {
  const { NombreCategoria, Descripcion } = req.body;
  if (!NombreCategoria) {
    return res.status(400).json({ error: 'NombreCategoria es requerido' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('NombreCategoria', sql.NVarChar(100), NombreCategoria)
      .input('Descripcion', sql.NVarChar(sql.MAX), Descripcion || '')
      .query(`
        INSERT INTO dbo.Categorias (NombreCategoria, Descripcion)
        OUTPUT INSERTED.*
        VALUES (@NombreCategoria, @Descripcion)
      `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/categorias/:id → actualiza nombre y descripción
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { NombreCategoria, Descripcion } = req.body;
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  if (!NombreCategoria) {
    return res.status(400).json({ error: 'NombreCategoria es requerido' });
  }

  try {
    const pool = await poolPromise;
    // 1) Ejecutar update
    const updateResult = await pool.request()
      .input('id', sql.Int, id)
      .input('NombreCategoria', sql.NVarChar(100), NombreCategoria)
      .input('Descripcion', sql.NVarChar(sql.MAX), Descripcion || '')
      .query(`
        UPDATE dbo.Categorias
           SET NombreCategoria = @NombreCategoria,
               Descripcion     = @Descripcion
         WHERE CategoriaID = @id
      `);

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    // 2) Leer fila actualizada
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM dbo.Categorias WHERE CategoriaID = @id');

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/categorias/:id → elimina
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const pool = await poolPromise;
    const deleteResult = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.Categorias WHERE CategoriaID = @id');

    if (deleteResult.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json({ message: 'Categoría eliminada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
