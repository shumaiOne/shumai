import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFolder, listProjects } from '@shumai/operations'
import { callOperation } from './call-operation'
import { CliError } from './errors'

describe('callOperation', () => {
  const env = { ...process.env }
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    process.env.SHUMAI_API_SERVER = 'http://shumai.test/'
    process.env.SHUMAI_API_KEY = 'shumai_token'
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    process.env = { ...env }
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  it('posts the input to /api/ops/:name with the token and CLI attribution', async () => {
    const folder = { id: 'f1', name: 'Renders', type: 'folder', size: 0, projectId: 'p1' }
    fetchMock.mockResolvedValue(json(folder))

    const output = await callOperation(createFolder, { parent: 'root', name: 'Renders' })

    expect(output).toEqual(folder)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://shumai.test/api/ops/create_folder')
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer shumai_token',
        'Content-Type': 'application/json',
        'x-shumai-client': 'cli',
      },
      body: JSON.stringify({ parent: 'root', name: 'Renders' }),
    })
  })

  it('throws the server error message', async () => {
    fetchMock.mockResolvedValue(json({ error: 'User is not a member of the team' }, 403))

    await expect(callOperation(listProjects, {})).rejects.toEqual(
      new CliError('User is not a member of the team'),
    )
  })

  it('falls back to the status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('Bad gateway', { status: 502 }))

    await expect(callOperation(listProjects, {})).rejects.toThrow('Request failed with status 502')
  })

  it('reports connection failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    await expect(callOperation(listProjects, {})).rejects.toMatchObject({
      message: 'Error connecting to API server: fetch failed',
      prefixed: true,
    })
  })

  it('rejects responses that do not match the output schema', async () => {
    fetchMock.mockResolvedValue(json({ unexpected: true }))

    await expect(callOperation(listProjects, {})).rejects.toThrow(
      'Unexpected response from server for list_projects',
    )
  })
})
