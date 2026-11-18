import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { AuditAction } from '@shumai/dtos'
import teamRoute from './team'
import { authMiddleware } from './middleware/auth'
import { teamService } from '@shumai/core/src/team/team'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'
import { authzService, ResourceType, Permission } from '@shumai/core/src/authz/authz'

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn().mockResolvedValue(undefined),
  },
  Permission: {
    Read: 'Read',
    Edit: 'Edit',
    Admin: 'Admin',
  },
  ResourceType: {
    Team: 'team',
  },
}))

vi.mock('./middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { id: 'user1', name: 'Test User' })
    await next()
  },
}))

vi.mock('@shumai/core/src/user/api-token', () => ({
  apiTokenService: {
    listTokens: vi.fn(),
    createToken: vi.fn(),
    deleteToken: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/ai-usage/ai-usage', () => ({
  aiUsageService: {
    recordUsage: vi.fn(),
    getTeamUsageStats: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/auditLog/auditLog', () => ({
  auditLogService: {
    logAction: vi.fn(),
    listAuditLogs: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/turntable/turntable', () => ({
  turntableService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    testConnection: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/gotenberg/gotenberg', () => ({
  gotenbergService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    testConnection: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/workflowTask/workflowTask', () => ({
  workflowTaskService: {
    listWorkflowTasks: vi.fn(),
    getBatchWorkflowTaskStatus: vi.fn(),
    stopWorkflowTask: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/runner', () => ({
  runnerService: {
    listRunners: vi.fn(),
    createRunner: vi.fn(),
    updateRunner: vi.fn(),
    rotateRunnerKey: vi.fn(),
    deleteRunner: vi.fn(),
  },
}))

describe('team api', () => {
  const app = new Hono().use('*', authMiddleware).route('/', teamRoute)
  let mockGetUserTeams: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockGetMe: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockGetTeamMembers: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockGetSettings: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockUpdateSettings: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockListUserMetadata: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockUpsertUserMetadata: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockUpdateMe: any // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(() => {
    mockGetUserTeams = vi.spyOn(teamService, 'getUserTeams')
    mockGetMe = vi.spyOn(teamService, 'getMe')
    mockGetTeamMembers = vi.spyOn(teamService, 'getTeamMembers')
    mockGetSettings = vi.spyOn(teamService, 'getSettings')
    mockUpdateSettings = vi.spyOn(teamService, 'updateSettings')
    mockListUserMetadata = vi.spyOn(userMetadataService, 'listMetadata')
    mockUpsertUserMetadata = vi.spyOn(userMetadataService, 'upsertMetadata')
    mockUpdateMe = vi.spyOn(teamService, 'updateMe')
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POST /teams returns 404 without creating a team or writing an audit entry', async () => {
    const createTeam = vi.spyOn(teamService, 'createTeam').mockResolvedValue({
      id: 't1',
      name: 'New Team',
      updatedAt: new Date(),
    })
    const { auditLogService } = await import('@shumai/core/src/auditLog/auditLog')

    const res = await app.request('/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Team',
      }),
    })

    expect(res.status).toBe(404)
    expect(createTeam).not.toHaveBeenCalled()
    expect(auditLogService.logAction).not.toHaveBeenCalled()
  })

  it('GET /teams returns user teams', async () => {
    mockGetUserTeams.mockResolvedValue({
      data: [{ id: 't1', name: 'User Team', updatedAt: new Date() }],
      pageInfo: { total: 1, cursor: undefined },
    })

    const res = await app.request('/teams?first=10')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data[0].id).toBe('t1')
    expect(mockGetUserTeams).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user1' }))
  })

  it('POST /teams/:teamId/members returns 404', async () => {
    const res = await app.request('/teams/t1/members', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('GET /teams/:teamId/me returns user role in team', async () => {
    mockGetMe.mockResolvedValue({ id: 'user1', name: 'Test User', role: 'owner' })

    const res = await app.request('/teams/t1/me')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.role).toBe('owner')
    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ResourceType.Team,
        id: 't1',
        permission: Permission.Read,
      }),
    )
    expect(mockGetMe).toHaveBeenCalledWith({ teamId: 't1', user: expect.any(Object) })
  })

  it('PATCH /teams/:teamId/me updates user info', async () => {
    mockUpdateMe.mockResolvedValue(undefined)

    const res = await app.request('/teams/t1/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name', imageKey: 'avatar-s3-key' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ResourceType.Team,
        id: 't1',
        permission: Permission.Read,
      }),
    )
    expect(mockUpdateMe).toHaveBeenCalledWith('user1', {
      name: 'New Name',
      imageKey: 'avatar-s3-key',
    })
  })

  it('GET /teams/:teamId/members returns members', async () => {
    mockGetTeamMembers.mockResolvedValue([{ id: 'user1', name: 'Test User', role: 'owner' }])

    const res = await app.request('/teams/t1/members')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ResourceType.Team,
        id: 't1',
        permission: Permission.Read,
      }),
    )
    expect(mockGetTeamMembers).toHaveBeenCalledWith({
      teamId: 't1',
      userId: 'user1',
      includeAgents: false,
    })
  })

  it('GET /teams/:teamId/settings returns settings', async () => {
    mockGetSettings.mockResolvedValue({ someKey: 'some_value' })

    const res = await app.request('/teams/t1/settings')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.someKey).toBe('some_value')
    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ResourceType.Team,
        id: 't1',
        permission: Permission.Read,
      }),
    )
    expect(mockGetSettings).toHaveBeenCalledWith('t1', { isAdmin: true })
  })

  it('GET /teams/:teamId/settings passes isAdmin: false when user lacks admin permission', async () => {
    vi.mocked(authzService.hasPermission).mockImplementation(async (params) => {
      if (params.permission === Permission.Admin) {
        throw new Error('Forbidden')
      }
    })
    mockGetSettings.mockResolvedValue({
      archiveStorage: { enabled: true },
    })

    const res = await app.request('/teams/t1/settings')

    expect(res.status).toBe(200)
    expect(mockGetSettings).toHaveBeenCalledWith('t1', { isAdmin: false })
  })

  it('GET /teams/:teamId/settings does not return emailNotification to readers', async () => {
    mockGetSettings.mockResolvedValue({
      semanticSearchEnabled: false,
      transcode: { videoStrategy: 'best_match', hardwareAcceleration: 'off', threads: 0 },
      appearance: { hideAgent: false },
    })

    const res = await app.request('/teams/t1/settings')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.emailNotification).toBeUndefined()
    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ResourceType.Team,
        id: 't1',
        permission: Permission.Read,
      }),
    )
  })

  it('PATCH /teams/:teamId/settings updates settings', async () => {
    mockUpdateSettings.mockResolvedValue({ transcode: { videoStrategy: 'multi' } })

    const res = await app.request('/teams/t1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'transcode.videoStrategy', value: 'multi' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.transcode.videoStrategy).toBe('multi')
    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ResourceType.Team,
        id: 't1',
        permission: Permission.Admin,
      }),
    )
    expect(mockUpdateSettings).toHaveBeenCalledWith('t1', 'transcode.videoStrategy', 'multi')
  })

  it('PATCH /teams/:teamId/settings updates transcode.videoResolutions', async () => {
    mockUpdateSettings.mockResolvedValue({
      transcode: { videoResolutions: ['720p', '1080p'] },
    })

    const res = await app.request('/teams/t1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'transcode.videoResolutions',
        value: ['720p', '1080p'],
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.transcode.videoResolutions).toEqual(['720p', '1080p'])
    expect(mockUpdateSettings).toHaveBeenCalledWith('t1', 'transcode.videoResolutions', [
      '720p',
      '1080p',
    ])
  })

  it('PATCH /teams/:teamId/settings updates transcode.hardwareAcceleration', async () => {
    mockUpdateSettings.mockResolvedValue({ transcode: { hardwareAcceleration: 'auto' } })

    const res = await app.request('/teams/t1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'transcode.hardwareAcceleration', value: 'auto' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.transcode.hardwareAcceleration).toBe('auto')
    expect(mockUpdateSettings).toHaveBeenCalledWith('t1', 'transcode.hardwareAcceleration', 'auto')
  })

  it('PATCH /teams/:teamId/settings updates transcode.threads', async () => {
    mockUpdateSettings.mockResolvedValue({ transcode: { threads: 8 } })

    const res = await app.request('/teams/t1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'transcode.threads', value: 8 }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.transcode.threads).toBe(8)
    expect(mockUpdateSettings).toHaveBeenCalledWith('t1', 'transcode.threads', 8)
  })

  it('PATCH /teams/:teamId/settings rejects invalid transcode.threads', async () => {
    const resNegative = await app.request('/teams/t1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'transcode.threads', value: -1 }),
    })
    expect(resNegative.status).toBe(400)

    const resTooLarge = await app.request('/teams/t1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'transcode.threads', value: 33 }),
    })
    expect(resTooLarge.status).toBe(400)

    const resFloat = await app.request('/teams/t1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'transcode.threads', value: 4.5 }),
    })
    expect(resFloat.status).toBe(400)
  })

  it('PATCH /teams/:teamId/settings updates appearance.hideAgent', async () => {
    mockUpdateSettings.mockResolvedValue({ appearance: { hideAgent: true } })

    const res = await app.request('/teams/t1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'appearance.hideAgent', value: true }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.appearance.hideAgent).toBe(true)
    expect(mockUpdateSettings).toHaveBeenCalledWith('t1', 'appearance.hideAgent', true)
  })

  it('PATCH /teams/:teamId/settings updates autoArchive settings object', async () => {
    mockUpdateSettings.mockResolvedValue({
      autoArchive: {
        enabled: true,
        method: 'not_updated',
        days: 30,
        postRestoreGraceDays: 30,
      },
    })

    const res = await app.request('/teams/t1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'autoArchive',
        value: {
          enabled: true,
          method: 'not_updated',
          days: 30,
          postRestoreGraceDays: 30,
        },
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.autoArchive.enabled).toBe(true)
    expect(data.autoArchive.days).toBe(30)
    expect(mockUpdateSettings).toHaveBeenCalledWith('t1', 'autoArchive', {
      enabled: true,
      method: 'not_updated',
      days: 30,
      postRestoreGraceDays: 30,
    })
  })

  it('PATCH /teams/:teamId/settings updates autoArchive.enabled individual field', async () => {
    mockUpdateSettings.mockResolvedValue({
      autoArchive: {
        enabled: false,
        method: 'not_updated',
        days: 30,
        postRestoreGraceDays: 30,
      },
    })

    const res = await app.request('/teams/t1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'autoArchive.enabled',
        value: false,
      }),
    })

    expect(res.status).toBe(200)
    expect(mockUpdateSettings).toHaveBeenCalledWith('t1', 'autoArchive.enabled', false)
  })

  it('GET /teams/:teamId/user-metadata returns all metadata for the user in the team', async () => {
    mockListUserMetadata.mockResolvedValue([
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: 'value2' },
    ])

    const res = await app.request('/teams/t1/user-metadata')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
    expect(data[0].key).toBe('key1')
    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ResourceType.Team,
        id: 't1',
        permission: Permission.Read,
      }),
    )
    expect(mockListUserMetadata).toHaveBeenCalledWith('user1', 't1')
  })

  it('PUT /teams/:teamId/user-metadata/:key upserts the metadata', async () => {
    mockUpsertUserMetadata.mockResolvedValue({ key: 'key1', value: 'value1' })

    const res = await app.request('/teams/t1/user-metadata/key1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'value1' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.key).toBe('key1')
    expect(data.value).toBe('value1')
    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ResourceType.Team,
        id: 't1',
        permission: Permission.Read,
      }),
    )
    expect(mockUpsertUserMetadata).toHaveBeenCalledWith('user1', 't1', 'key1', 'value1')
  })

  describe('Runners', () => {
    it('GET /teams/:teamId/runners returns team runners', async () => {
      const { runnerService } = await import('@shumai/core/src/runner')
      vi.mocked(runnerService.listRunners).mockResolvedValue([
        {
          id: 'r1',
          teamId: 't1',
          name: 'Local Mac Mini',
          keyPrefix: 'shm_rn_12345678',
          isDefault: true,
          status: 'connected',
          lastConnectedAt: '2026-11-14T00:00:00.000Z',
          lastDisconnectedAt: null,
          createdAt: '2026-11-14T00:00:00.000Z',
          updatedAt: '2026-11-14T00:00:00.000Z',
        },
      ])

      const res = await app.request('/teams/t1/runners')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe('Local Mac Mini')
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Team,
          id: 't1',
          permission: Permission.Read,
        }),
      )
      expect(runnerService.listRunners).toHaveBeenCalledWith('t1')
    })

    it('POST /teams/:teamId/runners creates a runner and returns key', async () => {
      const { runnerService } = await import('@shumai/core/src/runner')
      vi.mocked(runnerService.createRunner).mockResolvedValue({
        runner: {
          id: 'r1',
          teamId: 't1',
          name: 'Local Mac Mini',
          keyPrefix: 'shm_rn_12345678',
          isDefault: true,
          status: 'disconnected',
          lastConnectedAt: null,
          lastDisconnectedAt: null,
          createdAt: '2026-11-14T00:00:00.000Z',
          updatedAt: '2026-11-14T00:00:00.000Z',
        },
        key: 'shm_rn_1234567890abcdef1234567890abcdef1234567890abcdef',
      })

      const res = await app.request('/teams/t1/runners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Local Mac Mini', isDefault: true }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.runner.id).toBe('r1')
      expect(data.key).toMatch(/^shm_rn_/)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ResourceType.Team,
          id: 't1',
          permission: Permission.Admin,
        }),
      )
      expect(runnerService.createRunner).toHaveBeenCalledWith('t1', {
        name: 'Local Mac Mini',
        isDefault: true,
      })
    })

    it('PATCH /teams/:teamId/runners/:runnerId updates a runner', async () => {
      const { runnerService } = await import('@shumai/core/src/runner')
      vi.mocked(runnerService.updateRunner).mockResolvedValue({
        id: 'r1',
        teamId: 't1',
        name: 'Renamed Runner',
        keyPrefix: 'shm_rn_12345678',
        isDefault: true,
        status: 'disconnected',
        lastConnectedAt: null,
        lastDisconnectedAt: null,
        createdAt: '2026-11-14T00:00:00.000Z',
        updatedAt: '2026-11-14T00:00:00.000Z',
      })

      const res = await app.request('/teams/t1/runners/r1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed Runner', isDefault: true }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.name).toBe('Renamed Runner')
      expect(runnerService.updateRunner).toHaveBeenCalledWith('t1', 'r1', {
        name: 'Renamed Runner',
        isDefault: true,
      })
    })

    it('POST /teams/:teamId/runners/:runnerId/rotate-key rotates runner key', async () => {
      const { runnerService } = await import('@shumai/core/src/runner')
      vi.mocked(runnerService.rotateRunnerKey).mockResolvedValue({
        runner: {
          id: 'r1',
          teamId: 't1',
          name: 'Local Mac Mini',
          keyPrefix: 'shm_rn_abcdef12',
          isDefault: true,
          status: 'disconnected',
          lastConnectedAt: null,
          lastDisconnectedAt: null,
          createdAt: '2026-11-14T00:00:00.000Z',
          updatedAt: '2026-11-14T00:00:00.000Z',
        },
        key: 'shm_rn_abcdef1234567890abcdef1234567890abcdef1234567890',
      })

      const res = await app.request('/teams/t1/runners/r1/rotate-key', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.key).toMatch(/^shm_rn_abcdef12/)
      expect(runnerService.rotateRunnerKey).toHaveBeenCalledWith('t1', 'r1')
    })

    it('DELETE /teams/:teamId/runners/:runnerId deletes a runner', async () => {
      const { runnerService } = await import('@shumai/core/src/runner')
      vi.mocked(runnerService.deleteRunner).mockResolvedValue(undefined)

      const res = await app.request('/teams/t1/runners/r1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(runnerService.deleteRunner).toHaveBeenCalledWith('t1', 'r1')
    })
  })

  describe('API Tokens', () => {
    it('GET /teams/:teamId/api-tokens', async () => {
      const { apiTokenService } = await import('@shumai/core/src/user/api-token')
      const mockDate = new Date('2026-06-21T00:00:00.000Z')
      vi.mocked(apiTokenService.listTokens).mockResolvedValue([
        {
          id: 'token1',
          tokenHint: 'a1b2',
          name: 'cli-key',
          userId: 'user1',
          createdAt: mockDate,
          updatedAt: mockDate,
        },
      ])

      const res = await app.request('/teams/t1/api-tokens')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      // The plaintext token is never returned when listing
      expect(data[0]).toEqual({
        id: 'token1',
        tokenHint: 'a1b2',
        name: 'cli-key',
        createdAt: '2026-06-21T00:00:00.000Z',
      })
      expect(data[0]).not.toHaveProperty('token')
      expect(apiTokenService.listTokens).toHaveBeenCalledWith('user1')
    })

    it('POST /teams/:teamId/api-tokens', async () => {
      const { apiTokenService } = await import('@shumai/core/src/user/api-token')
      const mockDate = new Date('2026-06-21T00:00:00.000Z')
      vi.mocked(apiTokenService.createToken).mockResolvedValue({
        record: {
          id: 'token1',
          tokenHint: 'a1b2',
          name: 'cli-key',
          userId: 'user1',
          createdAt: mockDate,
          updatedAt: mockDate,
        },
        token: 'shumai_plaintext-a1b2',
      })

      const res = await app.request('/teams/t1/api-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'cli-key' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      // The plaintext is returned exactly once, at creation
      expect(data).toEqual({
        id: 'token1',
        token: 'shumai_plaintext-a1b2',
        tokenHint: 'a1b2',
        name: 'cli-key',
        createdAt: '2026-06-21T00:00:00.000Z',
      })
      expect(apiTokenService.createToken).toHaveBeenCalledWith('user1', 'cli-key')
    })

    it('DELETE /teams/:teamId/api-tokens/:tokenId', async () => {
      const { apiTokenService } = await import('@shumai/core/src/user/api-token')
      // Mocking return value of deleteToken is simpler with any casting
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(apiTokenService.deleteToken).mockResolvedValue({} as any)

      const res = await app.request('/teams/t1/api-tokens/token1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ success: true })
      expect(apiTokenService.deleteToken).toHaveBeenCalledWith('user1', 'token1')
    })

    it('GET /teams/:teamId/ai-usage returns team usage stats for owner', async () => {
      const { aiUsageService } = await import('@shumai/core/src/ai-usage/ai-usage')
      vi.mocked(aiUsageService.getTeamUsageStats).mockResolvedValue({
        timeframe: '30d',
        team: {
          inputTokens: 1000,
          outputTokens: 500,
          cacheReadTokens: 200,
          totalTokens: 1500,
          cost: 0.005,
        },
      })

      const res = await app.request('/teams/t1/ai-usage?timeframe=30d')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.team.totalTokens).toBe(1500)
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          permission: Permission.Admin,
          type: ResourceType.Team,
          id: 't1',
        }),
      )
      expect(aiUsageService.getTeamUsageStats).toHaveBeenCalledWith({
        teamId: 't1',
        timeframe: '30d',
        userId: undefined,
      })
    })

    it('GET /teams/:teamId/ai-usage?userId=user1 returns specific member usage stats', async () => {
      const { aiUsageService } = await import('@shumai/core/src/ai-usage/ai-usage')
      vi.mocked(aiUsageService.getTeamUsageStats).mockResolvedValue({
        timeframe: '7d',
        member: {
          userId: 'user1',
          userName: 'Test User',
          userEmail: 'user1@example.com',
          role: 'owner',
          inputTokens: 400,
          outputTokens: 200,
          cacheReadTokens: 50,
          totalTokens: 600,
          cost: 0.002,
        },
      })

      const res = await app.request('/teams/t1/ai-usage?timeframe=7d&userId=user1')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.member.userId).toBe('user1')
      expect(aiUsageService.getTeamUsageStats).toHaveBeenCalledWith({
        teamId: 't1',
        timeframe: '7d',
        userId: 'user1',
      })
    })

    it('GET /teams/:teamId/audit-logs returns list of audit logs for team owner', async () => {
      const { auditLogService } = await import('@shumai/core/src/auditLog/auditLog')
      vi.mocked(auditLogService.listAuditLogs).mockResolvedValue({
        nodes: [
          {
            id: 'log1',
            action: AuditAction.project_create,
            teamId: 't1',
            userId: 'user1',
            agentId: null,
            agent: null,
            projectId: 'p1',
            itemId: 'p1',
            createdAt: new Date().toISOString(),
          },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
        total: 1,
      })

      const res = await app.request('/teams/t1/audit-logs')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.nodes).toHaveLength(1)
      expect(data.nodes[0].id).toBe('log1')
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          permission: Permission.Admin,
          type: ResourceType.Team,
          id: 't1',
        }),
      )
    })

    it('GET /teams/:teamId/workflow-tasks returns list of workflow tasks for team owner', async () => {
      const { workflowTaskService } = await import('@shumai/core/src/workflowTask/workflowTask')
      vi.mocked(workflowTaskService.listWorkflowTasks).mockResolvedValue({
        nodes: [
          {
            id: 'task1',
            uid: 'uid1',
            teamId: 't1',
            projectId: 'p1',
            assetId: 'a1',
            type: 'transcode_video' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            status: 'processing' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            payload: {},
            output: null,
            heartbeat: null,
            inputTokens: 0,
            outputTokens: 0,
            model: null,
            sessionId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
        total: 1,
      })

      const res = await app.request('/teams/t1/workflow-tasks')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.nodes).toHaveLength(1)
      expect(data.nodes[0].id).toBe('task1')
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          permission: Permission.Admin,
          type: ResourceType.Team,
          id: 't1',
        }),
      )
    })

    it('POST /teams/:teamId/workflow-tasks/batch-status returns batch task statuses', async () => {
      const { workflowTaskService } = await import('@shumai/core/src/workflowTask/workflowTask')
      vi.mocked(workflowTaskService.getBatchWorkflowTaskStatus).mockResolvedValue({
        tasks: [
          {
            id: 'task1',
            uid: 'uid1',
            teamId: 't1',
            projectId: 'p1',
            assetId: 'a1',
            type: 'transcode_video' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            status: 'completed' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            payload: {},
            output: null,
            heartbeat: null,
            inputTokens: 0,
            outputTokens: 0,
            model: null,
            sessionId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      })

      const res = await app.request('/teams/t1/workflow-tasks/batch-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: ['task1'] }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.tasks).toHaveLength(1)
      expect(data.tasks[0].status).toBe('completed')
    })

    it('POST /teams/:teamId/workflow-tasks/:taskId/stop stops task for team owner', async () => {
      const { workflowTaskService } = await import('@shumai/core/src/workflowTask/workflowTask')
      vi.mocked(workflowTaskService.stopWorkflowTask).mockResolvedValue({
        success: true,
        task: {
          id: 'task1',
          uid: 'uid1',
          teamId: 't1',
          projectId: 'p1',
          assetId: 'a1',
          type: 'transcode_video' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          status: 'failed' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          payload: {},
          output: { error: 'Task was stopped by user' },
          heartbeat: null,
          inputTokens: 0,
          outputTokens: 0,
          model: null,
          sessionId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })

      const res = await app.request('/teams/t1/workflow-tasks/task1/stop', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.task.status).toBe('failed')
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          permission: Permission.Admin,
          type: ResourceType.Team,
          id: 't1',
        }),
      )
    })

    it('GET /teams/:teamId/turntable-settings returns turntable settings', async () => {
      const { turntableService } = await import('@shumai/core/src/turntable/turntable')
      vi.mocked(turntableService.getSettings).mockResolvedValue({
        url: 'http://localhost:3001',
        username: 'user',
        hasPassword: true,
        isEnvConfigured: false,
      })

      const res = await app.request('/teams/t1/turntable-settings')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        url: 'http://localhost:3001',
        username: 'user',
        hasPassword: true,
        isEnvConfigured: false,
      })
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          permission: Permission.Read,
          type: ResourceType.Team,
          id: 't1',
        }),
      )
    })

    it('PUT /teams/:teamId/turntable-settings updates settings when not env configured', async () => {
      const { turntableService } = await import('@shumai/core/src/turntable/turntable')
      vi.mocked(turntableService.updateSettings).mockResolvedValue({
        url: 'http://custom:3001',
        username: 'newuser',
        hasPassword: true,
        isEnvConfigured: false,
      })

      const res = await app.request('/teams/t1/turntable-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'http://custom:3001',
          username: 'newuser',
          password: 'secretpassword',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.url).toBe('http://custom:3001')
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          permission: Permission.Admin,
          type: ResourceType.Team,
          id: 't1',
        }),
      )
    })

    it('PUT /teams/:teamId/turntable-settings returns 400 when env configured', async () => {
      const { turntableService } = await import('@shumai/core/src/turntable/turntable')
      vi.mocked(turntableService.updateSettings).mockRejectedValue(
        new Error(
          'Turntable settings are configured via environment variables and cannot be edited',
        ),
      )

      const res = await app.request('/teams/t1/turntable-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'http://custom:3001',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain('configured via environment variables')
    })

    it('POST /teams/:teamId/turntable-settings/test tests connection', async () => {
      const { turntableService } = await import('@shumai/core/src/turntable/turntable')
      vi.mocked(turntableService.testConnection).mockResolvedValue({
        ok: true,
        version: '1.0.0',
        blender: '5.2.0',
      })

      const res = await app.request('/teams/t1/turntable-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'http://custom:3001',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.blender).toBe('5.2.0')
    })

    it('GET /teams/:teamId/gotenberg-settings returns gotenberg settings', async () => {
      const { gotenbergService } = await import('@shumai/core/src/gotenberg/gotenberg')
      vi.mocked(gotenbergService.getSettings).mockResolvedValue({
        url: 'http://localhost:3000',
        username: 'user',
        hasPassword: true,
        isEnvConfigured: false,
      })

      const res = await app.request('/teams/t1/gotenberg-settings')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        url: 'http://localhost:3000',
        username: 'user',
        hasPassword: true,
        isEnvConfigured: false,
      })
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          permission: Permission.Read,
          type: ResourceType.Team,
          id: 't1',
        }),
      )
    })

    it('PUT /teams/:teamId/gotenberg-settings updates settings when not env configured', async () => {
      const { gotenbergService } = await import('@shumai/core/src/gotenberg/gotenberg')
      vi.mocked(gotenbergService.updateSettings).mockResolvedValue({
        url: 'http://custom:3000',
        username: 'newuser',
        hasPassword: true,
        isEnvConfigured: false,
      })

      const res = await app.request('/teams/t1/gotenberg-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'http://custom:3000',
          username: 'newuser',
          password: 'secretpassword',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.url).toBe('http://custom:3000')
      expect(authzService.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          permission: Permission.Admin,
          type: ResourceType.Team,
          id: 't1',
        }),
      )
    })

    it('PUT /teams/:teamId/gotenberg-settings returns 400 when env configured', async () => {
      const { gotenbergService } = await import('@shumai/core/src/gotenberg/gotenberg')
      vi.mocked(gotenbergService.updateSettings).mockRejectedValue(
        new Error(
          'Gotenberg settings are configured via environment variables and cannot be edited',
        ),
      )

      const res = await app.request('/teams/t1/gotenberg-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'http://custom:3000',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain('configured via environment variables')
    })

    it('POST /teams/:teamId/gotenberg-settings/test tests connection', async () => {
      const { gotenbergService } = await import('@shumai/core/src/gotenberg/gotenberg')
      vi.mocked(gotenbergService.testConnection).mockResolvedValue({
        ok: true,
        version: '8.3.0',
      })

      const res = await app.request('/teams/t1/gotenberg-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'http://custom:3000',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.version).toBe('8.3.0')
    })
  })
})
