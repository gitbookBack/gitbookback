// backend/routes/reviews.js
const express = require('express');
const auth    = require('../middleware/auth');
const { connect } = require('../mongoClient');
const { ObjectId } = require('mongodb');
const { syncBookStats } = require('../utils/syncBookStats');

const router = express.Router();

// POST /api/reviews
router.post('/', auth, async (req, res) => {
  const { bookId, rating, text } = req.body;
  const userId = req.user.id;

  if (!bookId || rating == null) {
    return res.status(400).json({ error: 'Falta bookId o rating' });
  }

  try {
    const db = await connect();
    await db.collection('reviews').insertOne({
      bookId:    new ObjectId(bookId),
      userId:    new ObjectId(userId),
      rating:    Number(rating),
      text:      text || '',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Sync SQL metadata
    await syncBookStats(bookId);

    res.status(201).json({ message: 'Review guardada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar review' });
  }
});

module.exports = router;
