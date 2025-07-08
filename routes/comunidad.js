// routes/comunidad.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const multer  = require('multer');
const upload  = multer({ dest: './tmp' });
const { poolPromise, sql } = require('../db');
const { connect }         = require('../mongoClient');
const { subirImagen }     = require('../upload');
const { ObjectId }        = require('mongodb');

// ─── 1) Obtener feed ─────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const db    = await connect();
    const posts = await db
      .collection('comunidad')
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    // extraer userIds únicos
    const userIds = [...new Set(posts.map(p => p.userId))];
    let usersMap = {};

    if (userIds.length) {
      const pool = await poolPromise;
      // placeholders: @id0,@id1,...
      const placeholders = userIds.map((_,i)=>`@id${i}`).join(',');
      const reqSql = pool.request();
      userIds.forEach((id,i)=> reqSql.input(`id${i}`, sql.Int, id));

      const { recordset } = await reqSql.query(`
        SELECT UsuarioID, NombreUsuario, AvatarUrl
          FROM Usuarios
         WHERE UsuarioID IN (${placeholders})
      `);

      recordset.forEach(u => {
        usersMap[u.UsuarioID] = {
          nombre:    u.NombreUsuario,
          avatarUrl: u.AvatarUrl
        };
      });
    }

    const feed = posts.map(p => {
      const u = usersMap[p.userId] || {};
      return {
        _id:         p._id.toString(),
        texto:       p.texto,
        imagenUrl:   p.imageUrl || null,
        creado:      p.createdAt,
        autorNombre: u.nombre || '–',
        avatarUrl:   u.avatarUrl   || null,
        likes:       Array.isArray(p.likes)    ? p.likes.length    : 0,
        dislikes:    Array.isArray(p.dislikes) ? p.dislikes.length : 0,
        loves:       Array.isArray(p.loves)    ? p.loves.length    : 0,
        liked:       p.likes?.includes(req.user.id)    || false,
        disliked:    p.dislikes?.includes(req.user.id) || false,
        loved:       p.loves?.includes(req.user.id)    || false
      };
    });

    res.json(feed);
  } catch (err) {
    console.error('GET /api/comunidad error:', err);
    res.status(500).json({ error: 'Error cargando comunidad' });
  }
});

// ─── 2) Crear post ───────────────────────────────────────────
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.id;
    const texto  = req.body.texto || '';
    let imageUrl = null;
    if (req.file) {
      imageUrl = await subirImagen('comunidad', req.file.path);
    }

    const db = await connect();
    const doc = {
      userId,
      texto,
      imageUrl,
      likes:    [],
      dislikes: [],
      loves:    [],
      createdAt: new Date()
    };
    const result = await db.collection('comunidad').insertOne(doc);

    // devolvemos el objeto completo para render inmediato
    res.status(201).json({
      _id:         result.insertedId.toString(),
      texto:       doc.texto,
      imagenUrl:   doc.imageUrl,
      creado:      doc.createdAt,
      autorNombre: null,    // el front rellenará con GET feed
      avatarUrl:   null,
      likes:0, dislikes:0, loves:0,
      liked:false, disliked:false, loved:false
    });
  } catch (err) {
    console.error('POST /api/comunidad error:', err);
    res.status(500).json({ error: 'Error publicando' });
  }
});

// ─── 3) Reaccionar ───────────────────────────────────────────
router.post('/:id/react', auth, async (req, res) => {
  try {
    const postId = req.params.id;
    const tipo   = req.body.tipo;         // 'like'|'dislike'|'love'
    const userId = req.user.id;

    const ops = {
      like:    { $addToSet:{ likes: userId },    $pull:{ dislikes: userId, loves: userId    } },
      dislike: { $addToSet:{ dislikes: userId }, $pull:{ likes: userId,    loves: userId    } },
      love:    { $addToSet:{ loves: userId },    $pull:{ likes: userId,    dislikes: userId } }
    }[tipo];

    if (!ops) return res.status(400).json({ error: 'Tipo inválido' });

    const db = await connect();
    await db.collection('comunidad')
            .updateOne({ _id: new ObjectId(postId) }, ops);

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/comunidad/:id/react error:', err);
    res.status(500).json({ error: 'Error actualizando reacción' });
  }
});

// ─── 4) Listar comentarios ───────────────────────────────────
router.get('/:id/comentarios', auth, async (req, res) => {
  try {
    const postId = req.params.id;
    const db     = await connect();
    const comms  = await db
      .collection('comentarios')
      .find({ postId: new ObjectId(postId) })
      .sort({ createdAt: 1 })
      .toArray();

    // enriquecemos con nombre y avatar desde SQL
    const userIds = [...new Set(comms.map(c => c.userId))];
    let usersMap = {};
    if (userIds.length) {
      const pool = await poolPromise;
      const placeholders = userIds.map((_,i)=>`@id${i}`).join(',');
      const reqSql = pool.request();
      userIds.forEach((id,i)=> reqSql.input(`id${i}`, sql.Int, id));

      const { recordset } = await reqSql.query(`
        SELECT UsuarioID, NombreUsuario, AvatarUrl
          FROM Usuarios
         WHERE UsuarioID IN (${placeholders})
      `);

      recordset.forEach(u=>{
        usersMap[u.UsuarioID] = {
          nombre:    u.NombreUsuario,
          avatarUrl: u.AvatarUrl
        };
      });
    }

    const enriched = comms.map(c => {
      const u = usersMap[c.userId]||{};
      return {
        id:         c._id.toString(),
        texto:      c.texto,
        fecha:      c.createdAt,
        usuario:    u.nombre || '–',
        avatarUrl:  u.avatarUrl || null
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('GET comentarios error:', err);
    res.status(500).json({ error: 'Error cargando comentarios' });
  }
});

// ─── 5) Agregar comentario ────────────────────────────────────
router.post('/:id/comentarios', auth, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    const texto  = req.body.texto || '';
    const db     = await connect();

    const doc = {
      postId:    new ObjectId(postId),
      userId,
      texto,
      createdAt: new Date()
    };
    const result = await db.collection('comentarios').insertOne(doc);

    // enriquecemos sólo este comentario con SQL
    const pool = await poolPromise;
    const { recordset } = await pool.request()
      .input('UsuarioID', sql.Int, userId)
      .query(`
        SELECT NombreUsuario, AvatarUrl
          FROM Usuarios
         WHERE UsuarioID = @UsuarioID
      `);
    const u = recordset[0] || {};

    res.status(201).json({
      id:        result.insertedId.toString(),
      texto:     doc.texto,
      fecha:     doc.createdAt,
      usuario:   u.NombreUsuario  || '–',
      avatarUrl: u.AvatarUrl      || null
    });
  } catch (err) {
    console.error('POST comentario error:', err);
    res.status(500).json({ error: 'Error publicando comentario' });
  }
});

module.exports = router;
