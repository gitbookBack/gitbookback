// routes/carrito.js
const express = require('express');
const router  = express.Router();
const { poolPromise, sql } = require('../db');

// Helper para extraer userID (reemplaza con tu middleware real si lo tienes)
function getUserId(req) {
  return req.user?.id || 1;
}

// Helper: obtiene o crea un carrito "Abierto" para el usuario
async function getOrCreateCart(pool, usuarioID) {
  // 1) Intento leer carrito abierto
  const r1 = await pool.request()
    .input('UsuarioID', sql.Int, usuarioID)
    .query(`
      SELECT CarritoID 
        FROM dbo.Carrito 
       WHERE UsuarioID = @UsuarioID 
         AND Estatus   = 'Abierto'
    `);
  if (r1.recordset.length) {
    return r1.recordset[0].CarritoID;
  }
  // 2) Si no existe, lo creo
  const r2 = await pool.request()
    .input('UsuarioID', sql.Int, usuarioID)
    .query(`
      INSERT INTO dbo.Carrito
        (UsuarioID, FechaCreacion, Estatus, CreatedAt)
      OUTPUT INSERTED.CarritoID
      VALUES
        (@UsuarioID, GETDATE(), 'Abierto', GETDATE());
    `);
  return r2.recordset[0].CarritoID;
}

// GET /api/carrito
// Lista todos los ítems del carrito activo del usuario
// routes/carrito.js  (sólo la parte del GET)
router.get('/', async (req, res) => {
  try {
    const usuarioID = getUserId(req);
    const pool      = await poolPromise;
    const carritoID = await getOrCreateCart(pool, usuarioID);

    const result = await pool.request()
      .input('CarritoID', sql.Int, carritoID)
      .query(`
        SELECT
          ic.ItemsCarritoID,
          ic.Cantidad,
          ic.PrecioUnitario,
          l.LibroID,
          l.Titulo,
          l.UrlImagen
        FROM dbo.ItemsCarrito ic
        JOIN dbo.Libros       l 
          ON l.LibroID = ic.LibroID
       WHERE ic.CarritoID = @CarritoID
      `);

    // Aquí armamos la respuesta EXACTA que tu front espera:
    const items = result.recordset.map(r => ({
      // coincide con it.itemCarritoID en el front
      itemCarritoID:  r.ItemsCarritoID,
      cantidad:       r.Cantidad,
      libro: {
        LibroID:      r.LibroID,
        Titulo:    r.Titulo,
        UrlImagen: r.UrlImagen,
        // el front hacía libro.Precio.toFixed(), así que lo llamamos Precio
        Precio:    parseFloat(r.PrecioUnitario)
      }
    }));

    res.json(items);
  } catch (err) {
    console.error('GET /api/carrito error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/carrito
// Añade al carrito (o suma si ya existía)
router.post('/', async (req, res) => {
  try {
    const usuarioID = getUserId(req);
    const { LibroID, Cantidad = 1 } = req.body;
    if (!LibroID || Cantidad < 1) {
      return res.status(400).json({ error: 'LibroID y Cantidad válidos son requeridos' });
    }

    const pool = await poolPromise;
    const carritoID = await getOrCreateCart(pool, usuarioID);

    // ¿Ya está ese libro en el carrito?
    const exists = await pool.request()
      .input('CarritoID', sql.Int, carritoID)
      .input('LibroID',   sql.Int, LibroID)
      .query(`
        SELECT 1 
          FROM dbo.ItemsCarrito 
         WHERE CarritoID = @CarritoID 
           AND LibroID   = @LibroID
      `);

    if (exists.recordset.length) {
      // Sumo cantidad
      await pool.request()
        .input('CarritoID',   sql.Int, carritoID)
        .input('LibroID',     sql.Int, LibroID)
        .input('CantidadAdd', sql.Int, Cantidad)
        .query(`
          UPDATE dbo.ItemsCarrito
             SET Cantidad = Cantidad + @CantidadAdd
           WHERE CarritoID = @CarritoID
             AND LibroID   = @LibroID;
        `);
    } else {
      // Inserto nuevo ítem, con precio unitario tomado del libro
      const libroRow = await pool.request()
        .input('LibroID', sql.Int, LibroID)
        .query(`SELECT Precio FROM dbo.Libros WHERE LibroID = @LibroID`);
      if (!libroRow.recordset.length) {
        return res.status(404).json({ error: 'Libro no encontrado' });
      }
      const precioUnitario = libroRow.recordset[0].Precio;

      await pool.request()
        .input('CarritoID',     sql.Int, carritoID)
        .input('LibroID',       sql.Int, LibroID)
        .input('Cantidad',      sql.Int, Cantidad)
        .input('PrecioUnitario', sql.Decimal(10,2), precioUnitario)
        .query(`
          INSERT INTO dbo.ItemsCarrito
            (CarritoID, LibroID, Cantidad, PrecioUnitario, CreatedAt)
          VALUES
            (@CarritoID, @LibroID, @Cantidad, @PrecioUnitario, GETDATE());
        `);
    }

    res.status(201).json({ message: 'Libro añadido al carrito' });
  } catch (err) {
    console.error('POST /api/carrito error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/carrito/:id
// Actualiza cantidad de un ítem (solo si pertenece al carrito del usuario)
router.put('/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id, 10);
    const { Cantidad } = req.body;
    if (isNaN(itemId) || Cantidad < 1) {
      return res.status(400).json({ error: 'ID inválido o Cantidad menor que 1' });
    }

    const usuarioID = getUserId(req);
    const pool = await poolPromise;
    const carritoID = await getOrCreateCart(pool, usuarioID);

    const result = await pool.request()
      .input('ItemsCarritoID', sql.Int, itemId)
      .input('CarritoID',     sql.Int, carritoID)
      .input('Cantidad',      sql.Int, Cantidad)
      .query(`
        UPDATE dbo.ItemsCarrito
           SET Cantidad = @Cantidad
         WHERE ItemsCarritoID = @ItemsCarritoID
           AND CarritoID     = @CarritoID;
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Ítem no encontrado en tu carrito' });
    }
    res.json({ message: 'Cantidad actualizada' });
  } catch (err) {
    console.error('PUT /api/carrito/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/carrito/:id
// Elimina un ítem del carrito del usuario
router.delete('/:id', async (req, res) => {
  try {
    const itemId    = parseInt(req.params.id, 10);
    const usuarioID = getUserId(req);
    const pool      = await poolPromise;
    const carritoID = await getOrCreateCart(pool, usuarioID);

    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // 1) Borro el ítem específico
    const del = await pool.request()
      .input('ItemsCarritoID', sql.Int, itemId)
      .input('CarritoID',      sql.Int, carritoID)
      .query(`
        DELETE FROM dbo.ItemsCarrito
         WHERE ItemsCarritoID = @ItemsCarritoID
           AND CarritoID      = @CarritoID;
      `);

    if (del.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Ítem no encontrado en tu carrito' });
    }

    // 2) Compruebo si el carrito ahora está vacío
    const cnt = await pool.request()
      .input('CarritoID', sql.Int, carritoID)
      .query(`
        SELECT COUNT(*) AS cnt
          FROM dbo.ItemsCarrito
         WHERE CarritoID = @CarritoID;
      `);

    if (cnt.recordset[0].cnt === 0) {
      // 3A) Marcar carrito como 'Cancelado' y actualizar timestamp
      console.log(carritoID);
      await pool.request()
        .input('CarritoID', sql.Int, carritoID)
        .query(`
          UPDATE dbo.Carrito
             SET Estatus   = 'Cancelado',
                 UpdatedAt = GETDATE()
           WHERE CarritoID = @CarritoID;
        `);

      // Opcional: si en vez de cancelar prefieres eliminar:
      // await pool.request()
      //   .input('CarritoID', sql.Int, carritoID)
      //   .query('DELETE FROM dbo.Carrito WHERE CarritoID = @CarritoID;');
    }

    res.json({ message: 'Ítem eliminado correctamente' });
  } catch (err) {
    console.error('DELETE /api/carrito/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
