// backend/routes/social.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { connect } = require('../mongoClient');

// POST /api/social
// body: { platform, action, bookId, metadata }
router.post('/', auth, async (req, res) => {
  try {
    const db = await connect();
    const doc = {
      userId:   req.user.id,
      platform: req.body.platform,
      action:   req.body.action,
      bookId:   req.body.bookId,
      metadata: req.body.metadata || {},
      createdAt: new Date()
    };
    const { insertedId } = await db.collection('socialActivities').insertOne(doc);
    res.status(201).json({ id: insertedId });
  } catch (err) {
    console.error('Error POST /api/social', err);
    res.status(500).json({ error: 'Error al registrar actividad social' });
  }
});

module.exports = router;
