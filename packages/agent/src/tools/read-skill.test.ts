import { vi } from 'vitest'

vi.mock('@shumai/core/src/s3/s3')
vi.mock('fs')

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { createReadSkillTool } from './read-skill'
import { s3Service } from '@shumai/core/src/s3/s3'
import AdmZip from 'adm-zip'
import * as fs from 'fs'

describe('readSkillTool', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw error if skill not found', async () => {
    const readSkillTool = createReadSkillTool(undefined, () => {})
    await expect(
      readSkillTool.execute('1', { skillId: 'non-existent' }, undefined, undefined),
    ).rejects.toThrow('not found')
  })

  it('should read skill from cache if hash matches', async () => {
    const team = await prisma.team.create({ data: { name: 'Test Team' } })
    const skill = await prisma.skill.create({
      data: {
        name: 'Test Skill',
        assetId: 'asset1',
        hash: 'match-hash',
        teamId: team.id,
      },
    })

    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs calls
    vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
      if (path.toString().endsWith('.hash')) return 'match-hash'
      if (path.toString().endsWith('SKILL.md')) return '# Test Skill Content'
      return ''
    })

    const readSkillTool = createReadSkillTool(undefined, () => {})
    const result = await readSkillTool.execute('1', { skillId: skill.id }, undefined, undefined)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).text).toBe('# Test Skill Content')
    expect(s3Service.getObject).not.toHaveBeenCalled()
  })

  it('should download and extract skill if cache missing or hash mismatch', async () => {
    const team = await prisma.team.create({ data: { name: 'Test Team' } })
    const skill = await prisma.skill.create({
      data: {
        name: 'New Skill',
        assetId: 'asset1',
        hash: 'new-hash',
        teamId: team.id,
      },
    })

    await prisma.asset.create({
      data: {
        id: 'asset1',
        name: 'skill.zip',
        storageKey: { create: { key: 'skills/skill.zip' } },
        type: 'file',
        status: 'uploaded',
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs calls
    vi.spyOn(fs, 'existsSync').mockImplementation((path: any) => {
      if (path.toString().endsWith('.hash')) return false
      if (path.toString().endsWith('SKILL.md')) return true
      return true
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs calls
    vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
      if (path.toString().endsWith('SKILL.md')) return '# Extracted Content'
      return ''
    })

    const zip = new AdmZip()
    zip.addFile('SKILL.md', Buffer.from('# Extracted Content'))
    const zipBuffer = zip.toBuffer()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking s3Service return
    ;(s3Service.getObject as any).mockResolvedValue({
      buffer: zipBuffer,
      contentType: 'application/zip',
    })

    const readSkillTool = createReadSkillTool(undefined, () => {})
    const result = await readSkillTool.execute('1', { skillId: skill.id }, undefined, undefined)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).text).toBe('# Extracted Content')
    expect(s3Service.getObject).toHaveBeenCalled()
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('.hash'), 'new-hash')
  })

  describe('environment variables', () => {
    let originalEnv: NodeJS.ProcessEnv

    beforeEach(() => {
      originalEnv = { ...process.env }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should use user-configured value if it is non-empty', async () => {
      const team = await prisma.team.create({ data: { name: 'Test Team' } })
      const skill = await prisma.skill.create({
        data: {
          name: 'Skill Env Test 1',
          assetId: 'asset1',
          hash: 'hash1',
          teamId: team.id,
          config: {
            environmentVariables: [{ name: 'CONFIGURED_VAR', default: 'user-val' }],
          },
        },
      })

      delete process.env.CONFIGURED_VAR

      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs readFileSync which has complex overloaded signatures
      vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
        if (path.toString().endsWith('.hash')) return 'hash1'
        if (path.toString().endsWith('SKILL.md')) return '# Content'
        return ''
      })

      let capturedEnvs: Record<string, string> = {}
      const readSkillTool = createReadSkillTool(undefined, (envs) => {
        capturedEnvs = { ...capturedEnvs, ...envs }
      })
      await readSkillTool.execute('1', { skillId: skill.id }, undefined, undefined)

      expect(capturedEnvs).toEqual({
        CONFIGURED_VAR: 'user-val',
      })
    })

    it('should favor user-configured value even if host environment variable is also defined', async () => {
      const team = await prisma.team.create({ data: { name: 'Test Team' } })
      const skill = await prisma.skill.create({
        data: {
          name: 'Skill Env Test 2',
          assetId: 'asset1',
          hash: 'hash2',
          teamId: team.id,
          config: {
            environmentVariables: [{ name: 'OVERRIDDEN_VAR', default: 'user-val' }],
          },
        },
      })

      process.env.OVERRIDDEN_VAR = 'host-val'

      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs readFileSync which has complex overloaded signatures
      vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
        if (path.toString().endsWith('.hash')) return 'hash2'
        if (path.toString().endsWith('SKILL.md')) return '# Content'
        return ''
      })

      let capturedEnvs: Record<string, string> = {}
      const readSkillTool = createReadSkillTool(undefined, (envs) => {
        capturedEnvs = { ...capturedEnvs, ...envs }
      })
      await readSkillTool.execute('1', { skillId: skill.id }, undefined, undefined)

      expect(capturedEnvs).toEqual({
        OVERRIDDEN_VAR: 'user-val',
      })
    })

    it('should fall back to host environment variable if user-configured value is empty string', async () => {
      const team = await prisma.team.create({ data: { name: 'Test Team' } })
      const skill = await prisma.skill.create({
        data: {
          name: 'Skill Env Test 3',
          assetId: 'asset1',
          hash: 'hash3',
          teamId: team.id,
          config: {
            environmentVariables: [{ name: 'FALLBACK_VAR', default: '' }],
          },
        },
      })

      process.env.FALLBACK_VAR = 'host-val'

      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs readFileSync which has complex overloaded signatures
      vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
        if (path.toString().endsWith('.hash')) return 'hash3'
        if (path.toString().endsWith('SKILL.md')) return '# Content'
        return ''
      })

      let capturedEnvs: Record<string, string> = {}
      const readSkillTool = createReadSkillTool(undefined, (envs) => {
        capturedEnvs = { ...capturedEnvs, ...envs }
      })
      await readSkillTool.execute('1', { skillId: skill.id }, undefined, undefined)

      expect(capturedEnvs).toEqual({
        FALLBACK_VAR: 'host-val',
      })
    })

    it('should fall back to host environment variable if user-configured value is undefined', async () => {
      const team = await prisma.team.create({ data: { name: 'Test Team' } })
      const skill = await prisma.skill.create({
        data: {
          name: 'Skill Env Test 4',
          assetId: 'asset1',
          hash: 'hash4',
          teamId: team.id,
          config: {
            environmentVariables: [{ name: 'FALLBACK_VAR_UNDEF' }],
          },
        },
      })

      process.env.FALLBACK_VAR_UNDEF = 'host-val2'

      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs readFileSync which has complex overloaded signatures
      vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
        if (path.toString().endsWith('.hash')) return 'hash4'
        if (path.toString().endsWith('SKILL.md')) return '# Content'
        return ''
      })

      let capturedEnvs: Record<string, string> = {}
      const readSkillTool = createReadSkillTool(undefined, (envs) => {
        capturedEnvs = { ...capturedEnvs, ...envs }
      })
      await readSkillTool.execute('1', { skillId: skill.id }, undefined, undefined)

      expect(capturedEnvs).toEqual({
        FALLBACK_VAR_UNDEF: 'host-val2',
      })
    })
  })

  describe('permissions', () => {
    it('should allow loading skill matching user role level or lower', async () => {
      const team = await prisma.team.create({ data: { name: 'Permission Team' } })
      const ownerUser = await prisma.user.create({
        data: { name: 'Owner User', email: 'owner@test.com' },
      })
      const reviewerUser = await prisma.user.create({
        data: { name: 'Reviewer User', email: 'reviewer@test.com' },
      })

      await prisma.teamMember.create({
        data: { teamId: team.id, userId: ownerUser.id, role: 'owner' },
      })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: reviewerUser.id, role: 'reviewer' },
      })

      const ownerSkill = await prisma.skill.create({
        data: {
          name: 'Owner Skill',
          assetId: 'asset1',
          hash: 'hash-owner',
          teamId: team.id,
          permission: 'owner',
        },
      })

      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
        if (path.toString().endsWith('.hash')) return 'hash-owner'
        if (path.toString().endsWith('SKILL.md')) return '# Owner Skill'
        return ''
      })

      const ownerTool = createReadSkillTool(ownerUser.id, () => {})
      const resultOwner = await ownerTool.execute(
        '1',
        { skillId: ownerSkill.id },
        undefined,
        undefined,
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((resultOwner.content[0] as any).text).toBe('# Owner Skill')

      const reviewerTool = createReadSkillTool(reviewerUser.id, () => {})
      await expect(
        reviewerTool.execute('1', { skillId: ownerSkill.id }, undefined, undefined),
      ).rejects.toThrow('Permission denied')
    })
  })

  describe('onSkillLoaded callback', () => {
    it('should invoke onSkillLoaded after a successful skill load', async () => {
      const team = await prisma.team.create({ data: { name: 'Callback Team' } })
      const skill = await prisma.skill.create({
        data: {
          name: 'Callback Skill',
          assetId: 'asset1',
          hash: 'cb-hash',
          teamId: team.id,
        },
      })

      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs readFileSync which has complex overloaded signatures
      vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
        if (path.toString().endsWith('.hash')) return 'cb-hash'
        if (path.toString().endsWith('SKILL.md')) return '# Callback Skill'
        return ''
      })

      const onSkillLoaded = vi.fn()
      const readSkillTool = createReadSkillTool(undefined, () => {}, onSkillLoaded)
      await readSkillTool.execute('1', { skillId: skill.id }, undefined, undefined)

      expect(onSkillLoaded).toHaveBeenCalledTimes(1)
    })

    it('should not invoke onSkillLoaded when loading is denied', async () => {
      const team = await prisma.team.create({ data: { name: 'Callback Deny Team' } })
      const reviewerUser = await prisma.user.create({
        data: { name: 'Reviewer Callback', email: 'callback-reviewer@test.com' },
      })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: reviewerUser.id, role: 'reviewer' },
      })
      const ownerSkill = await prisma.skill.create({
        data: {
          name: 'Owner Callback Skill',
          assetId: 'asset1',
          hash: 'cb-owner-hash',
          teamId: team.id,
          permission: 'owner',
        },
      })

      const onSkillLoaded = vi.fn()
      const reviewerTool = createReadSkillTool(reviewerUser.id, () => {}, onSkillLoaded)
      await expect(
        reviewerTool.execute('1', { skillId: ownerSkill.id }, undefined, undefined),
      ).rejects.toThrow('Permission denied')

      expect(onSkillLoaded).not.toHaveBeenCalled()
    })
  })

  describe('enabled skills enforcement', () => {
    it('should reject loading a skill that is not enabled for the agent', async () => {
      const team = await prisma.team.create({ data: { name: 'Enabled Filter Team' } })
      const skill = await prisma.skill.create({
        data: {
          name: 'Disabled For Agent Skill',
          assetId: 'asset1',
          hash: 'disabled-agent-hash',
          teamId: team.id,
        },
      })

      const readSkillTool = createReadSkillTool(undefined, () => {}, undefined, [
        'some-other-enabled-skill',
      ])
      await expect(
        readSkillTool.execute('1', { skillId: skill.id }, undefined, undefined),
      ).rejects.toThrow('not enabled for this agent')
    })

    it('should allow loading a skill that is enabled for the agent', async () => {
      const team = await prisma.team.create({ data: { name: 'Enabled Allow Team' } })
      const skill = await prisma.skill.create({
        data: {
          name: 'Enabled For Agent Skill',
          assetId: 'asset1',
          hash: 'enabled-agent-hash',
          teamId: team.id,
        },
      })

      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs readFileSync which has complex overloaded signatures
      vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
        if (path.toString().endsWith('.hash')) return 'enabled-agent-hash'
        if (path.toString().endsWith('SKILL.md')) return '# Enabled For Agent Skill'
        return ''
      })

      const readSkillTool = createReadSkillTool(undefined, () => {}, undefined, [skill.id])
      const result = await readSkillTool.execute('1', { skillId: skill.id }, undefined, undefined)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.content[0] as any).text).toBe('# Enabled For Agent Skill')
    })

    it('should allow loading any skill when enabledSkillIds is not provided (backward compatibility)', async () => {
      const team = await prisma.team.create({ data: { name: 'No Filter Team' } })
      const skill = await prisma.skill.create({
        data: {
          name: 'No Filter Skill',
          assetId: 'asset1',
          hash: 'no-filter-hash',
          teamId: team.id,
        },
      })

      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking node fs readFileSync which has complex overloaded signatures
      vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
        if (path.toString().endsWith('.hash')) return 'no-filter-hash'
        if (path.toString().endsWith('SKILL.md')) return '# No Filter Skill'
        return ''
      })

      const readSkillTool = createReadSkillTool(undefined, () => {})
      const result = await readSkillTool.execute('1', { skillId: skill.id }, undefined, undefined)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.content[0] as any).text).toBe('# No Filter Skill')
    })
  })
})
