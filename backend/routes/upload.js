const express = require('express');
const multer = require('multer');
const { extractTextFromBuffer } = require('../utils/chunker');

const router = express.Router();
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB limit

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }
    cb(null, true);
  },
});

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'file is required' });
  }

  try {
    const text = await extractTextFromBuffer(req.file);
    res.json({ text });
  } catch (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Max 15MB.' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Only PDF or plain text files are allowed.' });
      }
    }
    console.error('[Upload] Failed to extract text:', err.message);
    res.status(500).json({ error: 'Unable to process file' });
  }
});

module.exports = router;
