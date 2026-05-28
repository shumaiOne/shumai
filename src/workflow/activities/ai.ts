import { ElevenLabsProvider } from '@/services/ai/provider/elevenlabs'
import { GeminiProvider } from '@/services/ai/provider/gemini'
import { OpenAiProvider } from '@/services/ai/provider/openai'
import { Provider, Usage } from '@/services/ai/provider/provider'
import { AiProvider } from '@/dtos/ai'
import { s3Service } from '@/services/s3/s3'
import { transcodeService } from '@/transcode/transcode'
import { exec } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'
import { ApplicationFailure } from '@temporalio/activity'

const execAsync = promisify(exec)

function providerFactory(providerName: string, config: PrismaJson.AiProviderSettings): Provider {
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
      throw ApplicationFailure.create({
        message: `Unsupported provider: ${providerName}`,
        nonRetryable: true,
      })
  }

  switch (pKey) {
    case AiProvider.Google:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider config requires a broad casting since it is a JSON property of the provider model
      return new GeminiProvider(config as any)
    case AiProvider.OpenAi:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider config requires a broad casting since it is a JSON property of the provider model
      return new OpenAiProvider(config as any)
    case AiProvider.ElevenLabs:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider config requires a broad casting since it is a JSON property of the provider model
      return new ElevenLabsProvider(config as any)
    default:
      throw ApplicationFailure.create({
        message: `Provider implementation for ${providerName} not found`,
        nonRetryable: true,
      })
  }
}

export interface GeneratedEmbedding {
  embedding: number[]
  startTime?: number
  endTime?: number
}

export interface GenerateEmbeddingParams {
  teamId: string
  assetId: string
  context: {
    agent: unknown
    asset: unknown
    dbProvider: unknown
  }
}

export async function generateEmbeddingActivity(params: GenerateEmbeddingParams): Promise<{
  embeddings: GeneratedEmbedding[]
  usage: Usage
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- context properties are fetched as JSON from the DB activity
  const { agent, asset, dbProvider } = params.context as any

  const config = agent.config as unknown as PrismaJson.AgentConfig
  if (!config.provider) {
    throw ApplicationFailure.create({
      message: 'embedding provider not configured',
      nonRetryable: true,
    })
  }
  if (!config.model) {
    throw ApplicationFailure.create({
      message: 'embedding model not configured',
      nonRetryable: true,
    })
  }

  if (!asset.mediaType) {
    throw ApplicationFailure.create({ message: 'asset has no media type', nonRetryable: true })
  }

  const p = providerFactory(config.provider, dbProvider.config as PrismaJson.AiProviderSettings)

  const usage: Usage = {
    model: config.model,
    inputTokens: 0,
    outputTokens: 0,
  }

  const isImage = asset.mediaType.startsWith('image/')
  const isVideo = asset.mediaType.startsWith('video/')

  if (!isImage && !isVideo) {
    throw ApplicationFailure.create({
      message: `unsupported media type for embeddings: ${asset.mediaType}`,
      nonRetryable: true,
    })
  }

  const key = asset.storageKey?.key
  if (!key) {
    throw ApplicationFailure.create({ message: 'asset has no key', nonRetryable: true })
  }

  const { buffer: data } = await s3Service.getObject(process.env.S3_BUCKET || 'shumai', key)

  const results: GeneratedEmbedding[] = []

  if (isImage) {
    const embVec = await p.generateImageEmbedding(config.model, data)
    results.push({ embedding: embVec })
  } else if (isVideo) {
    const tmpFile = path.join(os.tmpdir(), `video-${Date.now()}.mp4`)
    fs.writeFileSync(tmpFile, data)

    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tmpFile}"`,
      )
      const duration = parseFloat(stdout.trim())
      if (isNaN(duration)) {
        throw ApplicationFailure.create({
          message: 'failed to parse video duration',
          nonRetryable: true,
        })
      }

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
          results.push({ embedding: embVec, startTime: start, endTime: end })
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

  return {
    embeddings: results,
    usage,
  }
}

export interface ExtractAiMetadataParams {
  assetKey: string
  filePath: string
  type: 'autofill'
  isImage: boolean
}

export async function extractAiMetadataActivity(
  params: ExtractAiMetadataParams,
): Promise<string[]> {
  const bucket = process.env.S3_BUCKET || 'shumai'
  const assetDir = path.dirname(params.assetKey)
  const aiDir = path.join(assetDir, 'ai_metadata')
  const generatedFiles: string[] = []

  const tmpDir = path.dirname(params.filePath)

  try {
    if (params.type === 'autofill') {
      const targetKey = path.join(aiDir, '1.webp')
      try {
        await s3Service.headObject(bucket, targetKey)
        const keys = await s3Service.listObjects(bucket, aiDir)
        return keys.filter((k) => k.toLowerCase().endsWith('.webp'))
      } catch {
        // Not found
      }

      const files = await transcodeService.extractVideoFrames({
        inputFile: params.filePath,
        outputDir: tmpDir,
        numFrames: 30,
        frameHeight: 720,
        isImage: params.isImage,
      })

      for (const file of files) {
        const name = path.basename(file)
        const buffer = fs.readFileSync(file)
        const key = path.join(aiDir, name)
        await s3Service.putObject(bucket, key, buffer, buffer.length, 'image/webp')
        generatedFiles.push(key)
      }
    }
  } finally {
    // Files are in tmpDir which will be cleaned up by cleanupTmpDirActivity
  }

  return generatedFiles
}
