#!/usr/bin/env node
/**
 * Filter a massive NYT CSV export down to the N most recent rows and emit backend-ready JSON.
 *
 * Usage:
 *   node scripts/filter-nyt.js <inputCSV> <outputJSON> [limit=10000]
 *
 * Example:
 *   node scripts/filter-nyt.js backend/nyt-metadata.csv backend/nyt_embeddings.json 10000
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const INPUT_PATH = process.argv[2] || path.join(__dirname, '..', 'nyt-metadata.csv');
const OUTPUT_PATH = process.argv[3] || path.join(__dirname, '..', 'nyt_embeddings.json');
const LIMIT = Number(process.argv[4]) || 10000;

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseKeywords(raw) {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((keyword) => keyword && keyword.value ? keyword.value : keyword).filter(Boolean);
    }
  } catch {
    // ignore
  }
  return trimmed
    .split(/[,;|]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function parseEmbedding(raw, fallbackText) {
  if (!raw) {
    return generateFallbackEmbedding(fallbackText);
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return generateFallbackEmbedding(fallbackText);
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(Number).filter((value) => Number.isFinite(value));
      }
    } catch {
      // ignore and fall back to tokenized parsing below
    }
  }

  return trimmed
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function generateFallbackEmbedding(text = '') {
  const content = text.trim();
  if (!content) {
    return [];
  }

  const size = 256;
  const vector = new Array(size).fill(0);
  for (let i = 0; i < content.length; i += 1) {
    const code = content.charCodeAt(i);
    const index = code % size;
    vector[index] += (code % 13) / 13;
  }

  const magnitude = Math.sqrt(vector.reduce((acc, value) => acc + value * value, 0));
  if (!magnitude) {
    return vector;
  }
  return vector.map((value) => value / magnitude);
}

function normalizeRow(row, index) {
  const textForEmbedding =
    row.abstract ||
    row.lead_paragraph ||
    row.snippet ||
    row.headline ||
    '';

  const embedding =
    parseEmbedding(
      row.embedding || row.embeddings || row.vector || row.embedding_vector || '',
      textForEmbedding,
    );
  if (!embedding.length) {
    return null;
  }

  const keywords = parseKeywords(row.keywords || row.keyword || row.tags || '');
  const headline = row.headline || row.title || row.main_headline || '';
  const id =
    row.id ||
    row.article_id ||
    row.uri ||
    row.web_url ||
    `nyt-${row.pub_date || row.pubdate || Date.now()}-${index}`;

  return {
    id,
    headline,
    abstract: row.abstract || row.lead_paragraph || row.summary || '',
    snippet: row.snippet || row.abstract || row.summary || '',
    web_url: row.web_url || row.url || '',
    pub_date: row.pub_date || row.pubdate || row.date || '',
    section_name: row.section_name || row.section || row.news_desk || '',
    keywords,
    embedding,
  };
}

async function run() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`[filter-nyt] Input CSV not found: ${INPUT_PATH}`);
    process.exit(1);
  }

  console.log(`[filter-nyt] Starting filter for ${INPUT_PATH}`);
  console.log(`[filter-nyt] Output will be written to ${OUTPUT_PATH}`);
  console.log(`[filter-nyt] Randomly sampling ${LIMIT} rows from the entire dataset.`);

  const fileStream = fs.createReadStream(INPUT_PATH);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let headers = null;
  let totalLines = 0;
  let keptLines = 0;

  const buffer = [];
  let totalEligible = 0;

  function insertArticle(article, timestamp) {
    const record = { timestamp, article };
    totalEligible += 1;

    if (buffer.length < LIMIT) {
      buffer.push(record);
      return;
    }

    const replaceIndex = Math.floor(Math.random() * totalEligible);
    if (replaceIndex < LIMIT) {
      buffer[replaceIndex] = record;
    }
  }

  for await (const line of rl) {
    totalLines += 1;
    if (!headers) {
      headers = parseCSVLine(line);
      continue;
    }

    if (!line.trim()) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    const dateString = row.pub_date || row.pubdate || row.date || row.published_date;
    const timestamp = Date.parse(dateString) || Date.now();

    const normalized = normalizeRow(row, buffer.length);
    if (!normalized) {
      continue;
    }

    insertArticle(normalized, timestamp);
    keptLines = Math.min(totalEligible, LIMIT);

    if (totalLines % 100000 === 0) {
      console.log(
        `[filter-nyt] Processed ${totalLines.toLocaleString()} lines... eligible ${totalEligible.toLocaleString()}, kept ${keptLines.toLocaleString()} so far`,
      );
    }
  }

  const normalized = buffer
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((record) => record.article);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(normalized, null, 2));
  console.log('[filter-nyt] Writing filtered dataset to disk...');
  console.log(
    `[filter-nyt] Wrote ${normalized.length} rows (limit ${LIMIT}) to ${OUTPUT_PATH} after scanning ${totalLines.toLocaleString()} lines`,
  );
  console.log('[filter-nyt] Done.');
}

run().catch((error) => {
  console.error('[filter-nyt] Failed:', error);
  process.exit(1);
});
