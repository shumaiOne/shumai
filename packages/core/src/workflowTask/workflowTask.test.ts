import { describe, it, expect } from 'vitest'
import { prisma, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
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
})
