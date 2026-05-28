import OpenAI from 'openai'

import { AiProviderSettings } from '@/dtos/ai'
import { Provider, Usage } from './provider'

export class OpenAiProvider implements Provider {
  private config: AiProviderSettings
  private client: OpenAI

  constructor(config: AiProviderSettings) {
    this.config = config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = {
      apiKey: config.apiKey,
    }
    if (config.baseUrl) {
      opts.baseUrl = config.baseUrl
    }
    this.client = new OpenAI(opts)
  }

  async chat(
    model: string,
    prompt: string,
    images: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema?: any,
  ): Promise<{ text: string; usage: Usage }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = []

    if (images.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentParts: any[] = [{ type: 'text', text: prompt }]
      for (const imgUrl of images) {
        contentParts.push({
          type: 'imageUrl',
          imageUrl: { url: imgUrl },
        })
      }
      messages.push({ role: 'user', content: contentParts })
    } else {
      messages.push({ role: 'user', content: prompt })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      model,
      messages,
    }

    if (schema) {
      params.response_format = {
        type: 'jsonSchema',
        jsonSchema: {
          name: 'response',
          description: 'Structured response',
          schema: schema,
          strict: true,
        },
      }
    }

    const chat = await this.client.chat.completions.create(params)

    if (chat.choices.length === 0) {
      throw new Error('No choices returned from openai')
    }

    const usage: Usage = {
      model,
      inputTokens: chat.usage?.prompt_tokens || 0,
      outputTokens: chat.usage?.completion_tokens || 0,
    }

    return { text: chat.choices[0].message.content || '', usage }
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
