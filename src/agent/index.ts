import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { getModel } from '@mariozechner/pi-ai'
import {
  AuthStorage,
  createAgentSession as piCreateAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type ToolDefinition,
} from '@mariozechner/pi-coding-agent'
import { Type, type TSchema } from '@sinclair/typebox'
import * as fs from 'fs'
import * as path from 'path'
import type { DatabaseSessionManager } from './database-session-manager'
import { analyzeAssetMediaTool } from './tools/analyze-asset-media'
import { createReadSkillTool } from './tools/read-skill'
import { createSandboxedBashTool } from './tools/sandboxed-bash'

export interface CreateAgentSessionParams {
  agentId: string
  providerName: string
  modelId: string
  apiKey?: string
  systemPrompt: string
  teamSkills: Array<{ id: string; name: string; description?: string | null }>
  allowedDomains: string[]
  sessionManager: DatabaseSessionManager
  customTools?: ToolDefinition[]
  providers: Array<{
    name: string
    config: Record<string, unknown>
    models: Array<{
      modelId: string
      name: string | null
      config: Record<string, unknown>
    }>
  }>
}

export async function createAgentSession(params: CreateAgentSessionParams) {
  const {
    agentId,
    providerName,
    modelId,
    apiKey,
    systemPrompt,
    teamSkills,
    allowedDomains,
    sessionManager,
    customTools = [],
    providers,
  } = params

  const agentDir = path.join(process.cwd(), '.pi', 'agents', agentId)
  if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true })

  const authStorage = AuthStorage.create(path.join(agentDir, 'auth.json'))
  const modelRegistry = ModelRegistry.create(authStorage)
  modelRegistry.getAll()

  for (const p of providers) {
    // Ensure each model has a name (fallback to ID) to satisfy registerProvider's strict requirement
    const config = {
      ...p.config,
      models: p.models.map((m) => ({
        ...m.config,
        id: m.modelId,
        name: m.name || m.modelId,
      })),
    }
    // We cast to any because the third-party library's ProviderConfigInput type expects highly specific properties
    // like reasoning, input, and cost on each model config, which are stored dynamically in the database
    // and loaded as arbitrary Record<string, unknown> JSON values.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modelRegistry.registerProvider(p.name, config as any)
  }

  if (apiKey) {
    authStorage.set(providerName, { type: 'api_key', key: apiKey })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (getModel as any)(providerName, modelId)

  const settingsManager = SettingsManager.create(process.cwd(), agentDir)
  const resourceLoader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir,
    settingsManager,
    systemPromptOverride: () => {
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
    noContextFiles: true,
  })
  await resourceLoader.reload()

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

  const sandboxedBash = createSandboxedBashTool(process.cwd(), sessionManager)

  const { session } = await piCreateAgentSession({
    cwd: process.cwd(),
    agentDir,
    authStorage,
    modelRegistry,
    model,
    resourceLoader,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionManager: sessionManager as any as SessionManager,
    customTools: [
      analyzeAssetMediaTool,
      createReadSkillTool(sessionManager),
      sandboxedBash,
      ...customTools,
    ],
  })

  return session
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
