import { AiProviderSettings } from '@/dtos/ai'
import { Provider, Usage } from './provider'

export class ElevenLabsProvider implements Provider {
  private config: AiProviderSettings

  constructor(config: AiProviderSettings) {
    this.config = config
  }

  async chat(
    model: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _prompt: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _images: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    _schema?: any,
  ): Promise<{ text: string; usage: Usage }> {
    // TODO: Implement ElevenLabs chat
    return {
      text: 'elevenlabs response',
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
