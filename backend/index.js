const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const uploadRouter = require('./routes/upload');
const embedRouter = require('./routes/embed');
const nearestRouter = require('./routes/nearest');
const analyzeRouter = require('./routes/analyze');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const datasetPath = path.join(__dirname, 'nyt_embeddings.json');
global.nytArticles = [];

function loadArticlesIntoMemory() {
  if (!fs.existsSync(datasetPath)) {
    console.warn(
      '[Dataset] Optional nyt_embeddings.json not found; continuing without sample articles.',
    );
    return;
  }

  try {
    const raw = fs.readFileSync(datasetPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      global.nytArticles = parsed;
    } else if (parsed && Array.isArray(parsed.articles)) {
      global.nytArticles = parsed.articles;
    } else {
      throw new Error('nyt_embeddings.json must export an array of article objects.');
    }
    console.log(`[Dataset] Loaded ${global.nytArticles.length} NYT articles.`);
  } catch (error) {
    console.error('[Dataset] Failed to load nyt_embeddings.json:', error.message);
    global.nytArticles = [];
  }
}

loadArticlesIntoMemory();

app.use('/upload', uploadRouter);
app.use('/embed', embedRouter);
app.use('/nearest', nearestRouter);
app.use('/analyze', analyzeRouter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    articles: global.nytArticles.length,
  });
});

app.get('/articles', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const articles = global.nytArticles.slice(0, limit).map(({ embedding, ...rest }) => rest);
  res.json({ articles, limit, total: global.nytArticles.length });
});

app.listen(PORT, () => {
  console.log(`Research Compass backend ready at http://localhost:${PORT}`);
});
