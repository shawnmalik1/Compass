const express = require('express');
const { getEmbedding } = require('../utils/claude');

const router = express.Router();

router.post('/', async (req, res) => {
  const { text } = req.body || {};

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const embedding = await getEmbedding(text);
    res.json({ embedding });
  } catch (err) {
    console.error('[Embed] Failed to generate embedding:', err.message);
    res.status(500).json({ error: 'Failed to generate embedding' });
  }
});

module.exports = router;
