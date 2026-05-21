import { prisma } from '@/db'
import { s3Service } from '@/services/s3/s3'
import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import * as path from 'path'
import * as fs from 'fs'
import AdmZip from 'adm-zip'

const readSkillSchema = Type.Object({
  skillId: Type.String({ description: 'The ID of the skill to read' }),
})

export const createReadSkillTool = (
  onEnvsAdded: (envs: Record<string, string>) => void,
): AgentTool<typeof readSkillSchema, { skillId: string }> => ({
  name: 'read_skill',
  label: 'Read Agent Skill',
  description: 'Downloads and reads an agent skill to understand how to use it.',
  parameters: readSkillSchema,
  execute: async (_toolCallId, params) => {
    try {
      const skill = await prisma.skill.findUnique({
        where: { id: params.skillId },
      })

      if (!skill) {
        return {
          content: [{ type: 'text', text: `Skill with ID ${params.skillId} not found.` }],
          details: { skillId: params.skillId },
        }
      }

      // Capture environment variables if present in config
      const config = skill.config as unknown as PrismaJson.SkillConfig
      if (config?.environmentVariables && Array.isArray(config.environmentVariables)) {
        const envs: Record<string, string> = {}
        for (const envVar of config.environmentVariables) {
          const value =
            envVar.default !== undefined && envVar.default !== null && envVar.default !== ''
              ? envVar.default
              : process.env[envVar.name]
          if (value !== undefined) {
            envs[envVar.name] = value
          }
        }
        onEnvsAdded(envs)
      }

      const skillDir = path.join(process.cwd(), '.pi', 'skills', skill.id)
      const hashFile = path.join(skillDir, '.hash')
      let needsDownload = true

      if (fs.existsSync(hashFile)) {
        const localHash = fs.readFileSync(hashFile, 'utf8')
        if (localHash === skill.hash) {
          needsDownload = false
        }
      }

      if (needsDownload) {
        if (fs.existsSync(skillDir)) {
          fs.rmSync(skillDir, { recursive: true, force: true })
        }
        fs.mkdirSync(skillDir, { recursive: true })

        const asset = await prisma.asset.findUnique({
          where: { id: skill.assetId },
        })

        if (!asset || !asset.key) {
          throw new Error('Skill asset not found or has no key')
        }

        const { buffer: zipBuffer } = await s3Service.getObject(
          process.env.S3_BUCKET || 'shumai',
          asset.key,
        )

        const zip = new AdmZip(zipBuffer)
        zip.extractAllTo(skillDir, true)

        fs.writeFileSync(hashFile, skill.hash)
      }

      // Read SKILL.md
      let skillMdPath = path.join(skillDir, 'SKILL.md')
      if (!fs.existsSync(skillMdPath)) {
        skillMdPath = path.join(skillDir, 'skill.md')
      }

      if (!fs.existsSync(skillMdPath)) {
        return {
          content: [
            {
              type: 'text',
              text: `Skill downloaded but SKILL.md not found in ${skillDir}`,
            },
          ],
          details: { skillId: params.skillId },
        }
      }

      const skillMdContent = fs.readFileSync(skillMdPath, 'utf8')
      return {
        content: [{ type: 'text', text: skillMdContent }],
        details: { skillId: params.skillId },
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error reading skill ${params.skillId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        details: { skillId: params.skillId },
      }
    }
  },
})
