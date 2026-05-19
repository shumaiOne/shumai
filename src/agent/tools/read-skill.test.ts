import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { readSkillTool } from './read-skill'
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
    const result = await readSkillTool.execute(
      '1',
      { skillId: 'non-existent' },
      undefined,
      undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking AgentSession is too complex for this test
      {} as unknown as any,
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

    const result = await readSkillTool.execute(
      '1',
      { skillId: skill.id },
      undefined,
      undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking AgentSession is too complex for this test
      {} as unknown as any,
    )
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
        key: 'skills/skill.zip',
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
    ;(s3Service.getObject as any).mockResolvedValue({ buffer: Buffer.from('zipdata'), contentType: 'application/zip' })

    const result = await readSkillTool.execute(
      '1',
      { skillId: skill.id },
      undefined,
      undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking AgentSession is too complex for this test
      {} as unknown as any,
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).text).toBe('# Extracted Content')
    expect(s3Service.getObject).toHaveBeenCalled()
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('.hash'), 'new-hash')
  })
})
