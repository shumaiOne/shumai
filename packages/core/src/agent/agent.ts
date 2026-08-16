import { prisma, type Prisma, type TeamMemberRole } from '@shumai/db'
import {
  CreateAgentParams,
  DeleteAgentParams,
  ListAgentsParams,
  UpdateAgentParams,
  AgentSessionInfo,
  AgentInfo,
  AgentType,
} from '@shumai/dtos'
import {
  paginateQuery,
  type PaginatedData,
  type PaginationParams,
} from '@shumai/core/src/pagination'
import '@shumai/db/src/prisma-json-types'
import { s3Service } from '@shumai/core/src/s3/s3'
import { getAvatarUrl } from '@shumai/core/src/user/avatar'
import { resolveEffectiveRole } from '@shumai/core/src/authz/authz'
import { getAllowedAgentRoles } from './permissions'
import AdmZip from 'adm-zip'
import * as fs from 'fs'
import * as path from 'path'

const agentInclude = {
  user: true,
  provider: true,
  modelRef: true,
  skills: { include: { skill: true } },
  mcpServers: true,
} satisfies Prisma.AgentInclude

/** Structural shape consumed by `toAgentInfo` (works with any standard include). */
interface AgentInfoSource {
  id: string
  type: AgentType
  enabled: boolean
  permission: TeamMemberRole
  providerId: string | null
  modelId: string | null
  config: unknown
  soul: string | null
  user: { name: string; image: string | null }
  skills: Array<{ id: string; skillId: string; skill: { id: string; name: string } }>
  mcpServers: Array<{ mcpServerId: string }>
}

function extractS3Key(urlOrKey?: string | null): string | null | undefined {
  if (!urlOrKey) return urlOrKey
  const match = urlOrKey.match(/files\/[A-Z0-9]{26}/)
  return match ? match[0] : urlOrKey
}

export class AgentService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  async getSkillContent(skillId: string): Promise<string> {
    const skill = await this.prismaClient.skill.findUnique({
      where: { id: skillId },
    })

    if (!skill) {
      throw new Error(`Skill with ID ${skillId} not found.`)
    }

    const skillDir = path.join(process.cwd(), '.pi', 'skills', skill.id)
    const hashFile = path.join(skillDir, '.hash')
    let needsDownload = true

    if (fs.existsSync(hashFile)) {
      const localHash = fs.readFileSync(hashFile, 'utf8')
      if (localHash === skill.hash) {
        needsDownload = false
      }
    }

    if (needsDownload) {
      if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true, force: true })
      }
      fs.mkdirSync(skillDir, { recursive: true })

      const asset = await this.prismaClient.asset.findUnique({
        where: { id: skill.assetId },
        include: { storageKey: true },
      })

      if (!asset || !asset.storageKey?.key) {
        throw new Error('Skill asset not found or has no key')
      }

      const { buffer: zipBuffer } = await s3Service.getObject(
        process.env.S3_BUCKET || 'shumai',
        asset.storageKey.key,
      )

      const zip = new AdmZip(zipBuffer)
      zip.extractAllTo(skillDir, true)

      fs.writeFileSync(hashFile, skill.hash)
    }

    // Read SKILL.md
    let skillMdPath = path.join(skillDir, 'SKILL.md')
    if (!fs.existsSync(skillMdPath)) {
      skillMdPath = path.join(skillDir, 'skill.md')
    }

    if (!fs.existsSync(skillMdPath)) {
      throw new Error(`Skill downloaded but SKILL.md not found in ${skillDir}`)
    }

    return fs.readFileSync(skillMdPath, 'utf8')
  }

  async getSkillEnvs(skillId: string): Promise<Record<string, string>> {
    const skill = await this.prismaClient.skill.findUnique({
      where: { id: skillId },
    })
    if (!skill) return {}

    const config = skill.config as unknown as PrismaJson.SkillConfig
    const envs: Record<string, string> = {}
    if (config?.environmentVariables && Array.isArray(config.environmentVariables)) {
      for (const envVar of config.environmentVariables) {
        const value =
          envVar.default !== undefined && envVar.default !== null && envVar.default !== ''
            ? envVar.default
            : process.env[envVar.name]
        if (value !== undefined) {
          envs[envVar.name] = value
        }
      }
    }
    return envs
  }

  async createAgent(params: CreateAgentParams) {
    const {
      teamId,
      name,
      type,
      enabled,
      permission,
      avatar,
      providerId,
      modelId,
      thinkingLevel,
      systemPrompt,
      soul,
      skills,
      mcpServerIds,
      deniedTools,
    } = params

    if (type === 'embedding' || type === 'autofill') {
      const existing = await this.prismaClient.agent.findFirst({
        where: {
          type,
          teamId,
        },
      })
      if (existing) {
        throw new Error(`Agent of type ${type} already exists for this team`)
      }
    }

    if (type === 'chat' || type === 'autofill') {
      if (!providerId || !modelId) {
        throw new Error('providerId and modelId are required for chat/autofill agents')
      }
      const model = await this.prismaClient.model.findUnique({
        where: { id: modelId },
      })
      if (!model) throw new Error('model not found')
      if (model.providerId !== providerId) {
        throw new Error('model does not belong to provider')
      }
    }

    return this.prismaClient.$transaction(async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
      })
      if (!team) throw new Error('team not found')

      const agentConfig: PrismaJson.AgentConfig = {
        provider: providerId || '',
        model: modelId || '',
        thinkingLevel,
        systemPrompt,
        deniedTools: deniedTools || [],
      }

      const user = await tx.user.create({
        data: {
          name,
          email: `agent-${Date.now()}-${Math.random().toString(36).substring(7)}@shumai.ai`,
          type: 'agent',
          image: extractS3Key(avatar),
        },
      })

      const agent = await tx.agent.create({
        data: {
          id: user.id,
          teamId,
          type,
          enabled: enabled ?? true,
          permission: permission || 'reviewer',
          providerId: providerId || null,
          modelId: modelId || null,
          soul,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: agentConfig as any,
          skills: {
            create:
              skills?.map((skillId) => ({
                skillId,
              })) || [],
          },
          mcpServers: {
            create:
              mcpServerIds?.map((mcpServerId) => ({
                mcpServerId,
              })) || [],
          },
        },
      })

      await tx.teamMember.create({
        data: {
          teamId,
          userId: user.id,
          role: 'reviewer', // Default role for agents
        },
      })

      return tx.agent.findUnique({
        where: { id: agent.id },
        include: {
          user: true,
          skills: { include: { skill: true } },
          mcpServers: { include: { mcpServer: true } },
        },
      })
    })
  }

  async updateAgent(params: UpdateAgentParams) {
    const {
      agentId,
      name,
      type,
      enabled,
      permission,
      avatar,
      providerId,
      modelId,
      thinkingLevel,
      systemPrompt,
      soul,
      skills,
      mcpServerIds,
      deniedTools,
    } = params

    const agent = await this.prismaClient.agent.findUnique({
      where: { id: agentId },
      include: { user: { include: { teamMembers: true } } },
    })

    if (!agent) throw new Error('agent not found')

    if (type === 'embedding' || type === 'autofill') {
      const existing = await this.prismaClient.agent.findFirst({
        where: {
          type,
          id: { not: agentId },
          teamId: agent.teamId,
        },
      })
      if (existing) {
        throw new Error(`Agent of type ${type} already exists for this team`)
      }
    }

    if (type === 'chat' || type === 'autofill') {
      if (!providerId || !modelId) {
        throw new Error('providerId and modelId are required for chat/autofill agents')
      }
      const model = await this.prismaClient.model.findUnique({
        where: { id: modelId },
      })
      if (!model) throw new Error('model not found')
      if (model.providerId !== providerId) {
        throw new Error('model does not belong to provider')
      }
    }

    const agentConfig: PrismaJson.AgentConfig = {
      provider: providerId || '',
      model: modelId || '',
      thinkingLevel,
      systemPrompt,
      deniedTools: deniedTools || [],
    }

    return this.prismaClient.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: agentId },
        data: {
          name,
          image: extractS3Key(avatar),
        },
      })

      // Update skills: easier to delete all and recreate
      await tx.agentSkill.deleteMany({
        where: { agentId },
      })

      // Update MCP server assignments: easier to delete all and recreate
      await tx.agentMcpServer.deleteMany({
        where: { agentId },
      })

      return tx.agent.update({
        where: { id: agentId },
        data: {
          type,
          enabled: enabled ?? true,
          ...(permission ? { permission } : {}),
          providerId: providerId || null,
          modelId: modelId || null,
          soul,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: agentConfig as any,
          skills: {
            create:
              skills?.map((skillId) => ({
                skillId,
              })) || [],
          },
          mcpServers: {
            create:
              mcpServerIds?.map((mcpServerId) => ({
                mcpServerId,
              })) || [],
          },
        },
        include: {
          user: true,
          skills: { include: { skill: true } },
          mcpServers: { include: { mcpServer: true } },
        },
      })
    })
  }

  async updateAgentPermission(agentId: string, permission: 'owner' | 'editor' | 'reviewer') {
    const existing = await this.prismaClient.agent.findUnique({
      where: { id: agentId },
    })
    if (!existing) throw new Error('agent not found')

    return this.prismaClient.agent.update({
      where: { id: agentId },
      data: { permission },
      include: {
        user: true,
        provider: true,
        modelRef: true,
        skills: {
          include: {
            skill: true,
          },
        },
        mcpServers: true,
      },
    })
  }

  async getAgent(params: { agentId: string }) {
    return this.prismaClient.agent.findUnique({
      where: { id: params.agentId },
    })
  }

  async deleteAgent(params: DeleteAgentParams) {
    const { agentId } = params

    const agent = await this.prismaClient.agent.findUnique({
      where: { id: agentId },
    })

    if (!agent) throw new Error('agent not found')

    // Deleting user will cascade to agent and teamMember due to schema definition
    await this.prismaClient.user.delete({
      where: { id: agentId },
    })
  }

  /**
   * Map an agent (with the standard relations include) to the AgentInfo DTO.
   * Shared by the team-level agent list and the project-scoped chat-agent list.
   */
  async toAgentInfo(agent: AgentInfoSource): Promise<AgentInfo> {
    const config = agent.config as unknown as PrismaJson.AgentConfig
    return {
      id: agent.id,
      name: agent.user.name,
      type: agent.type as AgentType,
      enabled: agent.enabled,
      permission: agent.permission,
      avatar: (await getAvatarUrl(agent.user.image)) || undefined,
      providerId: agent.providerId || undefined,
      modelId: agent.modelId || undefined,
      thinkingLevel: config.thinkingLevel || 'off',
      systemPrompt: config.systemPrompt,
      soul: agent.soul || undefined,
      skills: agent.skills.map((s) => ({
        id: s.id,
        skillId: s.skillId,
        skill: s.skill,
      })),
      mcpServerIds: (agent.mcpServers || []).map((m) => m.mcpServerId),
      deniedTools: config.deniedTools || [],
    }
  }

  /**
   * List the chat agents available to a user inside a specific project,
   * resolved against the user's effective project role (project override wins;
   * restricted users get an empty list). Used by the one-to-one chat selector.
   */
  async listProjectChatAgents(projectId: string, userId: string): Promise<AgentInfo[]> {
    const project = await this.prismaClient.project.findUnique({
      where: { id: projectId },
      select: { teamId: true },
    })
    if (!project) return []

    const effectiveRole = await resolveEffectiveRole(project.teamId, projectId, userId)
    if (!effectiveRole) return []

    const allowedRoles = getAllowedAgentRoles(effectiveRole)

    const agents = await this.prismaClient.agent.findMany({
      where: {
        teamId: project.teamId,
        type: 'chat',
        enabled: true,
        permission: { in: allowedRoles },
      },
      orderBy: { id: 'desc' },
      include: agentInclude,
    })

    return Promise.all(agents.map((agent) => this.toAgentInfo(agent)))
  }

  async listAgents(params: ListAgentsParams) {
    const allowedRoles = params.userId
      ? getAllowedAgentRoles(
          (
            await this.prismaClient.teamMember.findUnique({
              where: {
                teamIdUserId: {
                  teamId: params.teamId,
                  userId: params.userId,
                },
              },
              select: { role: true },
            })
          )?.role,
        )
      : null

    return this.prismaClient.agent.findMany({
      where: {
        teamId: params.teamId,
        ...(allowedRoles
          ? {
              OR: [
                { type: { not: 'chat' } },
                {
                  type: 'chat',
                  permission: { in: allowedRoles },
                },
              ],
            }
          : {}),
      },
      orderBy: {
        id: 'desc',
      },
      include: {
        user: true,
        provider: true,
        modelRef: true,
        skills: {
          include: {
            skill: true,
          },
        },
        mcpServers: true,
      },
    })
  }

  async getSessionEntries(params: { sessionId: string }) {
    const session = await this.prismaClient.agentSession.findUnique({
      where: { id: params.sessionId },
      select: { leafId: true },
    })

    if (!session?.leafId) {
      return []
    }

    interface EntryRow {
      id: string
      // eslint-disable-next-line @typescript-eslint/naming-convention
      session_id: string | null
      type: string | null
      // eslint-disable-next-line @typescript-eslint/naming-convention
      parent_id: string | null
      // eslint-disable-next-line @typescript-eslint/naming-convention
      created_at: Date
      data: unknown
    }

    const rows = await this.prismaClient.$queryRaw<EntryRow[]>`
      WITH RECURSIVE entry_path AS (
        SELECT id, session_id, type, parent_id, created_at, data, 1 AS depth
        FROM agent_session_entries
        WHERE id = ${session.leafId}

        UNION ALL

        SELECT e.id, e.session_id, e.type, e.parent_id, e.created_at, e.data, ep.depth + 1
        FROM agent_session_entries e
        INNER JOIN entry_path ep ON e.id = ep.parent_id
      )
      SELECT id, session_id, type, parent_id, created_at, data
      FROM entry_path
      ORDER BY depth DESC;
    `

    return rows.map((r) => {
      const payload = (r.data as Record<string, unknown>) || {}
      const entryObj = {
        id: r.id,
        type: r.type || 'message',
        parentId: r.parent_id,
        timestamp: r.created_at.toISOString(),
        ...payload,
      }
      return {
        id: r.id,
        sessionId: r.session_id || params.sessionId,
        type: r.type,
        parentId: r.parent_id,
        data: r.data,
        createdAt: r.created_at,
        entry: entryObj,
      }
    })
  }

  async listSessions(
    teamId: string,
    params: PaginationParams,
  ): Promise<PaginatedData<AgentSessionInfo[]>> {
    const where: Prisma.AgentSessionWhereInput = {
      id: { not: 'pending' },
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
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        })

        return await Promise.all(
          sessions.map(async (s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            createdAt: s.createdAt.toISOString(),
            creator: s.user
              ? {
                  id: s.user.id,
                  name: s.user.name,
                  email: s.user.email,
                  image: await getAvatarUrl(s.user.image),
                }
              : null,
            agentId: s.agentId,
          })),
        )
      },
      async () => {
        return this.prismaClient.agentSession.count({ where })
      },
      params,
    )
  }
}

export const agentService = new AgentService()
