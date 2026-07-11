import { prisma } from '@shumai/db'
import type { Prisma } from '@shumai/db'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { paginateQuery, type PaginatedData } from '@shumai/core/src/pagination'
import type { ChatRequest, ChatSessionInfo, ChatMessage } from '@shumai/dtos'
import type { SessionTreeEntry } from '@earendil-works/pi-agent-core'

type User = Prisma.UserGetPayload<Record<string, never>>

export type PathEntry = SessionTreeEntry & { id: string }

export function buildSessionMessages(pathEntries: PathEntry[]): ChatMessage[] {
  let compaction: (SessionTreeEntry & { type: 'compaction' } & { id: string }) | null = null

  for (const entry of pathEntries) {
    if (entry.type === 'compaction') {
      compaction = entry as SessionTreeEntry & { type: 'compaction' } & { id: string }
    }
  }

  const messages: ChatMessage[] = []
  const appendMessage = (entry: PathEntry) => {
    const timestampMs = new Date(entry.timestamp).getTime()
    if (entry.type === 'message') {
      messages.push({
        ...entry.message,
        id: entry.id,
        timestamp: entry.message.timestamp || timestampMs,
      } as unknown as ChatMessage)
    } else if (entry.type === 'custom_message') {
      if (entry.customType === 'context') return
      messages.push({
        id: entry.id,
        role: 'custom',
        customType: entry.customType,
        content: entry.content,
        display: entry.display,
        details: entry.details as Record<string, unknown> | undefined,
        timestamp: timestampMs,
      } as unknown as ChatMessage)
    } else if (entry.type === 'custom') {
      messages.push({
        id: entry.id,
        role: 'custom',
        customType: entry.customType,
        details: (entry as { data?: unknown }).data as Record<string, unknown> | undefined,
        timestamp: timestampMs,
      } as unknown as ChatMessage)
    } else if (entry.type === 'branch_summary') {
      messages.push({
        id: entry.id,
        role: 'custom',
        customType: 'branch-summary',
        content: entry.summary,
        details: { fromId: entry.fromId },
        timestamp: timestampMs,
      } as unknown as ChatMessage)
    } else if (entry.type === 'thinking_level_change') {
      messages.push({
        id: entry.id,
        role: 'thinking_level_change',
        content: `Thinking level changed to ${entry.thinkingLevel}`,
        timestamp: timestampMs,
      } as unknown as ChatMessage)
    }
  }

  if (compaction) {
    const compactionTimestamp = new Date(compaction.timestamp).getTime()
    messages.push({
      id: compaction.id,
      role: 'custom',
      customType: 'compaction-summary',
      content: compaction.summary,
      details: { tokensBefore: compaction.tokensBefore },
      timestamp: compactionTimestamp,
    } as unknown as ChatMessage)
    const compactionIdx = pathEntries.findIndex(
      (e) => e.type === 'compaction' && e.id === compaction?.id,
    )
    let foundFirstKept = false
    for (let i = 0; i < compactionIdx; i++) {
      const entry = pathEntries[i]
      if (entry.id === compaction.firstKeptEntryId) foundFirstKept = true
      if (foundFirstKept) appendMessage(entry)
    }
    for (let i = compactionIdx + 1; i < pathEntries.length; i++) {
      appendMessage(pathEntries[i])
    }
  } else {
    for (const entry of pathEntries) {
      appendMessage(entry)
    }
  }

  return messages
}

export function mapEntryToMessage(
  entryRecord: Prisma.AgentSessionEntryGetPayload<Record<string, never>>,
): ChatMessage | null {
  const entryObj = entryRecord.entry as unknown as SessionTreeEntry
  if (
    entryObj.type === 'custom_message' &&
    (entryObj as { customType?: string }).customType === 'context'
  ) {
    return null
  }
  const pathEntries = [{ ...entryObj, id: entryRecord.id }]
  const messages = buildSessionMessages(pathEntries)
  if (messages.length > 0) {
    return messages[0]
  }
  return {
    id: entryRecord.id,
    role: 'user',
    content: '',
  } as unknown as ChatMessage
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

    const finalPrompt = textPrompt || ''

    const resolvedImageUrls: string[] = []
    for (const fileId of attachedFiles) {
      const file = await this.prismaClient.asset.findUnique({
        where: { id: fileId },
        include: { storageKey: true },
      })
      if (file && file.mediaType?.startsWith('image/') && file.storageKey?.key) {
        resolvedImageUrls.push(file.storageKey.key)
      }
    }

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

      let agentId: string
      let activeSessionId = passedSessionId

      if (activeSessionId) {
        const sessionExists = await tx.agentSession.findUnique({
          where: { id: activeSessionId },
          select: { id: true, agentId: true },
        })
        if (!sessionExists) throw new Error('Session not found')
        agentId = sessionExists.agentId
      } else {
        const teamSettings = (asset.project.team.settings || {}) as Record<string, unknown>
        const settingsAgentId = teamSettings.chatbotAgentId as string | undefined
        if (!settingsAgentId) {
          throw new Error('No chatbot agent configured for the team')
        }
        agentId = settingsAgentId
      }

      // Ensure AI agent configuration exists
      const agent = await tx.agent.findUnique({ where: { id: agentId } })
      if (!agent) {
        throw new Error(`Agent with ID "${agentId}" not found`)
      }

      if (!activeSessionId) {
        const newSession = await tx.agentSession.create({
          data: {
            agentId,
            userId: user.id,
            cwd: process.cwd(),
            assetId: asset.id,
            type: 'chat',
          },
        })
        activeSessionId = newSession.id
      }
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
              prompt: finalPrompt,
              imageUrls: resolvedImageUrls,
              attachedFiles,
              assetIds,
              explicitMention: true,
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
      type: 'chat',
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

    const pathEntries = entries.map((e) => {
      const entryObj = e.entry as unknown as SessionTreeEntry
      return {
        ...entryObj,
        id: e.id,
      }
    })

    return buildSessionMessages(pathEntries)
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
