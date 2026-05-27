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
      throw new Error(`Unsupported provider: ${providerName}`)
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
      throw new Error(`Provider implementation for ${providerName} not found`)
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
  if (!config.provider) throw new Error('embedding provider not configured')
  if (!config.model) throw new Error('embedding model not configured')

  if (!asset.mediaType) throw new Error('asset has no media type')

  const p = providerFactory(config.provider, dbProvider.config as PrismaJson.AiProviderSettings)

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

  const key = asset.storageKey?.key
  if (!key) {
    throw new Error(`asset has no key`)
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
  type: 'autofill' | 'transcription'
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
    if (params.type === 'transcription') {
      const targetKey = path.join(aiDir, 'audio.mp3')
      try {
        await s3Service.headObject(bucket, targetKey)
        return [targetKey]
      } catch {
        // Not found
      }

      const outputFile = path.join(tmpDir, 'audio.mp3')
      await transcodeService.extractAudio(params.filePath, outputFile, '16k')
      const buffer = fs.readFileSync(outputFile)
      await s3Service.putObject(bucket, targetKey, buffer, buffer.length, 'audio/mpeg')
      generatedFiles.push(targetKey)
    } else if (params.type === 'autofill') {
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
