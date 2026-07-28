import { prisma } from '@shumai/db'
import type { Prisma } from '@shumai/db'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { paginateQuery, type PaginatedData } from '@shumai/core/src/pagination'
import type { ChatRequest, ChatSessionInfo, ChatMessage } from '@shumai/dtos'
import type { SessionTreeEntry } from '@earendil-works/pi-agent-core'
import { workflowService } from '@shumai/workflow-core'
import { agentService } from '@shumai/core/src/agent/agent'

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
  const payload = (entryRecord.data as Record<string, unknown>) || {}
  const entryObj = {
    id: entryRecord.id,
    type: (entryRecord.type || 'message') as SessionTreeEntry['type'],
    parentId: entryRecord.parentId,
    timestamp: entryRecord.createdAt.toISOString(),
    ...payload,
  } as unknown as SessionTreeEntry

  if (
    entryObj.type === 'custom_message' &&
    (entryObj as { customType?: string }).customType === 'context'
  ) {
    return null
  }
  const pathEntries = [entryObj]
  const messages = buildSessionMessages(pathEntries)
  if (messages.length > 0) {
    return messages[0]
  }
  return {
    id: entryRecord.id,
    role: 'user',
    content: '',
    timestamp: entryRecord.createdAt.getTime(),
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
    teamId: string,
    req: ChatRequest,
  ): Promise<{ sessionId: string; taskId: string }> {
    const {
      agentId,
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
    let hasAssetChanged = false

    if (passedSessionId) {
      const session = await this.prismaClient.agentSession.findUnique({
        where: { id: passedSessionId },
        include: { asset: { include: { project: true } } },
      })
      if (!session) throw new Error('Session not found')
      if (session.userId !== user.id) throw new Error('Unauthorized session access')
      if (!session.assetId) throw new Error('Session has no associated asset')

      if (contextAssetId && contextAssetId !== session.assetId) {
        const contextAsset = await this.prismaClient.asset.findUnique({
          where: { id: contextAssetId },
          include: { project: true },
        })
        if (!contextAsset) throw new Error('Context asset not found')
        targetAssetId = contextAssetId
        hasAssetChanged = true
      } else {
        targetAssetId = session.assetId
      }
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
      const isImage = (file?.media as PrismaJson.MediaInfo | null)?.proxyType === 'image'
      if (file && isImage && file.storageKey?.key) {
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

      let activeSessionId = passedSessionId

      // Ensure AI agent configuration exists
      const agent = await tx.agent.findUnique({ where: { id: agentId } })
      if (!agent) {
        throw new Error(`Agent with ID "${agentId}" not found`)
      }
      if (agent.teamId !== teamId) {
        throw new Error(`Agent does not belong to the specified team`)
      }

      if (activeSessionId) {
        const sessionExists = await tx.agentSession.findUnique({
          where: { id: activeSessionId },
          select: { id: true, userId: true },
        })
        if (!sessionExists) throw new Error('Session not found')
        if (sessionExists.userId !== user.id) throw new Error('Unauthorized session access')

        // Update the session's agentId and assetId (if location changed)
        await tx.agentSession.update({
          where: { id: activeSessionId },
          data: {
            agentId,
            ...(hasAssetChanged ? { assetId: targetAssetId } : {}),
          },
        })
      } else {
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
          sessionId: activeSessionId,
          payload: {
            projectId,
            agent: {
              prompt: finalPrompt,
              imageUrls: resolvedImageUrls,
              attachedFiles,
              assetIds,
              agentId,
              sessionId: activeSessionId,
              userId: user.id,
              isNewChat: !passedSessionId,
              hasAssetChanged,
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
    teamId: string,
    params: { first?: number; after?: string },
  ): Promise<PaginatedData<ChatSessionInfo[]>> {
    const where: Prisma.AgentSessionWhereInput = {
      userId,
      type: 'chat',
      agent: {
        teamId,
      },
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
          name: s.name,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        }))
      },
      async () => this.prismaClient.agentSession.count({ where }),
      params,
    )
  }

  async listMessages(userId: string, teamId: string, sessionId: string): Promise<ChatMessage[]> {
    const session = await this.prismaClient.agentSession.findUnique({
      where: { id: sessionId },
    })
    if (!session) {
      throw new Error('Session not found')
    }
    if (session.userId !== userId) {
      throw new Error('Unauthorized session access')
    }

    const entries = await agentService.getSessionEntries({ sessionId })

    const pathEntries = entries.map(
      (e: {
        id: string
        type: string | null
        parentId: string | null
        createdAt: Date
        data: unknown
      }) => {
        const payload = (e.data as Record<string, unknown>) || {}
        return {
          id: e.id,
          type: (e.type || 'message') as SessionTreeEntry['type'],
          parentId: e.parentId,
          timestamp: e.createdAt.toISOString(),
          ...payload,
        } as unknown as SessionTreeEntry
      },
    )

    return buildSessionMessages(pathEntries)
  }

  async deleteSession(userId: string, teamId: string, sessionId: string): Promise<void> {
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

  async getNewSessionMessages(
    sessionId: string,
    lastEntryId?: string,
  ): Promise<{ messages: ChatMessage[]; lastEntryId: string | null }> {
    const entries = await this.prismaClient.agentSessionEntry.findMany({
      where: {
        sessionId,
        ...(lastEntryId ? { id: { gt: lastEntryId } } : {}),
      },
      orderBy: { id: 'asc' },
    })

    if (entries.length === 0) {
      return { messages: [], lastEntryId: lastEntryId ?? null }
    }

    const messages: ChatMessage[] = []
    for (const entry of entries) {
      const message = mapEntryToMessage(entry)
      if (message) {
        messages.push(message)
      }
    }

    return {
      messages,
      lastEntryId: entries[entries.length - 1].id,
    }
  }

  async getChatWorkflowStatus(
    taskId: string,
  ): Promise<{ status: string | null; output: Record<string, unknown> | null } | null> {
    const task = await this.prismaClient.workflowTask.findUnique({
      where: { id: taskId },
      select: { status: true, output: true },
    })
    if (!task) return null
    return {
      status: task.status,
      output: task.output as Record<string, unknown> | null,
    }
  }

  async abortSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prismaClient.agentSession.findUnique({
      where: { id: sessionId },
    })
    if (!session) {
      throw new Error('Session not found')
    }
    if (session.userId !== userId) {
      throw new Error('Unauthorized session access')
    }

    const taskToAbort = await this.prismaClient.workflowTask.findFirst({
      where: {
        status: { in: ['pending', 'processing'] },
        type: 'chat',
        sessionId,
      },
    })

    if (!taskToAbort) {
      throw new Error('No active execution found for this session')
    }

    await workflowService.cancel(taskToAbort.id)

    await this.prismaClient.workflowTask.update({
      where: { id: taskToAbort.id },
      data: {
        status: 'failed',
        output: { error: 'aborted' },
      },
    })
  }
}

export const chatService = new ChatService()
