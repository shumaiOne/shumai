import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import teamRoute from './team'
import { authMiddleware } from '@/api/middleware/auth'
import { teamService } from '@/services/team/team'
import { userMetadataService } from '@/services/user-metadata/user-metadata'
import { notificationService } from '@/services/notification/notification'

vi.mock('@/services/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn(),
  },
  Permission: {
    Read: 'Read',
    Edit: 'Edit',
    Admin: 'Admin',
  },
}))

vi.mock('@/api/middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { id: 'user1', name: 'Test User' })
    await next()
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
    expect(mockGetMe).toHaveBeenCalledWith({ teamId: 't1', user: expect.any(Object) })
  })

  it('GET /teams/:teamId/members returns members', async () => {
    mockGetTeamMembers.mockResolvedValue([{ id: 'user1', name: 'Test User', role: 'owner' }])

    const res = await app.request('/teams/t1/members')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(mockGetTeamMembers).toHaveBeenCalledWith({ teamId: 't1', includeAgents: false })
  })

  it('GET /teams/:teamId/settings returns settings', async () => {
    mockGetSettings.mockResolvedValue({ someKey: 'some_value' })

    const res = await app.request('/teams/t1/settings')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.someKey).toBe('some_value')
    expect(mockGetSettings).toHaveBeenCalledWith('t1')
  })

  it('PATCH /teams/:teamId/settings updates settings', async () => {
    mockUpdateSettings.mockResolvedValue({ someKey: 'new_value' })

    const res = await app.request('/teams/t1/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'someKey', value: 'new_value' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.someKey).toBe('new_value')
    expect(mockUpdateSettings).toHaveBeenCalledWith('t1', 'someKey', 'new_value')
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
    expect(mockUpsertUserMetadata).toHaveBeenCalledWith('user1', 't1', 'key1', 'value1')
  })

  it('GET /teams/:teamId/sandbox returns sandbox settings', async () => {
    mockGetSandboxSettings.mockResolvedValue({ allowedDomains: ['example.com'] })

    const res = await app.request('/teams/t1/sandbox')

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.allowedDomains).toEqual(['example.com'])
    expect(mockGetSandboxSettings).toHaveBeenCalledWith('t1')
  })

  it('PUT /teams/:teamId/sandbox updates sandbox settings', async () => {
    mockUpdateSandboxSettings.mockResolvedValue({ allowedDomains: ['new.com'] })

    const res = await app.request('/teams/t1/sandbox', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedDomains: ['new.com'] }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.allowedDomains).toEqual(['new.com'])
    expect(mockUpdateSandboxSettings).toHaveBeenCalledWith('t1', { allowedDomains: ['new.com'] })
  })
})
