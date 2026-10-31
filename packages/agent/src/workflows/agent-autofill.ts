import type { WorkflowTask } from '@shumai/db'
import {
  ApplicationFailure,
  updateTaskStatusActivity,
  updateTaskUsageActivity,
} from '@shumai/workflow-core'
import { getProxyType } from '@shumai/core/src/utils/mime'
import {
  autofillAiActivity,
  createCommentActivity,
  getAgentAutofillContextActivity,
  getAssetActivity,
  getProjectAutofillFieldsActivity,
  updateAssetMetadataActivity,
} from '../activities/agent'

export async function agentAutofillMedia(task: WorkflowTask): Promise<void> {
  try {
    // Update status to processing
    await updateTaskStatusActivity({
      taskId: task.id,
      status: 'processing',
    })

    // 1. Get Asset
    const asset = await getAssetActivity(task.assetId)
    if (!asset || !asset.project) {
      throw ApplicationFailure.create({ message: 'Asset or project not found', nonRetryable: true })
    }
    const teamId = asset.project.teamId
    const projectId = asset.project.id

    // 2. Get Project Autofill Fields
    const fields = await getProjectAutofillFieldsActivity(projectId)
    if (fields.length === 0) {
      await updateTaskStatusActivity({
        taskId: task.id,
        status: 'completed',
      })
      return
    }

    // 3. Fetch Agent Context
    const context = await getAgentAutofillContextActivity({
      teamId,
    })

    // 4. Call AI Service (inspects asset on demand via read_asset)
    const mediaInfo = asset.media as PrismaJson.MediaInfo | null
    const proxyType = mediaInfo?.proxyType || getProxyType(asset.mediaType, asset.name) || undefined

    const duration =
      (proxyType === 'video' || proxyType === 'audio') && typeof mediaInfo?.duration === 'number'
        ? mediaInfo.duration
        : undefined

    const pageCount =
      proxyType === 'pdf'
        ? typeof mediaInfo?.metadata?.totalFrames === 'number'
          ? mediaInfo.metadata.totalFrames
          : typeof mediaInfo?.frames === 'number'
            ? mediaInfo.frames
            : undefined
        : undefined

    const aiResult = await autofillAiActivity({
      teamId,
      assetId: asset.id,
      assetName: asset.name,
      mediaType: asset.mediaType ?? undefined,
      duration,
      pageCount,
      projectId: asset.projectId ?? undefined,
      fields: fields.map((f) => ({
        id: f.key,
        config: (f.config as unknown as PrismaJson.FieldConfig) ?? {},
        description: f.description,
      })),
      context,
    })

    if (aiResult.usage) {
      // Update Usage
      await updateTaskUsageActivity({
        taskId: task.id,
        inputTokens: aiResult.usage.inputTokens,
        outputTokens: aiResult.usage.outputTokens,
        model: aiResult.usage.model,
      })
    }

    // 6. Update Asset Metadata
    const result = JSON.parse(aiResult.text)
    const metadataUpdates = Object.entries(result)
      .filter(([, value]) => value !== null)
      .map(([key, value]) => ({
        key,
        value,
      }))

    if (metadataUpdates.length > 0) {
      await updateAssetMetadataActivity({
        assetId: asset.id,
        metadata: metadataUpdates,
      })
    }

    // Update status to completed
    await updateTaskStatusActivity({
      taskId: task.id,
      status: 'completed',
    })
  } catch (err) {
    console.error(`AgentAutofillMedia failed for task ${task.id}:`, err)

    // Create error comment
    try {
      const payload = task.payload
      await createCommentActivity({
        assetId: task.assetId,
        message: `Autofill failed: ${err instanceof Error ? err.message : String(err)}`,
        sessionId: payload?.agent?.sessionId || task.id,
        agentId: payload?.agent?.agentId || 'default',
      })
    } catch (commentErr) {
      console.error('Failed to create error comment:', commentErr)
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

export const agentAutofillWorkflow = agentAutofillMedia
