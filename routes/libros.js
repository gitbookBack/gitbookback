// routes/libros.js
const express = require('express');
const router = express.Router();
const { poolPromise, sql } = require('../db');
const multer = require('multer');
const { subirImagen } = require('../upload'); // si usas blob

const upload = multer({ dest: 'uploads/' });

// GET /api/libros  (con JOIN para categoría y autores)
router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
   SELECT
        l.LibroID,
        l.Titulo,
        l.UrlImagen,
        l.Precio,
        l.Descripcion,
        l.CategoriaID,             
        c.NombreCategoria,
        STRING_AGG(a.NombreAutor, ', ') AS Autores
      FROM dbo.Libros l
      JOIN dbo.Categorias c ON l.CategoriaID = c.CategoriaID
      LEFT JOIN dbo.LibrosAutores la ON la.LibroID = l.LibroID
      LEFT JOIN dbo.Autores a ON a.AutorID = la.AutorID
      GROUP BY
        l.LibroID, l.Titulo, l.UrlImagen,
        l.Precio, l.Descripcion, l.CategoriaID, c.NombreCategoria
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/libros  (con subida de portada)
router.post('/', upload.single('portada'), async (req, res) => {
  const { titulo, precio, descripcion, categoriaID, autores } = req.body;
  const tokenUsuario = 1;
  try {
    // 1) subir imagen a blob y obtener URL
    const urlImagen = await subirImagen(req.file.path);

    // 2) insertar libro
    const pool = await poolPromise;
    const insertBook = await pool.request()
      .input('Titulo', sql.NVarChar, titulo)
      .input('UrlImagen', sql.NVarChar, urlImagen)
      .input('Precio', sql.Decimal(10,2), precio)
      .input('Descripcion', sql.NVarChar, descripcion)
      .input('CategoriaID', sql.Int, categoriaID)
      .input('UsuarioCreaID', sql.Int, tokenUsuario)
      .query(`
        INSERT INTO dbo.Libros (Titulo, UrlImagen, Precio, Descripcion, CategoriaID, UsuarioCreaID)
        VALUES (@Titulo, @UrlImagen, @Precio, @Descripcion, @CategoriaID, @UsuarioCreaID);
        SELECT SCOPE_IDENTITY() AS LibroID;
      `);
    const newLibroID = insertBook.recordset[0].LibroID;

    // 3) insertar relación con autores (array de IDs separados por comas)
    const pool2 = await poolPromise;
    for (let autorID of autores.split(',')) {
      await pool2.request()
        .input('LibroID', sql.Int, newLibroID)
        .input('AutorID', sql.Int, autorID)
        .query(`
          INSERT INTO dbo.LibrosAutores (LibroID, AutorID)
          VALUES (@LibroID, @AutorID);
        `);
    }

    res.json({ mensaje: 'Libro creado', LibroID: newLibroID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('LibroID', sql.Int, id)
      .query(`
        SELECT
          l.LibroID,
          l.Titulo,
          l.UrlImagen,
          l.Precio,
          l.Descripcion,
          l.CategoriaID,
          c.NombreCategoria,
          STRING_AGG(a.NombreAutor, ', ') AS Autores
        FROM dbo.Libros l
        JOIN dbo.Categorias c
          ON l.CategoriaID = c.CategoriaID
        LEFT JOIN dbo.LibrosAutores la
          ON la.LibroID = l.LibroID
        LEFT JOIN dbo.Autores a
          ON a.AutorID = la.AutorID
        WHERE l.LibroID = @LibroID
        GROUP BY
          l.LibroID, l.Titulo, l.UrlImagen,
          l.Precio, l.Descripcion, l.CategoriaID, c.NombreCategoria
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error en GET /api/libros/:id', err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
