// backend/routes/searchHistory.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { connect } = require('../mongoClient');

// POST /api/search-history
// body: { term }
router.post('/', auth, async (req, res) => {
  try {
    const db = await connect();
    await db.collection('searchHistory').insertOne({
      userId:     req.user.id,
      term:       req.body.term,
      searchedAt: new Date()
    });
    res.status(201).json({ message: 'Historial registrado' });
  } catch (err) {
    console.error('Error POST /api/search-history', err);
    res.status(500).json({ error: 'Error al guardar búsqueda' });
  }
});

module.exports = router;
