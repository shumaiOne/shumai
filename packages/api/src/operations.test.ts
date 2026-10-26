import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { teamService } from '@shumai/core/src/team/team'
import {
  createFolderOp,
  getOperation,
  listAssetsOp,
  runOperation,
  type Operation,
} from '@shumai/core/src/operations'
import operationsRoute from './operations'

vi.mock('@shumai/core/src/operations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/core/src/operations')>()
  return { ...actual, runOperation: vi.fn(), getOperation: vi.fn(actual.getOperation) }
})

const app = new Hono<{ Variables: { user: { id: string } } }>()
  .use('*', async (c, next) => {
    c.set('user', { id: 'user1' })
    await next()
  })
  .route('/', operationsRoute)

function post(name: string, body?: string, headers: Record<string, string> = {}) {
  return app.request(`/ops/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
}

describe('POST /ops/:name', () => {
  beforeEach(() => {
    vi.mocked(runOperation).mockReset()
    delete process.env.SHUMAI_DEMO_MODE
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.SHUMAI_DEMO_MODE
  })

  it('runs the Operation with the JSON body and returns its output', async () => {
    const output = { id: 'f1', name: 'Renders', type: 'folder', size: 0, projectId: 'p1' }
    vi.mocked(runOperation).mockResolvedValue(output)

    const res = await post('create_folder', JSON.stringify({ parent: 'root', name: 'Renders' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(output)
    expect(runOperation).toHaveBeenCalledWith(
      createFolderOp,
      { userId: 'user1', via: 'api' },
      { parent: 'root', name: 'Renders' },
    )
  })

  it('attributes calls from the CLI to via cli', async () => {
    vi.mocked(runOperation).mockResolvedValue({ data: [] })

    await post('list_projects', '{}', { 'x-shumai-client': 'cli' })

    expect(runOperation).toHaveBeenCalledWith(
      expect.anything(),
      { userId: 'user1', via: 'cli' },
      {},
    )
  })

  it('treats an empty body as an empty input', async () => {
    vi.mocked(runOperation).mockResolvedValue({ data: [] })

    const res = await post('list_projects')

    expect(res.status).toBe(200)
    expect(runOperation).toHaveBeenCalledWith(expect.anything(), expect.anything(), {})
  })

  it('returns 404 for an unknown Operation', async () => {
    const res = await post('drop_database', '{}')

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Unknown operation "drop_database"' })
    expect(runOperation).not.toHaveBeenCalled()
  })

  it('returns 404 for an Operation without the cli surface', async () => {
    const agentOnly: Operation = {
      ...listAssetsOp,
      definition: { ...listAssetsOp.definition, surfaces: ['agent'] },
    }
    vi.mocked(getOperation).mockReturnValueOnce(agentOnly)

    const res = await post('list_assets', '{}')

    expect(res.status).toBe(404)
    expect(runOperation).not.toHaveBeenCalled()
  })

  it('returns 400 for a body that is not JSON', async () => {
    const res = await post('list_projects', 'not json')

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Request body must be a JSON object' })
  })

  it('returns the status and message of HTTP errors', async () => {
    vi.mocked(runOperation).mockRejectedValue(
      new HTTPException(403, { message: 'User is not a member of the team' }),
    )

    const res = await post('create_folder', '{"parent":"p","name":"n"}')

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'User is not a member of the team' })
  })

  it('returns service error messages as 500', async () => {
    vi.mocked(runOperation).mockRejectedValue(new Error('Parent not found'))

    const res = await post('create_folder', '{"parent":"p","name":"n"}')

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Parent not found' })
  })

  it('hides messages of unexpected error types', async () => {
    class DriverError extends Error {}
    vi.mocked(runOperation).mockRejectedValue(new DriverError('SELECT * FROM secrets failed'))

    const res = await post('create_folder', '{"parent":"p","name":"n"}')

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })

  describe('in demo mode', () => {
    beforeEach(() => {
      process.env.SHUMAI_DEMO_MODE = '1'
      vi.spyOn(teamService, 'hasWritableRoleInAnyTeam').mockResolvedValue(false)
    })

    it('rejects Operations that change data for read-only users', async () => {
      const res = await post('create_folder', '{"parent":"p","name":"n"}')

      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'System is in read-only mode' })
      expect(runOperation).not.toHaveBeenCalled()
    })

    it('still allows read-only Operations', async () => {
      vi.mocked(runOperation).mockResolvedValue({ data: [] })

      const res = await post('list_projects', '{}')

      expect(res.status).toBe(200)
    })
  })
})
