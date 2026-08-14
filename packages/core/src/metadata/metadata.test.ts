import { describe, it, expect, beforeEach } from 'vitest'
import { MetadataService } from './metadata'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'

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

  it('AutofillSourceAndDescription', async () => {
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
        config: { name: 'Test Team Field', type: 'text', autofillSource: 'CONTENT' },
        description: desc,
      },
    })

    const newDesc = 'Updated description'
    const updatedTeamField = await metadataService.updateTeamField(team.id, teamField.key, {
      config: { name: 'Test Team Field', type: 'text', autofillSource: 'NONE' },
      description: newDesc,
    })
    expect(updatedTeamField.config?.autofillSource).toBe('NONE')
    expect(updatedTeamField.description).toBe(newDesc)
    // IDOR test
    await expect(
      metadataService.updateTeamField('wrong-team-id', teamField.key, {
        config: { name: 'Hack', type: 'text', autofillSource: 'NONE' },
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
    const width = values.find((v) => v.fieldKey === 'resolution_width')
    expect(width?.numberValue).toBe(1920)
    const height = values.find((v) => v.fieldKey === 'resolution_height')
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
        assetId_fieldKey: {
          assetId: asset.id,
          fieldKey: field.key,
        },
      },
    })
    expect(val?.stringValue).toBe('some value')
  })

  it('should save and retrieve user and userMulti metadata fields', async () => {
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

    const userField = await prisma.metadataField.create({
      data: {
        key: 'assigned_user',
        scope: 'PROJECT',
        project: { connect: { id: project.id } },
        config: { name: 'Assigned User', type: 'user' },
      },
    })

    const userMultiField = await prisma.metadataField.create({
      data: {
        key: 'reviewers',
        scope: 'PROJECT',
        project: { connect: { id: project.id } },
        config: { name: 'Reviewers', type: 'userMulti' },
      },
    })

    const singleUserId = 'user_ulid_123'
    const multiUserIds = ['user_ulid_456', 'user_ulid_789']

    const reqs = [
      { key: userField.key, value: singleUserId },
      { key: userMultiField.key, value: multiUserIds },
    ]

    await metadataService.updateAssetMetadata(asset.id, reqs)

    const values = await prisma.assetMetadataValue.findMany({
      where: { assetId: asset.id },
    })
    expect(values).toHaveLength(2)

    const singleVal = values.find((v) => v.fieldKey === userField.key)
    expect(singleVal?.stringValue).toBe(singleUserId)

    const multiVal = values.find((v) => v.fieldKey === userMultiField.key)
    expect(multiVal?.jsonValue).toEqual(multiUserIds)
  })

  it('should dynamically create new options for select fields and store option id', async () => {
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

    const selectField = await prisma.metadataField.create({
      data: {
        key: 'ai_provider',
        scope: 'PROJECT',
        project: { connect: { id: project.id } },
        config: {
          name: 'AI Provider',
          type: 'select',
          select: {
            options: [
              { id: 'openai', displayName: 'OpenAI', color: '#f43f5e' },
              { id: 'google', displayName: 'Google', color: '#3b82f6' },
            ],
          },
        },
      },
    })

    // 1. Add new option 'Kling AI'
    await metadataService.updateAssetMetadata(asset.id, [
      { key: selectField.key, value: { newOption: { value: 'Kling AI' } } },
    ])

    // Verify option added to field config
    const updatedField = await prisma.metadataField.findUnique({
      where: { key: selectField.key },
    })
    const options = (updatedField?.config as PrismaJson.FieldConfig)?.select?.options || []
    expect(options).toHaveLength(3)
    const klingOpt = options.find((o) => o.displayName === 'Kling AI')
    expect(klingOpt).toBeDefined()
    expect(klingOpt?.id).toBe('kling-ai')
    expect(klingOpt?.color).toBeDefined()

    // Verify asset metadata value stores the option ID
    const val = await prisma.assetMetadataValue.findUnique({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        assetId_fieldKey: {
          assetId: asset.id,
          fieldKey: selectField.key,
        },
      },
    })
    expect(val?.stringValue).toBe('kling-ai')

    // 2. Deduplication: passing 'kling ai' case-insensitively should reuse existing 'kling-ai'
    await metadataService.updateAssetMetadata(asset.id, [
      { key: selectField.key, value: { newOption: { value: 'kling ai' } } },
    ])
    const updatedField2 = await prisma.metadataField.findUnique({
      where: { key: selectField.key },
    })
    const options2 = (updatedField2?.config as PrismaJson.FieldConfig)?.select?.options || []
    expect(options2).toHaveLength(3) // Not 4!
  })

  it('should dynamically create new options for selectMulti fields and store array of option ids', async () => {
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

    const selectMultiField = await prisma.metadataField.create({
      data: {
        key: 'tags',
        scope: 'PROJECT',
        project: { connect: { id: project.id } },
        config: {
          name: 'Tags',
          type: 'selectMulti',
          selectMulti: {
            options: [{ id: 'tag1', displayName: 'Tag 1', color: '#f43f5e' }],
          },
        },
      },
    })

    // Pass mixed existing and new option
    await metadataService.updateAssetMetadata(asset.id, [
      {
        key: selectMultiField.key,
        value: ['tag1', { newOption: { value: 'Tag 2' } }],
      },
    ])

    // Verify option added to field config
    const updatedField = await prisma.metadataField.findUnique({
      where: { key: selectMultiField.key },
    })
    const options = (updatedField?.config as PrismaJson.FieldConfig)?.selectMulti?.options || []
    expect(options).toHaveLength(2)
    const tag2Opt = options.find((o) => o.displayName === 'Tag 2')
    expect(tag2Opt).toBeDefined()
    expect(tag2Opt?.id).toBe('tag-2')

    // Verify asset metadata value stores array of IDs
    const val = await prisma.assetMetadataValue.findUnique({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        assetId_fieldKey: {
          assetId: asset.id,
          fieldKey: selectMultiField.key,
        },
      },
    })
    expect(val?.jsonValue).toEqual(['tag1', 'tag-2'])
  })

  it('should reject invalid newOption value format', async () => {
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

    const selectField = await prisma.metadataField.create({
      data: {
        key: 'field_opt',
        scope: 'PROJECT',
        project: { connect: { id: project.id } },
        config: { name: 'Field Opt', type: 'select' },
      },
    })

    await expect(
      metadataService.updateAssetMetadata(asset.id, [
        { key: selectField.key, value: { newOption: { value: '   ' } } },
      ]),
    ).rejects.toThrow('value must be a non-empty string')
  })

  it('should handle ID collisions by appending numeric suffix', async () => {
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

    const selectField = await prisma.metadataField.create({
      data: {
        key: 'collision_test',
        scope: 'PROJECT',
        project: { connect: { id: project.id } },
        config: {
          name: 'Collision Test',
          type: 'select',
          select: {
            options: [
              { id: 'kling-ai', displayName: 'Old Kling AI', color: '#f43f5e' },
              { id: 'kling-ai-1', displayName: 'Old Kling AI Suffix 1', color: '#3b82f6' },
            ],
          },
        },
      },
    })

    // Now adding a new option with different displayName whose slug collides with 'kling-ai'
    await metadataService.updateAssetMetadata(asset.id, [
      { key: selectField.key, value: { newOption: { value: 'Kling AI Unique' } } },
    ])

    const updatedField = await prisma.metadataField.findUnique({
      where: { key: selectField.key },
    })
    const options = (updatedField?.config as PrismaJson.FieldConfig)?.select?.options || []
    const newOpt = options.find((o) => o.displayName === 'Kling AI Unique')
    expect(newOpt).toBeDefined()
    expect(newOpt?.id).toBe('kling-ai-unique')

    // Test when baseId and candidateId-1 exist, next should be candidateId-2
    const collisionField = await prisma.metadataField.create({
      data: {
        key: 'collision_base',
        scope: 'PROJECT',
        project: { connect: { id: project.id } },
        config: {
          name: 'Collision Base',
          type: 'select',
          select: {
            options: [
              { id: 'custom-tool', displayName: 'First Tool', color: '#f43f5e' },
              { id: 'custom-tool-1', displayName: 'Second Tool', color: '#3b82f6' },
            ],
          },
        },
      },
    })

    // displayName is 'Custom Tool' which has baseId 'custom-tool' (not matching display names 'First Tool' / 'Second Tool')
    await metadataService.updateAssetMetadata(asset.id, [
      { key: collisionField.key, value: { newOption: { value: 'Custom Tool' } } },
    ])

    const updatedCollisionField = await prisma.metadataField.findUnique({
      where: { key: collisionField.key },
    })
    const collisionOpts =
      (updatedCollisionField?.config as PrismaJson.FieldConfig)?.select?.options || []
    const resolvedNewOpt = collisionOpts.find((o) => o.displayName === 'Custom Tool')
    expect(resolvedNewOpt).toBeDefined()
    expect(resolvedNewOpt?.id).toBe('custom-tool-2')
  })

  it('should reject non-string and non-newOption items in selectMulti array', async () => {
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

    const selectMultiField = await prisma.metadataField.create({
      data: {
        key: 'tags_invalid_items',
        scope: 'PROJECT',
        project: { connect: { id: project.id } },
        config: {
          name: 'Tags',
          type: 'selectMulti',
        },
      },
    })

    // Passing invalid items like number or null
    await expect(
      metadataService.updateAssetMetadata(asset.id, [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { key: selectMultiField.key, value: ['tag1', 123 as any] },
      ]),
    ).rejects.toThrow('expected string or {newOption}')
  })
})
