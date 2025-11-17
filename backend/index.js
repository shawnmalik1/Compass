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
const API_ACCESS_TOKEN = process.env.API_ACCESS_TOKEN || '';
const UPLOAD_RATE_LIMIT = Number(process.env.NODE_UPLOAD_RATE_LIMIT || 10);
const UPLOAD_RATE_WINDOW = Number(process.env.NODE_UPLOAD_RATE_WINDOW || 60); // seconds
const ANALYZE_RATE_LIMIT = Number(process.env.NODE_ANALYZE_RATE_LIMIT || 10);
const ANALYZE_RATE_WINDOW = Number(process.env.NODE_ANALYZE_RATE_WINDOW || 60);
const rateBuckets = new Map();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

function requireApiToken(req, res, next) {
  if (!API_ACCESS_TOKEN || req.path === '/health') {
    return next();
  }
  const provided = req.header('x-compass-key');
  if (provided !== API_ACCESS_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

function applyRateLimit(req, res, next) {
  const limits = [];
  if (req.path.startsWith('/upload') && UPLOAD_RATE_LIMIT > 0) {
    limits.push({
      key: 'upload',
      limit: UPLOAD_RATE_LIMIT,
      window: UPLOAD_RATE_WINDOW,
      message: 'Too many uploads. Please slow down.',
    });
  }
  if (req.path.startsWith('/analyze') && ANALYZE_RATE_LIMIT > 0) {
    limits.push({
      key: 'analyze',
      limit: ANALYZE_RATE_LIMIT,
      window: ANALYZE_RATE_WINDOW,
      message: 'Too many analyze requests. Please wait a moment.',
    });
  }
  const now = Date.now();
  for (const config of limits) {
    const bucketKey = `${config.key}:${req.ip || 'global'}`;
    const bucket = rateBuckets.get(bucketKey) || [];
    const windowStart = now - config.window * 1000;
    const recent = bucket.filter((ts) => ts >= windowStart);
    if (recent.length >= config.limit) {
      return res.status(429).json({ error: config.message });
    }
    recent.push(now);
    rateBuckets.set(bucketKey, recent);
  }
  return next();
}

app.use(requireApiToken);
app.use(applyRateLimit);

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
