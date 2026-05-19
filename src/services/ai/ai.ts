import { prisma } from '@/db'
import { AiProvider } from '@/dtos/ai'
import { s3Service } from '@/services/s3/s3'

import { exec } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'
import { ElevenLabsProvider } from './provider/elevenlabs'
import { GeminiProvider } from './provider/gemini'
import { OpenAiProvider } from './provider/openai'
import { Provider, Usage } from './provider/provider'

const execAsync = promisify(exec)

export type ProviderFactory = (
  providerName: string,
  config: PrismaJson.AiProviderSettings,
) => Provider

function defaultProviderFactory(
  providerName: string,
  config: PrismaJson.AiProviderSettings,
): Provider {
  let pKey: AiProvider
  switch (providerName) {
    case AiProvider.Google:
      pKey = AiProvider.Google
      break
    case AiProvider.OpenAi:
      pKey = AiProvider.OpenAi
      break
    case AiProvider.ElevenLabs:
      pKey = AiProvider.ElevenLabs
      break
    default:
      throw new Error(`Unsupported provider: ${providerName}`)
  }

  // Typecasting config for now to match the strict interface in providers.
  switch (pKey) {
    case AiProvider.Google:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new GeminiProvider(config as any)
    case AiProvider.OpenAi:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new OpenAiProvider(config as any)
    case AiProvider.ElevenLabs:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new ElevenLabsProvider(config as any)
    default:
      throw new Error(`Provider implementation for ${providerName} not found`)
  }
}

export class AiService {
  private providerFactory: ProviderFactory = defaultProviderFactory

  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  private async getTeam(teamId: string) {
    return this.prismaClient.team.findUnique({
      where: { id: teamId },
    })
  }

  async transcribe(teamId: string, audioBuffer: Buffer): Promise<{ text: string; usage: Usage }> {
    const t = await this.getTeam(teamId)
    if (!t) throw new Error('failed to get team')

    const agent = await this.prismaClient.agent.findFirst({
      where: {
        type: 'transcription',
        enabled: true,
        user: { teamMembers: { some: { teamId } } },
      },
    })
    if (!agent) {
      throw new Error('transcription feature is disabled or agent not found')
    }

    const config = agent.config as unknown as PrismaJson.AgentConfig
    if (!config.provider) throw new Error('transcription provider not configured')
    if (!config.model) throw new Error('transcription model not configured')

    const dbProvider = await this.prismaClient.provider.findFirst({
      where: { teamId, name: config.provider },
    })
    if (!dbProvider) throw new Error(`Provider ${config.provider} not found in database`)

    const p = this.providerFactory(
      config.provider,
      dbProvider.config as PrismaJson.AiProviderSettings,
    )

    return p.transcribe(config.model, audioBuffer)
  }

  async generateAssetEmbeddings(teamId: string, assetId: string): Promise<Usage> {
    const t = await this.getTeam(teamId)
    if (!t) throw new Error('failed to get team')

    const agent = await this.prismaClient.agent.findFirst({
      where: {
        type: 'embedding',
        enabled: true,
        user: { teamMembers: { some: { teamId } } },
      },
    })
    if (!agent) {
      throw new Error('embedding feature is disabled or agent not found')
    }

    const config = agent.config as unknown as PrismaJson.AgentConfig
    if (!config.provider) throw new Error('embedding provider not configured')
    if (!config.model) throw new Error('embedding model not configured')

    const asset = await this.prismaClient.asset.findUnique({
      where: { id: assetId },
    })

    if (!asset) throw new Error('failed to get asset')
    if (!asset.mediaType) throw new Error('asset has no media type')

    const dbProvider = await this.prismaClient.provider.findFirst({
      where: { teamId, name: config.provider },
    })
    if (!dbProvider) throw new Error(`Provider ${config.provider} not found in database`)

    const p = this.providerFactory(
      config.provider,
      dbProvider.config as PrismaJson.AiProviderSettings,
    )

    const usage: Usage = {
      model: config.model,
      inputTokens: 0,
      outputTokens: 0,
    }

    const isImage = asset.mediaType.startsWith('image/')
    const isVideo = asset.mediaType.startsWith('video/')

    if (!isImage && !isVideo) {
      throw new Error(`unsupported media type for embeddings: ${asset.mediaType}`)
    }

    if (!asset.key) {
      throw new Error(`asset has no key`)
    }

    const { buffer: data } = await s3Service.getObject(process.env.S3_BUCKET || 'shumai', asset.key)

    if (isImage) {
      const embVec = await p.generateImageEmbedding(config.model, data)

      await this.prismaClient.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding, updated_at)
        VALUES (gen_random_uuid()::text, ${asset.id}, ${embVec}::vector, NOW())
      `
    } else if (isVideo) {
      const tmpFile = path.join(os.tmpdir(), `video-${Date.now()}.mp4`)
      fs.writeFileSync(tmpFile, data)

      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tmpFile}"`,
        )
        const duration = parseFloat(stdout.trim())
        if (isNaN(duration)) throw new Error('failed to parse video duration')

        const chunkSize = 60.0
        for (let start = 0.0; start < duration; start += chunkSize) {
          let end = start + chunkSize
          if (end > duration) end = duration

          const chunkTmp = path.join(os.tmpdir(), `video-chunk-${Date.now()}.mp4`)
          await execAsync(
            `ffmpeg -y -i "${tmpFile}" -ss ${start} -t ${end - start} -c copy "${chunkTmp}"`,
          )

          const chunkData = fs.readFileSync(chunkTmp)
          fs.unlinkSync(chunkTmp)

          try {
            const embVec = await p.generateVideoEmbedding(config.model, chunkData)
            await this.prismaClient.$executeRaw`
              INSERT INTO asset_embeddings (id, asset_id, embedding, start_time, end_time, updated_at)
              VALUES (gen_random_uuid()::text, ${asset.id}, ${embVec}::vector, ${start}, ${end}, NOW())
            `
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (e: any) {
            console.error(
              `failed to generate video embedding for chunk ${start}-${end}: ${e.message}`,
            )
          }
        }
      } finally {
        fs.unlinkSync(tmpFile)
      }
    }

    return usage
  }

  async generateTextEmbeddings(teamId: string, text: string): Promise<number[]> {
    const t = await this.getTeam(teamId)
    if (!t) throw new Error('failed to get team')

    const agent = await this.prismaClient.agent.findFirst({
      where: {
        type: 'embedding',
        enabled: true,
        user: { teamMembers: { some: { teamId } } },
      },
    })
    if (!agent) {
      throw new Error('embedding feature is disabled or agent not found')
    }

    const config = agent.config as unknown as PrismaJson.AgentConfig
    if (!config.provider) throw new Error('embedding provider not configured')
    if (!config.model) throw new Error('embedding model not configured')

    const dbProvider = await this.prismaClient.provider.findFirst({
      where: { teamId, name: config.provider },
    })
    if (!dbProvider) throw new Error(`Provider ${config.provider} not found in database`)

    const p = this.providerFactory(
      config.provider,
      dbProvider.config as PrismaJson.AiProviderSettings,
    )

    return p.generateTextEmbedding(config.model, text)
  }
}

export const aiService = new AiService()
