const express = require('express');
const { findNearest } = require('../utils/vector');

const router = express.Router();

router.post('/', (req, res) => {
  const { embedding, k = 20 } = req.body || {};

  if (!Array.isArray(embedding) || embedding.length === 0) {
    return res
      .status(400)
      .json({ error: 'embedding (number[]) is required to search neighbors.' });
  }

  try {
    const limit = Number(k) || 20;
    const nearest = findNearest(embedding, limit);
    res.json(nearest);
  } catch (err) {
    console.error('[Nearest] Failed to compute similarities:', err.message);
    res.status(500).json({ error: 'Failed to compute nearest neighbors' });
  }
});

module.exports = router;
