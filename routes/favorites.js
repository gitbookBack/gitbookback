// backend/routes/favorites.js
const express = require('express');
const auth    = require('../middleware/auth');
const { connect } = require('../mongoClient');
const { ObjectId } = require('mongodb');
const { syncBookStats } = require('../utils/syncBookStats');

const router = express.Router();

// POST /api/favorites/toggle
router.post('/toggle', auth, async (req, res) => {
  const { bookId } = req.body;
  const userId = req.user.id;
  const db = await connect();
  const oidBook = new ObjectId(bookId);
  const oidUser = new ObjectId(userId);

  try {
    const exists = await db.collection('favorites')
      .findOne({ bookId: oidBook, userId: oidUser });

    if (exists) {
      await db.collection('favorites').deleteOne({ _id: exists._id });
      await syncBookStats(bookId);
      return res.json({ favorited: false });
    }

    await db.collection('favorites').insertOne({
      bookId: oidBook,
      userId: oidUser,
      createdAt: new Date()
    });
    await syncBookStats(bookId);
    res.json({ favorited: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error toggle favorito' });
  }
});

module.exports = router;
