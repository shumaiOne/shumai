import { BACKGROUND_CONTEXT as piContext } from '@earendil-works/chord/context'
import type { Model, ModelThinkingLevel } from '@earendil-works/pi-ai'
import {
  createModels,
  createProvider,
  envApiKeyAuth,
  InMemoryCredentialStore,
  type ProviderStreams,
} from '@earendil-works/pi-ai'
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy'
import { azureOpenAIResponsesApi } from '@earendil-works/pi-ai/api/azure-openai-responses.lazy'
import { bedrockConverseStreamApi } from '@earendil-works/pi-ai/api/bedrock-converse-stream.lazy'
import { googleGenerativeAIApi } from '@earendil-works/pi-ai/api/google-generative-ai.lazy'
import { googleVertexApi } from '@earendil-works/pi-ai/api/google-vertex.lazy'
import { mistralConversationsApi } from '@earendil-works/pi-ai/api/mistral-conversations.lazy'
import { openAICodexResponsesApi } from '@earendil-works/pi-ai/api/openai-codex-responses.lazy'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy'
import { builtinProviders } from '@earendil-works/pi-ai/providers/all'
import {
  createRegistry,
  defineExtension,
  GenerationTask,
  Harness,
  hook,
  type ToolRegistration as AgentTool,
} from '@earendil-works/pi-durable'
import { agentService } from '@shumai/core/src/agent/agent'
import { hydrateRequest } from '@shumai/core/src/agent/session-content'
import { agentSessionService } from '@shumai/core/src/agent/session-service'
import { resolveEffectiveRole } from '@shumai/core/src/authz/authz'
import { logger } from '@shumai/core/src/logger'
import { mediaGenerationService } from '@shumai/core/src/media-generation/media-generation'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { QuotaExceededError, quotaService } from '@shumai/core/src/quota/quota-service'
import { runnerService } from '@shumai/core/src/runner'
import { prisma } from '@shumai/db'
import { DEFAULT_DENIED_TOOLS } from '@shumai/dtos'
import * as path from 'path'
import { Type, type TSchema } from 'typebox'
import { createAutofillReadAssetTool } from './operation-extensions'
import { buildOperationTools } from './operation-tools'
import { createGenerateImageTool } from './tools/generate-image'
import { createGenerateVideoTool } from './tools/generate-video'
import { createReadSkillTool } from './tools/read-skill'
import { createReadThreadTool } from './tools/read-thread'
import { createSandboxedBashTool, type LoadedSkillRef } from './tools/sandboxed-bash'

const activeHarnesses = new Set<Harness>()

export async function closeAgentSessions() {
  await Promise.allSettled([...activeHarnesses].map((harness) => harness.close(piContext)))
  await agentSessionService.closeAll()
}

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

type ConfiguredApi = PrismaJson.ProviderConfig['api']

const apiAdapters = {
  'anthropic-messages': anthropicMessagesApi,
  'azure-openai-responses': azureOpenAIResponsesApi,
  'bedrock-converse-stream': bedrockConverseStreamApi,
  'google-generative-ai': googleGenerativeAIApi,
  'google-vertex': googleVertexApi,
  'mistral-conversations': mistralConversationsApi,
  'openai-codex-responses': openAICodexResponsesApi,
  'openai-completions': openAICompletionsApi,
  'openai-responses': openAIResponsesApi,
} satisfies Record<ConfiguredApi, () => ProviderStreams>

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
  Object.assign(m, dbModel.config)
  if (dbProvider.config.api) {
    m.api = dbProvider.config.api
  }
  if (dbModel.name) {
    m.name = dbModel.name
  }
  return m as Model<ConfiguredApi>
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
  enabledSkillIds?: string[]
  allowedDomains?: string[]
  sessionId?: string
  userId?: string
  projectId?: string
  assetId?: string
  userCommentId?: string | null
  customTools?: AgentTool[]
  thinkingLevel?: string
  disableTools?: boolean
  providers: DbProviderInfo[]
  maxRetries?: number
  baseDelayMs?: number
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
    enabledSkillIds,
    sessionId,
    userId,
    projectId,
    assetId,
    userCommentId: passedUserCommentId,
    customTools = [],
    thinkingLevel,
    disableTools = false,
    maxRetries = 3,
    baseDelayMs = 2000,
  } = params

  const record = sessionId
    ? await prisma.agentSession.findUniqueOrThrow({ where: { id: sessionId } })
    : await prisma.agentSession.create({
        data: { agentId, userId, cwd: process.cwd(), assetId, userCommentId: passedUserCommentId },
      })
  const opened = await agentSessionService.openWriter(record.id, piContext, {
    teamId,
    userId,
    role: userId ? await resolveEffectiveRole(teamId, projectId, userId) : undefined,
  })
  const storage = opened.storage
  try {
    getModelFromDb(params.providers, providerName, modelId)

    const role = userId ? await resolveEffectiveRole(teamId, projectId, userId) : undefined
    const isOwner = !userId || role === 'owner'
    const restricted = !isOwner

    const wrapToolWithQuota = (tool: AgentTool): AgentTool => {
      const originalExecute = tool.execute
      return {
        ...tool,
        execute: async (args, api, context) => {
          try {
            await quotaService.checkQuota(
              {
                teamId,
                userId,
                role,
                resource: 'agent_tool_call_count',
                resourceData: { name: tool.name, toolName: tool.name },
              },
              1,
            )
          } catch (err) {
            if (err instanceof QuotaExceededError) {
              return {
                output: [{ type: 'text', text: `Quota exceeded: ${err.message}` }],
                details: { error: err.message },
              }
            }
            throw err
          }

          const result = await originalExecute(args, api, context)

          try {
            await quotaService.consumeQuota(
              {
                teamId,
                userId,
                role,
                resource: 'agent_tool_call_count',
                resourceData: { name: tool.name, toolName: tool.name },
              },
              1,
            )
          } catch (err) {
            logger.error({ err }, 'Failed to record quota usage for agent tool call')
          }

          return result
        },
      }
    }

    const skillEnvs: Record<string, string> = {}
    const onEnvsAdded = (envs: Record<string, string>) => {
      Object.assign(skillEnvs, envs)
    }

    const loadedSkills = new Map<string, LoadedSkillRef>()

    // Restore env variables and loaded skill refs from previously loaded skills in this session
    let skillLoadedInSession = false
    if (sessionId) {
      try {
        const entries = await agentSessionService.getEntries(record.id)
        for (const entry of entries) {
          for (const message of entry.model ?? []) {
            if (
              message.role === 'toolResult' &&
              message.toolName === 'read_skill' &&
              !message.isError
            ) {
              const details = message.details
              if (
                details &&
                typeof details === 'object' &&
                !Array.isArray(details) &&
                'skillId' in details &&
                typeof details.skillId === 'string'
              ) {
                skillLoadedInSession = true
                onEnvsAdded(await agentService.getSkillEnvs(details.skillId))
                const dbSkill = await prisma.skill.findUnique({
                  where: { id: details.skillId },
                  select: { id: true, assetId: true, hash: true },
                })
                if (dbSkill) {
                  loadedSkills.set(dbSkill.id, dbSkill)
                }
              }
            }
          }
        }
      } catch (err) {
        logger.error({ err, sessionId }, 'Failed to restore skill environment variables')
      }
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    })
    const agentConfig = agent?.config as PrismaJson.AgentConfig | null | undefined
    const deniedTools = agentConfig?.deniedTools ?? [...DEFAULT_DENIED_TOOLS]

    const resolvedRunner = await runnerService.resolveRunnerForAgent(teamId, agent?.runnerId)
    const hasRunner = resolvedRunner.hasConfiguredRunner

    const mediaTools: AgentTool[] = []
    // Agents acting for a user get read_asset / get_asset_render from the Operation registry
    // (see systemTools below); the autofill system agent has its own team-scoped read_asset.
    if (!userId && agent?.type === 'autofill' && assetId) {
      mediaTools.push(
        createAutofillReadAssetTool({
          teamId,
          targetAssetId: assetId,
        }),
      )
    }

    if (!deniedTools.includes('generate_image') || !deniedTools.includes('generate_video')) {
      try {
        const { imageModels, videoModels, providerKeys } =
          await mediaGenerationService.getValidModels(teamId)
        if (imageModels.length > 0 && !deniedTools.includes('generate_image')) {
          mediaTools.push(createGenerateImageTool(imageModels, providerKeys, userId))
        }
        if (videoModels.length > 0 && !deniedTools.includes('generate_video')) {
          mediaTools.push(createGenerateVideoTool(videoModels, providerKeys, userId))
        }
      } catch (err) {
        logger.error({ err, teamId }, 'Failed to initialize media generation tools')
      }
    }

    const sandboxedBash = createSandboxedBashTool(process.cwd(), skillEnvs, {
      teamId,
      agentRunnerId: agent?.runnerId,
      userId,
      role,
      // Non-owner users can only run bash commands required by a loaded skill
      restrictedUser: restricted,
      getLoadedSkills: () => loadedSkills.values(),
    })

    // When a team has no Runner configured in DB, bash and download_asset are omitted.
    // For non-owner users, the bash tool is not injected initially. It becomes available
    // only after a skill is successfully loaded via the read_skill tool (or immediately when
    // a skill was already loaded earlier in this session).
    const registry = createRegistry()
    const bashIncludedFromStart = hasRunner && (isOwner || skillLoadedInSession)
    let bashInjected = bashIncludedFromStart
    const onSkillLoaded = async (skill: LoadedSkillRef) => {
      loadedSkills.set(skill.id, skill)
      if (resolvedRunner.runner && runnerService.isRunnerConnected(resolvedRunner.runner.id)) {
        await runnerService.ensureSkillOnRunner(resolvedRunner.runner.id, skill).catch((err) => {
          logger.warn(
            { err, skillId: skill.id, runnerId: resolvedRunner.runner?.id },
            'Failed to eagerly stage skill on runner',
          )
        })
      }
      if (!restricted || !hasRunner || bashInjected || deniedTools.includes('bash')) return
      bashInjected = true
      registry.install(
        defineExtension({ name: 'shumai.bash', tools: [wrapToolWithQuota(sandboxedBash)] }),
      )
      await session?.configure(
        {
          tools: [...enabledTools, wrapToolWithQuota(sandboxedBash)],
          modelTools: { add: [sandboxedBash] },
        },
        piContext,
      )
    }
    const readSkill = createReadSkillTool(
      userId,
      onEnvsAdded,
      onSkillLoaded,
      enabledSkillIds,
      projectId,
    )

    const systemTools: AgentTool[] = []
    if (userId) {
      const creationMetadataSchema = await buildProjectMetadataSchema(projectId)
      systemTools.push(
        // Shared Operations (also exposed via MCP and the CLI): browsing, searching, organizing,
        // reading and downloading assets, creating files and versions, comments and metadata
        ...buildOperationTools(
          { userId, agentId, teamId, projectId, runnerId: agent?.runnerId },
          {
            creationMetadataSchema,
            excludeOperations: hasRunner ? [] : ['download_asset'],
          },
        ),
      )
    }

    const readThread = createReadThreadTool({ userId, teamId })
    const rawTools = [
      ...mediaTools,
      readSkill,
      readThread,
      ...(bashIncludedFromStart ? [sandboxedBash] : []),
      ...systemTools,
      ...customTools,
    ]
    const allTools = rawTools.map((tool) => wrapToolWithQuota(tool))
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

    const configuredModel = getModelFromDb(params.providers, providerName, modelId)
    const builtin = modelsStore.getProvider(providerName)
    if (builtin?.getModels().some((candidate) => candidate.api === configuredModel.api)) {
      modelsStore.setProvider({ ...builtin, getModels: () => [configuredModel] })
    } else {
      // Providers that share an API can still require different authentication and headers.
      modelsStore.setProvider(
        createProvider({
          id: providerName,
          models: [configuredModel],
          api: apiAdapters[configuredModel.api](),
          auth: { apiKey: envApiKeyAuth('API key', []) },
        }),
      )
    }
    registry.install(
      defineExtension({
        name: 'shumai',
        tools: enabledTools,
        hooks: [
          hook(GenerationTask, {
            beforeRequest: async ({ messages }, api, context) => ({
              messages: await hydrateRequest(messages, api, context),
            }),
          }),
        ],
      }),
    )
    const harness = await Harness.open(
      storage,
      {
        models: modelsStore,
        registry,
        settings: { retry: { enabled: true, maxRetries, baseDelayMs } },
        onReport: (report) =>
          logger.error({ kind: report.kind, err: report.error }, 'Agent runtime report'),
      },
      piContext,
    )
    const buildPrompt = async () => {
      let prompt = systemPrompt

      if (disableTools) {
        return prompt
      }

      if (restricted) {
        prompt += `\n\n${buildRestrictedUserInstructions()}`
      }

      if (hasRunner && !deniedTools.includes('bash')) {
        prompt +=
          '\n\n' +
          [
            '# Runner Environment & Workspace Rules',
            'Your shell environment (`bash` tool) runs on a dedicated Runner workspace:',
            '1. **Workspace Directory**: Read and write files inside the `.pi` folder in the current working directory.',
            '2. **Generated Media Staging**: Files generated by `generate_image` or `generate_video` are returned at virtual paths `.pi/generated/<id>/<filename>`. You can pass those paths directly to `create_file` or `create_version` without using `bash`. If you need to process a generated file inside `bash`, pass its path in the `inputFiles` array parameter of the `bash` tool so it is staged into the runner workspace before the command runs.',
            '3. **Temporary File Cleanup**: If you download workspace assets to `.pi` using the `download_asset` tool for local processing or script execution, you MUST delete the temporary downloaded files from `.pi` after finishing your task.',
          ].join('\n')
      }

      if (teamSkills.length > 0) {
        prompt += formatSkillsForPrompt(teamSkills)
      }
      return prompt
    }
    const session = await harness.root(piContext)
    await session.configure(
      {
        model: { provider: providerName, modelId },
        thinkingLevel: (thinkingLevel || 'off') as ModelThinkingLevel,
        instructions: await buildPrompt(),
        tools: enabledTools,
      },
      piContext,
    )
    const onLost = () => {
      void harness.close(piContext)
    }
    opened.signal.addEventListener('abort', onLost, { once: true })
    activeHarnesses.add(harness)
    harness.subscribeClose(() => {
      activeHarnesses.delete(harness)
      opened.signal.removeEventListener('abort', onLost)
    })
    return { session, harness, storage, sessionId: record.id }
  } catch (error) {
    await storage.close(piContext)
    throw error
  }
}

export interface AutofillField {
  id: string
  config: PrismaJson.FieldConfig
  description?: string | null
}

export function fieldsToTypeBoxSchema(fields: AutofillField[]) {
  const newOptionSchema = Type.Object(
    {
      newOption: Type.Object(
        {
          value: Type.String({
            minLength: 1,
            description:
              'The new option display name/value to create and select if none of the existing options match.',
          }),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  )

  const properties: Record<string, TSchema> = {}
  for (const f of fields) {
    let schema: TSchema
    const fieldName = f.config.name
    const fieldDesc = f.description || fieldName
    const baseDescription = `The field '${fieldName}' represents ${fieldDesc}.`
    switch (f.config.type) {
      case 'text':
      case 'longText':
        schema = Type.String({ description: baseDescription })
        break
      case 'number':
      case 'rating':
        schema = Type.Number({ description: baseDescription })
        break
      case 'toggle':
        schema = Type.Boolean({ description: baseDescription })
        break
      case 'select': {
        const options = f.config.select?.options || []
        const description =
          options.length > 0
            ? `${baseDescription}\nSelect one existing option ID or provide {"newOption": {"value": "..."}} to create a new option.\n\nAvailable options:\n${options.map((o) => `- ${o.displayName} => ${o.id}`).join('\n')}`
            : `${baseDescription}\nProvide {"newOption": {"value": "..."}} with the desired option name.`
        if (options.length > 0) {
          schema = Type.Union(
            [
              Type.String({
                enum: options.map((o) => o.id),
              }),
              newOptionSchema,
            ],
            { description },
          )
        } else {
          schema = Type.Object(newOptionSchema.properties, {
            additionalProperties: false,
            description,
          })
        }
        break
      }
      case 'selectMulti': {
        const options = f.config.selectMulti?.options || []
        const description =
          options.length > 0
            ? `${baseDescription}\nSelect applicable option IDs or provide {"newOption": {"value": "..."}} objects for new options (e.g. ["opt1", {"newOption": {"value": "new_name"}}]).\n\nAvailable options:\n${options.map((o) => `- ${o.displayName} => ${o.id}`).join('\n')}`
            : `${baseDescription}\nProvide an array of {"newOption": {"value": "..."}} objects for new options.`
        const itemSchema =
          options.length > 0
            ? Type.Union([
                Type.String({
                  enum: options.map((o) => o.id),
                }),
                newOptionSchema,
              ])
            : newOptionSchema
        schema = Type.Array(itemSchema, { description })
        break
      }
      default:
        schema = Type.String({ description: baseDescription })
    }
    // Every field is required but nullable: the agent must return each field key,
    // using `null` for values it does not know. Nulls are skipped when persisting.
    // This matches the OpenAI structured-outputs strict-mode convention (all
    // properties required, optionality expressed via `null`).
    properties[f.id] = Type.Union([schema, Type.Null()])
  }

  return Type.Object(properties, { additionalProperties: false })
}

/**
 * Builds the strict, all-optional metadata schema for the project's CREATION_CONTEXT
 * fields (the same field set the agent may attach when creating files/versions).
 * Returns undefined when no project is known or the project defines no fields, in
 * which case the `metadata` parameter is omitted from the tools entirely.
 */
async function buildProjectMetadataSchema(projectId?: string): Promise<TSchema | undefined> {
  if (!projectId) return undefined
  const fields = await metadataService.listProjectFields('', projectId)
  const creationFields: AutofillField[] = []
  for (const f of fields) {
    const config = f.field.config
    if (!config || config.autofillSource !== 'CREATION_CONTEXT') continue
    creationFields.push({
      id: f.field.key,
      config,
      description: f.field.description,
    })
  }
  if (creationFields.length === 0) return undefined
  return fieldsToTypeBoxSchema(creationFields)
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
    'When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that relative path in tool commands.',
    '',
    '<available_skills>',
  ]

  for (const skill of skills) {
    const filePath = path.posix.join('.pi', 'skills', skill.id, 'SKILL.md')
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
