import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { skillService } from '@shumai/core/src/skill/skill'
import AdmZip from 'adm-zip'
import { describe, expect, it, vi } from 'vitest'

describe('SkillService', () => {
  setupTestDbHooks()

  it('should list skills', async () => {
    const team = await prisma.team.create({ data: { name: 'Test Team' } })
    await prisma.skill.create({
      data: {
        name: 'Skill 1',
        description: 'Desc 1',
        assetId: 'asset1',
        hash: 'hash1',
        teamId: team.id,
      },
    })

    const skills = await skillService.listSkills(team.id)
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('Skill 1')
  })

  it('should upsert skill from asset', async () => {
    const team = await prisma.team.create({ data: { name: 'Test Team' } })

    // Create a dummy zip buffer
    const zip = new AdmZip()
    zip.addFile(
      'SKILL.md',
      Buffer.from('---\nname: "Test Skill"\ndescription: "This is a test skill."\n---'),
    )
    const zipBuffer = zip.toBuffer()

    const asset = await prisma.asset.create({
      data: {
        name: 'test.zip',
        storageKey: { create: { key: 'test.zip' } },
        type: 'file',
        status: 'uploaded',
      },
    })

    const getObjectSpy = vi.spyOn(s3Service, 'getObject').mockResolvedValue({
      buffer: zipBuffer,
      contentType: 'application/zip',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const putObjectSpy = vi.spyOn(s3Service, 'putObject').mockResolvedValue(undefined as any)

    const skill = await skillService.upsertSkill(team.id, {
      assetId: asset.id,
    })

    expect(skill.name).toBe('Test Skill')
    expect(skill.description).toBe('This is a test skill.')
    expect(getObjectSpy).toHaveBeenCalled()
    expect(putObjectSpy).toHaveBeenCalled()

    const dbSkill = await prisma.skill.findUnique({
      where: { id: skill.id },
    })
    expect(dbSkill).toBeDefined()
    expect(dbSkill?.name).toBe('Test Skill')

    getObjectSpy.mockRestore()
    putObjectSpy.mockRestore()
  })

  it('should upsert skill from github url with path', async () => {
    const team = await prisma.team.create({ data: { name: 'Test Team' } })

    // Create a dummy github zip buffer (nested structure)
    const zip = new AdmZip()
    const rootDir = 'repo-main'
    zip.addFile(`${rootDir}/`, Buffer.from(''))
    zip.addFile(`${rootDir}/skills/`, Buffer.from(''))
    zip.addFile(
      `${rootDir}/skills/pptx-generator/SKILL.md`,
      Buffer.from('---\nname: "PPTX Generator"\ndescription: "Generate powerpoint files."\n---'),
    )
    zip.addFile(`${rootDir}/skills/pptx-generator/index.ts`, Buffer.from('console.log("hello")'))
    // Add some noise
    zip.addFile(`${rootDir}/README.md`, Buffer.from('root readme'))
    const zipBuffer = zip.toBuffer()

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => zipBuffer.buffer,
    } as Response)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const putObjectSpy = vi.spyOn(s3Service, 'putObject').mockResolvedValue(undefined as any)

    const skill = await skillService.upsertSkill(team.id, {
      githubUrl: 'https://github.com/owner/repo/tree/main/skills/pptx-generator',
    })

    expect(skill.name).toBe('PPTX Generator')
    expect(skill.description).toBe('Generate powerpoint files.')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://codeload.github.com/owner/repo/zip/refs/heads/main',
    )

    // Verify repacking
    expect(putObjectSpy).toHaveBeenCalled()
    const repackedBuffer = putObjectSpy.mock.calls[0][2] as Buffer
    const repackedZip = new AdmZip(repackedBuffer)
    const entries = repackedZip.getEntries().map((e) => e.entryName)
    expect(entries).toContain('SKILL.md')
    expect(entries).toContain('index.ts')

    fetchSpy.mockRestore()
    putObjectSpy.mockRestore()
  })

  it('should upsert skill from github url using "blob" marker', async () => {
    const team = await prisma.team.create({ data: { name: 'Test Team' } })

    const zip = new AdmZip()
    const rootDir = 'repo-main'
    zip.addFile(
      `${rootDir}/SKILL.md`,
      Buffer.from('---\nname: "Blob Skill"\ndescription: "From blob URL."\n---'),
    )
    const zipBuffer = zip.toBuffer()

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => zipBuffer.buffer,
    } as Response)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const putObjectSpy = vi.spyOn(s3Service, 'putObject').mockResolvedValue(undefined as any)

    const skill = await skillService.upsertSkill(team.id, {
      githubUrl: 'https://github.com/owner/repo/blob/main/SKILL.md',
    })

    expect(skill.name).toBe('Blob Skill')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://codeload.github.com/owner/repo/zip/refs/heads/main',
    )

    fetchSpy.mockRestore()
    putObjectSpy.mockRestore()
  })

  it('should upsert skill from github url using direct path (no tree/blob)', async () => {
    const team = await prisma.team.create({ data: { name: 'Test Team' } })

    const zip = new AdmZip()
    const rootDir = 'repo-main'
    zip.addFile(
      `${rootDir}/my-path/SKILL.md`,
      Buffer.from('---\nname: "Direct Skill"\ndescription: "From direct path."\n---'),
    )
    const zipBuffer = zip.toBuffer()

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => zipBuffer.buffer,
    } as Response)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const putObjectSpy = vi.spyOn(s3Service, 'putObject').mockResolvedValue(undefined as any)

    const skill = await skillService.upsertSkill(team.id, {
      githubUrl: 'https://github.com/owner/repo/my-path',
    })

    expect(skill.name).toBe('Direct Skill')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://codeload.github.com/owner/repo/zip/refs/heads/main',
    )

    fetchSpy.mockRestore()
    putObjectSpy.mockRestore()
  })

  it('should delete skill', async () => {
    const team = await prisma.team.create({ data: { name: 'Test Team' } })
    const skill = await prisma.skill.create({
      data: {
        name: 'Delete Me',
        assetId: 'asset1',
        hash: 'hash1',
        teamId: team.id,
      },
    })

    await skillService.deleteSkill(skill.id)
    const dbSkill = await prisma.skill.findUnique({
      where: { id: skill.id },
    })
    expect(dbSkill).toBeNull()
  })

  it('should update skill config', async () => {
    const team = await prisma.team.create({ data: { name: 'Test Team' } })
    const skill = await prisma.skill.create({
      data: {
        name: 'Config Skill',
        assetId: 'asset1',
        hash: 'hash1',
        teamId: team.id,
      },
    })

    const newConfig = {
      environmentVariables: [{ name: 'MY_VAR', default: 'my_val' }],
    }
    const updatedSkill = await skillService.updateSkillConfig(skill.id, newConfig)

    expect(updatedSkill.config).toEqual(newConfig)
    const dbSkill = await prisma.skill.findUnique({
      where: { id: skill.id },
    })
    expect(dbSkill?.config).toEqual(newConfig)
  })
})
