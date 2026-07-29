import { prisma } from '@shumai/db'
import type { Prisma } from '@shumai/db'
import {
  AgentSessionInfo,
  CreateAgentParams,
  DeleteAgentParams,
  ListAgentsParams,
  UpdateAgentParams,
} from '@shumai/dtos'
import '@shumai/db/src/prisma-json-types'
import { PaginatedData, paginateQuery, PaginationParams } from '@shumai/core/src/pagination'
import { s3Service } from '@shumai/core/src/s3/s3'
import { getAvatarUrl } from '@shumai/core/src/user/avatar'
import AdmZip from 'adm-zip'
import * as fs from 'fs'
import * as path from 'path'

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
      avatar,
      providerId,
      modelId,
      thinkingLevel,
      systemPrompt,
      soul,
      skills,
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
        include: { user: true, skills: { include: { skill: true } } },
      })
    })
  }

  async updateAgent(params: UpdateAgentParams) {
    const {
      agentId,
      name,
      type,
      enabled,
      avatar,
      providerId,
      modelId,
      thinkingLevel,
      systemPrompt,
      soul,
      skills,
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

      return tx.agent.update({
        where: { id: agentId },
        data: {
          type,
          enabled: enabled ?? true,
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
        },
        include: { user: true, skills: { include: { skill: true } } },
      })
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

  async listAgents(params: ListAgentsParams) {
    return this.prismaClient.agent.findMany({
      where: {
        teamId: params.teamId,
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

  async listTeamSessions(
    teamId: string,
    params: PaginationParams,
  ): Promise<PaginatedData<AgentSessionInfo[]>> {
    const where: Prisma.AgentSessionWhereInput = {
      agent: {
        teamId,
      },
      OR: [
        { name: null },
        {
          NOT: [{ name: { equals: 'pending', mode: 'insensitive' } }],
        },
      ],
    }

    return await paginateQuery(
      async (skip, take) => {
        const sessions = await this.prismaClient.agentSession.findMany({
          where,
          skip,
          take,
          orderBy: { id: 'desc' },
          include: {
            user: true,
            agent: {
              include: {
                user: true,
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
            updatedAt: s.updatedAt.toISOString(),
            creator: s.user
              ? {
                  id: s.user.id,
                  name: s.user.name,
                  avatar: (await getAvatarUrl(s.user.image)) || undefined,
                }
              : null,
            agent: s.agent
              ? {
                  id: s.agent.id,
                  name: s.agent.user.name,
                }
              : null,
          })),
        )
      },
      async () => this.prismaClient.agentSession.count({ where }),
      params,
    )
  }
}

export const agentService = new AgentService()
