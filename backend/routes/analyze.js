const express = require('express');
const { askClaude } = require('../utils/claude');

const router = express.Router();

function buildPrompt(documentText, nearestArticles = [], focusArticle) {
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

  const compareSection = focusArticle
    ? `
Focus article to compare (single NYT piece to evaluate against the user document):
ID: ${focusArticle.id || 'n/a'}
Title: ${focusArticle.headline || 'n/a'}
Section: ${
        focusArticle.section ||
        focusArticle.section_name ||
        focusArticle.sectionLabel ||
        'n/a'
      }
Summary: ${
        focusArticle.summary ||
        focusArticle.abstract ||
        focusArticle.snippet ||
        'n/a'
      }
`
    : '';

  return `
You are Research Compass, a critical research assistant.

User document:
"""
${documentText}
"""

Reference NYT articles (you MUST only cite items from this exact list):
${articleSection}
${compareSection}

Instructions:
- Provide a concise overview that summarizes the uploaded document and how it connects to the NYT coverage.
- Provide an "Explain Like I'm Five" version that captures the same idea in friendly language.
- Identify 2-3 differing viewpoints from the NYT list. For each, specify the stance (SUPPORTING, OPPOSING, NEUTRAL), a short summary, and include the IDs of the articles that represent that stance.
- ${
        focusArticle
          ? 'Emphasize how the focus article compares to the user document. Call out whether it supports, opposes, or offers a neutral perspective relative to the uploaded document.'
          : 'If the user did not select a focus article, use the provided NYT references to highlight key supporting and opposing coverage.'
      }
- Suggest 3-7 citations pulled strictly from the provided articles. Include why each is relevant.
- ABSOLUTELY DO NOT invent articles or cite anything beyond the provided references. If nothing is relevant, explicitly say so.

Respond ONLY with JSON in the following shape:
{
  "overview": "concise overview",
  "explainLikeFive": "fun, simple explanation",
  "viewpointComparison": [
    {
      "stance": "supportive/opposing/neutral",
      "summary": "50-80 word description of the stance",
      "article_ids": ["nyt-id-1", "nyt-id-2"]
    }
  ],
  "citations": [
    {"id": "nyt-...", "headline": "...", "web_url": "...", "reason": "..."}
  ]
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
    overview: fallbackSummary || 'Document overview unavailable.',
    explainLikeFive:
      'Unable to retrieve Claude analysis. Try again for a friendlier explanation.',
    viewpointComparison: [],
    citations,
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

function normalizeViewpoints(viewpoints, nearestArticles) {
  const articleMap = new Map(
    nearestArticles.map((article) => [String(article.id), article]),
  );
  return (Array.isArray(viewpoints) ? viewpoints : [])
    .map((viewpoint) => {
      const ids =
        viewpoint.article_ids ||
        viewpoint.articleIds ||
        viewpoint.articles ||
        [];
      const normalizedArticles = (Array.isArray(ids) ? ids : [])
        .map((id) => articleMap.get(String(id)))
        .filter(Boolean);
      return {
        stance: viewpoint.stance || viewpoint.label || 'Perspective',
        summary: viewpoint.summary || viewpoint.description || '',
        articles: normalizedArticles,
      };
    })
    .filter((entry) => entry.summary || entry.articles.length);
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
    overview: parsed.overview || parsed.summary || 'Overview unavailable.',
    explainLikeFive:
      parsed.explainLikeFive ||
      parsed.explainLikeImFive ||
      parsed.insights ||
      'Friendly explanation unavailable.',
    viewpointComparison: normalizeViewpoints(
      parsed.viewpointComparison,
      nearestArticles,
    ),
    citations: normalizeCitations(parsed.citations, nearestArticles),
  };
}

router.post('/', async (req, res) => {
  const { documentText, nearestArticles = [], focusArticle } = req.body || {};

  if (!documentText || !documentText.trim()) {
    return res.status(400).json({ error: 'documentText is required' });
  }

  try {
    const prompt = buildPrompt(documentText, nearestArticles, focusArticle);
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
