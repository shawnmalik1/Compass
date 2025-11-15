export function normalizeArticle(article = {}) {
  const snippet = article.snippet || article.abstract || '';
  return {
    ...article,
    section_name: article.section_name || article.section || null,
    web_url: article.web_url || article.url || null,
    snippet,
    abstract: article.abstract || snippet || null,
    keywords: Array.isArray(article.keywords) ? article.keywords : [],
  };
}

export function normalizeArticles(list = []) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((article) => normalizeArticle(article));
}
