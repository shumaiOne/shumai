import { GoogleGenAI } from '@google/genai'
import { s3Service } from '@/services/s3/s3'
import { transcodeService } from '@/transcode/transcode'
import { exec } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'
import { ApplicationFailure } from '@temporalio/activity'

const execAsync = promisify(exec)

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
    dbProvider: unknown
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
  const { asset, dbProvider } = params.context as any

  if (!asset.mediaType) {
    throw ApplicationFailure.create({ message: 'asset has no media type', nonRetryable: true })
  }

  const apiKey = dbProvider?.config?.apiKey
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: 'Google GenAI apiKey not found in provider config',
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
