import { client } from './client.js';

export async function analyzeDocument(documentText, nearestArticles) {
  const response = await client.post('/analyze', {
    documentText,
    nearestArticles,
  });
  return response.data;
}
