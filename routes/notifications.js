// backend/routes/notifications.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { connect } = require('../mongoClient');

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  try {
    const db = await connect();
    const notes = await db.collection('notifications')
      .find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(notes);
  } catch (err) {
    console.error('Error GET /api/notifications', err);
    res.status(500).json({ error: 'Error al leer notificaciones' });
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', auth, async (req, res) => {
  try {
    const db = await connect();
    await db.collection('notifications')
      .updateOne(
        { _id: new ObjectId(req.params.id), userId: req.user.id },
        { $set: { read: true } }
      );
    res.json({ message: 'Notificación marcada como leída' });
  } catch (err) {
    console.error('Error POST /api/notifications/:id/read', err);
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
});

module.exports = router;
