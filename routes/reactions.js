// backend/routes/reactions.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { connect } = require('../mongoClient');

// POST /api/reactions
// body: { targetType, targetId, reaction }
// targetType: 'book' o 'comment'
router.post('/', auth, async (req, res) => {
  try {
    const db = await connect();
    const doc = {
      userId:    req.user.id,
      targetType: req.body.targetType,
      targetId:   req.body.targetId,
      reaction:   req.body.reaction,
      createdAt:  new Date()
    };
    const result = await db.collection('reactions').insertOne(doc);
    res.status(201).json({ id: result.insertedId });
  } catch (err) {
    console.error('Error POST /api/reactions', err);
    res.status(500).json({ error: 'Error al guardar reacción' });
  }
});

// GET /api/reactions?targetType=book&targetId=123
router.get('/', auth, async (req, res) => {
  try {
    const { targetType, targetId } = req.query;
    const db = await connect();
    const list = await db.collection('reactions')
      .find({ targetType, targetId })
      .toArray();
    // puedes devolver conteo por tipo:
    const counts = list.reduce((acc, r) => {
      acc[r.reaction] = (acc[r.reaction]||0) + 1;
      return acc;
    }, {});
    res.json({ counts, list });
  } catch (err) {
    console.error('Error GET /api/reactions', err);
    res.status(500).json({ error: 'Error al leer reacciones' });
  }
});

module.exports = router;
