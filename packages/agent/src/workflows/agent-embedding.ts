import type { WorkflowTask } from '@shumai/db'
import {
  ApplicationFailure,
  updateTaskStatusActivity,
  updateTaskUsageActivity,
} from '@shumai/workflow-core'
import { createCommentActivity, updateCommentActivity } from '../activities/agent'
import {
  deleteAssetEmbeddingsActivity,
  deleteS3ObjectActivity,
  generateImageEmbeddingActivity,
  generateVideoChunkEmbeddingActivity,
  getEmbeddingContextActivity,
  saveAssetEmbeddingsActivity,
  transcodeVideoChunkActivity,
  type ExistingAssetEmbeddingInfo,
} from '../activities/ai'

export interface GeneratedEmbedding {
  embedding: number[]
  startTime?: number
  endTime?: number
}

export type { ExistingAssetEmbeddingInfo }

export async function agentEmbeddingMedia(task: WorkflowTask): Promise<void> {
  let placeholderCommentId: string | undefined

  try {
    // Update status to processing
    await updateTaskStatusActivity({
      taskId: task.id,
      status: 'processing',
    })

    // 0. Create Placeholder Comment
    const payload = task.payload
    const placeholder = await createCommentActivity({
      assetId: task.assetId,
      message: '__EMBEDDING__',
      sessionId: payload?.agent?.sessionId || task.id,
      agentId: payload?.agent?.agentId || 'default',
    })
    placeholderCommentId = placeholder.id

    if (!task.teamId) {
      throw ApplicationFailure.create({ message: 'Task has no teamId', nonRetryable: true })
    }

    // 1. Fetch Agent Context
    const context = (await getEmbeddingContextActivity({
      teamId: task.teamId,
      assetId: task.assetId,
    })) as unknown as {
      asset: {
        id: string
        mediaType: string | null
        storageKey?: { key: string } | null
        media?: unknown
      }
      chunkDuration: number
      chunkOverlap: number
      embeddingProvider: string
      existingEmbeddings?: ExistingAssetEmbeddingInfo[]
    }

    const { asset, chunkDuration, chunkOverlap, embeddingProvider, existingEmbeddings } = context
    const isGemmaProvider = embeddingProvider === 'gemma-embedding-2-openai'

    const existing = existingEmbeddings || []

    // Purge incompatible embeddings (e.g. 1536d when Gemma is used, or 768d when Gemini is used)
    const incompatibleIds = existing
      .filter((e) => (isGemmaProvider ? e.has1536 || !e.has768 : e.has768 || !e.has1536))
      .map((e) => e.id)

    if (incompatibleIds.length > 0) {
      await deleteAssetEmbeddingsActivity({
        assetId: task.assetId,
        ids: incompatibleIds,
      })
    }

    const validExistingChunks = existing.filter((e) => !incompatibleIds.includes(e.id))

    const mediaInfo = asset.media as PrismaJson.MediaInfo | null
    const is3dWithViews =
      mediaInfo?.proxyType === '3d' && (mediaInfo.imageTranscodes?.length ?? 0) > 0
    const isImage = asset.mediaType?.startsWith('image/') || is3dWithViews
    const isVideo = asset.mediaType?.startsWith('video/')

    if (!isImage && !isVideo) {
      throw ApplicationFailure.create({
        message: `unsupported media type for embeddings: ${asset.mediaType}`,
        nonRetryable: true,
      })
    }

    // Resolve the S3 key to use for embedding (preferring transcoded version)
    let embeddingKey = asset.storageKey?.key
    let embeddingMediaType = asset.mediaType
    if (asset.media) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const media = asset.media as any
      if (isVideo) {
        if (media.videoTranscodes && media.videoTranscodes.length > 0) {
          const transcode = media.videoTranscodes[0] as PrismaJson.VideoTranscode
          if (transcode?.key) {
            embeddingKey = transcode.key
          }
        }
      } else if (isImage) {
        if (media.imageTranscodes && media.imageTranscodes.length > 0) {
          const transcode = media.imageTranscodes[0] as PrismaJson.ImageTranscode
          if (transcode?.key) {
            embeddingKey = transcode.key
            if (transcode.format) {
              embeddingMediaType = `image/${transcode.format}`
            }
          }
        }
      }
    }

    if (!embeddingKey) {
      throw ApplicationFailure.create({ message: 'asset has no key', nonRetryable: true })
    }

    const usage = {
      model: isGemmaProvider ? 'gemma-embedding-2-openai' : 'gemini-embedding-2',
      inputTokens: 0,
      outputTokens: 0,
    }

    if (isImage) {
      const alreadyEmbedded = validExistingChunks.some(
        (e) => e.startTime === null && e.endTime === null,
      )
      if (!alreadyEmbedded) {
        const result = await generateImageEmbeddingActivity({
          teamId: task.teamId,
          assetKey: embeddingKey,
          mediaType: embeddingMediaType || 'image/jpeg',
        })
        await saveAssetEmbeddingsActivity({
          assetId: task.assetId,
          embeddings: [{ embedding: result.embedding }],
        })
        if (result.usage) {
          usage.inputTokens += result.usage.inputTokens || 0
          usage.outputTokens += result.usage.outputTokens || 0
        }
      }
    } else if (isVideo) {
      // Get video duration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const duration = (asset.media as any)?.duration || 0
      const limit = chunkDuration || 60.0
      const overlap = chunkOverlap ?? 5.0
      const step = Math.max(1, limit - overlap)

      for (let start = 0.0; start < duration; start += step) {
        let end = start + limit
        if (end >= duration) {
          end = duration
        }

        // Check if this chunk is already completed
        const chunkExists = validExistingChunks.some(
          (c) =>
            c.startTime !== null &&
            c.endTime !== null &&
            Math.abs(c.startTime - start) < 0.1 &&
            Math.abs(c.endTime - end) < 0.1,
        )

        if (chunkExists) {
          // If this chunk reached the end of the video, stop
          if (end >= duration) {
            break
          }
          continue
        }

        // Step A: Slice chunk on transcode worker and upload to S3
        const chunkRes = await transcodeVideoChunkActivity({
          assetId: asset.id,
          assetKey: embeddingKey,
          startTime: start,
          endTime: end,
          format: isGemmaProvider ? 'frames' : 'video',
        })
        const { chunkKey } = chunkRes

        try {
          // Step B: Generate embedding on agent worker
          const chunkResult = await generateVideoChunkEmbeddingActivity({
            teamId: task.teamId,
            chunkKey,
          })

          // Step C: Save chunk embedding to database immediately
          await saveAssetEmbeddingsActivity({
            assetId: task.assetId,
            embeddings: [
              {
                embedding: chunkResult.embedding,
                startTime: start,
                endTime: end,
              },
            ],
          })

          if (chunkResult.usage) {
            usage.inputTokens += chunkResult.usage.inputTokens || 0
            usage.outputTokens += chunkResult.usage.outputTokens || 0
          }
        } finally {
          // Step D: Delete temporary chunk from S3
          await deleteS3ObjectActivity({
            key: chunkKey,
          })
        }

        // If this chunk reached the end of the video, stop to avoid redundant overlapping chunks
        if (end >= duration) {
          break
        }
      }
    }

    // Update Usage
    await updateTaskUsageActivity({
      taskId: task.id,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      model: usage.model,
    })

    // 7. Update Placeholder Comment
    if (placeholderCommentId) {
      await updateCommentActivity({
        commentId: placeholderCommentId,
        message: 'Embedding completed successfully.',
      })
    }

    // Update status to completed
    await updateTaskStatusActivity({
      taskId: task.id,
      status: 'completed',
    })
  } catch (err) {
    console.error(`AgentEmbeddingMedia failed for task ${task.id}:`, err)

    // Update placeholder comment with error message
    if (placeholderCommentId) {
      try {
        await updateCommentActivity({
          commentId: placeholderCommentId,
          message: `Embedding failed: ${err instanceof Error ? err.message : String(err)}`,
        })
      } catch (commentErr) {
        console.error('Failed to update error comment:', commentErr)
      }
    }

    // Update status to failed
    await updateTaskStatusActivity({
      taskId: task.id,
      status: 'failed',
      output: { error: err instanceof Error ? err.message : String(err) },
    })
    throw err
  }
}

export const agentEmbeddingWorkflow = agentEmbeddingMedia
