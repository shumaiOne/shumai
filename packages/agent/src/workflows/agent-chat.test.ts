import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentChat } from './agent-chat'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import * as workflowCore from '@shumai/workflow-core'
import * as agentActivities from '../activities/agent'

vi.mock('@shumai/workflow-core', async () => {
  const actual = await vi.importActual('@shumai/workflow-core')
  return {
    ...actual,
    updateTaskStatusActivity: vi.fn(),
    updateTaskUsageActivity: vi.fn(),
  }
})

vi.mock('../activities/agent', async () => {
  const actual = await vi.importActual('../activities/agent')
  return {
    ...actual,
    getCommentActivity: vi.fn(),
    createCommentActivity: vi.fn(),
    getAssetActivity: vi.fn(),
    initializeAgentSessionActivity: vi.fn(),
    getAgentChatContextActivity: vi.fn(),
    agentChatActivity: vi.fn(),
    updateCommentActivity: vi.fn(),
    deleteCommentActivity: vi.fn(),
    getAssetPathHierarchyActivity: vi.fn(),
    getAssetPathContextActivity: vi.fn(),
    generateSessionNameActivity: vi.fn(),
    getUserTeamInfoActivity: vi.fn(),
  }
})

describe('Agent Chat Workflow', () => {
  setupTestDbHooks()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities holds mock functions cast to expected types
  let mockActivities: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockActivities = {
      updateTaskStatusActivity: vi.mocked(workflowCore.updateTaskStatusActivity),
      getCommentActivity: vi.mocked(agentActivities.getCommentActivity),
      createCommentActivity: vi.mocked(agentActivities.createCommentActivity),
      getAssetActivity: vi.mocked(agentActivities.getAssetActivity),
      initializeAgentSessionActivity: vi.mocked(agentActivities.initializeAgentSessionActivity),
      getAgentChatContextActivity: vi.mocked(agentActivities.getAgentChatContextActivity),
      agentChatActivity: vi.mocked(agentActivities.agentChatActivity),
      updateCommentActivity: vi.mocked(agentActivities.updateCommentActivity),
      updateTaskUsageActivity: vi.mocked(workflowCore.updateTaskUsageActivity),
      deleteCommentActivity: vi.mocked(agentActivities.deleteCommentActivity),
      getAssetPathHierarchyActivity: vi.mocked(agentActivities.getAssetPathHierarchyActivity),
      getAssetPathContextActivity: vi.mocked(agentActivities.getAssetPathContextActivity),
      generateSessionNameActivity: vi.mocked(agentActivities.generateSessionNameActivity),
      getUserTeamInfoActivity: vi.mocked(agentActivities.getUserTeamInfoActivity),
    }

    mockActivities.updateTaskStatusActivity.mockResolvedValue({})
    mockActivities.createCommentActivity.mockResolvedValue({ id: 'comment-placeholder-id' })
    mockActivities.generateSessionNameActivity.mockResolvedValue(undefined)
    mockActivities.getUserTeamInfoActivity.mockResolvedValue({ name: 'Test User', role: 'owner' })
    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'a1',
      project: { teamId: 't1' },
      type: 'file',
      name: 'test-file.png',
      mediaType: 'image/png',
      media: { proxyType: 'image' },
      parentId: 'parent-folder-id',
    })
    mockActivities.getCommentActivity.mockResolvedValue({
      id: 'c1',
      creatorId: 'user-c1',
      message: 'hello agent',
      replyToId: null,
      attachments: [],
    })
    mockActivities.initializeAgentSessionActivity.mockResolvedValue('session-123')
    mockActivities.getAgentChatContextActivity.mockResolvedValue({ agent: { id: 'b1' } })
    mockActivities.getAssetPathHierarchyActivity.mockResolvedValue({
      path: 'folder/subfolder/test-file.png',
      ancestors: [
        { id: 'f1', name: 'folder' },
        { id: 'f2', name: 'subfolder' },
      ],
    })
    mockActivities.getAssetPathContextActivity.mockResolvedValue('folder/subfolder/test-file.png')
    mockActivities.agentChatActivity.mockResolvedValue({
      text: 'Hello user, how can I help you?',
      sessionId: 'session-123',
      usage: { inputTokens: 10, outputTokens: 20, model: 'gemini-model' },
    })
  })

  it('should run agent chat workflow successfully with default configurations', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1' },
        },
      },
    })

    await agentChat(task)

    // Verify task status processing
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'processing',
    })

    // Verify comment context fetched
    expect(mockActivities.getCommentActivity).toHaveBeenCalledWith('c1')

    // Verify agent context fetched with the project context forwarded
    expect(mockActivities.getAgentChatContextActivity).toHaveBeenCalledWith({
      teamId: 't1',
      agentId: 'b1',
      userId: undefined,
      projectId: 'p1',
    })

    // Verify placeholder comment created
    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      message: '__CHAT__',
      sessionId: 'pending',
      agentId: 'b1',
      replyToId: 'c1',
    })

    // Verify session initialized since sessionId was missing
    expect(mockActivities.initializeAgentSessionActivity).toHaveBeenCalledWith({
      teamId: 't1',
      agentId: 'b1',
      userCommentId: 'c1',
      userId: undefined,
    })

    // Verify agent chat called with structured messageContext
    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 't1',
        agentId: 'b1',
        message: 'hello agent',
        sessionId: 'session-123',
        folderId: 'parent-folder-id',
        assetId: 'a1',
        messageContext: expect.objectContaining({
          user: { id: 'user-c1', name: 'Test User', role: 'owner' },
          currentAsset: expect.objectContaining({
            id: 'a1',
            name: 'test-file.png',
            type: 'file',
            mediaType: 'image',
            mimeType: 'image/png',
            parentId: 'parent-folder-id',
            path: 'folder/subfolder/test-file.png',
            ancestors: [
              { id: 'f1', name: 'folder' },
              { id: 'f2', name: 'subfolder' },
            ],
          }),
        }),
      }),
    )

    // Verify comment update
    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'Hello user, how can I help you?',
      sessionId: 'session-123',
    })

    // Verify task usage update
    expect(mockActivities.updateTaskUsageActivity).toHaveBeenCalledWith({
      taskId: task.id,
      inputTokens: 10,
      outputTokens: 20,
      model: 'gemini-model',
    })

    // Verify task completed status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
      output: { sessionId: 'session-123' },
    })

    // Verify session name generation triggered
    expect(mockActivities.generateSessionNameActivity).toHaveBeenCalledWith({
      teamId: 't1',
      agentId: 'b1',
      prompt: 'hello agent',
      sessionId: 'session-123',
      context: expect.any(Object),
    })
  })

  it('should skip session initialization if sessionId is already provided', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1', sessionId: 'existing-session-456' },
        },
      },
    })

    await agentChat(task)

    expect(mockActivities.initializeAgentSessionActivity).not.toHaveBeenCalled()

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'existing-session-456',
        messageContext: expect.objectContaining({
          currentAsset: expect.objectContaining({ id: 'a1', name: 'test-file.png' }),
        }),
      }),
    )

    // Verify session name generation is skipped
    expect(mockActivities.generateSessionNameActivity).not.toHaveBeenCalled()
  })

  it('should collect S3 keys for image attachments from the user comment', async () => {
    mockActivities.getCommentActivity.mockResolvedValue({
      id: 'c1',
      message: 'look at this',
      replyToId: null,
      attachments: [
        {
          asset: {
            mediaType: 'image/png',
            media: { proxyType: 'image' },
            storageKey: { key: 'attachments/image1.png' },
          },
        },
        {
          asset: {
            mediaType: 'video/mp4', // non-image, should be ignored
            media: { proxyType: 'video' },
            storageKey: { key: 'attachments/video.mp4' },
          },
        },
        {
          asset: {
            mediaType: 'image/jpeg',
            media: { proxyType: 'image' },
            storageKey: { key: 'attachments/image2.jpg' },
          },
        },
      ],
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1' },
        },
      },
    })

    await agentChat(task)

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrls: ['attachments/image1.png', 'attachments/image2.jpg'],
      }),
    )
  })

  it('should format instructions with asset media info when available', async () => {
    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'a1',
      project: { teamId: 't1' },
      type: 'file',
      name: 'test-asset',
      mediaType: 'video/mp4',
      media: {
        duration: 10,
        height: 1080,
        width: 1920,
      },
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1' },
        },
      },
    })

    await agentChat(task)

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        messageContext: expect.objectContaining({
          currentAsset: expect.objectContaining({
            durationSeconds: 10,
          }),
        }),
      }),
    )
  })

  it('should handle errors gracefully by updating the placeholder comment with error message and marking task as failed', async () => {
    mockActivities.agentChatActivity.mockRejectedValue(new Error('AI error: API limit reached'))

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1' },
        },
      },
    })

    await expect(agentChat(task)).rejects.toThrow('AI error: API limit reached')

    // Verify placeholder updated with formatted error message
    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'AI error:  API limit reached',
    })

    // Verify status updated to failed
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'AI error: API limit reached' },
    })
  })

  it('should handle generic errors in error handling block', async () => {
    mockActivities.agentChatActivity.mockRejectedValue(new Error('Some DB connection error'))

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1' },
        },
      },
    })

    await expect(agentChat(task)).rejects.toThrow('Some DB connection error')

    // Verify placeholder updated with generic error message
    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'Sorry, I encountered an error while processing your request.',
    })
  })

  it('should execute direct-context chatbot flow resolving file metadata and skipping comment placeholder', async () => {
    mockActivities.getAssetActivity.mockImplementation(async (id: string) => {
      if (id === 'file-attachment-1') {
        return {
          id: 'file-attachment-1',
          name: 'attachment.png',
          type: 'file',
          mediaType: 'image/png',
          media: { proxyType: 'image' },
          projectId: 'p1',
        }
      }
      if (id === 'referenced-asset-1') {
        return {
          id: 'referenced-asset-1',
          name: 'ref-folder',
          type: 'folder',
          mediaType: null,
          media: null,
          projectId: 'p1',
        }
      }
      return {
        id,
        name: 'test-file.png',
        type: 'file',
        mediaType: 'image/png',
        media: { proxyType: 'image' },
        projectId: 'p1',
        project: { teamId: 't1' },
      }
    })

    mockActivities.getAssetPathContextActivity.mockImplementation(async (id: string) => {
      if (id === 'file-attachment-1') return 'attachment.png'
      if (id === 'referenced-asset-1') return 'ref-folder'
      return 'folder/subfolder/file.png'
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: {
            agentId: 'b1',
            sessionId: 'session-direct-123',
            prompt: 'chatbot prompt',
            attachedFiles: ['file-attachment-1'],
            assetIds: ['referenced-asset-1'],
          },
        },
      },
    })

    await agentChat(task)

    // Verify placeholder comment is NOT created
    expect(mockActivities.createCommentActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateCommentActivity).not.toHaveBeenCalled()

    // Verify messageContext is populated with attachedFiles and referencedAssets
    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 't1',
        agentId: 'b1',
        message: 'chatbot prompt',
        imageUrls: [],
        projectId: 'p1',
        folderId: '',
        sessionId: 'session-direct-123',
        userId: undefined,
        userCommentId: undefined,
        context: { agent: { id: 'b1' } },
        messageContext: expect.objectContaining({
          attachedFiles: [
            {
              id: 'file-attachment-1',
              name: 'attachment.png',
              type: 'file',
              mediaType: 'image',
              mimeType: 'image/png',
              path: 'attachment.png',
            },
          ],
          referencedAssets: [
            {
              id: 'referenced-asset-1',
              name: 'ref-folder',
              type: 'folder',
              mediaType: undefined,
              mimeType: undefined,
              path: 'ref-folder',
            },
          ],
        }),
      }),
    )
  })

  it('should handle version stack asset by building instructions with resolved latest version asset details', async () => {
    mockActivities.getAssetActivity.mockImplementation(async (id: string) => {
      if (id === 'vs-1') {
        return {
          id: 'v2-latest',
          project: { teamId: 't1' },
          type: 'file',
          name: 'latest-video.mp4',
          mediaType: 'video/mp4',
          media: { proxyType: 'video', duration: 42 },
          parentId: 'vs-1',
        }
      }
      return null
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'vs-1',
        payload: {
          projectId: 'p1',
          agent: {
            prompt: 'Explain this version stack video',
            sessionId: 'session-vs-123',
            agentId: 'b1',
          },
        },
      },
    })

    await agentChat(task)

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 't1',
        agentId: 'b1',
        message: 'Explain this version stack video',
        sessionId: 'session-vs-123',
        messageContext: expect.objectContaining({
          currentAsset: expect.objectContaining({
            id: 'v2-latest',
            durationSeconds: 42,
          }),
        }),
      }),
    )
  })

  it('should inject user info for 1-on-1 new chat sessions', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: {
            prompt: 'Hello agent from 1-on-1 chat',
            sessionId: 'session-new-1-on-1',
            agentId: 'b1',
            userId: 'user-alice',
            isNewChat: true,
          },
        },
      },
    })

    await agentChat(task)

    expect(mockActivities.getUserTeamInfoActivity).toHaveBeenCalledWith({
      userId: 'user-alice',
      teamId: 't1',
    })

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        messageContext: expect.objectContaining({
          user: { id: 'user-alice', name: 'Test User', role: 'owner' },
        }),
      }),
    )
  })

  it('should populate comment attachments into structured messageContext.attachedFiles', async () => {
    mockActivities.getCommentActivity.mockResolvedValue({
      id: 'c1',
      creatorId: 'user-c1',
      message: 'check these attachments',
      replyToId: null,
      attachments: [
        {
          asset: {
            id: 'att-doc-1',
            name: 'brief.pdf',
            type: 'file',
            mediaType: 'application/pdf',
            media: { proxyType: 'pdf' },
            storageKey: { key: 'brief.pdf' },
          },
        },
        {
          asset: {
            id: 'att-img-1',
            name: 'mockup.png',
            type: 'file',
            mediaType: 'image/png',
            media: { proxyType: 'image' },
            storageKey: { key: 'mockup.png' },
          },
        },
      ],
    })

    mockActivities.getAssetPathContextActivity.mockImplementation(async (id: string) => {
      if (id === 'att-doc-1') return 'Docs/brief.pdf'
      if (id === 'att-img-1') return 'Designs/mockup.png'
      return 'folder/subfolder/file.png'
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1' },
        },
      },
    })

    await agentChat(task)

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrls: ['mockup.png'],
        messageContext: expect.objectContaining({
          attachedFiles: [
            {
              id: 'att-doc-1',
              name: 'brief.pdf',
              type: 'file',
              mediaType: 'pdf',
              mimeType: 'application/pdf',
              path: 'Docs/brief.pdf',
            },
            {
              id: 'att-img-1',
              name: 'mockup.png',
              type: 'file',
              mediaType: 'image',
              mimeType: 'image/png',
              path: 'Designs/mockup.png',
            },
          ],
        }),
      }),
    )
  })

  it('should set totalFrames for video assets and totalPages for pdf assets in currentAsset context', async () => {
    mockActivities.getAssetActivity.mockImplementation(async (id: string) => {
      if (id === 'video-asset-1') {
        return {
          id: 'video-asset-1',
          project: { teamId: 't1' },
          type: 'file',
          name: 'clip.mp4',
          mediaType: 'video/mp4',
          media: { proxyType: 'video', duration: 9, frames: 268 },
          parentId: 'f1',
        }
      }
      if (id === 'pdf-asset-1') {
        return {
          id: 'pdf-asset-1',
          project: { teamId: 't1' },
          type: 'file',
          name: 'doc.pdf',
          mediaType: 'application/pdf',
          media: { proxyType: 'pdf', frames: 15, duration: 0 },
          parentId: 'f1',
        }
      }
      return null
    })

    // Test Video asset
    const videoTask = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'video-asset-1',
        payload: {
          projectId: 'p1',
          agent: { prompt: 'Analyze video', agentId: 'b1', sessionId: 'session-video-1' },
        },
      },
    })
    await agentChat(videoTask)

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        messageContext: expect.objectContaining({
          currentAsset: expect.objectContaining({
            id: 'video-asset-1',
            mediaType: 'video',
            durationSeconds: 9,
            totalFrames: 268,
            totalPages: undefined,
          }),
        }),
      }),
    )

    // Test PDF asset
    const pdfTask = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'pdf-asset-1',
        payload: {
          projectId: 'p1',
          agent: { prompt: 'Analyze pdf', agentId: 'b1', sessionId: 'session-pdf-1' },
        },
      },
    })
    await agentChat(pdfTask)

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        messageContext: expect.objectContaining({
          currentAsset: expect.objectContaining({
            id: 'pdf-asset-1',
            mediaType: 'pdf',
            totalPages: 15,
            totalFrames: undefined,
            durationSeconds: undefined,
          }),
        }),
      }),
    )
  })

  it('should include annotations and second in direct chat messageContext', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: {
            prompt: 'Look at the highlighted zone',
            agentId: 'b1',
            sessionId: 'session-markup-1',
            second: 14.2,
            annotations: [{ type: 'rectangle', x: 20, y: 30, width: 40, height: 50 }],
          },
        },
      },
    })

    await agentChat(task)

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        messageContext: expect.objectContaining({
          position: { type: 'time', seconds: 14.2 },
          annotations: [{ type: 'rectangle', x: 20, y: 30, width: 40, height: 50 }],
        }),
      }),
    )
  })

  it('should include userCommentId as id in comment messageContext', async () => {
    mockActivities.getCommentActivity.mockResolvedValue({
      id: 'comment-with-id-123',
      creatorId: 'user-c1',
      message: 'Check this out',
      replyToId: null,
      second: 5.0,
      annotation: [{ type: 'arrow' }],
      attachments: [],
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: {
            agentId: 'b1',
            userCommentId: 'comment-with-id-123',
          },
        },
      },
    })

    await agentChat(task)

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        messageContext: expect.objectContaining({
          id: 'comment-with-id-123',
          position: { type: 'time', seconds: 5.0 },
          annotation: true,
          annotations: [{ type: 'arrow' }],
        }),
      }),
    )
  })

  it('should format mediaPosition as degree for 3D assets in 1-on-1 chat', async () => {
    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'a-3d',
      project: { teamId: 't1' },
      type: 'file',
      name: 'model.glb',
      mediaType: 'model/gltf-binary',
      media: { proxyType: '3d' },
      parentId: null,
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a-3d',
        payload: {
          projectId: 'p1',
          agent: {
            agentId: 'b1',
            prompt: 'Look at this angle',
            sessionId: 'session-3d-1',
            second: 0.5, // 0.5s turntable time = 45°
          },
        },
      },
    })

    await agentChat(task)

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        messageContext: expect.objectContaining({
          position: { type: 'degree', degree: 45 },
        }),
      }),
    )
  })

  it('should format mediaPosition as degree for 3D assets in comment mode', async () => {
    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'a-3d',
      project: { teamId: 't1' },
      type: 'file',
      name: 'model.glb',
      mediaType: 'model/gltf-binary',
      media: { proxyType: '3d' },
      parentId: null,
    })

    mockActivities.getCommentActivity.mockResolvedValue({
      id: 'comment-3d-1',
      creatorId: 'user-c1',
      message: 'Look at the back',
      replyToId: null,
      second: 2.0, // 2.0s = 180°
      attachments: [],
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a-3d',
        payload: {
          projectId: 'p1',
          agent: {
            agentId: 'b1',
            userCommentId: 'comment-3d-1',
          },
        },
      },
    })

    await agentChat(task)

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        messageContext: expect.objectContaining({
          position: { type: 'degree', degree: 180 },
        }),
      }),
    )
  })
})
