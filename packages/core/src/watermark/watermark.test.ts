import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import { generateWatermarkSvg } from '@shumai/core/src/watermark/watermark-svg'
import { shareService } from '@shumai/core/src/share/share'
import { teamService } from '@shumai/core/src/team/team'
import { computeWatermarkConfigHash, WatermarkConfigSpec } from '@shumai/dtos'
import { describe, expect, it } from 'vitest'

describe('WatermarkService', () => {
  setupTestDbHooks()

  const sampleConfig: WatermarkConfigSpec = {
    blocks: [
      {
        id: 'block-1',
        type: 'text',
        x: 0.5,
        y: 0.5,
        opacity: 0.8,
        rotation: -30,
        text: 'CONFIDENTIAL',
        size: 0.2,
        color: '#FF0000',
      },
    ],
  }

  it('should compute deterministic hash ignoring block id and block order', () => {
    const config1: WatermarkConfigSpec = {
      blocks: [
        {
          id: 'b1',
          type: 'text',
          x: 0.5,
          y: 0.5,
          opacity: 0.5,
          rotation: 0,
          text: 'A',
          size: 0.1,
          color: '#FFFFFF',
        },
        {
          id: 'b2',
          type: 'text',
          x: 0.1,
          y: 0.1,
          opacity: 0.9,
          rotation: 15,
          text: 'B',
          size: 0.2,
          color: '#000000',
        },
      ],
    }
    const config2: WatermarkConfigSpec = {
      blocks: [
        {
          id: 'other-id-2',
          type: 'text',
          x: 0.1,
          y: 0.1,
          opacity: 0.9,
          rotation: 15,
          text: 'B',
          size: 0.2,
          color: '#000000',
        },
        {
          id: 'other-id-1',
          type: 'text',
          x: 0.5,
          y: 0.5,
          opacity: 0.5,
          rotation: 0,
          text: 'A',
          size: 0.1,
          color: '#FFFFFF',
        },
      ],
    }

    const hash1 = computeWatermarkConfigHash(config1)
    const hash2 = computeWatermarkConfigHash(config2)
    expect(hash1).toBe(hash2)
  })

  it('should generate SVG overlay XML', () => {
    const svg = generateWatermarkSvg(sampleConfig, 1000, 500)
    expect(svg).toContain('<svg')
    expect(svg).toContain('CONFIDENTIAL')
    expect(svg).toContain('fill="#FF0000"')
  })

  it('should upsert watermark config by hash', async () => {
    const config1 = await watermarkService.upsertConfig(sampleConfig)
    expect(config1.id).toBeDefined()

    const config2 = await watermarkService.upsertConfig(sampleConfig)
    expect(config2.id).toBe(config1.id)
  })

  it('should manage watermark templates (CRUD)', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: 'test-wm-tpl@example.com' },
    })
    const team = await teamService.createTeam(user, { name: 'Watermark Team' })

    const created = await watermarkService.createTemplate(team.id, 'Draft Preset', sampleConfig)
    expect(created.id).toBeDefined()
    expect(created.name).toBe('Draft Preset')

    const list = await watermarkService.listTemplates(team.id)
    expect(list.length).toBe(1)

    const updated = await watermarkService.updateTemplate(created.id, 'Final Preset')
    expect(updated.name).toBe('Final Preset')

    const fetched = await watermarkService.getTemplate(created.id)
    expect(fetched.name).toBe('Final Preset')

    await watermarkService.deleteTemplate(created.id)
    const emptyList = await watermarkService.listTemplates(team.id)
    expect(emptyList.length).toBe(0)
  })

  it('should update sharelink watermark and dispatch transcode tasks', async () => {
    const user = await prisma.user.create({
      data: { name: 'Share User', email: 'share-wm@example.com' },
    })
    const team = await teamService.createTeam(user, { name: 'Share Team' })

    const projectFolder = await prisma.asset.create({
      data: { name: 'root', type: 'root', status: 'processed' },
    })
    const project = await prisma.project.create({
      data: { name: 'Test Project', teamId: team.id, rootFolderId: projectFolder.id },
    })

    const shareLink = await shareService.createShareLink(project.id, { name: 'My Share' }, user.id)

    // Add a file asset to project and share link
    const asset = await prisma.asset.create({
      data: {
        name: 'sample.mp4',
        type: 'file',
        mediaType: 'video/mp4',
        status: 'processed',
        projectId: project.id,
      },
    })
    await shareService.addAssetToShare(shareLink.id, { assetIds: [asset.id] })

    // Update sharelink watermark -> enable
    const updated = await watermarkService.updateShareLinkWatermark(
      shareLink.id,
      true,
      sampleConfig,
    )
    expect(updated.watermarkStatus).toBe('processing')
    expect(updated.watermarkConfigId).toBeDefined()

    // Verify WorkflowTask was created
    const tasks = await prisma.workflowTask.findMany({
      where: { assetId: asset.id, type: 'transcode_watermark' },
    })
    expect(tasks.length).toBeGreaterThan(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((tasks[0].payload as any)?.watermark?.watermarkConfigId).toBe(updated.watermarkConfigId)

    // Attempting update while status is processing should throw conflict error
    await expect(
      watermarkService.updateShareLinkWatermark(shareLink.id, true, sampleConfig),
    ).rejects.toThrow('Watermark transcoding is currently in progress')

    // Simulate completion of transcoding
    await prisma.shareLink.update({
      where: { id: shareLink.id },
      data: { watermarkStatus: 'ready' },
    })

    // Disable watermark after ready
    const disabled = await watermarkService.updateShareLinkWatermark(shareLink.id, false)
    expect(disabled.watermarkStatus).toBe('disabled')
    expect(disabled.watermarkConfigId).toBeNull()
  })

  it('should purge orphan watermark configs during background GC', async () => {
    // Create orphan config
    const orphanConfig = await watermarkService.upsertConfig(sampleConfig)

    // Run background GC
    const purgedCount = await watermarkService.purgeOrphanWatermarkConfigs()
    expect(purgedCount).toBeGreaterThanOrEqual(1)

    const findDeleted = await prisma.watermarkConfig.findUnique({
      where: { id: orphanConfig.id },
    })
    expect(findDeleted).toBeNull()
  })
})
