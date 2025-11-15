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

async function extractTextFromBuffer(file) {
  if (!file) {
    throw new Error('Missing file');
  }

  const mime = file.mimetype || '';

  if (mime === 'application/pdf') {
    const parsed = await pdfParse(file.buffer);
    return parsed.text;
  }

  return file.buffer.toString('utf-8');
}

module.exports = {
  chunkText,
  extractTextFromBuffer,
};
