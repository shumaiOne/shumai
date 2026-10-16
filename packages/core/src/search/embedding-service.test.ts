import { describe, expect, it } from 'vitest'
import { prisma, AssetType, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { agentService } from '@shumai/core/src/agent/agent'
import { embeddingService } from './embedding-service'

describe('EmbeddingService', () => {
  setupTestDbHooks()

  it('should skip teams without an enabled embedding agent', async () => {
    const team = await prisma.team.create({
      data: { name: 'Team Without Agent' },
    })
    const project = await prisma.project.create({
      data: { name: 'Project 1', teamId: team.id },
    })
    await prisma.asset.create({
      data: {
        name: 'video.mp4',
        type: AssetType.file,
        status: 'processed',
        mediaType: 'video/mp4',
        projectId: project.id,
      },
    })

    const result = await embeddingService.regenerateEmbeddings()
    expect(result.tasksCreated).toBe(0)
    expect(result.totalAssets).toBe(0)
    expect(result.skippedTeams).toContain('Team Without Agent')
  })

  it('should skip teams where embedding agent exists but is disabled', async () => {
    const team = await prisma.team.create({
      data: { name: 'Team Disabled Agent' },
    })
    await agentService.createAgent({
      teamId: team.id,
      name: 'embedding-agent',
      type: 'embedding',
      avatar: 'avatar-1',
      thinkingLevel: 'off',
      enabled: false,
    })
    const project = await prisma.project.create({
      data: { name: 'Project Disabled', teamId: team.id },
    })
    await prisma.asset.create({
      data: {
        name: 'photo.jpg',
        type: AssetType.file,
        status: 'processed',
        mediaType: 'image/jpeg',
        projectId: project.id,
      },
    })

    const result = await embeddingService.regenerateEmbeddings()
    expect(result.tasksCreated).toBe(0)
    expect(result.totalAssets).toBe(0)
    expect(result.skippedTeams).toContain('Team Disabled Agent')
  })

  it('should regenerate embeddings for eligible media assets and clean up old data', async () => {
    const team = await prisma.team.create({
      data: { name: 'Active Embedding Team' },
    })
    const agent = await agentService.createAgent({
      teamId: team.id,
      name: 'embedding-agent',
      type: 'embedding',
      avatar: 'avatar-1',
      thinkingLevel: 'off',
      enabled: true,
    })

    const project = await prisma.project.create({
      data: { name: 'Active Project', teamId: team.id },
    })

    // 1. Eligible video asset
    const videoAsset = await prisma.asset.create({
      data: {
        name: 'sample.mp4',
        type: AssetType.file,
        status: 'processed',
        mediaType: 'video/mp4',
        projectId: project.id,
      },
    })

    // 2. Eligible image asset
    const imageAsset = await prisma.asset.create({
      data: {
        name: 'sample.png',
        type: AssetType.file,
        status: 'processed',
        mediaType: 'image/png',
        projectId: project.id,
      },
    })

    // 3. Eligible 3D asset with rendered views
    const asset3d = await prisma.asset.create({
      data: {
        name: 'model.glb',
        type: AssetType.file,
        status: 'processed',
        mediaType: 'model/gltf-binary',
        media: {
          proxyType: '3d',
          imageTranscodes: [
            { key: 'files/3d/view.webp', format: 'webp', width: 100, height: 100, quality: 80 },
          ],
        } as unknown as PrismaJson.MediaInfo,
        projectId: project.id,
      },
    })

    // 4. Ineligible asset (non-media document)
    await prisma.asset.create({
      data: {
        name: 'document.pdf',
        type: AssetType.file,
        status: 'processed',
        mediaType: 'application/pdf',
        projectId: project.id,
      },
    })

    // 5. Ineligible asset (trashed / deleted)
    await prisma.asset.create({
      data: {
        name: 'deleted-video.mp4',
        type: AssetType.file,
        status: 'processed',
        isDeleted: true,
        mediaType: 'video/mp4',
        projectId: project.id,
      },
    })

    // 6. Ineligible asset (status not processed)
    await prisma.asset.create({
      data: {
        name: 'uploading.mp4',
        type: AssetType.file,
        status: 'uploading',
        mediaType: 'video/mp4',
        projectId: project.id,
      },
    })

    // Create preexisting embeddings and workflow task for videoAsset to verify cleanup
    const dummyVec768 = `[${new Array(768).fill(0.1).join(',')}]`
    await prisma.$executeRaw`
      INSERT INTO asset_embeddings (id, asset_id, embedding_768, updated_at)
      VALUES (gen_random_uuid()::text, ${videoAsset.id}, ${dummyVec768}::vector, NOW())
    `
    await prisma.workflowTask.create({
      data: {
        assetId: videoAsset.id,
        type: WorkflowTaskType.ai_embedding,
        status: WorkflowTaskStatus.processing,
        teamId: team.id,
        projectId: project.id,
      },
    })

    const initialEmbeddings = await prisma.assetEmbedding.count({
      where: { assetId: videoAsset.id },
    })
    expect(initialEmbeddings).toBe(1)

    // Run regeneration
    const result = await embeddingService.regenerateEmbeddings()

    expect(result.totalAssets).toBe(3)
    expect(result.tasksCreated).toBe(3)
    expect(result.skippedTeams).not.toContain('Active Embedding Team')

    // Verify old embeddings were wiped upfront
    const remainingEmbeddings = await prisma.assetEmbedding.count({
      where: { assetId: videoAsset.id },
    })
    expect(remainingEmbeddings).toBe(0)

    // Verify tasks created
    const createdTasks = await prisma.workflowTask.findMany({
      where: {
        type: WorkflowTaskType.ai_embedding,
        assetId: { in: [videoAsset.id, imageAsset.id, asset3d.id] },
      },
    })
    expect(createdTasks).toHaveLength(3)
    for (const task of createdTasks) {
      expect(task.status).toBe(WorkflowTaskStatus.pending)
      expect(task.teamId).toBe(team.id)
      expect(task.projectId).toBe(project.id)
      const payload = task.payload as { agent?: { agentId?: string } }
      expect(payload?.agent?.agentId).toBe(agent!.id)
    }
  })

  it('should handle multiple teams where only some have active embedding agents', async () => {
    // Team 1: has active agent
    const team1 = await prisma.team.create({ data: { name: 'Team One' } })
    await agentService.createAgent({
      teamId: team1.id,
      name: 'embedding-agent',
      type: 'embedding',
      avatar: 'avatar-1',
      thinkingLevel: 'off',
      enabled: true,
    })
    const project1 = await prisma.project.create({ data: { name: 'P1', teamId: team1.id } })
    await prisma.asset.create({
      data: {
        name: 'v1.mp4',
        type: AssetType.file,
        status: 'processed',
        mediaType: 'video/mp4',
        projectId: project1.id,
      },
    })

    // Team 2: no active agent
    const team2 = await prisma.team.create({ data: { name: 'Team Two' } })
    const project2 = await prisma.project.create({ data: { name: 'P2', teamId: team2.id } })
    await prisma.asset.create({
      data: {
        name: 'v2.mp4',
        type: AssetType.file,
        status: 'processed',
        mediaType: 'video/mp4',
        projectId: project2.id,
      },
    })

    const result = await embeddingService.regenerateEmbeddings()

    expect(result.totalAssets).toBe(1)
    expect(result.tasksCreated).toBe(1)
    expect(result.skippedTeams).toContain('Team Two')
    expect(result.skippedTeams).not.toContain('Team One')

    const tasks = await prisma.workflowTask.findMany({
      where: {
        type: WorkflowTaskType.ai_embedding,
        teamId: { in: [team1.id, team2.id] },
      },
    })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].teamId).toBe(team1.id)
  })
})
