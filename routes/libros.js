// routes/libros.js
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { poolPromise, sql } = require('../db');
const { subirImagen }     = require('../upload');

const upload = multer({ dest: 'uploads/' });

// GET /api/libros
router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise;
    const r1 = await pool.request().query(`
      SELECT
        l.LibroID, l.Titulo, l.UrlImagen, l.Precio, l.Descripcion,
        l.CategoriaID, c.NombreCategoria,
        s.CantidadActual, s.CantidadMinima
      FROM dbo.Libros l
      JOIN dbo.Categorias c ON c.CategoriaID = l.CategoriaID
      LEFT JOIN dbo.Stock      s ON s.LibroID      = l.LibroID
    `);

    const libros = r1.recordset.map(r => ({
      LibroID:     r.LibroID,
      Titulo:      r.Titulo,
      UrlImagen:   r.UrlImagen,
      Precio:      r.Precio,
      Descripcion: r.Descripcion,
      Categoria: {
        CategoriaID:     r.CategoriaID,
        NombreCategoria: r.NombreCategoria
      },
      Stock: {
        CantidadActual:  r.CantidadActual,
        CantidadMinima:  r.CantidadMinima
      },
      Autores: []
    }));

    if (libros.length) {
      const ids = libros.map(b => b.LibroID).join(',');
      const r2 = await pool.request().query(`
        SELECT la.LibroID, a.AutorID, a.NombreAutor
        FROM dbo.LibrosAutores la
        JOIN dbo.Autores a ON a.AutorID = la.AutorID
        WHERE la.LibroID IN (${ ids })
      `);
      r2.recordset.forEach(row => {
        const libro = libros.find(b => b.LibroID === row.LibroID);
        if (libro) {
          libro.Autores.push({
            AutorID:     row.AutorID,
            NombreAutor: row.NombreAutor
          });
        }
      });
    }

    res.json(libros);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/libros/:id
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const pool = await poolPromise;
    const r1 = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT
          l.LibroID, l.Titulo, l.UrlImagen, l.Precio, l.Descripcion,
          l.CategoriaID, c.NombreCategoria,
          s.CantidadActual, s.CantidadMinima
        FROM dbo.Libros l
        JOIN dbo.Categorias c ON c.CategoriaID = l.CategoriaID
        LEFT JOIN dbo.Stock      s ON s.LibroID      = l.LibroID
        WHERE l.LibroID = @id
      `);
    if (!r1.recordset.length) return res.status(404).json({ error:'No encontrado' });

    const r = r1.recordset[0];
    const libro = {
      LibroID:     r.LibroID,
      Titulo:      r.Titulo,
      UrlImagen:   r.UrlImagen,
      Precio:      r.Precio,
      Descripcion: r.Descripcion,
      CategoriaID: r.CategoriaID,
      Categoria: {
        CategoriaID:     r.CategoriaID,
        NombreCategoria: r.NombreCategoria
      },
      Stock: {
        CantidadActual:  r.CantidadActual,
        CantidadMinima:  r.CantidadMinima
      },
      Autores: []
    };

    const r2 = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT a.AutorID, a.NombreAutor
        FROM dbo.LibrosAutores la
        JOIN dbo.Autores a ON a.AutorID = la.AutorID
        WHERE la.LibroID = @id
      `);
    libro.Autores = r2.recordset;

    res.json(libro);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/libros
router.post('/', upload.single('portada'), async (req, res) => {
  try {
    const {
      titulo, precio, descripcion,
      categoriaID, autores,
      cantidadActual, cantidadMinima
    } = req.body;

    const urlImagen = await subirImagen(req.file.path);
    const pool = await poolPromise;

    const ins = await pool.request()
      .input('Titulo',          sql.NVarChar(200),    titulo)
      .input('UrlImagen',       sql.NVarChar(sql.MAX),urlImagen)
      .input('Precio',          sql.Decimal(10,2),    precio)
      .input('Descripcion',     sql.NVarChar(sql.MAX),descripcion||'')
      .input('CategoriaID',     sql.Int,              categoriaID)
      .input('UsuarioCreaID', sql.Int,              req.user?.id||1)
      .query(`
        INSERT INTO dbo.Libros
          (Titulo,UrlImagen,Precio,Descripcion,CategoriaID,UsuarioCreaID,FechaCreacion)
        OUTPUT INSERTED.LibroID
        VALUES(@Titulo,@UrlImagen,@Precio,@Descripcion,@CategoriaID,@UsuarioCreaID,GETDATE());
      `);
    const newId = ins.recordset[0].LibroID;

    await pool.request()
      .input('LibroID',        sql.Int, newId)
      .input('CantidadActual', sql.Int, cantidadActual||0)
      .input('CantidadMinima', sql.Int, cantidadMinima||0)
      .query(`
        INSERT INTO dbo.Stock (LibroID,CantidadActual,CantidadMinima)
        VALUES(@LibroID,@CantidadActual,@CantidadMinima);
      `);

    for (const aid of JSON.parse(autores)) {
      await pool.request()
        .input('LibroID', sql.Int, newId)
        .input('AutorID', sql.Int, aid)
        .query(`
          INSERT INTO dbo.LibrosAutores(LibroID,AutorID)
          VALUES(@LibroID,@AutorID);
        `);
    }

    res.status(201).json({ mensaje:'Libro creado', LibroID:newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/libros/:id
router.put('/:id', upload.single('portada'), async (req, res) => {
  const id = parseInt(req.params.id,10);
  if (isNaN(id)) return res.status(400).json({ error:'ID inválido' });

  try {
    const {
      titulo, precio, descripcion,
      categoriaID, autores,
      cantidadActual, cantidadMinima
    } = req.body;

    const pool = await poolPromise;
    let urlImagen;
    if (req.file) {
      urlImagen = await subirImagen(req.file.path);
    }

    // actualizo Libros
    let upd = pool.request()
      .input('id',           sql.Int,             id)
      .input('Titulo',       sql.NVarChar(200),   titulo)
      .input('Precio',       sql.Decimal(10,2),   precio)
      .input('Descripcion',  sql.NVarChar(sql.MAX),descripcion||'')
      .input('CategoriaID',  sql.Int,             categoriaID);

    if (urlImagen) {
      upd = upd.input('UrlImagen', sql.NVarChar(sql.MAX), urlImagen);
      await upd.query(`
        UPDATE dbo.Libros
          SET Titulo=@Titulo, Precio=@Precio,
              Descripcion=@Descripcion,
              CategoriaID=@CategoriaID,
              UrlImagen=@UrlImagen
        WHERE LibroID=@id;
      `);
    } else {
      await upd.query(`
        UPDATE dbo.Libros
          SET Titulo=@Titulo, Precio=@Precio,
              Descripcion=@Descripcion,
              CategoriaID=@CategoriaID
        WHERE LibroID=@id;
      `);
    }

    // actualizo Stock
    await pool.request()
      .input('LibroID',        sql.Int, id)
      .input('CantidadActual', sql.Int, cantidadActual||0)
      .input('CantidadMinima', sql.Int, cantidadMinima||0)
      .query(`
        UPDATE dbo.Stock
         SET CantidadActual=@CantidadActual,
             CantidadMinima=@CantidadMinima
         WHERE LibroID=@LibroID;
      `);

    // reasigno autores
    await pool.request()
      .input('LibroID', sql.Int, id)
      .query('DELETE FROM dbo.LibrosAutores WHERE LibroID=@LibroID;');

    for (const aid of JSON.parse(autores)) {
      await pool.request()
        .input('LibroID', sql.Int, id)
        .input('AutorID', sql.Int, aid)
        .query(`
          INSERT INTO dbo.LibrosAutores(LibroID,AutorID)
          VALUES(@LibroID,@AutorID);
        `);
    }

    res.json({ mensaje:'Libro actualizado', LibroID:id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/libros/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id,10);
  if (isNaN(id)) return res.status(400).json({ error:'ID inválido' });

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.LibrosAutores WHERE LibroID=@id;');
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.Stock       WHERE LibroID=@id;');
    const del = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.Libros      WHERE LibroID=@id;');

    if (del.rowsAffected[0] === 0) {
      return res.status(404).json({ error:'Libro no encontrado' });
    }
    res.json({ mensaje:'Libro eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
