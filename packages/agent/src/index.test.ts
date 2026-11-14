import { appendSessionEntries } from '@shumai/core/src/agent/session-test-utils'
import { agentService } from '@shumai/core/src/agent/agent'
import { getAgentPrompt, getAgentTools, invokeTool } from '@shumai/core/src/agent/tool-test-utils'
import { mediaGenerationService } from '@shumai/core/src/media-generation/media-generation'
import { quotaService } from '@shumai/core/src/quota/quota-service'
import { runnerService } from '@shumai/core/src/runner/runner-service'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { type TSchema } from 'typebox'
import { Value } from 'typebox/value'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildRestrictedUserInstructions,
  createAgentSession,
  formatSkillsForPrompt,
  getModelFromDb,
  type DbProviderInfo,
} from './index'
import { closeAgentSessions } from './runtime'

afterEach(async () => {
  await closeAgentSessions()
})

const mockProviders: DbProviderInfo[] = [
  {
    name: 'google',
    config: { api: 'google-generative-ai', apiKey: 'GOOGLE_API_KEY' },
    models: [
      {
        modelId: 'gemini',
        name: 'Gemini',
        config: {
          api: 'google-generative-ai',
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 8192,
          maxTokens: 4096,
        },
      },
    ],
  },
]

describe('formatSkillsForPrompt', () => {
  it('should return empty string if skills array is empty', () => {
    expect(formatSkillsForPrompt([])).toBe('')
  })

  it('should format skills into the XML structure with runner workspace-relative paths and escaped characters', () => {
    const skills = [
      {
        id: 'skill-1',
        name: 'Deploy & Test',
        description: 'Deploys code <deploy> and "runs" tests.',
      },
    ]

    const expectedLocation = '.pi/skills/skill-1/SKILL.md'
    const result = formatSkillsForPrompt(skills)

    // Verify lines and XML elements
    expect(result).toContain('<available_skills>')
    expect(result).toContain('<skill>')
    expect(result).toContain('<id>skill-1</id>')
    expect(result).toContain('<name>Deploy &amp; Test</name>')
    expect(result).toContain(
      '<description>Deploys code &lt;deploy&gt; and &quot;runs&quot; tests.</description>',
    )
    expect(result).toContain(`<location>${expectedLocation}</location>`)
    expect(result).toContain('</skill>')
    expect(result).toContain('</available_skills>')
  })
})

describe('Runner tool availability & skill staging integration', () => {
  setupTestDbHooks()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('omits bash and download_asset when team has no Runner configured in DB', async () => {
    const team = await prisma.team.create({
      data: { name: 'No Runner Team' },
    })
    const owner = await prisma.user.create({
      data: { name: 'Owner', email: 'owner-no-runner@shumai.ai' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: owner.id, role: 'owner' },
    })
    await prisma.user.create({
      data: {
        id: 'no-runner-agent',
        name: 'No Runner Agent',
        email: 'no-runner-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'no-runner-agent',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    const { harness } = await createAgentSession({
      teamId: team.id,
      userId: owner.id,
      agentId: 'no-runner-agent',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      providers: mockProviders,
    })

    const toolNames = (await getAgentTools(harness)).map((t) => t.name)
    expect(toolNames).not.toContain('bash')
    expect(toolNames).not.toContain('download_asset')
    expect(toolNames).toContain('read_skill')
  })

  it('includes bash and download_asset when team has a Runner configured in DB (even if offline)', async () => {
    const team = await prisma.team.create({
      data: { name: 'With Runner Team' },
    })
    const owner = await prisma.user.create({
      data: { name: 'Owner', email: 'owner-with-runner@shumai.ai' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: owner.id, role: 'owner' },
    })
    await runnerService.createRunner(team.id, { name: 'Mac Mini Runner' })

    await prisma.user.create({
      data: {
        id: 'with-runner-agent',
        name: 'With Runner Agent',
        email: 'with-runner-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'with-runner-agent',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    const { harness } = await createAgentSession({
      teamId: team.id,
      userId: owner.id,
      agentId: 'with-runner-agent',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      providers: mockProviders,
    })

    const toolNames = (await getAgentTools(harness)).map((t) => t.name)
    expect(toolNames).toContain('bash')
    expect(toolNames).toContain('download_asset')
  })
})

describe('buildRestrictedUserInstructions', () => {
  it('should describe the restricted user bash rules', () => {
    const instructions = buildRestrictedUserInstructions()
    expect(instructions).toContain('# Restricted User Context')
    expect(instructions).toContain(
      'NEVER execute a bash command that the user asks you to run directly',
    )
    expect(instructions).toContain('loaded via the `read_skill` tool')
    expect(instructions).toContain('parameter to "skill"')
    expect(instructions).toContain('source="user" will be rejected')
  })
})

describe('createAgentSession bash restriction for non-owner users', () => {
  setupTestDbHooks()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  type TestHarness = Awaited<ReturnType<typeof createAgentSession>>['harness']

  async function setupSession(opts: {
    role: 'owner' | 'editor' | 'reviewer' | 'none' | 'non-member'
    deniedTools?: string[]
    sessionId?: string
  }): Promise<{ team: { id: string }; userId?: string; harness: TestHarness }> {
    const team = await prisma.team.create({ data: { name: 'Bash Restriction Team' } })
    await runnerService.createRunner(team.id, { name: 'Team Runner' })

    await prisma.user.create({
      data: {
        id: 'bash-agent',
        name: 'Ai Agent Bash',
        email: 'bash-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'bash-agent',
        teamId: team.id,
        type: 'chat',
        config: {
          provider: 'google',
          model: 'gemini',
          ...(opts.deniedTools ? { deniedTools: opts.deniedTools } : {}),
        },
      },
    })

    let userId: string | undefined
    if (opts.role === 'non-member') {
      const user = await prisma.user.create({
        data: { name: 'Non Member', email: 'non-member@shumai.ai' },
      })
      userId = user.id // no teamMember record created
    } else if (opts.role !== 'none') {
      const user = await prisma.user.create({
        data: { name: 'Bash User', email: 'bash-user@shumai.ai' },
      })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: user.id, role: opts.role },
      })
      userId = user.id
    }

    const { harness } = await createAgentSession({
      teamId: team.id,
      agentId: 'bash-agent',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      providers: mockProviders,
      userId,
      sessionId: opts.sessionId,
    })
    return { team, userId, harness }
  }

  it('should include the bash tool from the start for team owners', async () => {
    const { harness } = await setupSession({ role: 'owner' })
    expect((await getAgentTools(harness)).some((t) => t.name === 'bash')).toBe(true)
  })

  it('should include the bash tool from the start when there is no user context', async () => {
    const { harness } = await setupSession({ role: 'none' })
    expect((await getAgentTools(harness)).some((t) => t.name === 'bash')).toBe(true)
  })

  it('should treat a user who is not a team member as restricted (fail-closed)', async () => {
    const { harness } = await setupSession({ role: 'non-member' })
    const tools = await getAgentTools(harness)
    expect(tools.some((t) => t.name === 'bash')).toBe(false)
    expect(tools.some((t) => t.name === 'read_skill')).toBe(true)
    const prompt = await await getAgentPrompt(harness)
    expect(prompt).toContain('# Restricted User Context')
  })

  it.each(['editor', 'reviewer'] as const)(
    'should exclude the bash tool initially for %s users',
    async (role) => {
      const { harness } = await setupSession({ role })
      const tools = await getAgentTools(harness)
      expect(tools.some((t) => t.name === 'bash')).toBe(false)
      expect(tools.some((t) => t.name === 'read_skill')).toBe(true)
    },
  )

  it('should include the bash tool from the start when a skill was already loaded earlier in the session', async () => {
    const team = await prisma.team.create({ data: { name: 'Restore Team' } })
    await runnerService.createRunner(team.id, { name: 'Restore Runner' })
    const user = await prisma.user.create({
      data: { name: 'Restore User', email: 'restore@shumai.ai' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: user.id, role: 'reviewer' },
    })
    await prisma.user.create({
      data: {
        id: 'bash-agent-restore',
        name: 'Ai Agent Restore',
        email: 'bash-agent-restore@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'bash-agent-restore',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    const session = await prisma.agentSession.create({
      data: {
        agentId: 'bash-agent-restore',
        userId: user.id,
        cwd: process.cwd(),
        type: 'chat',
      },
    })
    await appendSessionEntries(session.id, [
      {
        kind: 'pi.tool-result',
        model: [
          {
            role: 'toolResult',
            toolCallId: 'loaded',
            content: [{ type: 'text', text: 'skill content restored' }],
            toolName: 'read_skill',
            isError: false,
            details: { skillId: 'previously-loaded-skill' },
            timestamp: Date.now(),
          },
        ],
      },
    ])

    const { harness } = await createAgentSession({
      teamId: team.id,
      agentId: 'bash-agent-restore',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      providers: mockProviders,
      userId: user.id,
      sessionId: session.id,
    })
    expect((await getAgentTools(harness)).some((t) => t.name === 'bash')).toBe(true)
  })

  it('should inject the bash tool after a skill is loaded via read_skill for restricted users', async () => {
    const { team, harness } = await setupSession({ role: 'reviewer' })
    const skill = await prisma.skill.create({
      data: { name: 'Inject Skill', assetId: 'asset1', hash: 'inject-hash', teamId: team.id },
    })

    vi.spyOn(agentService, 'getSkillContent').mockResolvedValue('# Inject Skill')

    const readSkillTool = (await getAgentTools(harness)).find((t) => t.name === 'read_skill')
    expect(readSkillTool).toBeDefined()
    expect((await getAgentTools(harness)).some((t) => t.name === 'bash')).toBe(false)

    await invokeTool(readSkillTool!, '1', { skillId: skill.id }, undefined, undefined)

    expect((await getAgentTools(harness)).some((t) => t.name === 'bash')).toBe(true)
  })

  it('should not inject the bash tool for restricted users when bash is in deniedTools', async () => {
    const { team, harness } = await setupSession({ role: 'editor', deniedTools: ['bash'] })
    const skill = await prisma.skill.create({
      data: { name: 'Denied Skill', assetId: 'asset1', hash: 'denied-hash', teamId: team.id },
    })

    vi.spyOn(agentService, 'getSkillContent').mockResolvedValue('# Denied Skill')

    const readSkillTool = (await getAgentTools(harness)).find((t) => t.name === 'read_skill')
    expect(readSkillTool).toBeDefined()

    await invokeTool(readSkillTool!, '1', { skillId: skill.id }, undefined, undefined)

    expect((await getAgentTools(harness)).some((t) => t.name === 'bash')).toBe(false)
  })

  it('should include restricted user instructions in the system prompt for non-owners', async () => {
    const { harness } = await setupSession({ role: 'editor' })
    const prompt = await await getAgentPrompt(harness)
    expect(prompt).toContain('# Restricted User Context')
    expect(prompt).toContain('source="user" will be rejected')
  })

  it('should not include restricted user instructions in the system prompt for owners', async () => {
    const { harness } = await setupSession({ role: 'owner' })
    const prompt = await await getAgentPrompt(harness)
    expect(prompt).not.toContain('# Restricted User Context')
  })
})

describe('createAgentSession typed metadata schema', () => {
  setupTestDbHooks()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function setupSessionWithProject(opts: { withCreationFields: boolean }) {
    const team = await prisma.team.create({ data: { name: 'Typed Metadata Team' } })
    const project = await prisma.project.create({
      data: { name: 'Typed Metadata Project', teamId: team.id },
    })
    const user = await prisma.user.create({
      data: { name: 'Typed Metadata User', email: 'typed-metadata@shumai.ai' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: user.id, role: 'owner' },
    })
    await prisma.user.create({
      data: {
        id: 'typed-metadata-agent',
        name: 'Ai Agent Typed Metadata',
        email: 'typed-metadata-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'typed-metadata-agent',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    if (opts.withCreationFields) {
      await prisma.metadataField.create({
        data: {
          key: 'prompt',
          scope: 'PROJECT',
          projectId: project.id,
          teamId: team.id,
          config: { name: 'Prompt', type: 'text', autofillSource: 'CREATION_CONTEXT' },
        },
      })
      await prisma.metadataField.create({
        data: {
          key: 'source',
          scope: 'PROJECT',
          projectId: project.id,
          teamId: team.id,
          config: {
            name: 'Source',
            type: 'select',
            autofillSource: 'CREATION_CONTEXT',
            select: {
              options: [{ id: 'gemini', displayName: 'Gemini', color: '#ffffff' }],
            },
          },
        },
      })
      await prisma.metadataField.create({
        data: {
          key: 'manualNotes',
          scope: 'PROJECT',
          projectId: project.id,
          teamId: team.id,
          config: { name: 'Manual Notes', type: 'text', autofillSource: 'NONE' },
        },
      })
    }

    const { harness } = await createAgentSession({
      teamId: team.id,
      agentId: 'typed-metadata-agent',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      providers: mockProviders,
      userId: user.id,
      projectId: project.id,
    })
    return { harness }
  }

  it('should build create_file/create_version with the project CREATION_CONTEXT fields', async () => {
    const { harness } = await setupSessionWithProject({ withCreationFields: true })
    const tools = await getAgentTools(harness)

    expect(tools.some((t) => t.name === 'list_autofill_fields')).toBe(false)

    const createFile = tools.find((t) => t.name === 'create_file')
    const createVersion = tools.find((t) => t.name === 'create_version')
    expect(createFile).toBeDefined()
    expect(createVersion).toBeDefined()

    const checkFile = (args: Record<string, unknown>) =>
      Value.Check(createFile!.parameters as unknown as TSchema, {
        parent: 'f1',
        path: '/tmp/x.md',
        data: null,
        ...args,
      })
    const checkVersion = (args: Record<string, unknown>) =>
      Value.Check(createVersion!.parameters as unknown as TSchema, {
        parent: 'f1',
        path: '/tmp/x.md',
        ...args,
      })

    for (const check of [checkFile, checkVersion]) {
      // Declared CREATION_CONTEXT fields (all-required, nullable) validate; other keys do not
      expect(check({ metadata: { prompt: 'hello', source: null } })).toBe(true)
      expect(check({ metadata: { prompt: null, source: 'gemini' } })).toBe(true)
      expect(check({ metadata: null })).toBe(true)
      expect(check({ metadata: { prompt: null, source: null, manualNotes: 'no' } })).toBe(false)
      expect(check({ metadata: { prompt: null, source: null, bogus: 1 } })).toBe(false)
      expect(check({ metadata: { prompt: 'hello' } })).toBe(false)
    }
  })

  it('should omit the metadata parameter when the project has no CREATION_CONTEXT fields', async () => {
    const { harness } = await setupSessionWithProject({ withCreationFields: false })
    const createFile = (await getAgentTools(harness)).find((t) => t.name === 'create_file')
    const createVersion = (await getAgentTools(harness)).find((t) => t.name === 'create_version')
    expect(createFile).toBeDefined()
    expect(createVersion).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inspecting the runtime schema shape of the dynamically-built tool
    const fileProps = (createFile!.parameters as any).properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inspecting the runtime schema shape of the dynamically-built tool
    const versionProps = (createVersion!.parameters as any).properties
    expect('metadata' in fileProps).toBe(false)
    expect('metadata' in versionProps).toBe(false)
  })

  it('should include rename_asset and move_assets by default, but exclude delete_asset', async () => {
    const { harness } = await setupSessionWithProject({ withCreationFields: false })
    const toolNames = (await getAgentTools(harness)).map((t) => t.name)

    expect(toolNames).toContain('rename_asset')
    expect(toolNames).toContain('move_assets')
    expect(toolNames).not.toContain('delete_asset')
  })

  it('should include delete_asset when deniedTools is explicitly empty', async () => {
    const team = await prisma.team.create({ data: { name: 'Delete Asset Team' } })
    const user = await prisma.user.create({
      data: { name: 'Owner', email: 'owner-del@shumai.ai' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: user.id, role: 'owner' },
    })
    await prisma.user.create({
      data: {
        id: 'del-agent',
        name: 'Del Agent',
        email: 'del-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'del-agent',
        teamId: team.id,
        type: 'chat',
        config: {
          provider: 'google',
          model: 'gemini',
          deniedTools: [],
        },
      },
    })

    const { harness } = await createAgentSession({
      teamId: team.id,
      agentId: 'del-agent',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      providers: mockProviders,
      userId: user.id,
    })
    const toolNames = (await getAgentTools(harness)).map((t) => t.name)
    expect(toolNames).toContain('delete_asset')
  })
})

describe('createAgentSession enabled skill filtering', () => {
  setupTestDbHooks()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should only advertise and allow reading skills enabled for the agent', async () => {
    const team = await prisma.team.create({ data: { name: 'Skill Filter Team' } })

    const enabledSkill = await prisma.skill.create({
      data: {
        name: 'Enabled Skill',
        assetId: 'asset-enabled',
        hash: 'enabled-hash',
        teamId: team.id,
      },
    })
    const disabledSkill = await prisma.skill.create({
      data: {
        name: 'Disabled Skill',
        assetId: 'asset-disabled',
        hash: 'disabled-hash',
        teamId: team.id,
      },
    })

    await prisma.user.create({
      data: {
        id: 'skill-filter-agent',
        name: 'Ai Agent Skill Filter',
        email: 'skill-filter-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'skill-filter-agent',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
        skills: {
          create: [{ skillId: enabledSkill.id }],
        },
      },
    })

    const { harness } = await createAgentSession({
      teamId: team.id,
      agentId: 'skill-filter-agent',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [{ id: enabledSkill.id, name: enabledSkill.name }],
      enabledSkillIds: [enabledSkill.id],
      providers: mockProviders,
    })

    // The disabled skill must not be advertised in the available skills list
    const prompt = await await getAgentPrompt(harness)
    expect(prompt).toContain(enabledSkill.id)
    expect(prompt).not.toContain(disabledSkill.id)

    // read_skill must reject the disabled skill id
    const readSkillTool = (await getAgentTools(harness)).find((t) => t.name === 'read_skill')
    expect(readSkillTool).toBeDefined()

    vi.spyOn(agentService, 'getSkillContent').mockResolvedValue('# Enabled Skill')

    await expect(
      invokeTool(readSkillTool!, '1', { skillId: disabledSkill.id }, undefined, undefined),
    ).rejects.toThrow('not enabled for this agent')

    const result = await invokeTool(
      readSkillTool!,
      '1',
      { skillId: enabledSkill.id },
      undefined,
      undefined,
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).text).toBe('# Enabled Skill')
  })

  it('should reject all read_skill calls when no skills are enabled for the agent', async () => {
    const team = await prisma.team.create({ data: { name: 'Skill None Team' } })
    const skill = await prisma.skill.create({
      data: { name: 'Unassigned Skill', assetId: 'asset-none', hash: 'none-hash', teamId: team.id },
    })

    await prisma.user.create({
      data: {
        id: 'skill-none-agent',
        name: 'Ai Agent Skill None',
        email: 'skill-none-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'skill-none-agent',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    const { harness } = await createAgentSession({
      teamId: team.id,
      agentId: 'skill-none-agent',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      enabledSkillIds: [],
      providers: mockProviders,
    })

    const readSkillTool = (await getAgentTools(harness)).find((t) => t.name === 'read_skill')
    expect(readSkillTool).toBeDefined()

    await expect(
      invokeTool(readSkillTool!, '1', { skillId: skill.id }, undefined, undefined),
    ).rejects.toThrow('not enabled for this agent')
  })

  it('enforces agent tool call count quota on tool execution', async () => {
    const team = await prisma.team.create({ data: { name: 'Tool Quota Enforcement Team' } })
    const user = await prisma.user.create({
      data: { name: 'Member User', email: 'member-tool-quota@shumai.ai', password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: user.id, role: 'editor' },
    })
    await prisma.user.create({
      data: {
        id: 'tool-quota-agent',
        name: 'Tool Quota Agent',
        email: 'tool-quota-agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: 'tool-quota-agent',
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    await quotaService.createRule(team.id, {
      scopeMode: 'all_members',
      resource: 'agent_tool_call_count',
      resourceData: { name: 'read_thread' },
      limit: 1,
      period: '1hour',
      enabled: true,
    })

    const { harness } = await createAgentSession({
      teamId: team.id,
      userId: user.id,
      agentId: 'tool-quota-agent',
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      enabledSkillIds: [],
      providers: mockProviders,
    })

    const readThreadTool = (await getAgentTools(harness)).find((t) => t.name === 'read_thread')
    expect(readThreadTool).toBeDefined()

    // First call executes and consumes quota
    const res1 = await invokeTool(
      readThreadTool!,
      'call-1',
      { threadId: 'non-existent' },
      undefined,
      undefined,
    )
    expect(res1).toBeDefined()

    // Second call exceeds quota and returns error
    const res2 = await invokeTool(
      readThreadTool!,
      'call-2',
      { threadId: 'non-existent' },
      undefined,
      undefined,
    )
    expect(res2).toBeDefined()
    const textContent = res2.content[0]
    if (textContent && textContent.type === 'text') {
      expect(textContent.text).toContain('Quota exceeded')
    } else {
      expect.unreachable('Expected text content')
    }
  })
})

describe('getModelFromDb', () => {
  it('should prioritize provider active api protocol over model config api', () => {
    const providers: DbProviderInfo[] = [
      {
        name: 'custom-provider',
        config: { api: 'anthropic-messages', apiKey: 'KEY' },
        models: [
          {
            modelId: 'my-model',
            name: 'My Model',
            config: {
              api: 'openai-responses', // stale model config
              reasoning: false,
              input: ['text'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 128000,
              maxTokens: 4096,
            },
          },
        ],
      },
    ]

    const model = getModelFromDb(providers, 'custom-provider', 'my-model')
    expect(model.api).toBe('anthropic-messages')
  })
})

describe('createAgentSession media generation tools injection', () => {
  setupTestDbHooks()

  it('omits generate_image and generate_video when no valid models are configured', async () => {
    const team = await prisma.team.create({
      data: { name: 'No Media Team' },
    })
    const user = await prisma.user.create({
      data: { name: 'User 1', email: 'user1@example.com', password: 'pw' },
    })
    const agentUser = await prisma.user.create({
      data: {
        id: 'agent-user-no-media',
        name: 'Agent User 1',
        email: 'agent1@test.com',
        type: 'agent',
      },
    })
    const agent = await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    vi.spyOn(mediaGenerationService, 'getValidModels').mockResolvedValue({
      imageModels: [],
      videoModels: [],
      providerKeys: {},
    })

    const { harness } = await createAgentSession({
      teamId: team.id,
      userId: user.id,
      agentId: agent.id,
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      enabledSkillIds: [],
      providers: mockProviders,
    })

    const tools = await getAgentTools(harness)
    expect(tools.find((t) => t.name === 'generate_image')).toBeUndefined()
    expect(tools.find((t) => t.name === 'generate_video')).toBeUndefined()
  })

  it('injects generate_image and generate_video when valid models are present', async () => {
    const team = await prisma.team.create({
      data: { name: 'Media Team' },
    })
    const user = await prisma.user.create({
      data: { name: 'User 2', email: 'user2@example.com', password: 'pw' },
    })
    const agentUser = await prisma.user.create({
      data: {
        id: 'agent-user-with-media',
        name: 'Agent User 2',
        email: 'agent2@test.com',
        type: 'agent',
      },
    })
    const agent = await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })

    vi.spyOn(mediaGenerationService, 'getValidModels').mockResolvedValue({
      imageModels: [
        {
          id: 'im-1',
          type: 'image',
          provider: 'openai',
          modelId: 'dall-e-3',
          name: 'DALL-E 3',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      videoModels: [
        {
          id: 'vm-1',
          type: 'video',
          provider: 'klingai',
          modelId: 'kling-v1-standard',
          name: 'Kling v1 Standard',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      providerKeys: {
        openai: { apiKey: 'key-1' },
        klingai: { apiKey: 'key-2' },
      },
    })

    const { harness } = await createAgentSession({
      teamId: team.id,
      userId: user.id,
      agentId: agent.id,
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      enabledSkillIds: [],
      providers: mockProviders,
    })

    const tools = await getAgentTools(harness)
    expect(tools.find((t) => t.name === 'generate_image')).toBeDefined()
    expect(tools.find((t) => t.name === 'generate_video')).toBeDefined()
  })

  it('respects deniedTools when generate_image is denied in agent config', async () => {
    const team = await prisma.team.create({
      data: { name: 'Denied Media Team' },
    })
    const user = await prisma.user.create({
      data: { name: 'User 3', email: 'user3@example.com', password: 'pw' },
    })
    const agentUser = await prisma.user.create({
      data: {
        id: 'agent-user-denied-media',
        name: 'Agent User 3',
        email: 'agent3@test.com',
        type: 'agent',
      },
    })
    const agent = await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: team.id,
        type: 'chat',
        config: {
          provider: 'google',
          model: 'gemini',
          deniedTools: ['generate_image'],
        },
      },
    })

    vi.spyOn(mediaGenerationService, 'getValidModels').mockResolvedValue({
      imageModels: [
        {
          id: 'im-1',
          type: 'image',
          provider: 'openai',
          modelId: 'dall-e-3',
          name: 'DALL-E 3',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      videoModels: [
        {
          id: 'vm-1',
          type: 'video',
          provider: 'klingai',
          modelId: 'kling-v1-standard',
          name: 'Kling v1 Standard',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      providerKeys: {
        openai: { apiKey: 'key-1' },
        klingai: { apiKey: 'key-2' },
      },
    })

    const { harness } = await createAgentSession({
      teamId: team.id,
      userId: user.id,
      agentId: agent.id,
      providerName: 'google',
      modelId: 'gemini',
      systemPrompt: 'prompt',
      teamSkills: [],
      enabledSkillIds: [],
      providers: mockProviders,
    })

    const tools = await getAgentTools(harness)
    expect(tools.find((t) => t.name === 'generate_image')).toBeUndefined()
    expect(tools.find((t) => t.name === 'generate_video')).toBeDefined()
  })
})
