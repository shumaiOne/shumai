import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import teamRoute from './team'
import { authMiddleware } from './middleware/auth'
import { teamService } from '@shumai/core/src/team/team'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'
import { notificationService } from '@shumai/core/src/notification/notification'
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

describe('team api', () => {
  const app = new Hono().use('*', authMiddleware).route('/', teamRoute)
  let mockCreateTeam: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockGetUserTeams: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockJoinTeam: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockGetMe: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockGetTeamMembers: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockGetSettings: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockUpdateSettings: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockListUserMetadata: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockUpsertUserMetadata: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockCreateNotification: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockGetSandboxSettings: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockUpdateSandboxSettings: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockUpdateMe: any // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(() => {
    mockCreateTeam = vi.spyOn(teamService, 'createTeam')
    mockGetUserTeams = vi.spyOn(teamService, 'getUserTeams')
    mockJoinTeam = vi.spyOn(teamService, 'joinTeam')
    mockGetMe = vi.spyOn(teamService, 'getMe')
    mockGetTeamMembers = vi.spyOn(teamService, 'getTeamMembers')
    mockGetSettings = vi.spyOn(teamService, 'getSettings')
    mockUpdateSettings = vi.spyOn(teamService, 'updateSettings')
    mockListUserMetadata = vi.spyOn(userMetadataService, 'listMetadata')
    mockUpsertUserMetadata = vi.spyOn(userMetadataService, 'upsertMetadata')
    mockCreateNotification = vi.spyOn(notificationService, 'create').mockResolvedValue()
    mockGetSandboxSettings = vi.spyOn(teamService, 'getSandboxSettings')
    mockUpdateSandboxSettings = vi.spyOn(teamService, 'updateSandboxSettings')
    mockUpdateMe = vi.spyOn(teamService, 'updateMe')
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POST /teams creates a new team', async () => {
    const mockTeam = { id: 't1', name: 'New Team', updatedAt: new Date() }
    mockCreateTeam.mockResolvedValue(mockTeam)

    const res = await app.request('/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Team',
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('t1')
    expect(mockCreateTeam).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user1' }),
      expect.objectContaining({ name: 'New Team' }),
    )
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

  it('POST /teams/:teamId/members joins team and sends notification', async () => {
    mockJoinTeam.mockResolvedValue(undefined)

    const res = await app.request('/teams/t1/members', { method: 'POST' })

    expect(res.status).toBe(204)
    expect(mockJoinTeam).toHaveBeenCalledWith({ teamId: 't1', userId: 'user1' })
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'new_user_join_team',
        teamId: 't1',
        userId: 'user1',
      }),
    )
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
    expect(mockGetSettings).toHaveBeenCalledWith('t1')
  })

  it('PATCH /teams/:teamId/settings updates settings', async () => {
    mockUpdateSettings.mockResolvedValue({ transcode: { videoStrategy: 'all' } })

    const res = await app.request('/teams/t1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'transcode.videoStrategy', value: 'all' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.transcode.videoStrategy).toBe('all')
    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ResourceType.Team,
        id: 't1',
        permission: Permission.Admin,
      }),
    )
    expect(mockUpdateSettings).toHaveBeenCalledWith('t1', 'transcode.videoStrategy', 'all')
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

  it('GET /teams/:teamId/sandbox returns sandbox settings', async () => {
    mockGetSandboxSettings.mockResolvedValue({
      allowedDomains: ['example.com'],
      pendingDomains: ['pending.com'],
    })

    const res = await app.request('/teams/t1/sandbox')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.allowedDomains).toEqual(['example.com'])
    expect(data.pendingDomains).toEqual(['pending.com'])
    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ResourceType.Team,
        id: 't1',
        permission: Permission.Read,
      }),
    )
    expect(mockGetSandboxSettings).toHaveBeenCalledWith('t1')
  })

  it('PUT /teams/:teamId/sandbox updates sandbox settings', async () => {
    mockUpdateSandboxSettings.mockResolvedValue({
      allowedDomains: ['new.com'],
      pendingDomains: ['new-pending.com'],
    })

    const res = await app.request('/teams/t1/sandbox', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedDomains: ['new.com'], pendingDomains: ['new-pending.com'] }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.allowedDomains).toEqual(['new.com'])
    expect(data.pendingDomains).toEqual(['new-pending.com'])
    expect(authzService.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ResourceType.Team,
        id: 't1',
        permission: Permission.Admin,
      }),
    )
    expect(mockUpdateSandboxSettings).toHaveBeenCalledWith('t1', {
      allowedDomains: ['new.com'],
      pendingDomains: ['new-pending.com'],
    })
  })

  describe('API Tokens', () => {
    it('GET /teams/:teamId/api-tokens', async () => {
      const { apiTokenService } = await import('@shumai/core/src/user/api-token')
      const mockDate = new Date('2026-06-21T00:00:00.000Z')
      vi.mocked(apiTokenService.listTokens).mockResolvedValue([
        {
          id: 'token1',
          token: 'ulid1',
          name: 'cli-key',
          userId: 'user1',
          createdAt: mockDate,
          updatedAt: mockDate,
        },
        // Mocking return value of listTokens is simpler with any casting
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any)

      const res = await app.request('/teams/t1/api-tokens')

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0]).toEqual({
        id: 'token1',
        token: 'ulid1',
        name: 'cli-key',
        createdAt: '2026-06-21T00:00:00.000Z',
      })
      expect(apiTokenService.listTokens).toHaveBeenCalledWith('user1')
    })

    it('POST /teams/:teamId/api-tokens', async () => {
      const { apiTokenService } = await import('@shumai/core/src/user/api-token')
      const mockDate = new Date('2026-06-21T00:00:00.000Z')
      vi.mocked(apiTokenService.createToken).mockResolvedValue({
        id: 'token1',
        token: 'ulid1',
        name: 'cli-key',
        userId: 'user1',
        createdAt: mockDate,
        updatedAt: mockDate,
        // Mocking return value of createToken is simpler with any casting
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const res = await app.request('/teams/t1/api-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'cli-key' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        id: 'token1',
        token: 'ulid1',
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
  })
})
