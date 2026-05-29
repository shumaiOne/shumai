import { WorkflowTask, WorkflowTaskStatus, Prisma } from '@/generated/prisma/client'
import { getActivities } from '../workflow-utils'
import { prisma } from '@/db'

export async function queryEmbeddingForSearch(task: WorkflowTask): Promise<void> {
  const { generateTextEmbeddingActivity } = getActivities()

  const payload = task.payload as PrismaJson.WorkflowTaskPayload | null
  const text = payload?.queryEmbeddingForSearch?.text

  if (!text) {
    throw new Error('Missing text in query_embedding_for_search task payload')
  }

  try {
    // 1. Mark as processing
    await prisma.workflowTask.update({
      where: { id: task.id },
      data: { status: WorkflowTaskStatus.processing, heartbeat: new Date() },
    })

    // 2. Generate embedding
    const result = await generateTextEmbeddingActivity({
      text,
      teamId: task.teamId!,
    })

    // 3. Save output and complete
    await prisma.workflowTask.update({
      where: { id: task.id },
      data: {
        status: WorkflowTaskStatus.completed,
        output: { embedding: result.embedding } as Prisma.InputJsonValue,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        model: result.usage.model,
      },
    })
  } catch (err) {
    console.error(`queryEmbeddingForSearch failed for task ${task.id}:`, err)
    await prisma.workflowTask.update({
      where: { id: task.id },
      data: {
        status: WorkflowTaskStatus.failed,
        output: {
          error: err instanceof Error ? err.message : String(err),
        } as Prisma.InputJsonValue,
      },
    })
    throw err
  }
}
