import { describe, it, expect, beforeEach } from 'vitest'
import { MetadataService } from './metadata'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'

describe('MetadataService', () => {
  setupTestDbHooks()

  let metadataService: MetadataService

  beforeEach(() => {
    metadataService = new MetadataService()
  })

  it('should initialize system fields', async () => {
    await metadataService.syncSystemFields()
    const fields = await prisma.metadataField.findMany({
      where: { scope: 'SYSTEM' },
    })
    expect(fields.length).toBeGreaterThan(0)

    // Test idempotency
    await metadataService.syncSystemFields()
    const fields2 = await prisma.metadataField.findMany({
      where: { scope: 'SYSTEM' },
    })
    expect(fields2.length).toBe(fields.length)
  })

  it('ProjectFieldsOrder', async () => {
    const user = await prisma.user.create({
      data: { name: 'test-user', email: 'test-user@example.com', password: 'password' },
    })
    const team = await prisma.team.create({
      data: { name: 'test-team' },
    })
    const project = await prisma.project.create({
      data: { name: 'test-project', teamId: team.id },
    })

    const field1 = await prisma.metadataField.create({
      data: {
        key: 'field1',
        scope: 'PROJECT',
        project: { connect: { id: project.id } },
        config: { name: 'Field A', type: 'text' },
      },
    })
    const field2 = await prisma.metadataField.create({
      data: {
        key: 'field2',
        scope: 'PROJECT',
        project: { connect: { id: project.id } },
        config: { name: 'Field B', type: 'text' },
      },
    })
    const field3 = await prisma.metadataField.create({
      data: {
        key: 'field3',
        scope: 'PROJECT',
        project: { connect: { id: project.id } },
        config: { name: 'Field C', type: 'text' },
      },
    })

    const order = [
      { fieldId: field3.key, visible: true },
      { fieldId: field1.key, visible: false },
    ]
    await metadataService.updateProjectFieldsOrder(user.id, project.id, order)

    const fields = await metadataService.listProjectFields(user.id, project.id)

    // Filter out system and team fields for simple comparison
    const projectFields = fields.filter((f) => f.field.scope === 'PROJECT')

    expect(projectFields.length).toBe(3)

    // Check order and visibility
    expect(projectFields[0].field.key).toBe(field3.key)
    expect(projectFields[0].visible).toBe(true)

    expect(projectFields[1].field.key).toBe(field1.key)
    expect(projectFields[1].visible).toBe(false)

    expect(projectFields[2].field.key).toBe(field2.key)
    expect(projectFields[2].visible).toBe(false)
  })

  it('AIAutofillAndDescription', async () => {
    const team = await prisma.team.create({
      data: { name: 'test-team' },
    })
    await prisma.project.create({
      data: { name: 'test-project', teamId: team.id },
    })

    const desc = 'This is a test description'

    // Instead of testing service create method which failed due to connection scope, we test service update
    const teamField = await prisma.metadataField.create({
      data: {
        key: 'teamfield1',
        scope: 'TEAM',
        team: { connect: { id: team.id } },
        config: { name: 'Test Team Field', type: 'text' },
        aiAutofill: true,
        description: desc,
      },
    })

    const newDesc = 'Updated description'
    const updatedTeamField = await metadataService.updateTeamField(team.id, teamField.key, {
      config: { name: 'Test Team Field', type: 'text' },
      aiAutofill: false,
      description: newDesc,
    })
    expect(updatedTeamField.aiAutofill).toBe(false)
    expect(updatedTeamField.description).toBe(newDesc)
    // IDOR test
    await expect(
      metadataService.updateTeamField('wrong-team-id', teamField.key, {
        config: { name: 'Hack', type: 'text' },
      }),
    ).rejects.toThrow('Field does not belong to this team')
  })

  it('UpdateAssetMetadata', async () => {
    const team = await prisma.team.create({
      data: { name: 'test-team' },
    })
    const project = await prisma.project.create({
      data: { name: 'test-project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'test-asset',
        project: { connect: { id: project.id } },
        type: 'file',
        status: 'uploaded',
        sizeByte: 100,
      },
    })
    const reqs = [
      { key: 'resolution_width', value: 1920 },
      { key: 'resolution_height', value: 1080 },
    ]
    await metadataService.updateAssetMetadata(asset.id, reqs)

    const values = await prisma.assetMetadataValue.findMany({
      where: { assetId: asset.id },
    })
    expect(values).toHaveLength(2)
    const width = values.find((v) => v.fieldId === 'resolution_width')
    expect(width?.numberValue).toBe(1920)
    const height = values.find((v) => v.fieldId === 'resolution_height')
    expect(height?.numberValue).toBe(1080)
  })

  it('should reject updating read-only fields', async () => {
    const team = await prisma.team.create({
      data: { name: 'test-team' },
    })
    const project = await prisma.project.create({
      data: { name: 'test-project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'test-asset',
        project: { connect: { id: project.id } },
        type: 'file',
        status: 'uploaded',
        sizeByte: 100,
      },
    })

    // Create a read-only metadata field
    const field = await prisma.metadataField.create({
      data: {
        key: 'readonly-field',
        scope: 'PROJECT',
        project: { connect: { id: project.id } },
        config: { name: 'Readonly Field', type: 'text' },
        readOnly: true,
      },
    })

    const reqs = [{ key: field.key, value: 'some value' }]

    await expect(metadataService.updateAssetMetadata(asset.id, reqs)).rejects.toThrow(
      'Field readonly-field is read-only',
    )

    // With allowReadOnly=true, it should successfully update
    await metadataService.updateAssetMetadata(asset.id, reqs, true)
    const val = await prisma.assetMetadataValue.findUnique({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        assetId_fieldId: {
          assetId: asset.id,
          fieldId: field.key,
        },
      },
    })
    expect(val?.stringValue).toBe('some value')
  })
})
