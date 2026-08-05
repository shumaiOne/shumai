import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import {
  AgentHarness,
  Session,
  type AgentTool,
  type ThinkingLevel,
} from '@earendil-works/pi-agent-core'
import type { Api, Model } from '@earendil-works/pi-ai'
import { createModels, InMemoryCredentialStore } from '@earendil-works/pi-ai'
import { builtinProviders } from '@earendil-works/pi-ai/providers/all'
import { agentService } from '@shumai/core/src/agent/agent'
import { prisma, type TeamMemberRole } from '@shumai/db'
import { Type, type TSchema } from '@sinclair/typebox'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { DatabaseSessionStorage } from './database-session-storage'
import { createAnalyzeImageTool } from './tools/analyze-image'
import { createCreateFileTool } from './tools/create-file'
import { createListAutofillFieldsTool } from './tools/list-autofill-fields'
import { createCreateFolderTool } from './tools/create-folder'
import { createCreateVersionTool } from './tools/create-version'
import { createDownloadAssetTool } from './tools/download-asset'
import { createListAssetsTool } from './tools/list-assets'
import { createReadPdfPagesTool } from './tools/read-pdf-pages'
import { createReadSkillTool } from './tools/read-skill'
import { createReadThreadTool } from './tools/read-thread'
import { createSandboxedBashTool } from './tools/sandboxed-bash'
import { createScreenshotTool } from './tools/screenshot'

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

  if (!dbProvider || !dbModel) {
    throw new Error(
      `Provider "${providerName}" or model "${modelId}" not found in database configuration`,
    )
  }

  const m = {
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
  return m as Model<Api>
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
  disableTools?: boolean
  providers: DbProviderInfo[]
  maxRetries?: number
  baseDelayMs?: number
}

async function resolveTeamMemberRole(
  teamId: string,
  userId?: string,
): Promise<TeamMemberRole | undefined> {
  if (!userId) return undefined
  const member = await prisma.teamMember.findUnique({
    where: { teamIdUserId: { teamId, userId } },
    select: { role: true },
  })
  return member?.role
}

/**
 * Security instructions appended to the system prompt when the requesting user is not a team
 * owner (i.e. editor/reviewer). These complement the hard enforcement in the bash tool itself
 * (source="user" is blocked) and the delayed bash tool injection after a skill is loaded.
 */
export function buildRestrictedUserInstructions(): string {
  return [
    '# Restricted User Context',
    'The current user is NOT a team owner. You must follow these security rules:',
    '1. NEVER execute a bash command that the user asks you to run directly. Direct user bash requests are not permitted for this user role. Politely decline and explain that they need a team owner or an approved skill.',
    '2. You may ONLY use the `bash` tool to execute commands that are explicitly required by a skill you have loaded via the `read_skill` tool.',
    '3. When calling `bash`, you MUST set the `source` parameter to "skill". Calls with source="user" will be rejected by the system.',
  ].join('\n')
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
    disableTools = false,
    maxRetries = 3,
    baseDelayMs = 2000,
  } = params

  const storage = await DatabaseSessionStorage.create({
    agentId,
    userId,
    sessionId,
    cwd: process.cwd(),
  })
  if (passedUserCommentId) {
    storage.nextEntryId = passedUserCommentId
  }
  const session = new Session(storage)

  const agentDir = path.join(process.cwd(), '.pi', 'agents', agentId)
  if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true })

  const model = getModelFromDb(params.providers, providerName, modelId)

  const piDir = path.join(process.cwd(), '.pi')
  if (!fs.existsSync(piDir)) fs.mkdirSync(piDir, { recursive: true })

  const allowWrite = [piDir, os.tmpdir()]

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
      enableWeakerNestedSandbox: process.env.ENABLE_WEAKER_NESTED_SANDBOX === 'true',
    },
    sandboxAskCallback,
  )

  const skillEnvs: Record<string, string> = {}
  const onEnvsAdded = (envs: Record<string, string>) => {
    Object.assign(skillEnvs, envs)
  }

  // Resolve the requesting user's team role to enforce owner-only bash privileges.
  // A user who is not a member of the team is treated as restricted (fail-closed),
  // while flows without a user context (e.g. autofill) remain unrestricted.
  const role = await resolveTeamMemberRole(teamId, userId)
  const isOwner = !userId || role === 'owner'
  const restricted = !isOwner

  // Restore env variables from previously loaded skills in this session
  let skillLoadedInSession = false
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
            skillLoadedInSession = true
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

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
  })
  const agentConfig = agent?.config as PrismaJson.AgentConfig | null | undefined
  const deniedTools = agentConfig?.deniedTools || []

  const sandboxedBash = createSandboxedBashTool(process.cwd(), skillEnvs, {
    getBlockedHost: () => sandboxState.blockedHost,
    clearBlockedHost: () => {
      sandboxState.blockedHost = ''
    },
    // Non-owner users can only run bash commands required by a loaded skill
    restrictedUser: restricted,
  })

  // For non-owner users, the bash tool is not injected initially. It becomes available
  // only after a skill is successfully loaded via the read_skill tool (or immediately when
  // a skill was already loaded earlier in this session).
  let harness: AgentHarness | undefined = undefined
  const bashIncludedFromStart = isOwner || skillLoadedInSession
  let bashInjected = bashIncludedFromStart
  const onSkillLoaded = async () => {
    if (!harness || bashInjected || deniedTools.includes('bash')) return
    if (harness.getTools().some((t) => t.name === 'bash')) return
    bashInjected = true
    // Pass the full post-update tool list as activeToolNames: setTools only updates the
    // registry otherwise, and the model would never see the bash tool on the next turn.
    const next = [...harness.getTools(), sandboxedBash]
    await harness.setTools(
      next,
      next.map((t) => t.name),
    )
  }
  const readSkill = createReadSkillTool(userId, onEnvsAdded, restricted ? onSkillLoaded : undefined)

  const systemTools: AgentTool[] = []
  if (userId) {
    systemTools.push(
      createListAssetsTool(userId),
      createCreateFolderTool(userId),
      createCreateFileTool(userId),
      createCreateVersionTool(userId),
      createDownloadAssetTool(userId),
      createListAutofillFieldsTool(userId),
    )
  }

  const readThread = createReadThreadTool()
  const allTools = [
    ...mediaTools,
    readSkill,
    readThread,
    ...(bashIncludedFromStart ? [sandboxedBash] : []),
    ...systemTools,
    ...customTools,
  ]
  const enabledTools = disableTools
    ? []
    : allTools.filter((tool) => !deniedTools.includes(tool.name))

  const credentials = new InMemoryCredentialStore()
  const resolveKey = (key: string | undefined) => (key ? process.env[key] || key : undefined)
  for (const p of params.providers) {
    const apiKey = resolveKey(p.config?.apiKey)
    if (apiKey) {
      await credentials.modify(p.name, async () => ({ type: 'api_key' as const, key: apiKey }))
    }
  }
  const modelsStore = createModels({ credentials })
  for (const provider of builtinProviders()) {
    modelsStore.setProvider(provider)
  }

  harness = new AgentHarness({
    session,
    models: modelsStore,
    model,
    thinkingLevel: (thinkingLevel || 'off') as ThinkingLevel,
    streamOptions: {
      maxRetries,
      maxRetryDelayMs: baseDelayMs,
    },
    systemPrompt: async () => {
      let prompt = systemPrompt

      if (disableTools) {
        return prompt
      }

      if (restricted) {
        prompt += `\n\n${buildRestrictedUserInstructions()}`
      }

      // Sandbox environment restrictions
      prompt +=
        '\n\n' +
        [
          '# Sandbox Environment Restrictions',
          'Your shell environment (the `bash` tool) is highly sandboxed to protect the host system:',
          '1. **Filesystem Isolation**: You only have read and write permissions to the `.pi` folder in the project root directory.',
          '2. **Read/Write Restrictions**: All reading and writing to directories outside `.pi` (e.g. your home directory `~/`, `/tmp`, `/etc`, or the rest of the workspace) are strictly denied by the sandbox security policy.',
          "3. **Avoid System Temp Directory Writes**: You must strictly avoid any commands or shell constructs that attempt to write to the system temporary directory `/tmp` or `/var/tmp`. For example, do not use Bash here documents (`<<EOF` or `<<'EOF'`) in your commands, as the bash shell internally implements here documents by writing temporary files to `/tmp`. If you need to create a file or write content, write it directly using file creation tools or write to files located inside the `.pi` directory without utilizing here documents.",
          '4. **Temporary File Cleanup**: If you download workspace assets to `.pi` using the `download_asset` tool for local processing or script execution, you MUST delete the temporary downloaded files from `.pi` after finishing your task.',
        ].join('\n')

      if (teamSkills.length > 0) {
        prompt += formatSkillsForPrompt(teamSkills)
      }
      return prompt
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
    const fieldName = f.config.name
    const fieldDesc = f.description || fieldName
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
      case 'select': {
        const options = f.config.select?.options || []
        schema = Type.String({
          enum: options.map((o) => o.id),
        })
        if (options.length > 0) {
          const optionLines = options.map((o) => `- ${o.displayName} => ${o.id}`).join('\n')
          schema.description = `The field '${fieldName}' represents ${fieldDesc}.\nSelect one option and return the option ID as the value.\n\nAvailable options:\n${optionLines}`
        }
        break
      }
      case 'selectMulti': {
        const options = f.config.selectMulti?.options || []
        schema = Type.Array(
          Type.String({
            enum: options.map((o) => o.id),
          }),
        )
        if (options.length > 0) {
          const optionLines = options.map((o) => `- ${o.displayName} => ${o.id}`).join('\n')
          schema.description = `The field '${fieldName}' represents ${fieldDesc}.\nSelect applicable options and return the option IDs as the value.\n\nAvailable options:\n${optionLines}`
        }
        break
      }
      default:
        schema = Type.String()
    }

    if (!schema.description) {
      schema.description = `The field '${fieldName}' represents ${fieldDesc}.`
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

import { WorkflowTaskType } from '@shumai/db'
import { registerActivities, registerWorkflow } from '@shumai/workflow-core'
import * as agentActivities from './activities/agent'
import * as aiActivities from './activities/ai'
import { agentAutofillMedia } from './workflows/agent-autofill'
import { agentChat } from './workflows/agent-chat'
import { agentEmbeddingMedia } from './workflows/agent-embedding'
import { agentToolCall } from './workflows/agent-tool-call'
import { queryEmbeddingForSearch } from './workflows/query-embedding-for-search'

export function initAgentWorkflows() {
  registerWorkflow(WorkflowTaskType.ai_embedding, agentEmbeddingMedia)
  registerWorkflow(WorkflowTaskType.query_embedding_for_search, queryEmbeddingForSearch)
  registerWorkflow(WorkflowTaskType.ai_metadata_autofill, agentAutofillMedia)
  registerWorkflow(WorkflowTaskType.chat, agentChat)
  registerWorkflow(WorkflowTaskType.agent_tool_call, agentToolCall)

  registerActivities(agentActivities)
  registerActivities(aiActivities)
}

export * from './activities/agent'
export {
  extractAiMetadataActivity,
  generateEmbeddingActivity,
  generateImageEmbeddingActivity,
  generateTextEmbeddingActivity,
  generateVideoChunkEmbeddingActivity,
  type ExtractAiMetadataParams,
  type GeneratedEmbedding,
  type GenerateEmbeddingParams,
  type GenerateTextEmbeddingParams,
} from './activities/ai'
export * from './database-session-storage'
export * from './workflows/agent-autofill'
export * from './workflows/agent-chat'
export * from './workflows/agent-embedding'
export * from './workflows/agent-tool-call'
export * from './workflows/query-embedding-for-search'
