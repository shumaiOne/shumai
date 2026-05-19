import { prisma } from '@/db'
import { aiService } from '@/services/ai/ai'
import { metadataService } from '@/services/metadata/metadata'
import { UpdateAssetMetadataRequest } from '@/dtos/metadata'
import { s3Service } from '@/services/s3/s3'
import { transcodeService } from '@/transcode/transcode'
import * as path from 'path'
import * as fs from 'fs'

export async function getAssetActivity(assetId: string) {
  return prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      project: {
        include: {
          team: true,
        },
      },
    },
  })
}

export interface GenerateEmbeddingParams {
  teamId: string
  assetId: string
}

export async function generateEmbeddingActivity(params: GenerateEmbeddingParams) {
  return aiService.generateAssetEmbeddings(params.teamId, params.assetId)
}

export async function getProjectAutofillFieldsActivity(projectId: string) {
  const fields = await metadataService.listProjectFields('', projectId)
  return fields.filter((f) => f.field.aiAutofill).map((f) => f.field)
}

export interface UpdateAssetMetadataParams {
  assetId: string
  metadata: UpdateAssetMetadataRequest[]
}

export async function updateAssetMetadataActivity(params: UpdateAssetMetadataParams) {
  return metadataService.updateAssetMetadata(params.assetId, params.metadata)
}

export async function getCommentActivity(commentId: string) {
  return prisma.assetComment.findUnique({
    where: { id: commentId },
    include: { attachments: { include: { asset: true } } },
  })
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
