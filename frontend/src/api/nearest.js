import { client } from './client.js';

export async function getNearest(embedding, k = 20) {
  const response = await client.post('/nearest', { embedding, k });
  return response.data;
}
