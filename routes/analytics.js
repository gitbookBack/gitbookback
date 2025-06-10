// backend/routes/analytics.js
const express = require('express');
const router  = express.Router();
const { connect } = require('../mongoClient');

// POST /api/analytics
// body: { event, page, meta }
router.post('/', async (req, res) => {
  try {
    const db = await connect();
    await db.collection('analytics').insertOne({
      userId:    req.user?.id || null,
      event:     req.body.event,
      page:      req.body.page,
      meta:      req.body.meta || {},
      timestamp: new Date()
    });
    res.status(201).json({ message: 'Evento registrado' });
  } catch (err) {
    console.error('Error POST /api/analytics', err);
    res.status(500).json({ error: 'Error al registrar evento' });
  }
});

module.exports = router;
