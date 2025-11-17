const pdfParse = require('pdf-parse');

function chunkText(text, options = {}) {
  const size = options.chunkSize || 800;
  const overlap = options.overlap || 100;
  if (!text) {
    return [];
  }

  const chunks = [];
  let index = 0;
  while (index < text.length) {
    const chunk = text.slice(index, index + size);
    chunks.push(chunk.trim());
    index += size - overlap;
  }
  return chunks.filter(Boolean);
}

function stripBinary(text = '') {
  return text.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function extractTextFromBuffer(file) {
  if (!file) {
    throw new Error('Missing file');
  }

  const mime = file.mimetype || '';

  if (mime === 'application/pdf') {
    try {
      const parsed = await pdfParse(file.buffer);
      if (parsed?.text?.trim()) {
        return parsed.text;
      }
    } catch (err) {
      console.warn('[Upload] Falling back to raw PDF text extraction:', err.message);
    }
    return stripBinary(file.buffer.toString('latin1'));
  }

  return file.buffer.toString('utf-8');
}

module.exports = {
  chunkText,
  extractTextFromBuffer,
  stripBinary,
};
