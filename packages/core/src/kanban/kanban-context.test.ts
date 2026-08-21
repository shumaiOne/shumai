import { describe, it, expect } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { KanbanTaskRunStatus, KanbanTaskEventType } from '@shumai/db/enums'
import { kanbanContextService } from './kanban-context'
import { kanbanService } from './kanban'

describe('KanbanContextService', () => {
  setupTestDbHooks()

  it('builds a comprehensive prompt briefing with safety preamble, previous runs, feedback, prerequisites, and comments', async () => {
    const user = await prisma.user.create({
      data: { name: 'Lead Developer', email: 'lead@example.com' },
    })
    const reviewer = await prisma.user.create({
      data: { name: 'Creative Reviewer', email: 'reviewer@example.com' },
    })

    const team = await prisma.team.create({
      data: {
        name: 'Context Test Team',
        settings: {
          transcode: { videoStrategy: 'best_match' },
        },
      },
    })

    await prisma.teamMember.createMany({
      data: [
        { teamId: team.id, userId: user.id, role: 'owner', scope: 'team' },
        { teamId: team.id, userId: reviewer.id, role: 'editor', scope: 'team' },
      ],
    })

    // Create parent task
    const parent = await kanbanService.createTask(
      team.id,
      { title: 'Setup Base Environment' },
      user.id,
      'owner',
    )
    await prisma.kanbanTaskRun.create({
      data: {
        taskId: parent.id,
        status: KanbanTaskRunStatus.COMPLETED,
        attempt: 1,
        claimToken: 'parent-token',
        summary: 'Base environment initialized with asset packages',
        metadata: { installedPackages: ['shumai-core', 'pi-agent'] },
      },
    })
    await kanbanService.startManualTask(parent.id, user.id)
    await kanbanService.completeManualTask(parent.id, user.id)

    // Create target task
    const task = await kanbanService.createTask(
      team.id,
      {
        title: 'Generate Marketing Materials',
        description: 'Generate high-resolution launch posters and banners.',
        isAgentTask: true,
        parentIds: [parent.id],
        assigneeId: user.id,
        reporterId: reviewer.id,
      },
      user.id,
      'owner',
    )

    // Add prior run
    await prisma.kanbanTaskRun.create({
      data: {
        taskId: task.id,
        status: KanbanTaskRunStatus.REVIEW_REQUESTED,
        attempt: 1,
        claimToken: 'run-token-1',
        summary: 'Generated first version of posters',
        metadata: { posterAssetIds: ['ast_01', 'ast_02'] },
      },
    })

    // Add review feedback event
    await prisma.kanbanTaskEvent.create({
      data: {
        taskId: task.id,
        actorId: reviewer.id,
        type: KanbanTaskEventType.CHANGES_REQUESTED,
        data: { reason: 'Please use darker contrast on the title typography.' },
      },
    })

    // Add a comment
    await kanbanService.addComment(
      task.id,
      reviewer.id,
      'Check the brand guidelines attached in the folder.',
    )

    // Build context
    const context = await kanbanContextService.buildAgentContext(task.id)

    expect(context).toContain(`# Kanban Task [${task.id}]: Generate Marketing Materials`)
    expect(context).toContain('untrusted project data')
    expect(context).toContain('Generate high-resolution launch posters and banners.')
    expect(context).toContain('Previous Attempt (Attempt 1)')
    expect(context).toContain('Generated first version of posters')
    expect(context).toContain('Reviewer Feedback & Changes Requested')
    expect(context).toContain('Please use darker contrast on the title typography.')
    expect(context).toContain('Parent Task Deliverables (Prerequisites)')
    expect(context).toContain('Setup Base Environment')
    expect(context).toContain('Base environment initialized with asset packages')
    expect(context).toContain('Comment Thread')
    expect(context).toContain('Check the brand guidelines attached in the folder.')
  })
})
