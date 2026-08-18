import { prisma } from '@shumai/db'
import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { agentService } from '@shumai/core/src/agent/agent'
import { resolveEffectiveRole } from '@shumai/core/src/authz/authz'

const readSkillSchema = Type.Object({
  skillId: Type.String({ description: 'The ID of the skill to read' }),
})

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 3,
  editor: 2,
  reviewer: 1,
}

export const createReadSkillTool = (
  userId: string | undefined,
  onEnvsAdded: (envs: Record<string, string>) => void,
  onSkillLoaded?: () => Promise<void> | void,
  enabledSkillIds?: string[],
  projectId?: string,
): AgentTool<typeof readSkillSchema, { skillId: string }> => ({
  name: 'read_skill',
  label: 'Read Agent Skill',
  description: 'Downloads and reads an agent skill to understand how to use it.',
  parameters: readSkillSchema,
  execute: async (_toolCallId, params) => {
    const skill = await prisma.skill.findUnique({
      where: { id: params.skillId },
    })

    if (!skill) {
      throw new Error(`Skill with ID ${params.skillId} not found.`)
    }

    // Skills disabled for this agent must not be loadable, even if the model
    // somehow knows their ID (e.g. from earlier conversation history).
    if (enabledSkillIds && !enabledSkillIds.includes(params.skillId)) {
      throw new Error(`Skill with ID ${params.skillId} is not enabled for this agent.`)
    }

    const requiredLevel = ROLE_HIERARCHY[skill.permission] || 1
    const effectiveRole = userId
      ? await resolveEffectiveRole(skill.teamId, projectId, userId)
      : null

    if (userId) {
      // Resolve the user's effective role for the project context (project
      // override wins; project-scoped members without project access are denied).
      const userLevel = effectiveRole ? ROLE_HIERARCHY[effectiveRole] || 0 : 0
      if (userLevel < requiredLevel) {
        throw new Error(
          `Permission denied: Insufficient role to load skill "${skill.name}". Minimum required role is "${skill.permission}".`,
        )
      }
    } else if (requiredLevel > 1) {
      throw new Error(
        `Permission denied: User context required to load skill "${skill.name}". Minimum required role is "${skill.permission}".`,
      )
    }

    // Capture environment variables using agentService
    const envs = await agentService.getSkillEnvs(params.skillId)
    onEnvsAdded(envs)

    // Retrieve skill content using agentService
    const skillMdContent = await agentService.getSkillContent(params.skillId)

    // Notify that a skill was successfully loaded (e.g. to enable restricted tools)
    await onSkillLoaded?.()

    return {
      content: [{ type: 'text', text: skillMdContent }],
      details: { skillId: params.skillId },
    }
  },
})
