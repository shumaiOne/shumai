import { describe, it, expect } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { quotaService, QuotaExceededError, wildcardToRegex } from './quota-service'

describe('QuotaRule Wildcard Matchers', () => {
  it('correctly matches bash command wildcards', () => {
    const starRegex = wildcardToRegex('*')
    expect(starRegex.test('npm install')).toBe(true)
    expect(starRegex.test('git commit -m "test"')).toBe(true)

    const npmRegex = wildcardToRegex('npm *')
    expect(npmRegex.test('npm install')).toBe(true)
    expect(npmRegex.test('npm test')).toBe(true)
    expect(npmRegex.test('git push')).toBe(false)

    const exactRegex = wildcardToRegex('rm -rf .pi')
    expect(exactRegex.test('rm -rf .pi')).toBe(true)
    expect(exactRegex.test('rm -rf /')).toBe(false)
  })

  it('correctly matches agent tool name wildcards', () => {
    const starTool = wildcardToRegex('*')
    expect(starTool.test('analyze_image')).toBe(true)
    expect(starTool.test('screenshot')).toBe(true)

    const exactTool = wildcardToRegex('analyze_image')
    expect(exactTool.test('analyze_image')).toBe(true)
    expect(exactTool.test('screenshot')).toBe(false)
  })
})

describe('QuotaService', () => {
  setupTestDbHooks()

  it('creates, reads, updates, and deletes quota rules', async () => {
    const team = await prisma.team.create({
      data: { name: 'Quota Team' },
    })

    // Create rule
    const rule = await quotaService.createRule(team.id, {
      scopeMode: 'all_members',
      resource: 'agent_total_tokens',
      limit: 100000,
      period: '1hour',
      enabled: true,
    })

    expect(rule.id).toBeDefined()
    expect(rule.teamId).toBe(team.id)
    expect(rule.scopeMode).toBe('all_members')
    expect(rule.limit).toBe(100000)
    expect(rule.period).toBe('1hour')

    // Get rule
    const fetched = await quotaService.getRule(team.id, rule.id)
    expect(fetched.id).toBe(rule.id)
    expect(fetched.limit).toBe(100000)

    // List rules
    const list = await quotaService.listRules(team.id)
    expect(list.total).toBe(1)
    expect(list.rules[0].id).toBe(rule.id)

    // Update rule
    const updated = await quotaService.updateRule(team.id, rule.id, {
      limit: 200000,
      enabled: false,
    })
    expect(updated.limit).toBe(200000)
    expect(updated.enabled).toBe(false)

    // Delete rule
    await quotaService.deleteRule(team.id, rule.id)
    const afterDelete = await quotaService.listRules(team.id)
    expect(afterDelete.total).toBe(0)
  })

  it('validates selected members on rule creation', async () => {
    const team = await prisma.team.create({
      data: { name: 'Quota Team' },
    })

    // Missing user should throw 400
    await expect(
      quotaService.createRule(team.id, {
        scopeMode: 'selected_members',
        userIds: ['non-existent-user-id'],
        resource: 'agent_cost',
        limit: 10,
        period: '1day',
      }),
    ).rejects.toThrow()
  })

  it('uses the latest database rule state for every quota check', async () => {
    const team = await prisma.team.create({
      data: { name: 'Fresh Quota Rule Team' },
    })

    const rule = await quotaService.createRule(team.id, {
      scopeMode: 'all_members',
      resource: 'agent_cost',
      limit: 10,
      period: '1hour',
    })

    const event = {
      teamId: team.id,
      resource: 'agent_cost' as const,
    }

    expect((await quotaService.checkQuota(event)).matchedRules).toHaveLength(1)

    await prisma.quotaRule.update({
      where: { id: rule.id },
      data: { enabled: false },
    })

    expect((await quotaService.checkQuota(event)).matchedRules).toHaveLength(0)
  })

  it('enforces check and consumes quota for all_members (shared pool)', async () => {
    const team = await prisma.team.create({
      data: { name: 'Shared Quota Team' },
    })

    await quotaService.createRule(team.id, {
      scopeMode: 'all_members',
      resource: 'agent_total_tokens',
      limit: 1000,
      period: '1hour',
      enabled: true,
    })

    // Check with 0 before consumption
    const checkResult = await quotaService.checkQuota(
      {
        teamId: team.id,
        resource: 'agent_total_tokens',
      },
      0,
    )
    expect(checkResult.allowed).toBe(true)

    // Consume 600 tokens
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        resource: 'agent_total_tokens',
      },
      600,
    )

    // Check with 300 tokens (600 + 300 = 900 <= 1000) -> allowed
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          resource: 'agent_total_tokens',
        },
        300,
      ),
    ).resolves.toEqual(expect.objectContaining({ allowed: true }))

    // Check with 500 tokens (600 + 500 = 1100 > 1000) -> throws QuotaExceededError
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          resource: 'agent_total_tokens',
        },
        500,
      ),
    ).rejects.toThrow(QuotaExceededError)

    // Consume another 400 tokens -> exactly 1000 consumed
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        resource: 'agent_total_tokens',
      },
      400,
    )

    // Now even checkQuota with 1 token should fail
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          resource: 'agent_total_tokens',
        },
        1,
      ),
    ).rejects.toThrow(QuotaExceededError)
  })

  it('enforces each_member scope independently for each member', async () => {
    const team = await prisma.team.create({
      data: { name: 'Each Member Team' },
    })

    const userAlice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@example.com', password: 'pw' },
    })

    const userBob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@example.com', password: 'pw' },
    })

    // Create rule: each member with role editor gets 5 skill calls per 1hour
    await quotaService.createRule(team.id, {
      scopeMode: 'each_member',
      role: 'editor',
      resource: 'agent_skill_call_count',
      resourceData: { id: 'skill_1' },
      limit: 5,
      period: '1hour',
      enabled: true,
    })

    // Alice consumes 5 skill calls
    for (let i = 0; i < 5; i++) {
      await quotaService.consumeQuota(
        {
          teamId: team.id,
          userId: userAlice.id,
          role: 'editor',
          resource: 'agent_skill_call_count',
          resourceData: { id: 'skill_1' },
        },
        1,
      )
    }

    // Alice should be blocked on 6th call
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          userId: userAlice.id,
          role: 'editor',
          resource: 'agent_skill_call_count',
          resourceData: { id: 'skill_1' },
        },
        1,
      ),
    ).rejects.toThrow(QuotaExceededError)

    // Bob (also an editor) should NOT be blocked (independent tracking)
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          userId: userBob.id,
          role: 'editor',
          resource: 'agent_skill_call_count',
          resourceData: { id: 'skill_1' },
        },
        1,
      ),
    ).resolves.toEqual(expect.objectContaining({ allowed: true }))

    // Reviewer should not match editor rule
    const reviewerCheck = await quotaService.checkQuota(
      {
        teamId: team.id,
        userId: userBob.id,
        role: 'reviewer',
        resource: 'agent_skill_call_count',
        resourceData: { id: 'skill_1' },
      },
      1,
    )
    expect(reviewerCheck.matchedRules).toHaveLength(0)
  })

  it('enforces selected_members scope correctly', async () => {
    const team = await prisma.team.create({
      data: { name: 'Selected Members Team' },
    })

    const userSelected = await prisma.user.create({
      data: { name: 'Selected User', email: 'sel@example.com', password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: userSelected.id, role: 'editor' },
    })

    const userOther = await prisma.user.create({
      data: { name: 'Other User', email: 'other@example.com', password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: userOther.id, role: 'editor' },
    })

    await quotaService.createRule(team.id, {
      scopeMode: 'selected_members',
      userIds: [userSelected.id],
      resource: 'agent_cost',
      limit: 5,
      period: '1day',
      enabled: true,
    })

    // Selected user consumes 5
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        userId: userSelected.id,
        resource: 'agent_cost',
      },
      5,
    )

    // Selected user is blocked
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          userId: userSelected.id,
          resource: 'agent_cost',
        },
        1,
      ),
    ).rejects.toThrow(QuotaExceededError)

    // Other user does not match the rule -> allowed
    const otherCheck = await quotaService.checkQuota(
      {
        teamId: team.id,
        userId: userOther.id,
        resource: 'agent_cost',
      },
      10,
    )
    expect(otherCheck.matchedRules).toHaveLength(0)
  })

  it('matches bash command wildcard rules', async () => {
    const team = await prisma.team.create({
      data: { name: 'Bash Quota Team' },
    })

    await quotaService.createRule(team.id, {
      scopeMode: 'all_members',
      resource: 'agent_bash_call_count',
      resourceData: { match: 'npm *' },
      limit: 2,
      period: '1hour',
      enabled: true,
    })

    // npm test matches -> consume 1
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        resource: 'agent_bash_call_count',
        resourceData: { command: 'npm test' },
      },
      1,
    )

    // npm install matches -> consume 1 (total = 2)
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        resource: 'agent_bash_call_count',
        resourceData: { command: 'npm install' },
      },
      1,
    )

    // 3rd npm command should be blocked
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          resource: 'agent_bash_call_count',
          resourceData: { command: 'npm run build' },
        },
        1,
      ),
    ).rejects.toThrow(QuotaExceededError)

    // git command does not match 'npm *' -> allowed
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          resource: 'agent_bash_call_count',
          resourceData: { command: 'git status' },
        },
        1,
      ),
    ).resolves.toEqual(expect.objectContaining({ allowed: true }))
  })

  it('matches agent tool call rules and wildcards', async () => {
    const team = await prisma.team.create({
      data: { name: 'Tool Quota Team' },
    })

    await quotaService.createRule(team.id, {
      scopeMode: 'all_members',
      resource: 'agent_tool_call_count',
      resourceData: { name: 'analyze_image' },
      limit: 1,
      period: '1hour',
      enabled: true,
    })

    // First call to analyze_image
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        resource: 'agent_tool_call_count',
        resourceData: { name: 'analyze_image' },
      },
      1,
    )

    // 2nd call to analyze_image is blocked
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          resource: 'agent_tool_call_count',
          resourceData: { name: 'analyze_image' },
        },
        1,
      ),
    ).rejects.toThrow(QuotaExceededError)

    // Call to create_file does not match -> allowed
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          resource: 'agent_tool_call_count',
          resourceData: { name: 'create_file' },
        },
        1,
      ),
    ).resolves.toEqual(expect.objectContaining({ allowed: true }))
  })

  it('handles period window rollover and resets usage in-place with no history tables', async () => {
    const team = await prisma.team.create({
      data: { name: 'Window Rollover Team' },
    })

    const rule = await quotaService.createRule(team.id, {
      scopeMode: 'all_members',
      resource: 'agent_cost',
      limit: 10,
      period: '1hour',
      enabled: true,
    })

    // Simulate an expired period by creating a past QuotaRecord
    const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const pastEnd = new Date(Date.now() - 1 * 60 * 60 * 1000)

    await prisma.quotaRecord.create({
      data: {
        ruleId: rule.id,
        teamId: team.id,
        userId: null,
        periodStart: pastStart,
        periodEnd: pastEnd,
        consumed: 10, // fully consumed in past window
      },
    })

    // Current check should be ALLOWED because the old window expired
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          resource: 'agent_cost',
        },
        5,
      ),
    ).resolves.toEqual(expect.objectContaining({ allowed: true }))

    // Consuming now resets the single record in-place
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        resource: 'agent_cost',
      },
      5,
    )

    const records = await prisma.quotaRecord.findMany({
      where: { ruleId: rule.id },
    })

    // No extra history records (exactly 1 record row updated in place)
    expect(records).toHaveLength(1)
    expect(records[0].consumed).toBe(5)
  })

  it('lists rule records accurately with lazy reset status', async () => {
    const team = await prisma.team.create({
      data: { name: 'Records List Team' },
    })

    const user = await prisma.user.create({
      data: { name: 'Alice Member', email: 'alice.member@example.com', password: 'pw' },
    })

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        role: 'editor',
      },
    })

    const rule = await quotaService.createRule(team.id, {
      scopeMode: 'each_member',
      resource: 'agent_total_tokens',
      limit: 50000,
      period: '1day',
      enabled: true,
    })

    // Before any usage: listRuleRecords returns member with consumed: 0, isWindowActive: false
    const initialRecords = await quotaService.listRuleRecords(team.id, rule.id)
    expect(initialRecords.total).toBe(1)
    expect(initialRecords.records[0].userId).toBe(user.id)
    expect(initialRecords.records[0].consumed).toBe(0)
    expect(initialRecords.records[0].remaining).toBe(50000)
    expect(initialRecords.records[0].isWindowActive).toBe(false)

    // Consume 10000 tokens
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        userId: user.id,
        role: 'editor',
        resource: 'agent_total_tokens',
      },
      10000,
    )

    // After usage: active window with consumed = 10000
    const activeRecords = await quotaService.listRuleRecords(team.id, rule.id)
    expect(activeRecords.records[0].consumed).toBe(10000)
    expect(activeRecords.records[0].remaining).toBe(40000)
    expect(activeRecords.records[0].isWindowActive).toBe(true)
  })

  it('enforces multiple matching rules simultaneously', async () => {
    const team = await prisma.team.create({
      data: { name: 'Multi Rule Team' },
    })

    const user = await prisma.user.create({
      data: { name: 'Charlie', email: 'charlie@example.com', password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: user.id, role: 'editor' },
    })

    // Rule 1: Team overall token limit 10,000 (all_members)
    await quotaService.createRule(team.id, {
      scopeMode: 'all_members',
      resource: 'agent_total_tokens',
      limit: 10000,
      period: '1day',
      enabled: true,
    })

    // Rule 2: User specific token limit 2,000 (selected_members)
    await quotaService.createRule(team.id, {
      scopeMode: 'selected_members',
      userIds: [user.id],
      resource: 'agent_total_tokens',
      limit: 2000,
      period: '1day',
      enabled: true,
    })

    // Consuming 2000 tokens for Charlie
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        userId: user.id,
        resource: 'agent_total_tokens',
      },
      2000,
    )

    // Charlie is blocked by user rule (2000 limit reached)
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          userId: user.id,
          resource: 'agent_total_tokens',
        },
        100,
      ),
    ).rejects.toThrow(QuotaExceededError)

    // Another user in the same team is NOT blocked by Charlie's limit, only by team limit
    const userDave = await prisma.user.create({
      data: { name: 'Dave', email: 'dave@example.com', password: 'pw' },
    })

    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          userId: userDave.id,
          resource: 'agent_total_tokens',
        },
        1000,
      ),
    ).resolves.toEqual(expect.objectContaining({ allowed: true }))
  })

  it('rejects selected_members if user is not a member of the team on create', async () => {
    const team1 = await prisma.team.create({ data: { name: 'Team 1' } })
    const team2 = await prisma.team.create({ data: { name: 'Team 2' } })

    const userInTeam1 = await prisma.user.create({
      data: { name: 'Member 1', email: 'm1@example.com', password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: team1.id, userId: userInTeam1.id, role: 'editor' },
    })

    const userInTeam2 = await prisma.user.create({
      data: { name: 'Member 2', email: 'm2@example.com', password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: team2.id, userId: userInTeam2.id, role: 'editor' },
    })

    // Creating rule on Team 1 with user from Team 2 should throw 400
    await expect(
      quotaService.createRule(team1.id, {
        scopeMode: 'selected_members',
        userIds: [userInTeam2.id],
        resource: 'agent_cost',
        limit: 10,
        period: '1day',
      }),
    ).rejects.toThrow('One or more selected users are not members of the team')
  })

  it('validates merged rule and rejects invalid partial updates', async () => {
    const team = await prisma.team.create({ data: { name: 'Validation Team' } })
    const user = await prisma.user.create({
      data: { name: 'User 1', email: 'u1@example.com', password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: user.id, role: 'editor' },
    })

    const rule = await quotaService.createRule(team.id, {
      scopeMode: 'each_member',
      resource: 'agent_total_tokens',
      limit: 10000,
      period: '1hour',
    })

    // Updating resource to agent_skill_call_count without resourceData.id should fail validation
    await expect(
      quotaService.updateRule(team.id, rule.id, {
        resource: 'agent_skill_call_count',
      }),
    ).rejects.toThrow()

    // Updating scopeMode to selected_members without userIds should fail validation
    await expect(
      quotaService.updateRule(team.id, rule.id, {
        scopeMode: 'selected_members',
      }),
    ).rejects.toThrow()

    // Updating userIds with a user from outside the team should fail validation
    const otherUser = await prisma.user.create({
      data: { name: 'Other User', email: 'other_team@example.com', password: 'pw' },
    })
    await expect(
      quotaService.updateRule(team.id, rule.id, {
        scopeMode: 'selected_members',
        userIds: [otherUser.id],
      }),
    ).rejects.toThrow('One or more selected users are not members of the team')
  })

  it('resets existing quota records when accounting dimensions change', async () => {
    const team = await prisma.team.create({ data: { name: 'Reset Records Team' } })

    const rule = await quotaService.createRule(team.id, {
      scopeMode: 'all_members',
      resource: 'agent_total_tokens',
      limit: 1000,
      period: '1hour',
    })

    // Consume 500 tokens
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        resource: 'agent_total_tokens',
      },
      500,
    )

    let records = await prisma.quotaRecord.findMany({ where: { ruleId: rule.id } })
    expect(records).toHaveLength(1)
    expect(records[0].consumed).toBe(500)

    // Update resource to agent_cost (limit 10)
    await quotaService.updateRule(team.id, rule.id, {
      resource: 'agent_cost',
      limit: 10,
    })

    // Records should be reset
    records = await prisma.quotaRecord.findMany({ where: { ruleId: rule.id } })
    expect(records).toHaveLength(0)

    // Consume $2 under the new resource
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        resource: 'agent_cost',
      },
      2,
    )

    records = await prisma.quotaRecord.findMany({ where: { ruleId: rule.id } })
    expect(records).toHaveLength(1)
    expect(records[0].consumed).toBe(2)
  })

  it('handles concurrent first consumption for all_members without creating duplicate records', async () => {
    const team = await prisma.team.create({ data: { name: 'Concurrent Quota Team' } })

    const rule = await quotaService.createRule(team.id, {
      scopeMode: 'all_members',
      resource: 'agent_total_tokens',
      limit: 10000,
      period: '1hour',
    })

    // Concurrently trigger 5 quota consumption calls for the first time
    await Promise.all([
      quotaService.consumeQuota({ teamId: team.id, resource: 'agent_total_tokens' }, 10),
      quotaService.consumeQuota({ teamId: team.id, resource: 'agent_total_tokens' }, 20),
      quotaService.consumeQuota({ teamId: team.id, resource: 'agent_total_tokens' }, 30),
      quotaService.consumeQuota({ teamId: team.id, resource: 'agent_total_tokens' }, 40),
      quotaService.consumeQuota({ teamId: team.id, resource: 'agent_total_tokens' }, 50),
    ])

    const records = await prisma.quotaRecord.findMany({ where: { ruleId: rule.id } })
    expect(records).toHaveLength(1)
    expect(records[0].consumed).toBe(150)
  })

  it('excludes agents from quota usage records and prevents creating quota rules for agents', async () => {
    const team = await prisma.team.create({ data: { name: 'Exclude Agent Team' } })

    // Create human user
    const humanUser = await prisma.user.create({
      data: {
        name: 'Human Member',
        email: 'human.member@example.com',
        type: 'human',
        password: 'pw',
      },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: humanUser.id, role: 'reviewer' },
    })

    // Create agent user and agent
    const agentUser = await prisma.user.create({
      data: {
        name: 'AI Agent Member',
        email: 'ai.agent@shumai.ai',
        type: 'agent',
      },
    })
    await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: team.id,
        type: 'chat',
        config: { provider: 'google', model: 'gemini' },
      },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: agentUser.id, role: 'reviewer' },
    })

    // 1. Quota rule with each_member
    const eachMemberRule = await quotaService.createRule(team.id, {
      scopeMode: 'each_member',
      resource: 'agent_total_tokens',
      limit: 10000,
      period: '1hour',
      enabled: true,
    })

    // listRuleRecords should ONLY return human members, NOT agents
    const recordsResult = await quotaService.listRuleRecords(team.id, eachMemberRule.id)
    expect(recordsResult.total).toBe(1)
    expect(recordsResult.records).toHaveLength(1)
    expect(recordsResult.records[0].userId).toBe(humanUser.id)
    expect(recordsResult.records[0].user?.email).toBe('human.member@example.com')

    // 2. Quota rule with selected_members targeting agentUser should be rejected
    await expect(
      quotaService.createRule(team.id, {
        scopeMode: 'selected_members',
        userIds: [agentUser.id],
        resource: 'agent_total_tokens',
        limit: 5000,
        period: '1day',
      }),
    ).rejects.toThrow('One or more selected users are not members of the team')

    // 3. Updating quota rule with selected_members targeting agentUser should be rejected
    const validSelectedRule = await quotaService.createRule(team.id, {
      scopeMode: 'selected_members',
      userIds: [humanUser.id],
      resource: 'agent_total_tokens',
      limit: 5000,
      period: '1day',
    })

    await expect(
      quotaService.updateRule(team.id, validSelectedRule.id, {
        userIds: [agentUser.id],
      }),
    ).rejects.toThrow('One or more selected users are not members of the team')

    const selectedRecords = await quotaService.listRuleRecords(team.id, validSelectedRule.id)
    expect(selectedRecords.total).toBe(1)
    expect(selectedRecords.records[0].userId).toBe(humanUser.id)
  })
})
