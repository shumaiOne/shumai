import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { AgentHarness, Session, type AgentTool } from '@earendil-works/pi-agent-core'
import { NodeExecutionEnv } from '@earendil-works/pi-agent-core/node'
import { getModel } from '@earendil-works/pi-ai'
import { Type, type TSchema } from '@sinclair/typebox'
import * as fs from 'fs'
import * as path from 'path'
import { DatabaseSessionStorage } from './database-session-storage'
import { analyzeAssetMediaTool } from './tools/analyze-asset-media'
import { createReadSkillTool } from './tools/read-skill'
import { createSandboxedBashTool } from './tools/sandboxed-bash'
import { createListAssetsTool } from './tools/list-assets'
import { createCreateFolderTool } from './tools/create-folder'
import { createCreateFileTool } from './tools/create-file'
import { createCreateVersionTool } from './tools/create-version'

export interface CreateAgentSessionParams {
  agentId: string
  providerName: string
  modelId: string
  systemPrompt: string
  teamSkills: Array<{ id: string; name: string; description?: string | null }>
  allowedDomains: string[]
  sessionId?: string
  userId?: string
  customTools?: AgentTool[]
  providers: Array<{
    name: string
    config: PrismaJson.ProviderConfig
    models: Array<{
      modelId: string
      name: string | null
      config: PrismaJson.ModelConfig
    }>
  }>
}

export async function createAgentSession(params: CreateAgentSessionParams) {
  const {
    agentId,
    providerName,
    modelId,
    systemPrompt,
    teamSkills,
    allowedDomains,
    sessionId,
    userId,
    customTools = [],
  } = params

  const storage = await DatabaseSessionStorage.create({
    agentId,
    userId,
    sessionId,
    cwd: process.cwd(),
  })
  const session = new Session(storage)

  const agentDir = path.join(process.cwd(), '.pi', 'agents', agentId)
  if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true })

  // Helper to construct a Model object from database providers list
  const getModelFromDb = (pName: string, mId: string) => {
    const dbProvider = params.providers.find((p) => p.name === pName)
    const dbModel = dbProvider?.models.find((m) => m.modelId === mId)

    if (!dbProvider || !dbModel) return undefined

    // Model contains complex internal types from pi-ai
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let m: any
    try {
      // Try to get built-in model as template
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      m = { ...(getModel as any)(pName, mId) }
    } catch {
      // Not a built-in model
      m = {
        id: mId,
        name: dbModel.name || mId,
        provider: pName,
        api: 'openai-responses',
        baseUrl: '',
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 4096,
        maxTokens: 4096,
      }
    }

    // Override with database config
    if (dbProvider.config.baseUrl) {
      m.baseUrl = dbProvider.config.baseUrl
    }
    if (dbProvider.config.api) {
      m.api = dbProvider.config.api
    }
    Object.assign(m, dbModel.config)
    if (dbModel.name) {
      m.name = dbModel.name
    }
    return m
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = getModelFromDb(providerName, modelId) || (getModel as any)(providerName, modelId)

  const piDir = path.join(process.cwd(), '.pi')
  if (!fs.existsSync(piDir)) fs.mkdirSync(piDir, { recursive: true })

  const allowWrite = [piDir, '/tmp']

  // SandboxManager.initialize is a global operation that applies to the entire process.
  await SandboxManager.initialize({
    network: {
      allowedDomains,
      deniedDomains: [],
    },
    filesystem: {
      allowWrite,
      denyWrite: ['.env', '.env.*', '*.pem', '*.key'],
      denyRead: ['~/.ssh', '~/.aws', '~/.gnupg'],
    },
  })

  const skillEnvs: Record<string, string> = {}
  const onEnvsAdded = (envs: Record<string, string>) => {
    Object.assign(skillEnvs, envs)
  }

  const sandboxedBash = createSandboxedBashTool(process.cwd(), skillEnvs)
  const readSkill = createReadSkillTool(onEnvsAdded)

  const systemTools: AgentTool[] = []
  if (userId) {
    systemTools.push(
      createListAssetsTool(userId),
      createCreateFolderTool(userId),
      createCreateFileTool(userId),
      createCreateVersionTool(userId),
    )
  }

  const harness = new AgentHarness({
    env: new NodeExecutionEnv({ cwd: process.cwd() }),
    session,
    model,
    systemPrompt: async () => {
      let prompt = systemPrompt
      if (teamSkills.length > 0) {
        prompt += '\n\nAvailable Skills:\n'
        for (const s of teamSkills) {
          prompt += `- ${s.name} (ID: ${s.id}): ${s.description || 'No description'}\n`
        }
        prompt +=
          '\nTo use a skill, first use the "read_skill" tool with the skill ID to read its instructions.'
      }
      return prompt
    },
    getApiKeyAndHeaders: async (targetModel) => {
      // Helper to resolve key from ENV if it matches an ENV var name
      const resolveKey = (key: string | undefined) => (key ? process.env[key] || key : undefined)

      // Look up the provider in our providers list
      const dbProvider = params.providers.find((p) => p.name === targetModel.provider)
      const providerApiKey = dbProvider?.config?.apiKey
      if (providerApiKey) {
        return { apiKey: resolveKey(providerApiKey)! }
      }

      return undefined
    },
    tools: [analyzeAssetMediaTool, readSkill, sandboxedBash, ...systemTools, ...customTools],
  })

  return { session, harness }
}

export interface AutofillField {
  id: string
  config: PrismaJson.FieldConfig
  description?: string | null
}

export function fieldsToTypeBoxSchema(fields: AutofillField[]) {
  const properties: Record<string, TSchema> = {}
  for (const f of fields) {
    let schema: TSchema
    switch (f.config.type) {
      case 'text':
      case 'longText':
        schema = Type.String()
        break
      case 'number':
      case 'rating':
        schema = Type.Number()
        break
      case 'toggle':
        schema = Type.Boolean()
        break
      case 'select':
        schema = Type.String({
          enum: f.config.select?.options?.map((o) => o.id) || [],
        })
        break
      default:
        schema = Type.String()
    }

    if (f.description) {
      schema.description = f.description
    }
    properties[f.id] = schema
  }

  return Type.Object(properties)
}
