import { describe, it, expect } from 'vitest'
import { setupTestDbHooks } from '@/db-test-hooks'
import { prisma } from '@/db'
import {
  createCommentActivity,
  updateCommentActivity,
  deleteCommentActivity,
  initializeAgentSessionActivity,
  getAgentChatContextActivity,
  getAgentAutofillContextActivity,
  getEmbeddingContextActivity,
  saveAssetEmbeddingsActivity,
  getAssetPathContextActivity,
  executeAgentToolActivity,
} from './db'
import type { SessionTreeEntry } from '@earendil-works/pi-agent-core'

describe('Database Activities', () => {
  setupTestDbHooks()

  it('should support comment CRUD activities (create, update, delete)', async () => {
    const team = await prisma.team.create({ data: { name: 't1' } })
    const user = await prisma.user.create({
      data: { name: 'User One', email: 'user1@example.com' },
    })
    const project = await prisma.project.create({
      data: { name: 'p1', teamId: team.id },
    })
    const file = await prisma.asset.create({
      data: {
        name: 'test-file',
        type: 'file',
        projectId: project.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })

    // 1. Create Comment
    const comment = await createCommentActivity({
      assetId: file.id,
      message: 'Initial comment',
    })
    expect(comment.id).toBeDefined()
    expect(comment.message).toBe('Initial comment')

    // 2. Update Comment
    const updated = await updateCommentActivity({
      commentId: comment.id,
      message: 'Updated comment',
    })
    expect(updated.message).toBe('Updated comment')

    // 3. Delete Comment
    await deleteCommentActivity(comment.id)
    const found = await prisma.assetComment.findUnique({
      where: { id: comment.id },
    })
    expect(found).toBeNull()
  })

  it('should support multiple comments in the same session without violating unique session_id constraint', async () => {
    const team = await prisma.team.create({ data: { name: 't2' } })
    const user = await prisma.user.create({
      data: { name: 'User Two', email: 'user2@example.com' },
    })
    const project = await prisma.project.create({
      data: { name: 'p2', teamId: team.id },
    })
    const file = await prisma.asset.create({
      data: {
        name: 'test-file-2',
        type: 'file',
        projectId: project.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })

    const sessionId = 'test-multi-comment-session'

    // 1. Create first agent comment in the session
    const c1 = await createCommentActivity({
      assetId: file.id,
      message: 'Agent comment 1',
      sessionId,
      agentId: 'default',
    })
    expect(c1.id).toBeDefined()
    expect(c1.sessionId).toBe(sessionId)

    // 2. Create second agent comment in the SAME session
    const c2 = await createCommentActivity({
      assetId: file.id,
      message: 'Agent comment 2',
      sessionId,
      agentId: 'default',
    })
    expect(c2.id).toBeDefined()
    expect(c2.sessionId).toBe(sessionId)
  })

  it('should initialize a new session with chronological context, prefixed usernames, and resolved user mentions', async () => {
    const team = await prisma.team.create({ data: { name: 't1' } })
    const user1 = await prisma.user.create({
      data: { name: 'User One', email: 'user1@example.com' },
    })
    const user2 = await prisma.user.create({
      data: { name: 'Matt', email: 'matt@example.com' },
    })
    const agentUser = await prisma.user.create({
      data: { id: 'agent-user-id', name: 'Smart Agent', email: 'agent@example.com', type: 'agent' },
    })
    const project = await prisma.project.create({
      data: { name: 'p1', teamId: team.id },
    })
    const file = await prisma.asset.create({
      data: {
        name: 'test-file',
        type: 'file',
        projectId: project.id,
        creatorId: user1.id,
        status: 'uploaded',
      },
    })

    // Create existing comment 1 (User mentioning user2)
    const comment1 = await prisma.assetComment.create({
      data: {
        assetId: file.id,
        creatorId: user1.id,
        message: `First comment message for <@${user2.id}>`,
      },
    })

    // Create existing comment 1.5 (Agent)
    const commentAgent = await prisma.assetComment.create({
      data: {
        assetId: file.id,
        creatorId: agentUser.id,
        message: 'I am helping',
      },
    })

    // Create triggering comment 2 (Rule 1: no reply, mentions agent)
    const comment2 = await prisma.assetComment.create({
      data: {
        assetId: file.id,
        creatorId: user1.id,
        message: 'Hello <@agent-user-id>',
      },
    })

    const sessionId = await initializeAgentSessionActivity({
      teamId: team.id,
      agentId: 'agent-user-id',
      userCommentId: comment2.id,
      userId: user1.id,
    })

    expect(sessionId).toBeDefined()

    // Verify session entries were populated with comment1 and commentAgent as context
    const entries = await prisma.agentSessionEntry.findMany({
      where: { sessionId },
      orderBy: { id: 'asc' },
    })

    expect(entries.length).toBe(2)

    // Verify User Comment Entry with resolved mention and username prefix
    const entryData1 = entries[0].entry as unknown as SessionTreeEntry
    expect(entryData1.id).toBeDefined()
    expect(entryData1.id).not.toBe(comment1.id)
    if (entryData1.type === 'message') {
      const msg = entryData1.message as { role: 'user'; content: { type: 'text'; text: string }[] }
      expect(msg.content[0].text).toBe('[User One]: First comment message for <@Matt>')
      expect(msg.role).toBe('user')
    } else {
      throw new Error('Expected entry to be a message')
    }

    // Verify Agent Comment Entry
    const entryData2 = entries[1].entry as unknown as SessionTreeEntry
    expect(entryData2.id).toBeDefined()
    expect(entryData2.id).not.toBe(commentAgent.id)
    if (entryData2.type === 'message') {
      const msg = entryData2.message as { role: 'user'; content: { type: 'text'; text: string }[] }
      expect(msg.content[0].text).toBe('[Agent Message][Smart Agent]: I am helping')
      expect(msg.role).toBe('user')
    } else {
      throw new Error('Expected entry to be a message')
    }
  })

  it('should support context-fetching and embedding database activities', async () => {
    const team = await prisma.team.create({ data: { name: 't_ctx' } })
    const project = await prisma.project.create({
      data: { name: 'p_ctx', teamId: team.id },
    })
    const sk = await prisma.storageKey.create({ data: { key: 'asset-key' } })
    const asset = await prisma.asset.create({
      data: {
        name: 'test-asset',
        type: 'file',
        projectId: project.id,
        status: 'uploaded',
        mediaType: 'image/png',
        storageKeyId: sk.id,
      },
    })

    const provider = await prisma.provider.create({
      data: {
        name: 'google',
        teamId: team.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider config requires broad any casting since it is defined as generic Json in Prisma schema
        config: { api: 'google', apiKey: 'key' } as any,
      },
    })

    const model = await prisma.model.create({
      data: {
        modelId: 'gemini',
        name: 'Gemini',
        providerId: provider.id,
        config: {
          reasoning: false,
          input: ['text'],
          contextWindow: 1000,
          maxTokens: 1000,
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- model config requires broad any casting since it is defined as generic Json in Prisma schema
        } as any,
      },
    })

    const botUser = await prisma.user.create({
      data: { name: 'Pirate Bot', email: 'bot@example.com', type: 'agent' },
    })

    const agent = await prisma.agent.create({
      data: {
        id: botUser.id,
        teamId: team.id,
        type: 'chat',
        enabled: true,
        providerId: provider.id,
        modelId: model.id,
        config: { provider: 'google', model: 'gemini' },
      },
    })

    await prisma.teamMember.create({
      data: { teamId: team.id, userId: botUser.id, role: 'reviewer' },
    })

    // Test getAgentChatContextActivity
    const chatCtx = await getAgentChatContextActivity({ teamId: team.id, agentId: agent.id })
    expect(chatCtx.agent.id).toBe(agent.id)
    expect(chatCtx.dbProviders.length).toBe(1)
    expect(chatCtx.allowedDomains).toEqual([])

    // Test getAgentAutofillContextActivity (needs an autofill agent)
    const autofillBot = await prisma.user.create({
      data: { name: 'Autofill Bot', email: 'autobot@example.com', type: 'agent' },
    })
    const autofillAgent = await prisma.agent.create({
      data: {
        id: autofillBot.id,
        teamId: team.id,
        type: 'autofill',
        enabled: true,
        providerId: provider.id,
        modelId: model.id,
        config: { provider: 'google', model: 'gemini' },
      },
    })
    const autofillCtx = await getAgentAutofillContextActivity({ teamId: team.id })
    expect(autofillCtx.agent.id).toBe(autofillAgent.id)

    // Test getEmbeddingContextActivity (needs an embedding agent)
    const embeddingBot = await prisma.user.create({
      data: { name: 'Embedding Bot', email: 'emb@example.com', type: 'agent' },
    })
    const embeddingAgent = await prisma.agent.create({
      data: {
        id: embeddingBot.id,
        teamId: team.id,
        type: 'embedding',
        enabled: true,
        providerId: provider.id,
        modelId: model.id,
        config: { provider: 'google', model: 'gemini' },
      },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: embeddingBot.id, role: 'reviewer' },
    })
    const embCtx = await getEmbeddingContextActivity({ teamId: team.id, assetId: asset.id })
    expect(embCtx.agent.id).toBe(embeddingAgent.id)
    expect(embCtx.asset.id).toBe(asset.id)

    // Test saveAssetEmbeddingsActivity
    const mockEmbedding = Array(1536).fill(0.1)
    await saveAssetEmbeddingsActivity({
      assetId: asset.id,
      embeddings: [{ embedding: mockEmbedding }],
    })
    const dbEmbeddings = await prisma.assetEmbedding.findMany({
      where: { assetId: asset.id },
    })
    expect(dbEmbeddings.length).toBe(1)
  })

  describe('Agent System Tools and Path Context Activities', () => {
    it('should correctly format getAssetPathContextActivity', async () => {
      const team = await prisma.team.create({ data: { name: 'Path Team' } })
      const project = await prisma.project.create({
        data: { name: 'Path Project', teamId: team.id },
      })
      const folder1 = await prisma.asset.create({
        data: {
          name: 'foo',
          type: 'folder',
          projectId: project.id,
          status: 'uploaded',
        },
      })
      const folder2 = await prisma.asset.create({
        data: {
          name: 'bar',
          type: 'folder',
          projectId: project.id,
          parentId: folder1.id,
          status: 'uploaded',
        },
      })
      const file = await prisma.asset.create({
        data: {
          name: 'z.png',
          type: 'file',
          projectId: project.id,
          parentId: folder2.id,
          status: 'uploaded',
        },
      })

      const pathCtx = await getAssetPathContextActivity(file.id)
      expect(pathCtx).toContain('Path: foo/bar/z.png')
      expect(pathCtx).toContain(`name: foo, id: ${folder1.id}`)
      expect(pathCtx).toContain(`name: bar, id: ${folder2.id}`)
      expect(pathCtx).toContain(`name: z.png, id: ${file.id}`)
    })

    it('should correctly list assets, create folders, create files, and create versions', async () => {
      const fs = await import('fs')
      const path = await import('path')

      const team = await prisma.team.create({ data: { name: 'Tool Team' } })
      const user = await prisma.user.create({
        data: { name: 'Tool User', email: 'tooluser@example.com' },
      })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: user.id, role: 'owner' },
      })

      const project = await prisma.project.create({
        data: { name: 'Tool Project', teamId: team.id },
      })

      const parentFolder = await prisma.asset.create({
        data: {
          name: 'Parent Folder',
          type: 'folder',
          projectId: project.id,
          status: 'uploaded',
          fileCount: 0,
        },
      })

      // 1. Test create_folder via executeAgentToolActivity
      const folderResult = await executeAgentToolActivity({
        taskId: 'task1',
        toolName: 'create_folder',
        args: {
          parent: parentFolder.id,
          name: 'Child Folder',
        },
        userId: user.id,
      })
      expect(folderResult.id).toBeDefined()
      expect(folderResult.name).toBe('Child Folder')
      expect(folderResult.type).toBe('folder')

      const updatedParent = await prisma.asset.findUnique({
        where: { id: parentFolder.id },
      })
      expect(updatedParent?.fileCount).toBe(1)

      // 2. Test create_file via executeAgentToolActivity
      const tempFilePath = path.join(process.cwd(), 'temp_test_file.txt')
      fs.writeFileSync(tempFilePath, 'hello Shumai!')

      try {
        const fileResult = await executeAgentToolActivity({
          taskId: 'task2',
          toolName: 'create_file',
          args: {
            parent: parentFolder.id,
            path: tempFilePath,
          },
          userId: user.id,
        })
        expect(fileResult.id).toBeDefined()
        expect(fileResult.name).toBe('temp_test_file.txt')
        expect(fileResult.type).toBe('file')

        const parentAfterFile = await prisma.asset.findUnique({
          where: { id: parentFolder.id },
        })
        expect(parentAfterFile?.fileCount).toBe(2)

        // 3. Test list_assets via executeAgentToolActivity
        const listResult = await executeAgentToolActivity({
          taskId: 'task3',
          toolName: 'list_assets',
          args: {
            parent: parentFolder.id,
            page: 1,
            pageSize: 10,
            type: 'all',
          },
          userId: user.id,
        })
        expect(listResult.assets).toBeDefined()
        expect(listResult.assets.length).toBe(2) // folder and file

        // 4. Test create_version via executeAgentToolActivity (regular file -> stack)
        const versionTempPath = path.join(process.cwd(), 'temp_version_file.txt')
        fs.writeFileSync(versionTempPath, 'hello Shumai V2!')

        try {
          const versionResult = await executeAgentToolActivity({
            taskId: 'task4',
            toolName: 'create_version',
            args: {
              parent: fileResult.id,
              path: versionTempPath,
            },
            userId: user.id,
          })
          expect(versionResult.id).toBeDefined()
          expect(versionResult.type).toBe('file')

          // Check if parent (the original file) was stacked
          const originalFile = await prisma.asset.findUnique({
            where: { id: fileResult.id },
            include: { parent: true },
          })
          expect(originalFile?.parentId).toBeDefined()
          expect(originalFile?.parent?.type).toBe('version_stack')
        } finally {
          if (fs.existsSync(versionTempPath)) {
            fs.unlinkSync(versionTempPath)
          }
        }
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath)
        }
      }
    })
  })
})
