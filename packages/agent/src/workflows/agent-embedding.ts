import { ApplicationFailure } from '@temporalio/workflow'
import type { WorkflowTask } from '@shumai/db'
import { getActivities, executeActivity, TaskQueueAgent } from '@shumai/workflow-core'

export interface GeneratedEmbedding {
  embedding: number[]
  startTime?: number
  endTime?: number
}

export async function agentEmbeddingMedia(task: WorkflowTask): Promise<void> {
  const {
    updateTaskStatusActivity,
    getEmbeddingContextActivity,
    generateImageEmbeddingActivity,
    generateVideoChunkEmbeddingActivity,
    saveAssetEmbeddingsActivity,
    updateTaskUsageActivity,
    createCommentActivity,
    updateCommentActivity,
    getAgentWorkerQueueActivity,
  } = getActivities()

  let placeholderCommentId: string | undefined
  let agentWorkerQueue = ''

  try {
    // 0. Discover queue
    agentWorkerQueue = await executeActivity(TaskQueueAgent, getAgentWorkerQueueActivity)

    // Update status to processing
    await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'processing',
    })

    // 0. Create Placeholder Comment
    const payload = task.payload
    const placeholder = await executeActivity(agentWorkerQueue, createCommentActivity, {
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
    const context = await executeActivity(agentWorkerQueue, getEmbeddingContextActivity, {
      teamId: task.teamId,
      assetId: task.assetId,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { asset, chunkDuration } = context as any

    const isImage = asset.mediaType?.startsWith('image/')
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
          // Find first non-raw transcode or fallback to first transcode
          const transcode =
            media.videoTranscodes.find((t: PrismaJson.VideoTranscode) => !t.isRaw) || media.videoTranscodes[0]
          if (transcode?.key) {
            embeddingKey = transcode.key
          }
        }
      } else if (isImage) {
        if (media.imageTranscodes && media.imageTranscodes.length > 0) {
          // Find first non-raw transcode or fallback to first transcode
          const transcode =
            media.imageTranscodes.find((t: PrismaJson.ImageTranscode) => !t.isRaw) || media.imageTranscodes[0]
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

    const results: GeneratedEmbedding[] = []
    const usage = {
      model: 'gemini-embedding-2',
      inputTokens: 0,
      outputTokens: 0,
    }

    if (isImage) {
      const result = await executeActivity(agentWorkerQueue, generateImageEmbeddingActivity, {
        teamId: task.teamId,
        assetKey: embeddingKey,
        mediaType: embeddingMediaType,
      })
      results.push({ embedding: result.embedding })
      if (result.usage) {
        usage.inputTokens += result.usage.inputTokens || 0
        usage.outputTokens += result.usage.outputTokens || 0
      }
    } else if (isVideo) {
      // Get video duration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const duration = (asset.media as any)?.duration || 0
      const limit = chunkDuration || 60.0

      for (let start = 0.0; start < duration; start += limit) {
        let end = start + limit
        if (end > duration) end = duration

        const chunkResult = await executeActivity(
          agentWorkerQueue,
          generateVideoChunkEmbeddingActivity,
          {
            teamId: task.teamId,
            assetKey: embeddingKey,
            startTime: start,
            endTime: end,
          },
        )

        results.push({
          embedding: chunkResult.embedding,
          startTime: start,
          endTime: end,
        })

        if (chunkResult.usage) {
          usage.inputTokens += chunkResult.usage.inputTokens || 0
          usage.outputTokens += chunkResult.usage.outputTokens || 0
        }
      }
    }

    // Save computed embeddings
    if (results.length > 0) {
      await executeActivity(agentWorkerQueue, saveAssetEmbeddingsActivity, {
        assetId: task.assetId,
        embeddings: results,
      })
    }

    // Update Usage
    await executeActivity(agentWorkerQueue, updateTaskUsageActivity, {
      taskId: task.id,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      model: usage.model,
    })

    // 7. Update Placeholder Comment
    if (placeholderCommentId) {
      await executeActivity(agentWorkerQueue, updateCommentActivity, {
        commentId: placeholderCommentId,
        message: 'Embedding completed successfully.',
      })
    }

    // Update status to completed
    await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'completed',
    })
  } catch (err) {
    console.error(`AgentEmbeddingMedia failed for task ${task.id}:`, err)

    // Update placeholder comment with error message
    if (placeholderCommentId && agentWorkerQueue) {
      try {
        await executeActivity(agentWorkerQueue, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: `Embedding failed: ${err instanceof Error ? err.message : String(err)}`,
        })
      } catch (commentErr) {
        console.error('Failed to update error comment:', commentErr)
      }
    }

    // Update status to failed
    if (agentWorkerQueue) {
      await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
        taskId: task.id,
        status: 'failed',
        output: { error: err instanceof Error ? err.message : String(err) },
      })
    }
    throw err
  }
}

export const agentEmbeddingWorkflow = agentEmbeddingMedia
