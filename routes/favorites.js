// routes/favorites.js
const express = require('express');
const auth    = require('../middleware/auth');
const { poolPromise, sql } = require('../db');
const router = express.Router();

router.use(auth);

// POST /api/favorites/toggle
router.post('/toggle', async (req, res) => {
  const usuarioID = req.user.id;
  const libroID   = parseInt(req.body.bookId, 10);
  const pool      = await poolPromise;

  // ¿Ya está?
  const { recordset } = await pool.request()
    .input('UsuarioID', sql.Int, usuarioID)
    .input('LibroID',   sql.Int, libroID)
    .query(`
      SELECT FavoritoID
        FROM dbo.Favoritos
       WHERE UsuarioID = @UsuarioID
         AND LibroID   = @LibroID
    `);

  let favorited;
  if (recordset.length) {
    // eliminar
    await pool.request()
      .input('FavoritoID', sql.Int, recordset[0].FavoritoID)
      .query(`DELETE FROM dbo.Favoritos WHERE FavoritoID=@FavoritoID`);
    favorited = false;
  } else {
    // insertar
    await pool.request()
      .input('UsuarioID', sql.Int, usuarioID)
      .input('LibroID',   sql.Int, libroID)
      .query(`
        INSERT INTO dbo.Favoritos
          (UsuarioID,LibroID,FechaAgregado,CreatedAt,UpdatedAt)
        VALUES
          (@UsuarioID,@LibroID,GETDATE(),GETDATE(),GETDATE())
      `);
    favorited = true;
  }

  res.json({ favorited });
});

// GET /api/favorites
router.get('/', async (req, res) => {
  const usuarioID = req.user.id;
  const pool      = await poolPromise;
  const { recordset } = await pool.request()
    .input('UsuarioID', sql.Int, usuarioID)
    .query(`
      SELECT f.LibroID, l.Titulo
        FROM dbo.Favoritos f
        JOIN dbo.Libros    l ON l.LibroID = f.LibroID
       WHERE f.UsuarioID = @UsuarioID
       ORDER BY f.FechaAgregado DESC
    `);
  
  // uniformiza la respuesta
  const favs = recordset.map(r => ({
    libroId:     r.LibroID.toString(),
    libroTitulo: r.Titulo
  }));
  res.json(favs);
});

module.exports = router;
