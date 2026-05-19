import { describe, expect, it, vi, beforeEach } from 'vitest'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { aiService } from './ai'

const mockProviderConfig: PrismaJson.ProviderConfig = {
  api: 'openai-completions',
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'test-key',
}

const mockModelConfig: PrismaJson.ModelConfig = {
  reasoning: false,
  input: ['text'],
  contextWindow: 1000,
  maxTokens: 1000,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
}

describe('AiService', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('transcribes', async () => {
    // Transcribe still uses provider factory
    const mockTranscribe = vi.fn().mockResolvedValue({
      text: 'mock transcription',
      usage: { model: 'whisper', inputTokens: 0, outputTokens: 0 },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(aiService as any).providerFactory = () => ({
      transcribe: mockTranscribe,
    })

    const team = await prisma.team.create({
      data: {
        name: 'Transcribe Team',
      },
    })

    const provider = await prisma.provider.create({
      data: {
        name: 'openai',
        teamId: team.id,
        config: mockProviderConfig,
      },
    })

    const model = await prisma.model.create({
      data: {
        modelId: 'whisper',
        name: 'Whisper',
        providerId: provider.id,
        config: mockModelConfig,
      },
    })

    await prisma.user.create({
      data: {
        name: 'Transcriber',
        email: `transcriber-${Date.now()}@shumai.ai`,
        type: 'agent',
        agent: {
          create: {
            type: 'transcription',
            enabled: true,
            providerId: provider.id,
            modelId: model.id,
            config: {
              provider: 'openai',
              model: 'whisper',
            },
          },
        },
        teamMembers: {
          create: {
            teamId: team.id,
            role: 'reviewer',
          },
        },
      },
    })

    const resp = await aiService.transcribe(team.id, Buffer.from(''))
    expect(resp.text).toBe('mock transcription')
    expect(mockTranscribe).toHaveBeenCalled()
  })
})
