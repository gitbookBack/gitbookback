// backend/routes/shares.js
const express = require('express');
const auth    = require('../middleware/auth');
const { connect } = require('../mongoClient');
const { ObjectId } = require('mongodb');
const { syncBookStats } = require('../utils/syncBookStats');

const router = express.Router();

// POST /api/shares
router.post('/', auth, async (req, res) => {
  const { bookId, channel } = req.body;
  const userId = req.user.id;

  if (!bookId || !channel) {
    return res.status(400).json({ error: 'Falta bookId o channel' });
  }

  try {
    const db = await connect();
    await db.collection('shares').insertOne({
      bookId:    new ObjectId(bookId),
      userId:    new ObjectId(userId),
      channel,
      createdAt: new Date()
    });

    // Sync SQL metadata
    await syncBookStats(bookId);

    res.status(201).json({ message: 'Share registrado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar share' });
  }
});

module.exports = router;
