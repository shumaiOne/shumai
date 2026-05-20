import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { DatabaseSessionManager } from './database-session-manager'
import { s3Service } from '@/services/s3/s3'

vi.mock('@/services/s3/s3', () => ({
  s3Service: {
    getObject: vi.fn(),
  },
}))

describe('DatabaseSessionManager', () => {
  setupTestDbHooks()

  let agentId: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { name: 'Test Agent', email: 'agent@test.com', type: 'agent' },
    })
    await prisma.agent.create({
      data: {
        id: user.id,
        type: 'chat',
        config: { provider: 'openai', model: 'gpt-4o' },
      },
    })
    agentId = user.id
  })

  it('creates a new session in DB', async () => {
    const manager = await DatabaseSessionManager.create({ agentId })
    const sessionId = manager.getDbSessionId()
    expect(sessionId).toBeDefined()

    const session = await prisma.agentSession.findUnique({ where: { id: sessionId } })
    expect(session).toBeDefined()
    expect(session?.agentId).toBe(agentId)
  })

  it('persists message entries to DB', async () => {
    const manager = await DatabaseSessionManager.create({ agentId })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    manager.appendMessage({ role: 'user', content: 'Hello' } as any)
    await manager.waitForSync()

    const sessionId = manager.getDbSessionId()
    const entries = await prisma.agentSessionEntry.findMany({ where: { sessionId } })
    expect(entries).toHaveLength(1)
    // In simplified schema, type/parentId are part of the entry object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = entries[0].entry as any
    expect(entry.type).toBe('message')
    expect(entry.message.content).toBe('Hello')

    const session = await prisma.agentSession.findUnique({ where: { id: sessionId } })
    expect(session?.leafId).toBe(entries[0].id)
  })

  it('loads existing session from DB', async () => {
    const manager1 = await DatabaseSessionManager.create({ agentId })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msgId = manager1.appendMessage({ role: 'user', content: 'Message 1' } as any)
    await manager1.waitForSync()
    const sessionId = manager1.getDbSessionId()

    const manager2 = await DatabaseSessionManager.create({ agentId, sessionId })
    expect(manager2.getDbSessionId()).toBe(sessionId)
    expect(manager2.getLeafId()).toBe(msgId)

    const context = manager2.buildSessionContext()
    expect(context.messages).toHaveLength(1)
    expect(context.messages[0].content).toBe('Message 1')
  })

  it('re-injects image data from S3', async () => {
    const session = await prisma.agentSession.create({
      data: { agentId, cwd: '/tmp' },
    })

    const entry = {
      id: 'e1',
      type: 'message',
      message: {
        role: 'toolResult',
        content: [{ type: 'image', data: '__S3_DATA__' }],
        details: { sourceKeys: ['key1'] },
      },
    }

    await prisma.agentSessionEntry.create({
      data: {
        id: entry.id,
        sessionId: session.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entry: entry as any,
      },
    })

    vi.mocked(s3Service.getObject).mockResolvedValue({
      buffer: Buffer.from('fake-image-data'),
      contentType: 'image/png',
    })

    const manager = await DatabaseSessionManager.create({ agentId, sessionId: session.id })
    const context = manager.buildSessionContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reInjectedMessage = context.messages[0] as any

    expect(reInjectedMessage.content[0].data).toBe(
      Buffer.from('fake-image-data').toString('base64'),
    )
    expect(s3Service.getObject).toHaveBeenCalledWith(expect.any(String), 'key1')
  })

  it('handles branching', async () => {
    const manager = await DatabaseSessionManager.create({ agentId })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m1Id = manager.appendMessage({ role: 'user', content: 'M1' } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    manager.appendMessage({ role: 'assistant', content: 'A1' } as any)
    await manager.waitForSync()

    // Branch from M1
    manager.branch(m1Id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m2Id = manager.appendMessage({ role: 'user', content: 'M2' } as any)
    await manager.waitForSync()

    const sessionId = manager.getDbSessionId()
    const entries = await prisma.agentSessionEntry.findMany({ where: { sessionId } })
    expect(entries).toHaveLength(3)

    const m2Entry = entries.find((e) => e.id === m2Id)
    // parentId is now inside the entry object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((m2Entry?.entry as any).parentId).toBe(m1Id)

    const context = manager.buildSessionContext()
    expect(context.messages).toHaveLength(2)
    expect(context.messages[0].content).toBe('M1')
    expect(context.messages[1].content).toBe('M2')
  })

  it('handles skill environment variables', async () => {
    const manager = await DatabaseSessionManager.create({ agentId })
    const envs = { TEST_VAR: 'test_value', OTHER_VAR: 'other_value' }

    manager.addSkillEnvs(envs)
    expect(manager.getSkillEnvs()).toEqual(envs)

    manager.addSkillEnvs({ TEST_VAR: 'new_value', NEW_VAR: 'new' })
    expect(manager.getSkillEnvs()).toEqual({
      TEST_VAR: 'new_value',
      OTHER_VAR: 'other_value',
      NEW_VAR: 'new',
    })
  })
})
