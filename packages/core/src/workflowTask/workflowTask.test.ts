import { describe, it, expect } from 'vitest'
import {
  prisma,
  WorkflowTaskStatus,
  WorkflowTaskType,
  AssetStatus,
  registerWorkflowCancel,
} from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { HTTPException } from 'hono/http-exception'
import { workflowTaskService } from './workflowTask'

describe('WorkflowTaskService', () => {
  setupTestDbHooks()

  it('lists workflow tasks for a team with pagination and filters', async () => {
    const team1 = await prisma.team.create({
      data: { name: 'Workflow Team 1' },
    })

    const team2 = await prisma.team.create({
      data: { name: 'Workflow Team 2' },
    })

    const project1 = await prisma.project.create({
      data: { name: 'Project 1', teamId: team1.id },
    })

    const asset1 = await prisma.asset.create({
      data: {
        name: 'video1.mp4',
        type: 'file',
        sizeByte: 2048,
        status: 'uploaded',
        projectId: project1.id,
      },
    })

    // Task 1: Team 1 direct
    const task1 = await prisma.workflowTask.create({
      data: {
        assetId: asset1.id,
        teamId: team1.id,
        projectId: project1.id,
        type: WorkflowTaskType.transcode_video,
        status: WorkflowTaskStatus.completed,
      },
    })

    // Task 2: Team 1 via project (teamId is null)
    const task2 = await prisma.workflowTask.create({
      data: {
        assetId: asset1.id,
        projectId: project1.id,
        type: WorkflowTaskType.chat,
        status: WorkflowTaskStatus.pending,
      },
    })

    // Task 3: Team 2
    await prisma.workflowTask.create({
      data: {
        assetId: 'other-asset',
        teamId: team2.id,
        type: WorkflowTaskType.transcode_image,
        status: WorkflowTaskStatus.processing,
      },
    })

    // 1. List all for Team 1
    const listAll = await workflowTaskService.listWorkflowTasks({
      teamId: team1.id,
    })

    expect(listAll.total).toBe(2)
    expect(listAll.nodes).toHaveLength(2)
    expect(listAll.nodes.map((n) => n.id)).toEqual([task2.id, task1.id]) // ordered by id desc
    expect(listAll.nodes[0].fileName).toBe('video1.mp4')
    expect(listAll.nodes[0].fileSize).toBe(2048)
    expect(listAll.nodes[0].projectName).toBe('Project 1')
    expect(listAll.nodes[0].projectId).toBe(project1.id)
    expect(listAll.nodes[1].fileName).toBe('video1.mp4')
    expect(listAll.nodes[1].fileSize).toBe(2048)
    expect(listAll.nodes[1].projectName).toBe('Project 1')

    // 2. Filter by status
    const listPending = await workflowTaskService.listWorkflowTasks({
      teamId: team1.id,
      status: [WorkflowTaskStatus.pending],
    })
    expect(listPending.total).toBe(1)
    expect(listPending.nodes[0].id).toBe(task2.id)

    // 3. Filter by type
    const listChat = await workflowTaskService.listWorkflowTasks({
      teamId: team1.id,
      types: [WorkflowTaskType.chat],
    })
    expect(listChat.total).toBe(1)
    expect(listChat.nodes[0].id).toBe(task2.id)

    // 4. Pagination
    const page1 = await workflowTaskService.listWorkflowTasks({
      teamId: team1.id,
      first: 1,
    })
    expect(page1.nodes).toHaveLength(1)
    expect(page1.nodes[0].id).toBe(task2.id)
    expect(page1.pageInfo.hasNextPage).toBe(true)

    const page2 = await workflowTaskService.listWorkflowTasks({
      teamId: team1.id,
      first: 1,
      after: page1.pageInfo.endCursor!,
    })
    expect(page2.nodes).toHaveLength(1)
    expect(page2.nodes[0].id).toBe(task1.id)
  })

  it('gets batch status for specific task IDs with team security', async () => {
    const team1 = await prisma.team.create({
      data: { name: 'Batch Team 1' },
    })
    const team2 = await prisma.team.create({
      data: { name: 'Batch Team 2' },
    })

    const task1 = await prisma.workflowTask.create({
      data: {
        assetId: 'a1',
        teamId: team1.id,
        type: WorkflowTaskType.transcode_video,
        status: WorkflowTaskStatus.processing,
      },
    })

    const task2 = await prisma.workflowTask.create({
      data: {
        assetId: 'a2',
        teamId: team2.id,
        type: WorkflowTaskType.transcode_video,
        status: WorkflowTaskStatus.processing,
      },
    })

    // Query empty
    const empty = await workflowTaskService.getBatchWorkflowTaskStatus({
      teamId: team1.id,
      taskIds: [],
    })
    expect(empty.tasks).toEqual([])

    // Query both task1 and task2 under team1
    const res = await workflowTaskService.getBatchWorkflowTaskStatus({
      teamId: team1.id,
      taskIds: [task1.id, task2.id],
    })

    // task2 should be excluded because it belongs to team2
    expect(res.tasks).toHaveLength(1)
    expect(res.tasks[0].id).toBe(task1.id)
    expect(res.tasks[0].status).toBe(WorkflowTaskStatus.processing)
  })

  it('stops a pending or processing task successfully', async () => {
    const team = await prisma.team.create({
      data: { name: 'Stop Team' },
    })

    const pendingTask = await prisma.workflowTask.create({
      data: {
        assetId: 'asset-pending',
        teamId: team.id,
        type: WorkflowTaskType.transcode_video,
        status: WorkflowTaskStatus.pending,
        payload: { projectId: 'p1' },
      },
    })

    const processingTask = await prisma.workflowTask.create({
      data: {
        assetId: 'asset-processing',
        teamId: team.id,
        type: WorkflowTaskType.ai_metadata_autofill,
        status: WorkflowTaskStatus.processing,
      },
    })

    // Stop pending task
    const stopPendingRes = await workflowTaskService.stopWorkflowTask({
      teamId: team.id,
      taskId: pendingTask.id,
    })
    expect(stopPendingRes.success).toBe(true)
    expect(stopPendingRes.task.status).toBe(WorkflowTaskStatus.failed)
    const pendingOutput = stopPendingRes.task.output as { error: string }
    expect(pendingOutput.error).toBe('Task was stopped by user')

    // Stop processing task
    const stopProcessingRes = await workflowTaskService.stopWorkflowTask({
      teamId: team.id,
      taskId: processingTask.id,
    })
    expect(stopProcessingRes.success).toBe(true)
    expect(stopProcessingRes.task.status).toBe(WorkflowTaskStatus.failed)
  })

  it('updates associated asset status to failed atomically when task is stopped', async () => {
    const team = await prisma.team.create({
      data: { name: 'Asset Stop Team' },
    })
    const project = await prisma.project.create({
      data: { name: 'Asset Stop Project', teamId: team.id },
    })

    // Asset 1: currently uploaded (e.g. pending transcode)
    const asset1 = await prisma.asset.create({
      data: {
        name: 'pending-video.mp4',
        type: 'file',
        status: AssetStatus.uploaded,
        projectId: project.id,
        media: {
          duration: 120,
          filesize: 1000,
          frames: 3000,
          imageTranscodes: [],
          videoTranscodes: [],
          finishedAt: '',
          metadata: null,
          original: null,
        },
      },
    })

    const task1 = await prisma.workflowTask.create({
      data: {
        assetId: asset1.id,
        teamId: team.id,
        projectId: project.id,
        type: WorkflowTaskType.transcode_video,
        status: WorkflowTaskStatus.pending,
      },
    })

    // Asset 2: already processed (media finished)
    const asset2 = await prisma.asset.create({
      data: {
        name: 'completed-video.mp4',
        type: 'file',
        status: AssetStatus.processed,
        projectId: project.id,
        media: {
          duration: 60,
          filesize: 500,
          frames: 1500,
          imageTranscodes: [],
          videoTranscodes: [],
          finishedAt: '2026-01-01',
          metadata: null,
          original: null,
        },
      },
    })

    const task2 = await prisma.workflowTask.create({
      data: {
        assetId: asset2.id,
        teamId: team.id,
        projectId: project.id,
        type: WorkflowTaskType.ai_metadata_autofill,
        status: WorkflowTaskStatus.processing,
      },
    })

    // Stop task 1 (pending transcode)
    await workflowTaskService.stopWorkflowTask({
      teamId: team.id,
      taskId: task1.id,
    })

    const updatedAsset1 = await prisma.asset.findUniqueOrThrow({
      where: { id: asset1.id },
    })
    expect(updatedAsset1.status).toBe(AssetStatus.failed)
    const media1 = updatedAsset1.media as PrismaJson.MediaInfo
    expect(media1.duration).toBe(120) // preserved other json properties
    expect(media1.filesize).toBe(1000)
    expect(media1.error).toBe('Task was stopped by user')

    // Stop task 2 (asset already processed)
    await workflowTaskService.stopWorkflowTask({
      teamId: team.id,
      taskId: task2.id,
    })

    const updatedAsset2 = await prisma.asset.findUniqueOrThrow({
      where: { id: asset2.id },
    })
    // Must NOT be overwritten to failed
    expect(updatedAsset2.status).toBe(AssetStatus.processed)
    const media2 = updatedAsset2.media as PrismaJson.MediaInfo
    expect(media2.duration).toBe(60)
    expect(media2.error).toBeUndefined()
  })

  it('throws 400 when attempting to stop completed or failed task', async () => {
    const team = await prisma.team.create({
      data: { name: 'Stop Error Team' },
    })

    const completedTask = await prisma.workflowTask.create({
      data: {
        assetId: 'asset-completed',
        teamId: team.id,
        type: WorkflowTaskType.transcode_video,
        status: WorkflowTaskStatus.completed,
      },
    })

    await expect(
      workflowTaskService.stopWorkflowTask({
        teamId: team.id,
        taskId: completedTask.id,
      }),
    ).rejects.toThrow(HTTPException)
  })

  it('throws 404 when stopping non-existent task and 403 when task belongs to other team', async () => {
    const team1 = await prisma.team.create({
      data: { name: 'Team 1' },
    })
    const team2 = await prisma.team.create({
      data: { name: 'Team 2' },
    })

    const task2 = await prisma.workflowTask.create({
      data: {
        assetId: 'asset-team2',
        teamId: team2.id,
        type: WorkflowTaskType.transcode_video,
        status: WorkflowTaskStatus.pending,
      },
    })

    // Non-existent task
    await expect(
      workflowTaskService.stopWorkflowTask({
        teamId: team1.id,
        taskId: 'non-existent-task-id',
      }),
    ).rejects.toThrow(HTTPException)

    // Task belongs to team 2
    await expect(
      workflowTaskService.stopWorkflowTask({
        teamId: team1.id,
        taskId: task2.id,
      }),
    ).rejects.toThrow(HTTPException)
  })

  it('throws 502 and does not modify task or asset when workflow cancellation fails', async () => {
    const team = await prisma.team.create({
      data: { name: 'Cancel Fail Team' },
    })
    const project = await prisma.project.create({
      data: { name: 'Cancel Fail Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'fail-cancel.mp4',
        type: 'file',
        status: AssetStatus.processing,
        projectId: project.id,
      },
    })
    const task = await prisma.workflowTask.create({
      data: {
        assetId: asset.id,
        teamId: team.id,
        projectId: project.id,
        type: WorkflowTaskType.transcode_video,
        status: WorkflowTaskStatus.processing,
      },
    })

    registerWorkflowCancel(async () => {
      throw new Error('DBOS connection failure')
    })

    try {
      await expect(
        workflowTaskService.stopWorkflowTask({
          teamId: team.id,
          taskId: task.id,
        }),
      ).rejects.toMatchObject({ status: 502 })

      // Verify task status was NOT changed to failed
      const currentTask = await prisma.workflowTask.findUniqueOrThrow({
        where: { id: task.id },
      })
      expect(currentTask.status).toBe(WorkflowTaskStatus.processing)

      // Verify asset status was NOT changed to failed
      const currentAsset = await prisma.asset.findUniqueOrThrow({
        where: { id: asset.id },
      })
      expect(currentAsset.status).toBe(AssetStatus.processing)
    } finally {
      registerWorkflowCancel(async () => {})
    }
  })

  it('throws 409 and does not overwrite status when task completes during cancellation', async () => {
    const team = await prisma.team.create({
      data: { name: 'Race Team' },
    })
    const project = await prisma.project.create({
      data: { name: 'Race Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'race.mp4',
        type: 'file',
        status: AssetStatus.processing,
        projectId: project.id,
      },
    })
    const task = await prisma.workflowTask.create({
      data: {
        assetId: asset.id,
        teamId: team.id,
        projectId: project.id,
        type: WorkflowTaskType.transcode_video,
        status: WorkflowTaskStatus.processing,
      },
    })

    // Simulate task completing in the background while cancelWorkflowTask is awaiting
    registerWorkflowCancel(async () => {
      await prisma.workflowTask.update({
        where: { id: task.id },
        data: { status: WorkflowTaskStatus.completed },
      })
      await prisma.asset.update({
        where: { id: asset.id },
        data: { status: AssetStatus.processed },
      })
    })

    try {
      await expect(
        workflowTaskService.stopWorkflowTask({
          teamId: team.id,
          taskId: task.id,
        }),
      ).rejects.toMatchObject({ status: 409 })

      // Verify task remains completed, not overwritten to failed
      const currentTask = await prisma.workflowTask.findUniqueOrThrow({
        where: { id: task.id },
      })
      expect(currentTask.status).toBe(WorkflowTaskStatus.completed)

      // Verify asset remains processed, not overwritten to failed
      const currentAsset = await prisma.asset.findUniqueOrThrow({
        where: { id: asset.id },
      })
      expect(currentAsset.status).toBe(AssetStatus.processed)
    } finally {
      registerWorkflowCancel(async () => {})
    }
  })

  it('enriches tasks with fileName, fileSize, and projectName, and handles purged assets gracefully', async () => {
    const team = await prisma.team.create({
      data: { name: 'Enrich Team' },
    })
    const project = await prisma.project.create({
      data: { name: 'Enrich Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'sample_audio.mp3',
        type: 'file',
        sizeByte: 5242880,
        status: 'uploaded',
        projectId: project.id,
      },
    })

    const taskWithAsset = await prisma.workflowTask.create({
      data: {
        assetId: asset.id,
        teamId: team.id,
        projectId: project.id,
        type: WorkflowTaskType.transcode_video,
        status: WorkflowTaskStatus.pending,
      },
    })

    const taskWithPurgedAsset = await prisma.workflowTask.create({
      data: {
        assetId: 'purged-asset-id',
        teamId: team.id,
        type: WorkflowTaskType.transcode_image,
        status: WorkflowTaskStatus.completed,
      },
    })

    const listRes = await workflowTaskService.listWorkflowTasks({ teamId: team.id })
    expect(listRes.total).toBe(2)

    const foundActive = listRes.nodes.find((n) => n.id === taskWithAsset.id)
    expect(foundActive).toBeDefined()
    expect(foundActive?.fileName).toBe('sample_audio.mp3')
    expect(foundActive?.fileSize).toBe(5242880)
    expect(foundActive?.projectName).toBe('Enrich Project')
    expect(foundActive?.projectId).toBe(project.id)

    const foundPurged = listRes.nodes.find((n) => n.id === taskWithPurgedAsset.id)
    expect(foundPurged).toBeDefined()
    expect(foundPurged?.fileName).toBeNull()
    expect(foundPurged?.fileSize).toBeNull()
    expect(foundPurged?.projectName).toBeNull()

    // Test batch status enrichment
    const batchRes = await workflowTaskService.getBatchWorkflowTaskStatus({
      teamId: team.id,
      taskIds: [taskWithAsset.id, taskWithPurgedAsset.id],
    })
    expect(batchRes.tasks).toHaveLength(2)
    const batchActive = batchRes.tasks.find((t) => t.id === taskWithAsset.id)
    expect(batchActive?.fileName).toBe('sample_audio.mp3')
    expect(batchActive?.fileSize).toBe(5242880)
    expect(batchActive?.projectName).toBe('Enrich Project')

    // Test stopWorkflowTask enrichment
    const stopRes = await workflowTaskService.stopWorkflowTask({
      teamId: team.id,
      taskId: taskWithAsset.id,
    })
    expect(stopRes.success).toBe(true)
    expect(stopRes.task.fileName).toBe('sample_audio.mp3')
    expect(stopRes.task.fileSize).toBe(5242880)
    expect(stopRes.task.projectName).toBe('Enrich Project')
  })
})
