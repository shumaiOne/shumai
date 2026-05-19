import { prisma } from '@/db'
import { SkillInfo, UpsertSkillRequest } from '@/dtos/skill'
import { s3Service } from '@/services/s3/s3'
import { parseFrontmatter, SkillFrontmatter } from '@mariozechner/pi-coding-agent'
import AdmZip from 'adm-zip'
import * as crypto from 'crypto'
import { ulid } from 'ulid'

export class SkillService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  async upsertSkill(teamId: string, req: UpsertSkillRequest): Promise<SkillInfo> {
    let zipBuffer: Buffer
    let requestedPath: string | undefined

    if (req.githubUrl) {
      const { downloadUrl, path } = this.parseGithubUrl(req.githubUrl)
      requestedPath = path
      zipBuffer = await this.downloadGithubZip(downloadUrl)
    } else if (req.assetId) {
      const asset = await this.prismaClient.asset.findUnique({
        where: { id: req.assetId },
      })
      if (!asset || !asset.key) throw new Error('Asset not found or has no key')
      const { buffer } = await s3Service.getObject(process.env.S3_BUCKET || 'shumai', asset.key)
      zipBuffer = buffer
    } else {
      throw new Error('Either assetId or githubUrl must be provided')
    }

    const { name, description, repackedZip } = await this.processSkillZip(zipBuffer, requestedPath)

    // Check for existing skill if override is not requested
    const existingSkill = await this.prismaClient.skill.findUnique({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        teamId_name: {
          teamId,
          name,
        },
      },
    })

    if (existingSkill && !req.override) {
      const err = new Error(`Skill with name "${name}" already exists.`)
      err.name = 'ConflictError'
      throw err
    }

    const hash = crypto.createHash('sha256').update(repackedZip).digest('hex')

    // Upload repacked zip to S3
    const assetKey = `skills/${ulid()}.zip`
    await s3Service.putObject(
      process.env.S3_BUCKET || 'shumai',
      assetKey,
      repackedZip,
      repackedZip.length,
      'application/zip',
    )

    // Create a new asset record for the repacked zip
    const skillAsset = await this.prismaClient.asset.create({
      data: {
        name: `${name}.zip`,
        key: assetKey,
        type: 'file',
        mediaType: 'application/zip',
        sizeByte: repackedZip.length,
        status: 'uploaded',
      },
    })

    const skill = await this.prismaClient.skill.upsert({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        teamId_name: {
          teamId,
          name,
        },
      },
      update: {
        description,
        assetId: skillAsset.id,
        hash,
      },
      create: {
        name,
        description,
        assetId: skillAsset.id,
        hash,
        teamId,
      },
    })

    return this.toSkillInfo(skill)
  }

  async deleteSkill(id: string): Promise<void> {
    const skill = await this.prismaClient.skill.findUnique({
      where: { id },
    })
    if (!skill) return

    await this.prismaClient.skill.delete({
      where: { id },
    })

    // Optionally delete the asset as well, though it might be shared or kept for history.
    // For now, let's keep it simple and just delete the DB record.
  }

  async updateSkillConfig(id: string, config: PrismaJson.SkillConfig): Promise<SkillInfo> {
    const skill = await this.prismaClient.skill.update({
      where: { id },
      data: { config },
    })
    return this.toSkillInfo(skill)
  }

  async listSkills(teamId: string): Promise<SkillInfo[]> {
    const skills = await this.prismaClient.skill.findMany({
      where: { teamId },
      orderBy: { id: 'desc' },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return skills.map((s: any) => this.toSkillInfo(s))
  }

  private parseGithubUrl(url: string): { downloadUrl: string; path?: string } {
    // Standard GitHub URL patterns:
    // 1. https://github.com/owner/repo/tree/branch/path
    // 2. https://github.com/owner/repo/blob/branch/path
    // 3. https://github.com/owner/repo/path (direct path, main branch)

    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)

    if (parts.length < 2) {
      throw new Error('Invalid GitHub URL: missing owner or repo')
    }

    const owner = parts[0]
    const repo = parts[1]
    let ref = 'main'
    let path: string | undefined

    if (parts.length > 2) {
      if (parts[2] === 'tree' || parts[2] === 'blob') {
        if (parts.length < 4) {
          throw new Error('Invalid GitHub URL: missing ref or path')
        }
        ref = parts[3]
        path = parts.slice(4).join('/')
      } else {
        // Fallback: assume everything after repo is the path on 'main'
        path = parts.slice(2).join('/')
      }
    }

    const downloadUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${ref}`

    return { downloadUrl, path }
  }

  private async downloadGithubZip(url: string): Promise<Buffer> {
    const res = await fetch(url)
    if (!res.ok) {
      // Try 'master' if 'main' fails and it was a default guess
      if (url.endsWith('/refs/heads/main')) {
        const fallbackUrl = url.replace('/refs/heads/main', '/refs/heads/master')
        const fallbackRes = await fetch(fallbackUrl)
        if (fallbackRes.ok) {
          return Buffer.from(await fallbackRes.arrayBuffer())
        }
      }
      throw new Error(`Failed to download GitHub ZIP from ${url}`)
    }
    return Buffer.from(await res.arrayBuffer())
  }

  private async processSkillZip(
    buffer: Buffer,
    requestedPath?: string,
  ): Promise<{
    name: string
    description: string
    repackedZip: Buffer
  }> {
    const zip = new AdmZip(buffer)
    const entries = zip.getEntries()

    if (entries.length === 0) {
      throw new Error('The provided ZIP file is empty')
    }

    // Extract search path from entries
    const firstEntryName = entries[0].entryName
    const firstPart = firstEntryName.split('/')[0]
    const isGithubStructure = entries.every((e) => e.entryName.startsWith(`${firstPart}/`))

    let effectiveRequestedPath = requestedPath || ''
    if (effectiveRequestedPath.toLowerCase().endsWith('skill.md')) {
      effectiveRequestedPath = effectiveRequestedPath.substring(
        0,
        effectiveRequestedPath.toLowerCase().lastIndexOf('skill.md'),
      )
    }

    let searchPath = ''
    if (isGithubStructure) {
      searchPath = effectiveRequestedPath
        ? `${firstPart}/${effectiveRequestedPath.replace(/\/$/, '')}/`
        : `${firstPart}/`
    } else {
      searchPath = effectiveRequestedPath ? `${effectiveRequestedPath.replace(/\/$/, '')}/` : ''
    }

    // Find SKILL.md in the searchPath (case-insensitive)
    const skillMdEntry = entries.find((e) => {
      const entryLower = e.entryName.toLowerCase()
      const searchLower = searchPath.toLowerCase()
      return entryLower.startsWith(searchLower) && entryLower.endsWith('skill.md')
    })

    if (!skillMdEntry) {
      throw new Error(`SKILL.md not found in ${requestedPath || 'root'}`)
    }

    const content = skillMdEntry.getData().toString('utf8')
    const { name, description } = this.parseSkillMd(content)

    // Repack: ensure the found SKILL.md's directory becomes the root
    const newZip = new AdmZip()
    const prefix = skillMdEntry.entryName.substring(
      0,
      skillMdEntry.entryName.toLowerCase().lastIndexOf('skill.md'),
    )

    for (const entry of entries) {
      if (entry.isDirectory) continue
      if (entry.entryName.startsWith(prefix)) {
        const relPath = entry.entryName.substring(prefix.length)
        newZip.addFile(relPath, entry.getData())
      }
    }

    return {
      name,
      description,
      repackedZip: newZip.toBuffer(),
    }
  }

  private parseSkillMd(content: string): { name: string; description: string } {
    const { frontmatter } = parseFrontmatter<SkillFrontmatter>(content)
    const name = frontmatter.name || 'Unnamed Skill'
    const description = frontmatter.description || ''

    return { name, description }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toSkillInfo(s: any): SkillInfo {
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      config: s.config as PrismaJson.SkillConfig,
      assetId: s.assetId,
      hash: s.hash,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }
  }
}

export const skillService = new SkillService()
