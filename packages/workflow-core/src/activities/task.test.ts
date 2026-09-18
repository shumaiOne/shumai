import { describe, it, expect } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import {
  updateTaskStatusActivity,
  updateAssetStatusActivity,
  updateTaskUsageActivity,
} from './task'
import { WorkflowTaskStatus, WorkflowTaskType, AssetStatus } from '@shumai/db'

describe('Task Activities', () => {
  setupTestDbHooks()

  it('should update task status', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        assetId: 'asset-1',
        type: WorkflowTaskType.ai_embedding,
        status: WorkflowTaskStatus.pending,
      },
    })

    await updateTaskStatusActivity({
      taskId: task.id,
      status: WorkflowTaskStatus.processing,
    })

    const updated = await prisma.workflowTask.findUnique({ where: { id: task.id } })
    expect(updated?.status).toBe(WorkflowTaskStatus.processing)
  })

  it('should update asset status', async () => {
    const asset = await prisma.asset.create({
      data: {
        name: 'test.mp4',
        storageKey: { create: { key: 'test.mp4' } },
        status: 'uploaded',
        type: 'file',
      },
    })

    await updateAssetStatusActivity({
      assetId: asset.id,
      status: AssetStatus.processing,
    })

    const updated = await prisma.asset.findUnique({ where: { id: asset.id } })
    expect(updated?.status).toBe(AssetStatus.processing)
  })

  it('should NOT overwrite trashed status when asset is soft-deleted (isDeleted: true)', async () => {
    const asset = await prisma.asset.create({
      data: {
        name: 'trashed-video.mp4',
        storageKey: { create: { key: 'trashed-video.mp4' } },
        status: AssetStatus.trashed,
        isDeleted: true,
        type: 'file',
      },
    })

    await updateAssetStatusActivity({
      assetId: asset.id,
      status: AssetStatus.processed,
    })

    const updated = await prisma.asset.findUnique({ where: { id: asset.id } })
    expect(updated?.status).toBe(AssetStatus.trashed)
    expect(updated?.isDeleted).toBe(true)
  })

  it('should update task usage', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        assetId: 'asset-1',
        type: WorkflowTaskType.ai_embedding,
        status: WorkflowTaskStatus.pending,
      },
    })

    await updateTaskUsageActivity({
      taskId: task.id,
      inputTokens: 100,
      outputTokens: 200,
      model: 'gpt-4o',
    })

    const updated = await prisma.workflowTask.findUnique({ where: { id: task.id } })
    expect(updated?.inputTokens).toBe(100)
    expect(updated?.outputTokens).toBe(200)
    expect(updated?.model).toBe('gpt-4o')
  })

  it('should not throw error when updating status of a non-existent or purged task', async () => {
    await expect(
      updateTaskStatusActivity({
        taskId: 'non-existent-task-id',
        status: WorkflowTaskStatus.failed,
      }),
    ).resolves.not.toThrow()
  })
})
