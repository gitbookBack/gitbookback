// routes/comments.js
const express       = require('express');
const auth          = require('../middleware/auth');
const { connect }   = require('../mongoClient');
const { poolPromise, sql } = require('../db');
const { ObjectId }  = require('mongodb');

const router = express.Router();

// Todas las rutas requieren estar autenticado
router.use(auth);

/**
 * POST /api/comments
 * Crear comentario o reply
 */
router.post('/', async (req, res) => {
  const { bookId, rating, text, parentCommentId } = req.body;
  const userId = Number(req.user.id);
  if (!bookId || !text) {
    return res.status(400).json({ error: 'Faltan bookId o text' });
  }
  try {
    const db = await connect();
    const doc = {
      bookId:          Number(bookId),
      userId,
      rating:          rating != null ? Number(rating) : 0,
      text,
      likes:           [],
      dislikes:        [],
      parentCommentId: parentCommentId || null,
      createdAt:       new Date(),
      updatedAt:       new Date()
    };
    const { insertedId } = await db.collection('comments').insertOne(doc);
    const mongoId = insertedId.toHexString();

    // Guardamos el mapping en SQL
    const pool = await poolPromise;
    await pool.request()
      .input('UsuarioID', sql.Int,    userId)
      .input('LibroID',   sql.Int,    Number(bookId))
      .input('MongoID',   sql.Char(24), mongoId)
      .query(`
        INSERT INTO ComentariosMeta (UsuarioID, LibroID, MongoID)
        VALUES (@UsuarioID, @LibroID, @MongoID);
      `);

    res.status(201).json({ id: mongoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo crear el comentario' });
  }
});

/**
 * GET /api/comments/:bookId
 * Leer todos los comentarios con sus replies anidadas
 */
router.get('/:bookId', async (req, res) => {
  const bookIdNum = Number(req.params.bookId);
  if (isNaN(bookIdNum)) {
    return res.status(400).json({ error: 'bookId inválido' });
  }

  try {
    // 1) Traer mapeos de SQL
    const pool = await poolPromise;
    const { recordset } = await pool.request()
      .input('LibroID', sql.Int, bookIdNum)
      .query(`
        SELECT cm.MongoID, u.NombreUsuario AS usuario,u.AvatarUrl AS avatarUrl
          FROM ComentariosMeta cm
          JOIN Usuarios u ON u.UsuarioID = cm.UsuarioID
         WHERE cm.LibroID = @LibroID;
      `);

    // 2) Cargar docs de Mongo y mapear
    const db  = await connect();
    const raw = await Promise.all(recordset.map(async row => {
      const doc = await db.collection('comments')
        .findOne({ _id: new ObjectId(row.MongoID) });
      if (!doc) return null;

      return {
        id:               row.MongoID,
        usuario:          row.usuario,
         avatarUrl:        row.avatarUrl, 
        rating:           doc.rating        ?? 0,
        text:             doc.text          ?? '',
        likesCount:       Array.isArray(doc.likes)    ? doc.likes.length    : 0,
        dislikesCount:    Array.isArray(doc.dislikes) ? doc.dislikes.length : 0,
        // parentCommentId como string (o null)
        parentCommentId:  doc.parentCommentId
                             ? doc.parentCommentId.toString()
                             : null,
        createdAt:        doc.createdAt,
        updatedAt:        doc.updatedAt
      };
    }));

    // 3) Filtrar nulos y construir árbol
    const filtered = raw.filter(c => c !== null);
    const mapObj = {};
    filtered.forEach(c => {
      mapObj[c.id] = { ...c, replies: [] };
    });

    const roots = [];
    filtered.forEach(c => {
      if (c.parentCommentId && mapObj[c.parentCommentId]) {
        mapObj[c.parentCommentId].replies.push(mapObj[c.id]);
      } else {
        roots.push(mapObj[c.id]);
      }
    });

    // 4) Ordenar por createdAt descendente
    const sortByDate = (a, b) => b.createdAt - a.createdAt;
    roots.sort(sortByDate);
    roots.forEach(r => r.replies.sort(sortByDate));

    res.json(roots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudieron cargar los comentarios' });
  }
});

/**
 * PUT /api/comments/:id
 * Editar texto y rating de un comentario
 */
router.put('/:id', async (req, res) => {
  const commentId = req.params.id;
  const { text, rating } = req.body;
  if (!text && rating == null) {
    return res.status(400).json({ error: 'Nada para actualizar' });
  }
  try {
    const db = await connect();
    const updates = { updatedAt: new Date() };
    if (text    != null) updates.text   = text;
    if (rating  != null) updates.rating = Number(rating);

    await db.collection('comments')
      .updateOne({ _id: new ObjectId(commentId) }, { $set: updates });

    res.json({ message: 'Comentario actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar comentario' });
  }
});

/**
 * DELETE /api/comments/:id
 * Eliminar comentario y su mapping SQL
 */
router.delete('/:id', async (req, res) => {
  const commentId = req.params.id;
  try {
    const db  = await connect();
    const oid = new ObjectId(commentId);

    // 1) Borrar de Mongo
    await db.collection('comments').deleteOne({ _id: oid });

    // 2) Borrar mapping en SQL
    const pool = await poolPromise;
    await pool.request()
      .input('MongoID', sql.Char(24), commentId)
      .query(`DELETE FROM ComentariosMeta WHERE MongoID = @MongoID;`);

    res.json({ message: 'Comentario eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar comentario' });
  }
});

/**
 * POST /api/comments/:id/like    Alterna like
 */
router.post('/:id/like', async (req, res) => {
  const commentId = req.params.id;
  const userId    = Number(req.user.id);
  try {
    const db  = await connect();
    const oid = new ObjectId(commentId);
    const c   = await db.collection('comments').findOne({ _id: oid });
    const has = Array.isArray(c.likes) && c.likes.includes(userId);

    await db.collection('comments').updateOne(
      { _id: oid },
      has
        ? { $pull: { likes: userId } }
        : { $addToSet: { likes: userId }, $pull: { dislikes: userId } }
    );
    const upd = await db.collection('comments').findOne({ _id: oid });
    res.json({ likes: upd.likes.length, dislikes: upd.dislikes.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error alternando like' });
  }
});

/**
 * POST /api/comments/:id/dislike Alterna dislike
 */
router.post('/:id/dislike', async (req, res) => {
  const commentId = req.params.id;
  const userId    = Number(req.user.id);
  try {
    const db  = await connect();
    const oid = new ObjectId(commentId);
    const c   = await db.collection('comments').findOne({ _id: oid });
    const has = Array.isArray(c.dislikes) && c.dislikes.includes(userId);

    await db.collection('comments').updateOne(
      { _id: oid },
      has
        ? { $pull: { dislikes: userId } }
        : { $addToSet: { dislikes: userId }, $pull: { likes: userId } }
    );
    const upd = await db.collection('comments').findOne({ _id: oid });
    res.json({ likes: upd.likes.length, dislikes: upd.dislikes.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error alternando dislike' });
  }
});

module.exports = router;
