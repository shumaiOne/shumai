import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { userMetadataService } from './user-metadata'
import { describe, expect, it } from 'vitest'

describe('UserMetadataService', () => {
  setupTestDbHooks()

  it('should upsert and get metadata', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: `test-${Date.now()}@example.com`, password: 'pw' },
    })
    const team = await prisma.team.create({
      data: { name: 'Test Team' },
    })

    const key = 'project:1:sort'
    const value = { field: 'name', order: 'asc' }

    await userMetadataService.upsertMetadata(user.id, team.id, key, value)

    const metadata = await userMetadataService.getMetadata(user.id, team.id, key)
    expect(metadata).toEqual({
      key,
      value,
    })

    // Update
    const newValue = { field: 'updatedAt', order: 'desc' }
    await userMetadataService.upsertMetadata(user.id, team.id, key, newValue)

    const updatedMetadata = await userMetadataService.getMetadata(user.id, team.id, key)
    expect(updatedMetadata?.value).toEqual(newValue)
  })

  it('should list all metadata for a user in a team', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User 2', email: `test2-${Date.now()}@example.com`, password: 'pw' },
    })
    const team = await prisma.team.create({
      data: { name: 'Test Team 2' },
    })

    await userMetadataService.upsertMetadata(user.id, team.id, 'key1', 'value1')
    await userMetadataService.upsertMetadata(user.id, team.id, 'key2', 'value2')

    const list = await userMetadataService.listMetadata(user.id, team.id)
    expect(list).toHaveLength(2)
    expect(list).toEqual([
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: 'value2' },
    ])
  })

  it('should return null if metadata not found', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User 3', email: `test3-${Date.now()}@example.com`, password: 'pw' },
    })
    const team = await prisma.team.create({
      data: { name: 'Test Team 3' },
    })

    const metadata = await userMetadataService.getMetadata(user.id, team.id, 'nonexistent')
    expect(metadata).toBeNull()
  })
})
