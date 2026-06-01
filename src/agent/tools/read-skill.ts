import { prisma } from '@shumai/db'
import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { agentService } from '@shumai/core/src/agent/agent'

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

      // Capture environment variables using agentService
      const envs = await agentService.getSkillEnvs(params.skillId)
      onEnvsAdded(envs)

      // Retrieve skill content using agentService
      const skillMdContent = await agentService.getSkillContent(params.skillId)

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
