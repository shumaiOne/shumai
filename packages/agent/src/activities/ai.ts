import { GoogleGenAI } from '@google/genai'
import { s3Service } from '@shumai/core/src/s3/s3'
import { transcodeService } from '@shumai/core'
import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'
import { ApplicationFailure } from '@temporalio/activity'
import { prisma } from '@shumai/db'

const execFileAsync = promisify(execFile)

export interface Usage {
  inputTokens: number
  outputTokens: number
  model: string
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
  }
}

async function generateMultimodalEmbedding(
  ai: GoogleGenAI,
  buffer: Buffer,
  mimeType: string,
): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: [
      {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType,
        },
      },
    ],
    config: {
      outputDimensionality: 1536,
    },
  })

  const values = response.embeddings?.[0]?.values
  if (!values) {
    throw new Error('No embedding values returned from gemini-embedding-2')
  }

  return values
}

export async function generateEmbeddingActivity(params: GenerateEmbeddingParams): Promise<{
  embeddings: GeneratedEmbedding[]
  usage: Usage
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- context properties are fetched as JSON from the DB activity
  const { asset } = params.context as any

  if (!asset.mediaType) {
    throw ApplicationFailure.create({ message: 'asset has no media type', nonRetryable: true })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: 'GEMINI_API_KEY environment variable is not configured',
      nonRetryable: true,
    })
  }

  const resolvedApiKey = process.env[apiKey] || apiKey
  const ai = new GoogleGenAI({ apiKey: resolvedApiKey })

  const usage: Usage = {
    model: 'gemini-embedding-2',
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
    const embVec = await generateMultimodalEmbedding(ai, data, asset.mediaType)
    results.push({ embedding: embVec })
  } else if (isVideo) {
    const tmpFile = path.join(os.tmpdir(), `video-${Date.now()}.mp4`)
    fs.writeFileSync(tmpFile, data)

    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        tmpFile,
      ])
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
        await execFileAsync('ffmpeg', [
          '-y',
          '-i',
          tmpFile,
          '-ss',
          start.toString(),
          '-t',
          (end - start).toString(),
          '-c',
          'copy',
          chunkTmp,
        ])

        const chunkData = fs.readFileSync(chunkTmp)
        fs.unlinkSync(chunkTmp)

        try {
          const embVec = await generateMultimodalEmbedding(ai, chunkData, 'video/mp4')
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

export interface GenerateTextEmbeddingParams {
  text: string
  teamId: string
}

export async function generateTextEmbeddingActivity(params: GenerateTextEmbeddingParams): Promise<{
  embedding: number[]
  usage: Usage
}> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: 'GEMINI_API_KEY environment variable is not configured',
      nonRetryable: true,
    })
  }

  const resolvedApiKey = process.env[apiKey] || apiKey
  const ai = new GoogleGenAI({ apiKey: resolvedApiKey })

  const usage: Usage = {
    model: 'gemini-embedding-2',
    inputTokens: 0,
    outputTokens: 0,
  }

  const response = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: [
      {
        parts: [{ text: params.text }],
        role: 'user',
      },
    ],
    config: {
      outputDimensionality: 1536,
    },
  })

  const values = response.embeddings?.[0]?.values
  if (!values) {
    throw new Error('No embedding values returned from gemini-embedding-2')
  }

  return {
    embedding: values,
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

export async function getEmbeddingContextActivity(params: { teamId: string; assetId: string }) {
  const team = await prisma.team.findUnique({
    where: { id: params.teamId },
  })
  if (!team) {
    throw ApplicationFailure.create({ message: 'failed to get team', nonRetryable: true })
  }

  const agent = await prisma.agent.findFirst({
    where: {
      type: 'embedding',
      enabled: true,
      user: { teamMembers: { some: { teamId: params.teamId } } },
    },
  })
  if (!agent) {
    throw ApplicationFailure.create({
      message: 'embedding feature is disabled or agent not found',
      nonRetryable: true,
    })
  }

  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    include: { storageKey: true },
  })
  if (!asset) {
    throw ApplicationFailure.create({ message: 'failed to get asset', nonRetryable: true })
  }
  if (!asset.mediaType) {
    throw ApplicationFailure.create({ message: 'asset has no media type', nonRetryable: true })
  }

  const parsedDuration = parseFloat(process.env.EMBEDDING_CHUNK_DURATION || '')
  const chunkDuration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 60.0

  return {
    agent,
    asset,
    chunkDuration,
  }
}

export async function saveAssetEmbeddingsActivity(params: {
  assetId: string
  embeddings: Array<{
    embedding: number[]
    startTime?: number
    endTime?: number
  }>
}) {
  for (const item of params.embeddings) {
    const embVec = JSON.stringify(item.embedding)
    if (item.startTime !== undefined && item.endTime !== undefined) {
      await prisma.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding, start_time, end_time, updated_at)
        VALUES (gen_random_uuid()::text, ${params.assetId}, ${embVec}::vector, ${item.startTime}, ${item.endTime}, NOW())
      `
    } else {
      await prisma.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding, updated_at)
        VALUES (gen_random_uuid()::text, ${params.assetId}, ${embVec}::vector, NOW())
      `
    }
  }
}

export interface GenerateImageEmbeddingParams {
  teamId: string
  assetKey: string
  mediaType: string
}

export async function generateImageEmbeddingActivity(
  params: GenerateImageEmbeddingParams,
): Promise<{
  embedding: number[]
  usage: Usage
}> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: 'GEMINI_API_KEY environment variable is not configured',
      nonRetryable: true,
    })
  }

  const resolvedApiKey = process.env[apiKey] || apiKey
  const ai = new GoogleGenAI({ apiKey: resolvedApiKey })

  const usage: Usage = {
    model: 'gemini-embedding-2',
    inputTokens: 0,
    outputTokens: 0,
  }

  const { buffer: data } = await s3Service.getObject(
    process.env.S3_BUCKET || 'shumai',
    params.assetKey,
  )
  const embVec = await generateMultimodalEmbedding(ai, data, params.mediaType)

  return {
    embedding: embVec,
    usage,
  }
}

export interface GenerateVideoChunkEmbeddingParams {
  teamId: string
  assetKey: string
  startTime: number
  endTime: number
}

export async function generateVideoChunkEmbeddingActivity(
  params: GenerateVideoChunkEmbeddingParams,
): Promise<{
  embedding: number[]
  usage: Usage
}> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: 'GEMINI_API_KEY environment variable is not configured',
      nonRetryable: true,
    })
  }

  const resolvedApiKey = process.env[apiKey] || apiKey
  const ai = new GoogleGenAI({ apiKey: resolvedApiKey })

  const usage: Usage = {
    model: 'gemini-embedding-2',
    inputTokens: 0,
    outputTokens: 0,
  }

  const { buffer: data } = await s3Service.getObject(
    process.env.S3_BUCKET || 'shumai',
    params.assetKey,
  )

  const tmpFile = path.join(os.tmpdir(), `video-chunk-source-${Date.now()}.mp4`)
  fs.writeFileSync(tmpFile, data)

  const chunkTmp = path.join(os.tmpdir(), `video-chunk-${Date.now()}.mp4`)
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      tmpFile,
      '-ss',
      params.startTime.toString(),
      '-t',
      (params.endTime - params.startTime).toString(),
      '-c',
      'copy',
      chunkTmp,
    ])

    const chunkData = fs.readFileSync(chunkTmp)
    fs.unlinkSync(chunkTmp)

    const embVec = await generateMultimodalEmbedding(ai, chunkData, 'video/mp4')
    return {
      embedding: embVec,
      usage,
    }
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Failed to generate video chunk embedding for ${params.startTime}-${params.endTime}: ${err instanceof Error ? err.message : String(err)}`,
      nonRetryable: false,
    })
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
    if (fs.existsSync(chunkTmp)) fs.unlinkSync(chunkTmp)
  }
}
