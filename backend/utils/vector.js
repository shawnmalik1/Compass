function dot(a, b) {
  const length = Math.min(a.length, b.length);
  let total = 0;
  for (let i = 0; i < length; i += 1) {
    total += (a[i] || 0) * (b[i] || 0);
  }
  return total;
}

function magnitude(vec) {
  let total = 0;
  for (let i = 0; i < vec.length; i += 1) {
    const value = vec[i] || 0;
    total += value * value;
  }
  return Math.sqrt(total);
}

function cosineSimilarity(a = [], b = []) {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (!magA || !magB) {
    return 0;
  }
  return dot(a, b) / (magA * magB);
}

function findNearest(embedding = [], limit = 20) {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('embedding array is required');
  }

  const dataset = Array.isArray(global.nytArticles) ? global.nytArticles : [];
  if (!dataset.length) {
    return [];
  }

  return dataset
    .filter((article) => Array.isArray(article.embedding))
    .map((article) => {
      const score = cosineSimilarity(embedding, article.embedding);
      const { embedding: _ignored, ...metadata } = article;
      return {
        ...metadata,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = {
  cosineSimilarity,
  findNearest,
};
