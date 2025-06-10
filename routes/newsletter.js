// backend/routes/newsletter.js
const express = require('express');
const router  = express.Router();
const { connect } = require('../mongoClient');

// POST /api/newsletter
// body: { email, source }
router.post('/', async (req, res) => {
  try {
    const db = await connect();
    const doc = {
      email:        req.body.email,
      source:       req.body.source || 'unknown',
      subscribedAt: new Date()
    };
    await db.collection('newsletterSubscriptions')
      .updateOne({ email: doc.email }, { $setOnInsert: doc }, { upsert: true });
    res.status(200).json({ message: 'Suscrito al newsletter' });
  } catch (err) {
    console.error('Error POST /api/newsletter', err);
    res.status(500).json({ error: 'No fue posible suscribir' });
  }
});

module.exports = router;
