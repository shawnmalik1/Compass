const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL =
  process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-large';
const CHAT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!apiKey) {
  console.warn(
    '[OpenAI] OPENAI_API_KEY missing – embedding/analysis routes will fail until it is set.',
  );
}

const client = new OpenAI({
  apiKey,
});

async function getEmbedding(text) {
  if (!text || !text.trim()) {
    throw new Error('text is required for embedding');
  }
  if (!apiKey) {
    throw new Error('OpenAI API key missing');
  }

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.trim(),
  });

  const vector = response?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    throw new Error('Embedding response malformed');
  }
  return vector;
}

async function askClaude(prompt, options = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error('prompt is required');
  }
  if (!apiKey) {
    throw new Error('OpenAI API key missing');
  }

  const response = await client.chat.completions.create({
    model: CHAT_MODEL,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens || 800,
    messages: [
      {
        role: 'system',
        content:
          options.systemPrompt ||
          'You are Research Compass, a meticulous research assistant who never hallucinates sources.',
      },
      {
        role: 'user',
        content: prompt.trim(),
      },
    ],
  });

  const text = response?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('OpenAI returned an empty response');
  }
  return text;
}

module.exports = {
  getEmbedding,
  askClaude,
};
