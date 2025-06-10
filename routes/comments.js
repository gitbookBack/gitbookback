// backend/routes/comments.js

const express     = require('express');
const auth        = require('../middleware/auth');
const { connect } = require('../mongoClient');
const { poolPromise, sql } = require('../db');
const { ObjectId } = require('mongodb');

const router = express.Router();

// POST /api/comments
router.post('/', auth, async (req, res) => {
  const { bookId, rating, text } = req.body;
  const userId = req.user.id;
  if (!bookId || !rating || !text) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  try {
    const db = await connect();
    const result = await db.collection('comments').insertOne({
      userId,
      bookId: Number(bookId),
      rating: Number(rating),
      text,
      createdAt: new Date(),
      updatedAt: new Date(),
      helpfulVotes: 0,
      replies: []
    });
    const mongoId = result.insertedId.toHexString();

    const pool = await poolPromise;
    await pool.request()
      .input('UsuarioID', sql.Int,      userId)
      .input('LibroID',   sql.Int,      Number(bookId))
      .input('MongoID',   sql.Char(24), mongoId)
      .query(`
        INSERT INTO ComentariosMeta (UsuarioID, LibroID, MongoID)
        VALUES (@UsuarioID, @LibroID, @MongoID);
      `);

    res.status(201).json({ mongoId });
  } catch (err) {
    console.error('Error POST /api/comments', err);
    res.status(500).json({ error: 'No se pudo guardar el comentario' });
  }
});

// GET /api/comments/:bookId
router.get('/:bookId', auth, async (req, res) => {
  const bookId = Number(req.params.bookId);
  try {
    const pool = await poolPromise;
    const { recordset } = await pool.request()
      .input('LibroID', sql.Int, bookId)
      .query(`
        SELECT cm.MongoID, u.NombreUsuario AS usuario, cm.FechaCreacion AS fecha
          FROM ComentariosMeta cm
          JOIN Usuarios u ON u.UsuarioID = cm.UsuarioID
         WHERE cm.LibroID = @LibroID
         ORDER BY cm.FechaCreacion DESC;
      `);

    const db = await connect();
    const comments = await Promise.all(recordset.map(async row => {
      const doc = await db.collection('comments')
        .findOne({ _id: new ObjectId(row.MongoID) });
      return {
        mongoId: row.MongoID,
        usuario: row.usuario,
        fecha:   row.fecha,
        rating:  doc.rating,
        text:    doc.text,
        helpfulVotes: doc.helpfulVotes
      };
    }));

    res.json(comments);
  } catch (err) {
    console.error('Error GET /api/comments/:bookId', err);
    res.status(500).json({ error: 'No se pudieron cargar comentarios' });
  }
});

module.exports = router;
