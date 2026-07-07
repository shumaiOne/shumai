import { prisma } from '@shumai/db'
import type { Prisma } from '@shumai/db'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { paginateQuery, type PaginatedData } from '@shumai/core/src/pagination'
import type { ChatRequest, ChatSessionInfo, ChatMessage } from '@shumai/dtos'
import { ulid } from 'ulid'

type User = Prisma.UserGetPayload<Record<string, never>>

export function mapEntryToMessage(
  entryRecord: Prisma.AgentSessionEntryGetPayload<Record<string, never>>,
): ChatMessage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry = entryRecord.entry as any
  const id = entryRecord.id
  const timestamp = entry.timestamp || new Date().toISOString()

  let role: ChatMessage['role']
  let content = ''

  if (entry.type === 'message') {
    const rawRole = entry.message?.role
    if (
      rawRole === 'user' ||
      rawRole === 'assistant' ||
      rawRole === 'toolCall' ||
      rawRole === 'toolResult'
    ) {
      role = rawRole
    } else {
      role = 'user'
    }

    if (Array.isArray(entry.message?.content)) {
      content = entry.message.content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => c.type === 'text')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => c.text)
        .join('\n')
    } else if (typeof entry.message?.content === 'string') {
      content = entry.message.content
    }
  } else if (entry.type === 'thinking_level_change') {
    role = 'thinking_level_change'
    content = `Thinking level changed to ${entry.thinkingLevel}`
  } else {
    role = 'toolCall'
    content = JSON.stringify(entry)
  }

  return {
    id,
    role,
    content,
    timestamp,
    entry,
  }
}

export class ChatService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  private async getAssetPath(assetId: string): Promise<string> {
    const parts: string[] = []
    let currentId: string | null = assetId
    while (currentId) {
      const dbAssetNode = (await prisma.asset.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true, type: true },
      })) as { id: string; name: string; parentId: string | null; type: unknown } | null
      if (!dbAssetNode) break
      if (dbAssetNode.type === 'root' || dbAssetNode.type === 'share_root') {
        break
      }
      parts.unshift(dbAssetNode.name)
      currentId = dbAssetNode.parentId
    }
    return parts.join('/')
  }

  async startOrContinueChat(
    user: User,
    req: ChatRequest,
  ): Promise<{ sessionId: string; taskId: string }> {
    const {
      textPrompt,
      attachedFiles = [],
      assetIds = [],
      sessionId: passedSessionId,
      contextAssetId,
      projectId: passedProjectId,
    } = req

    // 1. Permissions verification
    if (contextAssetId) {
      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: contextAssetId,
      })
    }

    for (const fileId of attachedFiles) {
      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: fileId,
      })
    }

    for (const assetId of assetIds) {
      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: assetId,
      })
    }

    // 2. Project / Asset scoping resolution
    let targetAssetId = ''

    if (passedSessionId) {
      const session = await this.prismaClient.agentSession.findUnique({
        where: { id: passedSessionId },
        include: { asset: { include: { project: true } } },
      })
      if (!session) throw new Error('Session not found')
      if (session.userId !== user.id) throw new Error('Unauthorized session access')
      if (!session.assetId) throw new Error('Session has no associated asset')
      targetAssetId = session.assetId
    } else {
      // Start a new session
      if (contextAssetId) {
        const asset = await this.prismaClient.asset.findUnique({
          where: { id: contextAssetId },
          include: { project: true },
        })
        if (!asset) throw new Error('Context asset not found')
        targetAssetId = contextAssetId
      } else if (passedProjectId) {
        const project = await this.prismaClient.project.findUnique({
          where: { id: passedProjectId },
        })
        if (!project || !project.rootFolderId) throw new Error('Project or root folder not found')
        targetAssetId = project.rootFolderId
      } else {
        // Find default project from user's first team
        const teamMember = await this.prismaClient.teamMember.findFirst({
          where: { userId: user.id },
          include: { team: { include: { projects: { include: { rootFolder: true } } } } },
        })
        const project = teamMember?.team?.projects?.[0]
        if (!project || !project.rootFolderId) {
          throw new Error('No active project found for the user. Please specify a projectId.')
        }
        targetAssetId = project.rootFolderId
      }
    }

    // 3. Context Prompt construction
    let contextPrompt = ''
    if (attachedFiles.length > 0 || assetIds.length > 0) {
      contextPrompt += '[Context: Attached Files & Referenced Assets]\n'
      if (attachedFiles.length > 0) {
        contextPrompt += 'Attached Files:\n'
        for (const fileId of attachedFiles) {
          const file = await this.prismaClient.asset.findUnique({
            where: { id: fileId },
          })
          if (file) {
            const filePath = await this.getAssetPath(file.id)
            contextPrompt += `- Name: ${file.name} (ID: ${file.id}, Type: ${file.type}, Media Type: ${file.mediaType || 'unknown'}, Project ID: ${file.projectId || 'unknown'}, Path: ${filePath})\n`
          }
        }
      }
      if (assetIds.length > 0) {
        contextPrompt += 'Referenced Workspace Assets:\n'
        for (const assetId of assetIds) {
          const asset = await this.prismaClient.asset.findUnique({
            where: { id: assetId },
          })
          if (asset) {
            const assetPath = await this.getAssetPath(asset.id)
            contextPrompt += `- Name: ${asset.name} (ID: ${asset.id}, Type: ${asset.type}, Media Type: ${asset.mediaType || 'unknown'}, Project ID: ${asset.projectId || 'unknown'}, Path: ${assetPath})\n`
          }
        }
      }
      contextPrompt += '\n---\n'
    }

    const finalPrompt = `${contextPrompt}${textPrompt || ''}`

    // 4. Create database records in a transaction
    return await this.prismaClient.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: targetAssetId },
        include: { project: { include: { team: true } } },
      })
      if (!asset || !asset.project) {
        throw new Error('Resolved asset or project not found')
      }
      const teamId = asset.project.teamId
      const projectId = asset.project.id

      // Ensure AI agent configuration exists
      const agentId = 'default'
      const userExists = await tx.user.findUnique({ where: { id: agentId } })
      if (!userExists) {
        await tx.user.create({
          data: {
            id: agentId,
            name: 'Ai Agent',
            email: `${agentId}@shumai.ai`,
            type: 'agent',
          },
        })
      }
      const agentExists = await tx.agent.findUnique({ where: { id: agentId } })
      if (!agentExists) {
        await tx.agent.create({
          data: {
            id: agentId,
            teamId,
            type: 'chat',
            config: {
              provider: 'openai',
              model: 'gpt-4',
            },
          },
        })
      }

      let activeSessionId = passedSessionId
      let existingSession = null

      if (activeSessionId) {
        existingSession = await tx.agentSession.findUnique({
          where: { id: activeSessionId },
        })
        if (!existingSession) throw new Error('Session not found')
      } else {
        const newSession = await tx.agentSession.create({
          data: {
            agentId,
            userId: user.id,
            cwd: process.cwd(),
            assetId: asset.id,
          },
        })
        activeSessionId = newSession.id
      }

      // Create comment representing the user's message
      const replyToId = passedSessionId ? existingSession?.userCommentId : undefined
      const comment = await tx.assetComment.create({
        data: {
          assetId: asset.id,
          creatorId: user.id,
          message: finalPrompt,
          sessionId: activeSessionId,
          replyToId: replyToId || null,
        },
      })

      // Link attachment assets if provided
      if (attachedFiles.length > 0) {
        for (const fileId of attachedFiles) {
          const fileAsset = await tx.asset.findUnique({
            where: { id: fileId },
          })
          if (fileAsset) {
            await tx.assetCommentAttachment.create({
              data: {
                assetId: fileAsset.id,
                commentId: comment.id,
              },
            })
          }
        }
      }

      // Append entry for user's message
      const parentId = passedSessionId ? existingSession?.leafId : null
      const entryId = ulid()
      const entryJson = {
        type: 'message' as const,
        id: entryId,
        parentId: parentId || null,
        timestamp: new Date().toISOString(),
        message: {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: finalPrompt }],
          timestamp: Date.now(),
        },
      }

      await tx.agentSessionEntry.create({
        data: {
          id: entryId,
          sessionId: activeSessionId!,
          entry: entryJson,
        },
      })

      // Update session's state
      await tx.agentSession.update({
        where: { id: activeSessionId },
        data: {
          leafId: entryId,
          ...(!passedSessionId ? { userCommentId: comment.id } : {}),
        },
      })

      // Trigger chat workflow
      const task = await tx.workflowTask.create({
        data: {
          assetId: asset.id,
          type: 'chat',
          status: 'pending',
          teamId,
          projectId,
          payload: {
            projectId,
            agent: {
              userCommentId: comment.id,
              agentId,
              sessionId: activeSessionId,
              userId: user.id,
            },
          },
        },
      })

      return {
        sessionId: activeSessionId!,
        taskId: task.id,
      }
    })
  }

  async listSessions(
    userId: string,
    params: { first?: number; after?: string },
  ): Promise<PaginatedData<ChatSessionInfo[]>> {
    const where: Prisma.AgentSessionWhereInput = {
      userId,
    }

    return await paginateQuery(
      async (skip, take) => {
        const sessions = await this.prismaClient.agentSession.findMany({
          where,
          skip,
          take,
          orderBy: { id: 'desc' },
        })
        return sessions.map((s) => ({
          id: s.id,
          agentId: s.agentId,
          userId: s.userId,
          assetId: s.assetId,
          userCommentId: s.userCommentId,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        }))
      },
      async () => this.prismaClient.agentSession.count({ where }),
      params,
    )
  }

  async listMessages(userId: string, sessionId: string): Promise<ChatMessage[]> {
    const session = await this.prismaClient.agentSession.findUnique({
      where: { id: sessionId },
    })
    if (!session) {
      throw new Error('Session not found')
    }
    if (session.userId !== userId) {
      throw new Error('Unauthorized session access')
    }

    const entries = await this.prismaClient.agentSessionEntry.findMany({
      where: { sessionId },
      orderBy: { id: 'asc' },
    })

    return entries.map(mapEntryToMessage)
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prismaClient.agentSession.findUnique({
      where: { id: sessionId },
    })
    if (!session) {
      throw new Error('Session not found')
    }
    if (session.userId !== userId) {
      throw new Error('Unauthorized session access')
    }
    await this.prismaClient.agentSession.delete({
      where: { id: sessionId },
    })
  }
}

export const chatService = new ChatService()
