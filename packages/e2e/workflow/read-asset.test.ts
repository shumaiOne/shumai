import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma, type User } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueAgent, TaskQueueTranscode } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import { projectService } from '@shumai/core/src/project/project'
import { getAssetRenderOp, readAssetOp, runOperation } from '@shumai/core/src/operations'
import { AgentHarness } from '@earendil-works/pi-agent-core'
import { fileURLToPath } from 'url'
import * as path from 'path'
import * as fs from 'fs'

const BUCKET = 'shumai-e2e-test-bucket-read-asset'
const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures')

type ToolResult = { content: Array<{ type: string; text?: string; data?: string }> }
type ExecutableTool = {
  execute: (id: string, params: Record<string, unknown>) => Promise<ToolResult>
}

/**
 * read_asset end to end: real render workflows (frames, PDF pages) through the reader
 * pipeline, the pending → get_asset_render path, and the agent's read_asset and
 * download_asset tools in a chat workflow.
 * Only the model call is mocked.
 */
describe('Workflow E2E - read_asset', () => {
  setupTestDbHooks()

  let videoAssetId = ''

  beforeAll(async () => {
    process.env.S3_BUCKET = BUCKET
    process.env.GEMINI_API_KEY = 'dummy-key'

    initTranscodeWorkflows()
    initAgentWorkflows()

    vi.spyOn(AgentHarness.prototype, 'prompt').mockImplementation(async function (
      this: AgentHarness,
    ) {
      const readAsset = this.getTools().find((t) => t.name === 'read_asset') as unknown as
        ExecutableTool | undefined
      const hasRenderTool = this.getTools().some((t) => t.name === 'get_asset_render')
      if (!readAsset) {
        return {
          content: [{ type: 'text', text: 'MISSING_READ_ASSET' }],
          usage: { input: 1, output: 1 },
          stopReason: 'stop',
        } as unknown as Awaited<ReturnType<typeof AgentHarness.prototype.prompt>>
      }
      const result = await readAsset.execute('call-1', {
        assetId: videoAssetId,
        videoConfig: { start: 0, end: 1, count: 2 },
      })
      const text = result.content.find((c) => c.type === 'text')?.text ?? ''
      const images = result.content.filter((c) => c.type === 'image' && c.data)
      // download_asset saves the original into the agent's sandbox (.pi)
      const download = this.getTools().find((t) => t.name === 'download_asset') as unknown as
        ExecutableTool | undefined
      const downloaded = download
        ? await download.execute('call-2', { assetIds: [videoAssetId], proxy: false })
        : undefined
      const savedPath = (
        downloaded as unknown as { details?: { files?: Array<{ absolutePath: string }> } }
      )?.details?.files?.[0]?.absolutePath
      const summary = [
        `images:${images.length}`,
        `frames:${(text.match(/- Frame at /g) ?? []).length}`,
        `render_tool:${hasRenderTool ? 'present' : 'absent'}`,
        `downloaded:${savedPath ?? 'none'}`,
      ].join('|')
      return {
        content: [{ type: 'text', text: summary }],
        usage: { input: 10, output: 20 },
        stopReason: 'stop',
      } as unknown as Awaited<ReturnType<typeof AgentHarness.prototype.prompt>>
    })

    await workflowService.startWorkers([TaskQueueTranscode, TaskQueueAgent])
  })

  afterAll(async () => {
    await workflowService.shutdownWorkers()
    workflowService.close()
    vi.restoreAllMocks()
    try {
      await s3Service.deletePrefix(BUCKET, '')
    } catch (err) {
      console.error('Failed to clean up E2E storage folder:', err)
    }
  })

  async function seed(prefix: string) {
    const team = await prisma.team.create({ data: { name: `E2E Read ${prefix} Team` } })
    const user = await prisma.user.create({
      data: { name: 'Reader', email: `read-${prefix}@example.com`, type: 'human' },
    })
    await prisma.teamMember.create({ data: { teamId: team.id, userId: user.id, role: 'owner' } })
    const project = await projectService.createProject(user, {
      teamId: team.id,
      name: `E2E Read ${prefix} Project`,
    })
    return { team, user, project }
  }

  async function createFileAsset(
    projectId: string,
    parentId: string,
    fixture: string,
    name: string,
    mediaType: string,
    proxyType: string,
  ) {
    const key = `projects/${projectId}/${name}`
    const buffer = fs.readFileSync(path.join(fixturesDir, fixture))
    await s3Service.putObject(BUCKET, key, buffer, buffer.length, mediaType)
    const storageKey = await prisma.storageKey.create({ data: { key } })
    return prisma.asset.create({
      data: {
        name,
        type: 'file',
        status: 'uploaded',
        mediaType,
        projectId,
        parentId,
        storageKeyId: storageKey.id,
        media: { proxyType } as unknown as PrismaJson.MediaInfo,
      },
    })
  }

  const cli = (user: User) => ({ userId: user.id, via: 'cli' as const })

  it('extracts real video frames and returns links without storage keys', async () => {
    const { user, project } = await seed('frames')
    const video = await createFileAsset(
      project.id,
      project.rootFolder!,
      'small.mp4',
      'clip.mp4',
      'video/mp4',
      'video',
    )

    const output = await runOperation(readAssetOp, cli(user), {
      assetId: video.id,
      videoConfig: { start: 0, end: 1, count: 2 },
    })

    expect(output.status).toBe('ready')
    expect(output.summary).toBe('Extracted 2 frame(s) from "clip.mp4" (0s - 1s):')
    expect(output.images).toHaveLength(2)
    for (const image of output.images) {
      expect(image.label).toMatch(/^Frame at [\d.]+s$/)
      expect(image.url).toEqual(expect.any(String))
      expect(image.key).toBeUndefined()
    }
  }, 60000)

  it('returns pending and completes the read through get_asset_render', async () => {
    const { user, project } = await seed('pending')
    const pdf = await createFileAsset(
      project.id,
      project.rootFolder!,
      'test.pdf',
      'deck.pdf',
      'application/pdf',
      'pdf',
    )

    const pending = await runOperation(readAssetOp, cli(user), {
      assetId: pdf.id,
      docConfig: { mode: 'pages', startPage: 1, endPage: 1 },
      maxWaitSeconds: 0,
    })
    expect(pending).toMatchObject({
      status: 'pending',
      asset: { id: pdf.id, kind: 'document' },
      taskId: expect.any(String),
      retryAfterSeconds: 5,
    })

    const ready = await runOperation(getAssetRenderOp, cli(user), { taskId: pending.taskId! })
    expect(ready.status).toBe('ready')
    expect(ready.summary).toBe('Rendered 1 page(s) of "deck.pdf" (Pages 1 to 1):')
    expect(ready.images).toEqual([
      { label: 'Page 1', mimeType: 'image/webp', url: expect.any(String) },
    ])

    // Only the requester can pick up the render.
    const other = await prisma.user.create({
      data: { name: 'Other', email: 'read-other@example.com', type: 'human' },
    })
    await expect(
      runOperation(getAssetRenderOp, cli(other), { taskId: pending.taskId! }),
    ).rejects.toMatchObject({ status: 404 })
  }, 60000)

  it('gives the chat agent video frames as images', async () => {
    const { team, user, project } = await seed('agent')
    const video = await createFileAsset(
      project.id,
      project.rootFolder!,
      'small.mp4',
      'agent-clip.mp4',
      'video/mp4',
      'video',
    )
    videoAssetId = video.id

    const agentUser = await prisma.user.create({
      data: { name: 'E2E Read Agent', email: 'e2e-read-agent@shumai.ai', type: 'agent' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: agentUser.id, role: 'editor' },
    })
    const provider = await prisma.provider.create({
      data: {
        name: 'google',
        teamId: team.id,
        config: { api: 'google-generative-ai', apiKey: 'dummy-google-api-key' },
      },
    })
    const model = await prisma.model.create({
      data: {
        modelId: 'gemini',
        name: 'Gemini',
        providerId: provider.id,
        config: {
          input: ['text', 'image'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 8192,
          maxTokens: 2048,
          reasoning: false,
        },
      },
    })
    await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: team.id,
        type: 'chat',
        enabled: true,
        providerId: provider.id,
        modelId: model.id,
        config: { provider: 'google', model: 'gemini' },
      },
    })
    await prisma.agentSession.create({
      data: {
        id: 'read-asset-session',
        agentId: agentUser.id,
        userId: user.id,
        cwd: process.cwd(),
      },
    })
    const userComment = await prisma.assetComment.create({
      data: {
        assetId: video.id,
        message: 'What happens in the first second?',
        creatorId: user.id,
        sessionId: 'read-asset-session',
      },
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: video.id,
        projectId: project.id,
        teamId: team.id,
        payload: {
          projectId: project.id,
          agent: {
            agentId: agentUser.id,
            sessionId: 'read-asset-session',
            userCommentId: userComment.id,
            userId: user.id,
          },
        },
      },
    })

    const completed = await workflowService.executeWait(task, 90000)
    expect(completed.status).toBe('completed')

    const [reply] = await prisma.assetComment.findMany({
      where: { assetId: video.id, replyToId: userComment.id },
    })
    expect(reply?.message).toContain('images:2')
    expect(reply?.message).toContain('frames:2')
    expect(reply?.message).toContain('render_tool:present')
    const savedPath = /downloaded:([^|]+)/.exec(reply?.message ?? '')?.[1] ?? 'none'
    expect(savedPath).not.toBe('none')
    expect(
      fs.readFileSync(savedPath).equals(fs.readFileSync(path.join(fixturesDir, 'small.mp4'))),
    ).toBe(true)
    fs.rmSync(savedPath, { force: true })

    const render = await prisma.workflowTask.findFirstOrThrow({
      where: { assetId: video.id, type: 'transcode_screenshot' },
    })
    expect(render.payload?.assetRead).toMatchObject({ reader: 'video', requestedBy: user.id })
  }, 100000)
})
