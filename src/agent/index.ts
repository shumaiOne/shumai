import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { AgentHarness, Session, type AgentTool } from '@earendil-works/pi-agent-core'
import { NodeExecutionEnv } from '@earendil-works/pi-agent-core/node'
import { getModel } from '@earendil-works/pi-ai'
import { Type, type TSchema } from '@sinclair/typebox'
import * as fs from 'fs'
import * as path from 'path'
import { agentService } from '@/services/agent/agent'
import { DatabaseSessionStorage } from './database-session-storage'
import { analyzeAssetMediaTool } from './tools/analyze-asset-media'
import { createCreateFileTool } from './tools/create-file'
import { createCreateFolderTool } from './tools/create-folder'
import { createCreateVersionTool } from './tools/create-version'
import { createListAssetsTool } from './tools/list-assets'
import { createReadSkillTool } from './tools/read-skill'
import { createSandboxedBashTool } from './tools/sandboxed-bash'

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

  const allowWrite = [piDir]

  // SandboxManager.initialize is a global operation that applies to the entire process.
  await SandboxManager.initialize({
    network: {
      allowedDomains,
      deniedDomains: [],
    },
    filesystem: {
      denyRead: ['.env', '.env.*', '*.pem', '*.key'],
      allowWrite,
      denyWrite: ['.env', '.env.*', '*.pem', '*.key'],
    },
  })

  const skillEnvs: Record<string, string> = {}
  const onEnvsAdded = (envs: Record<string, string>) => {
    Object.assign(skillEnvs, envs)
  }

  // Restore env variables from previously loaded skills in this session
  if (sessionId) {
    try {
      const entries = await storage.getEntries()
      for (const entry of entries) {
        if (
          entry.type === 'message' &&
          entry.message.role === 'toolResult' &&
          entry.message.toolName === 'read_skill' &&
          !entry.message.isError
        ) {
          const details = entry.message.details as { skillId?: string } | undefined
          if (details?.skillId) {
            const envs = await agentService.getSkillEnvs(details.skillId)
            onEnvsAdded(envs)
          }
        }
      }
    } catch (err) {
      console.error('Failed to restore skill environment variables:', err)
    }
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

      // Sandbox environment restrictions
      prompt +=
        '\n\n' +
        [
          '# Sandbox Environment Restrictions',
          'Your shell environment (the `bash` tool) is highly sandboxed to protect the host system:',
          '1. **Filesystem Isolation**: You only have read and write permissions to the `.pi` folder in the project root directory.',
          '2. **Read/Write Restrictions**: All reading and writing to directories outside `.pi` (e.g. your home directory `~/`, `/tmp`, `/etc`, or the rest of the workspace) are strictly denied by the sandbox security policy.',
          "3. **Avoid System Temp Directory Writes**: You must strictly avoid any commands or shell constructs that attempt to write to the system temporary directory `/tmp` or `/var/tmp`. For example, do not use Bash here documents (`<<EOF` or `<<'EOF'`) in your commands, as the bash shell internally implements here documents by writing temporary files to `/tmp`. If you need to create a file or write content, write it directly using file creation tools or write to files located inside the `.pi` directory without utilizing here documents.",
        ].join('\n')

      if (teamSkills.length > 0) {
        prompt += formatSkillsForPrompt(teamSkills)
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function formatSkillsForPrompt(
  skills: Array<{ id: string; name: string; description?: string | null }>,
): string {
  if (skills.length === 0) {
    return ''
  }

  const lines = [
    '\n\nThe following skills provide specialized instructions for specific tasks.',
    "Use the read_skill tool to load a skill's file when the task matches its description.",
    'When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.',
    '',
    '<available_skills>',
  ]

  for (const skill of skills) {
    const filePath = path.join(process.cwd(), '.pi', 'skills', skill.id, 'SKILL.md')
    lines.push('  <skill>')
    lines.push(`    <name>${escapeXml(skill.name)}</name>`)
    lines.push(`    <description>${escapeXml(skill.description || 'No description')}</description>`)
    lines.push(`    <location>${escapeXml(filePath)}</location>`)
    lines.push('  </skill>')
  }

  lines.push('</available_skills>')

  return lines.join('\n')
}
