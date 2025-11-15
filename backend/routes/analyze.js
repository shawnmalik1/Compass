const express = require('express');
const { askClaude } = require('../utils/claude');

const router = express.Router();

function buildPrompt(documentText, nearestArticles = []) {
  const articleSection = nearestArticles
    .map((article, index) => {
      const keywords = Array.isArray(article.keywords)
        ? article.keywords.join(', ')
        : 'N/A';
      return `[#${index + 1}] id: ${article.id}
Headline: ${article.headline}
Abstract: ${article.abstract || article.snippet || ''}
URL: ${article.web_url}
Published: ${article.pub_date || 'Unknown'}
Section: ${article.section_name || 'N/A'}
Keywords: ${keywords}
SimilarityScore: ${typeof article.score === 'number' ? article.score.toFixed(3) : 'n/a'}`;
    })
    .join('\n\n');

  return `
You are Research Compass, a critical research assistant.

User document:
"""
${documentText}
"""

Reference NYT articles (you MUST only cite items from this exact list):
${articleSection}

Instructions:
- Summarize the document in a few sentences.
- Connect the document to the NYT articles with 2-3 bullet insights.
- Suggest 3-7 citations pulled strictly from the provided articles. Include why each is relevant.
- Call out 2-3 opposing or complementary views from the articles to help the user balance perspectives.
- ABSOLUTELY DO NOT invent articles or cite anything beyond the provided references. If nothing is relevant, explicitly say so.

Respond ONLY with JSON in the following shape:
{
  "summary": "concise summary",
  "insights": "bullet or paragraph level insights",
  "citations": [
    {"id": "nyt-...", "headline": "...", "web_url": "...", "reason": "..."}
  ],
  "opposingViews": "text highlighting counter-points"
}
`;
}

function fallbackAnalysis(documentText, nearestArticles = []) {
  const intro = documentText.split(/[\n\.]/).filter((chunk) => chunk.trim());
  const fallbackSummary = intro.slice(0, 2).join('. ');
  const citations = nearestArticles.slice(0, 3).map((article) => ({
    id: article.id,
    headline: article.headline,
    web_url: article.web_url,
    reason: 'High similarity match to the uploaded document',
  }));

  return {
    summary: fallbackSummary || 'Document summary unavailable.',
    insights:
      'Unable to retrieve Claude analysis. Listed citations are the closest NYT matches to the uploaded document.',
    citations,
    opposingViews:
      'Review the cited NYT articles for varying perspectives; re-run analysis once Claude is reachable.',
  };
}

function normalizeCitations(citations, nearestArticles) {
  const map = new Map(nearestArticles.map((article) => [article.id, article]));
  return (Array.isArray(citations) ? citations : [])
    .map((citation) => {
      const source = map.get(citation.id);
      if (!source) {
        return null;
      }
      return {
        id: source.id,
        headline: citation.headline || source.headline,
        web_url: citation.web_url || source.web_url,
        reason:
          citation.reason ||
          'Relevant reference selected by Claude analysis.',
      };
    })
    .filter(Boolean)
    .slice(0, 7);
}

function parseAnalysis(raw, nearestArticles) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Claude response missing JSON payload');
  }

  const jsonSegment = raw.slice(start, end + 1);
  const parsed = JSON.parse(jsonSegment);
  return {
    summary: parsed.summary || 'Summary unavailable.',
    insights: parsed.insights || 'Insights unavailable.',
    citations: normalizeCitations(parsed.citations, nearestArticles),
    opposingViews: parsed.opposingViews || 'Opposing views unavailable.',
  };
}

router.post('/', async (req, res) => {
  const { documentText, nearestArticles = [] } = req.body || {};

  if (!documentText || !documentText.trim()) {
    return res.status(400).json({ error: 'documentText is required' });
  }

  try {
    const prompt = buildPrompt(documentText, nearestArticles);
    const response = await askClaude(prompt, { maxTokens: 1200 });
    const analysis = parseAnalysis(response, nearestArticles);
    res.json(analysis);
  } catch (err) {
    console.error('[Analyze] Falling back due to:', err.message);
    const fallback = fallbackAnalysis(documentText, nearestArticles);
    res.status(200).json({ ...fallback, fallback: true });
  }
});

module.exports = router;
