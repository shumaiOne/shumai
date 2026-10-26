import { describe, it, expect } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { createReadThreadTool } from './read-thread'

/**
 * Real-database authorization tests for `read_thread`.
 *
 * Reproduces a bug where the tool returned any comment thread by ID without
 * checking that the invoking user (or, for system agents, the agent's team)
 * has access to the asset the thread belongs to.
 */
describe('read_thread authorization', () => {
  setupTestDbHooks()

  async function seedTeamWithThread(label: string) {
    const team = await prisma.team.create({ data: { name: `Team ${label}` } })
    const project = await prisma.project.create({
      data: { name: `Project ${label}`, teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: { name: `${label}.png`, type: 'file', status: 'uploaded', projectId: project.id },
    })
    const author = await prisma.user.create({
      data: { name: `Author ${label}`, email: `author-${label}@test.com`, password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: author.id, role: 'owner' },
    })
    const thread = await prisma.assetComment.create({
      data: { assetId: asset.id, creatorId: author.id, message: `secret message ${label}` },
    })
    await prisma.assetComment.create({
      data: {
        assetId: asset.id,
        creatorId: author.id,
        replyToId: thread.id,
        message: `secret reply ${label}`,
      },
    })
    return { team, project, asset, author, thread }
  }

  it('lets a team member read a thread in their team', async () => {
    const a = await seedTeamWithThread('a')

    const tool = createReadThreadTool({ userId: a.author.id, teamId: a.team.id })
    const result = await tool.execute('call-1', { threadId: a.thread.id })
    const text = (result.content[0] as { text: string }).text

    expect(text).toContain('secret message a')
    expect(text).toContain('secret reply a')
  })

  it('rejects a user reading a thread from another team', async () => {
    const a = await seedTeamWithThread('a')
    const b = await seedTeamWithThread('b')

    const tool = createReadThreadTool({ userId: a.author.id, teamId: a.team.id })

    await expect(tool.execute('call-1', { threadId: b.thread.id })).rejects.toThrow(
      'User is not a member of the team',
    )
  })

  it('rejects a project-scoped member reading a thread in a project they cannot access', async () => {
    const b = await seedTeamWithThread('b')
    const outsider = await prisma.user.create({
      data: { name: 'Project scoped', email: 'scoped@test.com', password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: b.team.id, userId: outsider.id, role: 'editor', scope: 'project' },
    })

    const tool = createReadThreadTool({ userId: outsider.id, teamId: b.team.id })

    await expect(tool.execute('call-1', { threadId: b.thread.id })).rejects.toThrow()
  })

  it('confines a system agent (no user) to threads in its own team', async () => {
    const a = await seedTeamWithThread('a')
    const b = await seedTeamWithThread('b')

    const tool = createReadThreadTool({ teamId: a.team.id })

    const own = await tool.execute('call-1', { threadId: a.thread.id })
    expect((own.content[0] as { text: string }).text).toContain('secret message a')

    await expect(tool.execute('call-2', { threadId: b.thread.id })).rejects.toThrow('Access denied')
  })
})
