export function getGemmaEmbeddingEndpoint(): string {
  const baseUrl = process.env.GEMMA_EMBEDDING_OPENAI_BASE_URL || 'http://localhost:9379/v1'
  const url = baseUrl.replace(/\/+$/, '')
  if (url.endsWith('/embeddings')) return url
  return url.endsWith('/v1') ? `${url}/embeddings` : `${url}/v1/embeddings`
}
