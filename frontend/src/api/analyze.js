import { client } from './client.js';

export async function analyzeDocument(
  documentText,
  nearestArticles,
  focusArticle = null,
) {
  const response = await client.post('/analyze', {
    documentText,
    nearestArticles,
    focusArticle,
  });
  return response.data;
}
