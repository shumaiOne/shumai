import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import {
  AgentHarness,
  Session,
  type AgentTool,
  type ThinkingLevel,
} from '@earendil-works/pi-agent-core'
import { NodeExecutionEnv } from '@earendil-works/pi-agent-core/node'
import { getModel } from '@earendil-works/pi-ai/compat'
import { Type, type TSchema } from '@sinclair/typebox'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '@shumai/db'
import { agentService } from '@shumai/core/src/agent/agent'
import { DatabaseSessionStorage } from './database-session-storage'
import { createAnalyzeImageTool } from './tools/analyze-image'
import { createScreenshotTool } from './tools/screenshot'
import { createReadPdfPagesTool } from './tools/read-pdf-pages'
import { createCreateFileTool } from './tools/create-file'
import { createCreateFolderTool } from './tools/create-folder'
import { createCreateVersionTool } from './tools/create-version'
import { createListAssetsTool } from './tools/list-assets'
import { createReadSkillTool } from './tools/read-skill'
import { createSandboxedBashTool } from './tools/sandboxed-bash'

export interface DbModelInfo {
  modelId: string
  name: string | null
  config: PrismaJson.ModelConfig
}

export interface DbProviderInfo {
  name: string
  config: PrismaJson.ProviderConfig
  models: DbModelInfo[]
}

export function getModelFromDb(providers: DbProviderInfo[], providerName: string, modelId: string) {
  const dbProvider = providers.find((p) => p.name === providerName)
  const dbModel = dbProvider?.models.find((m) => m.modelId === modelId)

  if (!dbProvider || !dbModel) return undefined

  // Model contains complex internal types from pi-ai
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let m: any
  try {
    // Try to get built-in model as template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builtIn = (getModel as any)(providerName, modelId)
    if (!builtIn) {
      throw new Error(`Model ${modelId} is not a built-in model`)
    }
    m = { ...builtIn }
  } catch {
    // Not a built-in model
    m = {
      id: modelId,
      name: dbModel.name || modelId,
      provider: providerName,
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

export function getApiKeyAndHeadersFromDb(providers: DbProviderInfo[], providerName: string) {
  // Helper to resolve key from ENV if it matches an ENV var name
  const resolveKey = (key: string | undefined) => (key ? process.env[key] || key : undefined)

  // Look up the provider in our providers list
  const dbProvider = providers.find((p) => p.name === providerName)
  const providerApiKey = dbProvider?.config?.apiKey
  if (providerApiKey) {
    return { apiKey: resolveKey(providerApiKey)! }
  }

  return undefined
}

export interface CreateAgentSessionParams {
  teamId: string
  agentId: string
  providerName: string
  modelId: string
  systemPrompt: string
  teamSkills: Array<{ id: string; name: string; description?: string | null }>
  allowedDomains: string[]
  sessionId?: string
  userId?: string
  userCommentId?: string | null
  customTools?: AgentTool[]
  thinkingLevel?: string
  providers: DbProviderInfo[]
}

export async function createAgentSession(params: CreateAgentSessionParams) {
  const {
    teamId,
    agentId,
    providerName,
    modelId,
    systemPrompt,
    teamSkills,
    allowedDomains,
    sessionId,
    userId,
    userCommentId: passedUserCommentId,
    customTools = [],
    thinkingLevel,
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

  const model =
    getModelFromDb(params.providers, providerName, modelId) ||
    (getModel as unknown as (p: string, m: string) => unknown)(providerName, modelId)

  const piDir = path.join(process.cwd(), '.pi')
  if (!fs.existsSync(piDir)) fs.mkdirSync(piDir, { recursive: true })

  const allowWrite = [piDir]

  const sandboxState = {
    blockedHost: '',
  }

  const sandboxAskCallback = async ({ host }: { host: string; port?: number }) => {
    try {
      const sandbox = await prisma.sandbox.findUnique({
        where: { teamId },
      })
      const pendingDomains = sandbox?.pendingDomains || []
      if (!pendingDomains.includes(host)) {
        await prisma.sandbox.upsert({
          where: { teamId },
          create: {
            teamId,
            pendingDomains: [host],
          },
          update: {
            pendingDomains: {
              push: host,
            },
          },
        })
      }
    } catch (err) {
      console.error('Failed to update sandbox pending domains:', err)
    }

    sandboxState.blockedHost = host

    return false
  }

  // SandboxManager.initialize is a global operation that applies to the entire process.
  // We reset it first to ensure any previous process-global SOCKS/HTTP proxy servers
  // and callbacks are cleaned up, allowing the new callback and allowedDomains to take effect.
  await SandboxManager.reset()
  await SandboxManager.initialize(
    {
      network: {
        allowedDomains,
        deniedDomains: [],
      },
      filesystem: {
        denyRead: ['.env', '.env.*', '*.pem', '*.key'],
        allowWrite,
        denyWrite: ['.env', '.env.*', '*.pem', '*.key'],
      },
    },
    sandboxAskCallback,
  )

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

  const metadata = await storage.getMetadata()
  const userCommentId =
    passedUserCommentId !== undefined ? passedUserCommentId : metadata.userCommentId

  const mediaTools: AgentTool[] = []
  if (userId) {
    mediaTools.push(
      createAnalyzeImageTool(userId, userCommentId),
      createScreenshotTool(userId, userCommentId),
      createReadPdfPagesTool(userId, userCommentId),
    )
  }

  const sandboxedBash = createSandboxedBashTool(process.cwd(), skillEnvs, {
    getBlockedHost: () => sandboxState.blockedHost,
    clearBlockedHost: () => {
      sandboxState.blockedHost = ''
    },
  })
  const readSkill = createReadSkillTool(userId, onEnvsAdded)

  const systemTools: AgentTool[] = []
  if (userId) {
    systemTools.push(
      createListAssetsTool(userId),
      createCreateFolderTool(userId),
      createCreateFileTool(userId),
      createCreateVersionTool(userId),
    )
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
  })
  const agentConfig = agent?.config as PrismaJson.AgentConfig | null | undefined
  const deniedTools = agentConfig?.deniedTools || []

  const allTools = [...mediaTools, readSkill, sandboxedBash, ...systemTools, ...customTools]
  const enabledTools = allTools.filter((tool) => !deniedTools.includes(tool.name))

  const harness = new AgentHarness({
    env: new NodeExecutionEnv({ cwd: process.cwd() }),
    session,
    model,
    thinkingLevel: (thinkingLevel || 'off') as ThinkingLevel,
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
      return getApiKeyAndHeadersFromDb(params.providers, targetModel.provider)
    },
    tools: enabledTools,
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
    lines.push(`    <id>${escapeXml(skill.id)}</id>`)
    lines.push(`    <name>${escapeXml(skill.name)}</name>`)
    lines.push(`    <description>${escapeXml(skill.description || 'No description')}</description>`)
    lines.push(`    <location>${escapeXml(filePath)}</location>`)
    lines.push('  </skill>')
  }

  lines.push('</available_skills>')

  return lines.join('\n')
}

import { registerWorkflow, registerActivities } from '@shumai/workflow-core'
import { WorkflowTaskType } from '@shumai/db'
import { agentEmbeddingMedia } from './workflows/agent-embedding'
import { queryEmbeddingForSearch } from './workflows/query-embedding-for-search'
import { agentAutofillMedia } from './workflows/agent-autofill'
import { agentChat } from './workflows/agent-chat'
import { agentToolCall } from './workflows/agent-tool-call'
import * as agentActivities from './activities/agent'
import * as aiActivities from './activities/ai'

export function initAgentWorkflows() {
  registerWorkflow(WorkflowTaskType.ai_embedding, agentEmbeddingMedia)
  registerWorkflow(WorkflowTaskType.query_embedding_for_search, queryEmbeddingForSearch)
  registerWorkflow(WorkflowTaskType.ai_metadata_autofill, agentAutofillMedia)
  registerWorkflow(WorkflowTaskType.chat, agentChat)
  registerWorkflow(WorkflowTaskType.agent_tool_call, agentToolCall)

  registerActivities(agentActivities)
  registerActivities(aiActivities)
}

export * from './database-session-storage'
export * from './activities/agent'
export {
  type GeneratedEmbedding,
  type GenerateEmbeddingParams,
  generateEmbeddingActivity,
  type GenerateTextEmbeddingParams,
  generateTextEmbeddingActivity,
  type ExtractAiMetadataParams,
  extractAiMetadataActivity,
  generateImageEmbeddingActivity,
  generateVideoChunkEmbeddingActivity,
} from './activities/ai'
export * from './workflows/agent-autofill'
export * from './workflows/agent-chat'
export * from './workflows/agent-embedding'
export * from './workflows/agent-tool-call'
export * from './workflows/query-embedding-for-search'
