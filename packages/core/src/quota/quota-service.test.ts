import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { quotaService, QuotaExceededError } from './quota-service'
import { quotaRuleCache, wildcardToRegex, domainWildcardToRegex } from './quota-cache'

describe('QuotaRuleCache Wildcard Matchers', () => {
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

  it('correctly matches domain wildcards', () => {
    const starDomain = domainWildcardToRegex('*')
    expect(starDomain.test('api.github.com')).toBe(true)
    expect(starDomain.test('google.com')).toBe(true)

    const googleDomain = domainWildcardToRegex('*.googleapis.com')
    expect(googleDomain.test('storage.googleapis.com')).toBe(true)
    expect(googleDomain.test('auth.googleapis.com')).toBe(true)
    expect(googleDomain.test('googleapis.com')).toBe(true)
    expect(googleDomain.test('google.com')).toBe(false)
    expect(googleDomain.test('api.github.com')).toBe(false)

    const exactDomain = domainWildcardToRegex('api.github.com')
    expect(exactDomain.test('api.github.com')).toBe(true)
    expect(exactDomain.test('github.com')).toBe(false)
  })
})

describe('QuotaService', () => {
  setupTestDbHooks()

  beforeEach(() => {
    quotaRuleCache.clear()
  })

  it('creates, reads, updates, and deletes quota policies', async () => {
    const team = await prisma.team.create({
      data: { name: 'Quota Team' },
    })

    // Create policy
    const policy = await quotaService.createPolicy(team.id, {
      scopeType: 'team',
      resource: 'agent_total_tokens',
      limit: 100000,
      period: '1hour',
      enabled: true,
    })

    expect(policy.id).toBeDefined()
    expect(policy.teamId).toBe(team.id)
    expect(policy.limit).toBe(100000)
    expect(policy.period).toBe('1hour')

    // Get policy
    const fetched = await quotaService.getPolicy(team.id, policy.id)
    expect(fetched.id).toBe(policy.id)
    expect(fetched.limit).toBe(100000)

    // List policies
    const list = await quotaService.listPolicies(team.id)
    expect(list.total).toBe(1)
    expect(list.policies[0].id).toBe(policy.id)

    // Update policy
    const updated = await quotaService.updatePolicy(team.id, policy.id, {
      limit: 200000,
      enabled: false,
    })
    expect(updated.limit).toBe(200000)
    expect(updated.enabled).toBe(false)

    // Delete policy
    await quotaService.deletePolicy(team.id, policy.id)
    const afterDelete = await quotaService.listPolicies(team.id)
    expect(afterDelete.total).toBe(0)
  })

  it('validates user and role on policy creation', async () => {
    const team = await prisma.team.create({
      data: { name: 'Quota Team' },
    })

    // Missing user should throw 404
    await expect(
      quotaService.createPolicy(team.id, {
        scopeType: 'user',
        userId: 'non-existent-user-id',
        resource: 'agent_cost',
        limit: 10,
        period: '1day',
      }),
    ).rejects.toThrow()
  })

  it('enforces optimistic check and consumes quota for team scope', async () => {
    const team = await prisma.team.create({
      data: { name: 'Team Scope Quota' },
    })

    await quotaService.createPolicy(team.id, {
      scopeType: 'team',
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

  it('enforces role scope independently for each role member', async () => {
    const team = await prisma.team.create({
      data: { name: 'Role Scope Team' },
    })

    const userAlice = await prisma.user.create({
      data: { name: 'Alice', email: 'alice@example.com', password: 'pw' },
    })

    const userBob = await prisma.user.create({
      data: { name: 'Bob', email: 'bob@example.com', password: 'pw' },
    })

    // Create policy for editors with 5 skill calls per 1hour
    await quotaService.createPolicy(team.id, {
      scopeType: 'role',
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

    // Reviewer should not match editor policy
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

  it('matches bash command wildcard policies', async () => {
    const team = await prisma.team.create({
      data: { name: 'Bash Quota Team' },
    })

    await quotaService.createPolicy(team.id, {
      scopeType: 'team',
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

  it('matches network domain wildcard policies', async () => {
    const team = await prisma.team.create({
      data: { name: 'Network Quota Team' },
    })

    await quotaService.createPolicy(team.id, {
      scopeType: 'team',
      resource: 'agent_network_call_count',
      resourceData: { domain: '*.googleapis.com' },
      limit: 1,
      period: '1hour',
      enabled: true,
    })

    // First call to storage.googleapis.com
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        resource: 'agent_network_call_count',
        resourceData: { domain: 'storage.googleapis.com' },
      },
      1,
    )

    // 2nd call to auth.googleapis.com is blocked
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          resource: 'agent_network_call_count',
          resourceData: { domain: 'auth.googleapis.com' },
        },
        1,
      ),
    ).rejects.toThrow(QuotaExceededError)

    // Call to api.github.com does not match -> allowed
    await expect(
      quotaService.checkQuota(
        {
          teamId: team.id,
          resource: 'agent_network_call_count',
          resourceData: { domain: 'api.github.com' },
        },
        1,
      ),
    ).resolves.toEqual(expect.objectContaining({ allowed: true }))
  })

  it('handles period window rollover and resets usage', async () => {
    const team = await prisma.team.create({
      data: { name: 'Window Rollover Team' },
    })

    const policy = await quotaService.createPolicy(team.id, {
      scopeType: 'team',
      resource: 'agent_cost',
      limit: 10,
      period: '1hour',
      enabled: true,
    })

    // Simulate an expired period by creating a past QuotaUsage
    const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const pastEnd = new Date(Date.now() - 1 * 60 * 60 * 1000)

    await prisma.quotaUsage.create({
      data: {
        policyId: policy.id,
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

    // Consuming now starts a fresh window
    await quotaService.consumeQuota(
      {
        teamId: team.id,
        resource: 'agent_cost',
      },
      5,
    )

    const usages = await prisma.quotaUsage.findMany({
      where: { policyId: policy.id },
      orderBy: { periodStart: 'desc' },
    })

    // Preserves historical records (2 records total: past and current)
    expect(usages).toHaveLength(2)
    expect(usages[0].consumed).toBe(5)
  })

  it('enforces multiple matching policies simultaneously', async () => {
    const team = await prisma.team.create({
      data: { name: 'Multi Rule Team' },
    })

    const user = await prisma.user.create({
      data: { name: 'Charlie', email: 'charlie@example.com', password: 'pw' },
    })

    // Policy 1: Team overall token limit 10,000
    await quotaService.createPolicy(team.id, {
      scopeType: 'team',
      resource: 'agent_total_tokens',
      limit: 10000,
      period: '1day',
      enabled: true,
    })

    // Policy 2: User specific token limit 2,000
    await quotaService.createPolicy(team.id, {
      scopeType: 'user',
      userId: user.id,
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

    // Charlie is blocked by user policy (2000 limit reached)
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

    // Another user in the same team is NOT blocked by Charlie's user limit, only by team limit
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
})
