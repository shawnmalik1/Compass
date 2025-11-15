import { client } from './client.js';

export async function fetchArticlesMetadata(limit = 50) {
  const response = await client.get('/articles', {
    params: { limit },
  });
  const articles = Array.isArray(response.data?.articles)
    ? response.data.articles
    : [];
  return articles;
}
