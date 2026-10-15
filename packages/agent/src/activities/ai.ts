import { GoogleGenAI } from '@google/genai'
import { s3Service } from '@shumai/core/src/s3/s3'
import { transcodeService } from '@shumai/core'
import * as fs from 'fs'
import * as path from 'path'
import { ApplicationFailure } from '@temporalio/activity'
import { prisma } from '@shumai/db'
import sharp from 'sharp'

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

interface OpenAiEmbeddingItem {
  type?: string
  // eslint-disable-next-line @typescript-eslint/naming-convention
  image_url?: {
    url: string
  }
}

async function callGemmaEmbeddingServer(input: string | OpenAiEmbeddingItem[]): Promise<{
  embedding: number[]
  usage: Usage
}> {
  const rawBaseUrl = process.env.GEMMA_EMBEDDING_OPENAI_BASE_URL || 'http://localhost:9379/v1'

  const normalized = rawBaseUrl.replace(/\/+$/, '')
  const endpoint = normalized.endsWith('/embeddings')
    ? normalized
    : normalized.endsWith('/v1')
      ? `${normalized}/embeddings`
      : `${normalized}/v1/embeddings`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'embeddinggemma-2',
      input,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw ApplicationFailure.create({
      message: `Embedding server returned status ${response.status}: ${errorText}`,
      nonRetryable: false,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response json shape is dynamic from external endpoint
  const json: any = await response.json()
  const embedding = json.data?.[0]?.embedding
  if (!embedding || !Array.isArray(embedding)) {
    throw ApplicationFailure.create({
      message: 'Invalid embedding returned from embedding server',
      nonRetryable: false,
    })
  }

  return {
    embedding,
    usage: {
      model: json.model || 'gemma-embedding-2-openai',
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: 0,
    },
  }
}

import { textEmbeddingService } from '@shumai/core/src/search/text-embedding'

export interface GenerateTextEmbeddingParams {
  text: string
  teamId: string
}

export async function generateTextEmbeddingActivity(params: GenerateTextEmbeddingParams): Promise<{
  embedding: number[]
  usage: Usage
}> {
  const provider = process.env.EMBEDDING_PROVIDER || 'gemini-embedding-2'
  if (provider !== 'gemma-embedding-2-openai' && !process.env.GEMINI_API_KEY) {
    throw ApplicationFailure.create({
      message: 'GEMINI_API_KEY environment variable is not configured',
      nonRetryable: true,
    })
  }

  try {
    const result = await textEmbeddingService.generateEmbedding(params.text, {
      teamId: params.teamId,
      skipCache: true,
    })

    return {
      embedding: result.embedding,
      usage: {
        model: result.usage?.model || provider,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
      },
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) {
      throw err
    }
    throw ApplicationFailure.create({
      message: err instanceof Error ? err.message : String(err),
      nonRetryable: false,
    })
  }
}

export interface ExtractAiMetadataParams {
  assetKey: string
  filePath?: string
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

  let tmpDir = params.filePath ? path.dirname(params.filePath) : ''
  let cleanupTmp = false
  if (!tmpDir) {
    tmpDir = transcodeService.createTempDir('ai-meta-')
    cleanupTmp = true
  }

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

      const inputSource = params.filePath || (await s3Service.resolveInput(bucket, params.assetKey))

      const files = await transcodeService.extractVideoFrames({
        inputFile: inputSource,
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
    if (cleanupTmp && tmpDir) {
      transcodeService.removeDir(tmpDir)
    }
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
  const chunkDuration =
    Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 60.0

  const parsedOverlap = parseFloat(process.env.EMBEDDING_CHUNK_OVERLAP || '')
  const chunkOverlap = Number.isFinite(parsedOverlap) && parsedOverlap >= 0 ? parsedOverlap : 5.0
  const embeddingProvider = process.env.EMBEDDING_PROVIDER || 'gemini-embedding-2'

  return {
    agent,
    asset,
    chunkDuration,
    chunkOverlap,
    embeddingProvider,
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
    const is768 = item.embedding.length === 768

    if (item.startTime !== undefined && item.endTime !== undefined) {
      if (is768) {
        await prisma.$executeRaw`
          INSERT INTO asset_embeddings (id, asset_id, embedding_768, start_time, end_time, updated_at)
          VALUES (gen_random_uuid()::text, ${params.assetId}, ${embVec}::vector, ${item.startTime}, ${item.endTime}, NOW())
        `
      } else {
        await prisma.$executeRaw`
          INSERT INTO asset_embeddings (id, asset_id, embedding, start_time, end_time, updated_at)
          VALUES (gen_random_uuid()::text, ${params.assetId}, ${embVec}::vector, ${item.startTime}, ${item.endTime}, NOW())
        `
      }
    } else {
      if (is768) {
        await prisma.$executeRaw`
          INSERT INTO asset_embeddings (id, asset_id, embedding_768, updated_at)
          VALUES (gen_random_uuid()::text, ${params.assetId}, ${embVec}::vector, NOW())
        `
      } else {
        await prisma.$executeRaw`
          INSERT INTO asset_embeddings (id, asset_id, embedding, updated_at)
          VALUES (gen_random_uuid()::text, ${params.assetId}, ${embVec}::vector, NOW())
        `
      }
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
  const provider = process.env.EMBEDDING_PROVIDER || 'gemini-embedding-2'
  const { buffer: data } = await s3Service.getObject(
    process.env.S3_BUCKET || 'shumai',
    params.assetKey,
  )

  if (provider === 'gemma-embedding-2-openai') {
    let imgData = data
    let mimeType = params.mediaType || 'image/jpeg'
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
      imgData = await sharp(data).jpeg().toBuffer()
      mimeType = 'image/jpeg'
    }
    return callGemmaEmbeddingServer([
      {
        type: 'image_url',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        image_url: {
          url: `data:${mimeType};base64,${imgData.toString('base64')}`,
        },
      },
    ])
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

  const embVec = await generateMultimodalEmbedding(ai, data, params.mediaType)

  return {
    embedding: embVec,
    usage,
  }
}

export interface GenerateVideoChunkEmbeddingParams {
  teamId: string
  chunkKey: string
}

export async function generateVideoChunkEmbeddingActivity(
  params: GenerateVideoChunkEmbeddingParams,
): Promise<{
  embedding: number[]
  usage: Usage
}> {
  const provider = process.env.EMBEDDING_PROVIDER || 'gemini-embedding-2'
  const isGemma = provider === 'gemma-embedding-2-openai' || params.chunkKey.endsWith('.tar')

  if (isGemma) {
    const { buffer: data } = await s3Service.getObject(
      process.env.S3_BUCKET || 'shumai',
      params.chunkKey,
    )

    let filesMap: Map<string, File>
    try {
      const archive = new Bun.Archive(data)
      filesMap = await archive.files()
    } catch (err) {
      throw ApplicationFailure.create({
        message: `Failed to read chunk archive ${params.chunkKey}: ${err instanceof Error ? err.message : String(err)}`,
        nonRetryable: true,
      })
    }

    const frameFiles = Array.from(filesMap.keys())
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort()

    if (frameFiles.length === 0) {
      throw ApplicationFailure.create({
        message: `No extracted frames found in chunk archive ${params.chunkKey}`,
        nonRetryable: true,
      })
    }

    let selectedFrames = frameFiles
    if (selectedFrames.length > 16) {
      const step = (selectedFrames.length - 1) / 15
      selectedFrames = Array.from({ length: 16 }, (_, i) => selectedFrames[Math.round(i * step)])
    }

    const input: OpenAiEmbeddingItem[] = await Promise.all(
      selectedFrames.map(async (f) => {
        const file = filesMap.get(f)!
        const fileBytes = await file.bytes()
        if (fileBytes.byteLength === 0) {
          throw ApplicationFailure.create({
            message: `Extracted frame ${f} in chunk archive ${params.chunkKey} is empty (0 bytes)`,
            nonRetryable: true,
          })
        }
        return {
          type: 'image_url',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          image_url: {
            url: `data:image/jpeg;base64,${Buffer.from(fileBytes).toString('base64')}`,
          },
        }
      }),
    )

    return await callGemmaEmbeddingServer(input)
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

  try {
    const { buffer: data } = await s3Service.getObject(
      process.env.S3_BUCKET || 'shumai',
      params.chunkKey,
    )

    const embVec = await generateMultimodalEmbedding(ai, data, 'video/mp4')
    return {
      embedding: embVec,
      usage,
    }
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Failed to generate video chunk embedding for key ${params.chunkKey}: ${err instanceof Error ? err.message : String(err)}`,
      nonRetryable: false,
    })
  }
}
