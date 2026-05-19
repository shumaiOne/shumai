import { GoogleGenAI } from '@google/genai'
import { AiProviderSettings } from '@/dtos/ai'
import { Provider, Usage } from './provider'

export class GeminiProvider implements Provider {
  private config: AiProviderSettings
  private client: GoogleGenAI

  constructor(config: AiProviderSettings) {
    this.config = config
    this.client = new GoogleGenAI({
      apiKey: config.apiKey,
    })
  }

  private async downloadImage(url: string): Promise<{ data: Buffer; contentType: string }> {
    const resp = await fetch(url)
    if (!resp.ok) {
      throw new Error(`Failed to download image, status: ${resp.status}`)
    }
    const arrayBuffer = await resp.arrayBuffer()
    const contentType = resp.headers.get('content-type') || 'image/jpeg'
    return { data: Buffer.from(arrayBuffer), contentType }
  }

  async chat(
    model: string,
    prompt: string,
    images: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema?: any,
  ): Promise<{ text: string; usage: Usage }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = []

    for (const imgUrl of images) {
      const { data, contentType } = await this.downloadImage(imgUrl)
      parts.push({
        inlineData: {
          data: data.toString('base64'),
          mimeType: contentType,
        },
      })
    }
    parts.push({ text: prompt })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {}

    if (schema) {
      config.responseMimeType = 'application/json'
      config.responseSchema = schema
    }

    const result = await this.client.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config,
    })

    const usage: Usage = { model, inputTokens: 0, outputTokens: 0 }
    if (result.usageMetadata) {
      usage.inputTokens = result.usageMetadata.promptTokenCount || 0
      usage.outputTokens = result.usageMetadata.candidatesTokenCount || 0
    }

    return { text: result.text || '', usage }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(model: string, _audioBuffer: Buffer): Promise<{ text: string; usage: Usage }> {
    // TODO: Implement Gemini transcribe
    return {
      text: 'gemini transcription',
      usage: { model, inputTokens: 0, outputTokens: 0 },
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateImageEmbedding(_model: string, _imageBuffer: Buffer): Promise<number[]> {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateVideoEmbedding(_model: string, _videoBuffer: Buffer): Promise<number[]> {
    throw new Error('Not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateTextEmbedding(_model: string, _text: string): Promise<number[]> {
    throw new Error('Not implemented')
  }
}
