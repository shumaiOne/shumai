export interface Usage {
  inputTokens: number
  outputTokens: number
  model: string
}

export interface Provider {
  chat(
    model: string,
    prompt: string,
    images: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema?: any,
  ): Promise<{ text: string; usage: Usage }>

  transcribe(model: string, audioBuffer: Buffer): Promise<{ text: string; usage: Usage }>

  generateImageEmbedding(model: string, imageBuffer: Buffer): Promise<number[]>

  generateVideoEmbedding(model: string, videoBuffer: Buffer): Promise<number[]>

  generateTextEmbedding(model: string, text: string): Promise<number[]>
}
