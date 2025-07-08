// routes/pedidos.js

const express     = require('express');
const router      = express.Router();
const auth        = require('../middleware/auth');
const { poolPromise, sql } = require('../db');
const PDFDocument = require('pdfkit');
const { randomUUID } = require('crypto');

router.use(auth);

// 0) Helper para extraer userID (o 1 si no hay auth real aún)
function getUserId(req) {
  return req.user.id;
}

// 1) Helper para obtener o crear un carrito "Abierto"
async function getOrCreateCart(pool, usuarioID) {
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
  const r2 = await pool.request()
    .input('UsuarioID', sql.Int, usuarioID)
    .query(`
      INSERT INTO dbo.Carrito
        (UsuarioID, FechaCreacion, Estatus, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.CarritoID
      VALUES
        (@UsuarioID, GETDATE(), 'Abierto', GETDATE(), GETDATE());
    `);
  return r2.recordset[0].CarritoID;
}

// POST /api/pedidos
// → crea: Pedidos, ItemsPedido, EstadosPedido, Facturas, Pagos, marca Carrito
// → devuelve { pedidoID, pdfUrl }
router.post('/', async (req, res) => {
  const usuarioID      = getUserId(req);
  const { direccionID, metodoPagoID, cuponID = null } = req.body;
  if (!direccionID || !metodoPagoID) {
    return res
      .status(400)
      .json({ error: 'direccionID y metodoPagoID son requeridos' });
  }

  const pool      = await poolPromise;
  const carritoID = await getOrCreateCart(pool, usuarioID);

  // 2) Traer items del carrito
  const ri = await pool.request()
    .input('CarritoID', sql.Int, carritoID)
    .query(`
      SELECT LibroID, Cantidad, PrecioUnitario
        FROM dbo.ItemsCarrito
       WHERE CarritoID = @CarritoID
    `);
  const items = ri.recordset;
  if (items.length === 0) {
    return res.status(400).json({ error: 'Carrito vacío' });
  }

  // 3) Calcular total
  const total = items.reduce(
    (sum, i) => sum + Number(i.PrecioUnitario) * i.Cantidad,
    0
  );

  // 4) Abrir transacción
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    // 4.1) Insertar en Pedidos
    const rp = await transaction.request()
      .input('UsuarioID',        sql.Int,       usuarioID)
      .input('FechaPedido',      sql.DateTime,  new Date())
      .input('Total',            sql.Decimal(10,2), total)
      .input('EstadoActual',     sql.NVarChar(50), 'Pendiente')
      .input('CuponID',          sql.Int,       cuponID)
      .input('DireccionEnvioID', sql.Int,       direccionID)
      .input('CarritoID',        sql.Int,       carritoID)
      .query(`
        INSERT INTO dbo.Pedidos
          (UsuarioID,FechaPedido,Total,EstadoActual,CuponID,DireccionEnvioID,CarritoID,CreatedAt,UpdatedAt)
        OUTPUT INSERTED.PedidoID
        VALUES
          (@UsuarioID,@FechaPedido,@Total,@EstadoActual,@CuponID,@DireccionEnvioID,@CarritoID,GETDATE(),GETDATE());
      `);
    const pedidoID = rp.recordset[0].PedidoID;

    // 4.2) Insertar ItemsPedido
    for (let it of items) {
      await transaction.request()
        .input('PedidoID',       sql.Int,        pedidoID)
        .input('LibroID',        sql.Int,        it.LibroID)
        .input('Cantidad',       sql.Int,        it.Cantidad)
        .input('PrecioUnitario', sql.Decimal(10,2), it.PrecioUnitario)
        .query(`
          INSERT INTO dbo.ItemsPedido
            (PedidoID,LibroID,Cantidad,PrecioUnitario,CreatedAt,UpdatedAt)
          VALUES
            (@PedidoID,@LibroID,@Cantidad,@PrecioUnitario,GETDATE(),GETDATE());
        `);
    }

    // 4.3) Insertar estado inicial en EstadosPedido
    await transaction.request()
      .input('PedidoID', sql.Int, pedidoID)
      .input('Estado',   sql.NVarChar(50), 'Pendiente')
      .query(`
        INSERT INTO dbo.EstadosPedido
          (PedidoID,Estado,FechaCambio,CreatedAt,UpdatedAt)
        VALUES
          (@PedidoID,@Estado,GETDATE(),GETDATE(),GETDATE());
      `);

    // 4.4) Insertar Factura
    const numeroFact = `F-${Date.now()}`;
    await transaction.request()
      .input('PedidoID',     sql.Int,       pedidoID)
      .input('Numero',       sql.NVarChar(50), numeroFact)
      .input('FechaEmision', sql.DateTime,  new Date())
      .input('Total',        sql.Decimal(10,2), total)
      .query(`
        INSERT INTO dbo.Facturas
          (PedidoID,Numero,FechaEmision,Total)
        VALUES
          (@PedidoID,@Numero,@FechaEmision,@Total);
      `);

    // 4.5) Insertar Pago
    const referencia = randomUUID(); // Generar una referencia única
    await transaction.request()
      .input('PedidoID',      sql.Int,       pedidoID)
      .input('FechaPago',     sql.DateTime,  new Date())
      .input('Monto',         sql.Decimal(10,2), total)
      .input('MetodoPagoID',  sql.Int,       metodoPagoID)
      .input('EstadoActual',    sql.NVarChar(50), 'Completado')
      .input('ReferenciaGateway', sql.NVarChar(100), referencia)
      .query(`
        INSERT INTO dbo.Pagos
          (PedidoID,FechaPago,Monto,MetodoPagoID,EstadoActual,ReferenciaGateway,CreatedAt,UpdatedAt)
        VALUES
          (@PedidoID,@FechaPago,@Monto,@MetodoPagoID,@EstadoActual,@ReferenciaGateway,GETDATE(),GETDATE());
      `);

    // 4.6) Actualizar Pedido a Completado
    await transaction.request()
      .input('PedidoID',     sql.Int, pedidoID)
      .query(`
        UPDATE dbo.Pedidos
           SET EstadoActual = 'Completado',
               UpdatedAt    = GETDATE()
         WHERE PedidoID = @PedidoID;
      `);

    // 4.7) Nuevo estado en EstadosPedido (“Completado”)
    await transaction.request()
      .input('PedidoID', sql.Int, pedidoID)
      .input('Estado',   sql.NVarChar(50), 'Completado')
      .query(`
        INSERT INTO dbo.EstadosPedido
          (PedidoID,Estado,FechaCambio,CreatedAt,UpdatedAt)
        VALUES
          (@PedidoID,@Estado,GETDATE(),GETDATE(),GETDATE());
      `);

    // 4.8) Marcar Carrito como Completado
    await transaction.request()
      .input('CarritoID', sql.Int, carritoID)
      .query(`
        UPDATE dbo.Carrito
           SET Estatus   = 'Completado',
               UpdatedAt = GETDATE()
         WHERE CarritoID = @CarritoID;
      `);

    await transaction.commit();

    // 5) Enviar al frontend la URL para descargar el PDF
    return res.status(201).json({
      pedidoID,
      pdfUrl: `/api/pedidos/${pedidoID}/factura.pdf`
    });

  } catch (err) {
    await transaction.rollback();
    console.error('POST /api/pedidos error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/pedidos
// Lista todos los pedidos del usuario logueado
router.get('/', async (req, res) => {
  try {
    const usuarioID = req.user.id;
    const pool      = await poolPromise;
    const { recordset } = await pool.request()
      .input('UsuarioID', sql.Int, usuarioID)
      .query(`
        SELECT PedidoID, FechaPedido, Total
          FROM dbo.Pedidos
         WHERE UsuarioID = @UsuarioID
         ORDER BY FechaPedido DESC
      `);

    const pedidos = recordset.map(r => ({
      pedidoID: r.PedidoID,
      fecha:     r.FechaPedido,         // en el front lo formateas
      total:     Number(r.Total)
    }));

    res.json(pedidos);
  } catch (err) {
    console.error('GET /api/pedidos error:', err);
    res.status(500).json({ error: 'Error al listar pedidos' });
  }
});

// GET /api/pedidos/:id/factura.pdf
// → genera el PDF al vuelo con pdfkit
 router.get('/:id/factura.pdf', auth, async (req, res) => {
  const pedidoID = parseInt(req.params.id, 10);
  if (isNaN(pedidoID)) {
    return res.status(400).send('ID inválido');
  }

  try {
    const usuarioID = getUserId(req);
    const pool      = await poolPromise;

    // 1) Validar que el pedido exista y pertenezca al usuario
    const rp = await pool.request()
      .input('PedidoID',  sql.Int, pedidoID)
      .input('UsuarioID', sql.Int, usuarioID)
      .query(`
        SELECT * 
          FROM dbo.Pedidos 
         WHERE PedidoID=@PedidoID 
           AND UsuarioID=@UsuarioID
      `);
    if (!rp.recordset.length) {
      return res.status(404).send('Pedido no encontrado');
    }
    const pedido = rp.recordset[0];

    // 2) Traer los items
    const ri = await pool.request()
      .input('PedidoID', sql.Int, pedidoID)
      .query(`
        SELECT ip.LibroID, l.Titulo, ip.Cantidad, ip.PrecioUnitario
          FROM dbo.ItemsPedido ip
          JOIN dbo.Libros l ON l.LibroID = ip.LibroID
         WHERE ip.PedidoID = @PedidoID
      `);
    const items = ri.recordset;

    // 3) Emitir PDF
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=factura-${pedidoID}.pdf`
    );
    doc.pipe(res);

    doc.fontSize(18).text('Factura / Boleta', { align: 'center' }).moveDown();
    doc.fontSize(12)
       .text(`Pedido ID: ${pedidoID}`)
       .text(`Fecha: ${pedido.FechaPedido.toLocaleString()}`)
       .text(`Total: S/ ${pedido.Total.toFixed(2)}`)
       .moveDown();

    doc.text('Ítems:', { underline: true });
    items.forEach(it => {
      doc.text(`${it.Titulo} — ${it.Cantidad} × S/ ${it.PrecioUnitario.toFixed(2)}`);
      doc.text(`Subtotal: S/ ${(it.Cantidad * it.PrecioUnitario).toFixed(2)}`);
    });

    doc.moveDown().text('¡Gracias por tu compra!', { align: 'center' });
    doc.end();

  } catch (err) {
    console.error('GET factura.pdf error:', err);
    res.status(500).send('Error generando PDF');
  }
});

module.exports = router;