import { client } from './client.js';

export async function embedText(text) {
  const response = await client.post('/embed', { text });
  return response.data;
}
