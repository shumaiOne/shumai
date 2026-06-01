import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db'
import { createReadSkillTool } from './read-skill'
import { s3Service } from '@/services/s3/s3'
import * as fs from 'fs'

vi.mock('@/services/s3/s3')
vi.mock('fs')
vi.mock('adm-zip', () => {
  return {
    default: class {
      extractAllTo = vi.fn()
    },
  }
})

describe('readSkillTool', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error if skill not found', async () => {
    const readSkillTool = createReadSkillTool(() => {})
    const result = await readSkillTool.execute(
      '1',
      { skillId: 'non-existent' },
      undefined,
      undefined,
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).text).toContain('not found')
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

    const readSkillTool = createReadSkillTool(() => {})
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking s3Service return
    ;(s3Service.getObject as any).mockResolvedValue({
      buffer: Buffer.from('zipdata'),
      contentType: 'application/zip',
    })

    const readSkillTool = createReadSkillTool(() => {})
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
      const readSkillTool = createReadSkillTool((envs) => {
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
      const readSkillTool = createReadSkillTool((envs) => {
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
      const readSkillTool = createReadSkillTool((envs) => {
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
      const readSkillTool = createReadSkillTool((envs) => {
        capturedEnvs = { ...capturedEnvs, ...envs }
      })
      await readSkillTool.execute('1', { skillId: skill.id }, undefined, undefined)

      expect(capturedEnvs).toEqual({
        FALLBACK_VAR_UNDEF: 'host-val2',
      })
    })
  })
})
