const express = require('express');
const multer = require('multer');
const { extractTextFromBuffer } = require('../utils/chunker');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'file is required' });
  }

  try {
    const text = await extractTextFromBuffer(req.file);
    res.json({ text });
  } catch (err) {
    console.error('[Upload] Failed to extract text:', err.message);
    res.status(500).json({ error: 'Unable to process file' });
  }
});

module.exports = router;
