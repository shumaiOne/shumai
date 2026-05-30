import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { executeAgentToolWorkflow } from './utils'

const createVersionSchema = Type.Object({
  parent: Type.String({
    description:
      'The parent file ID for which to create a new version. This parameter is required.',
  }),
  path: Type.String({
    description:
      'The absolute or relative local path to the file on disk. This parameter is required.',
  }),
})

export function createCreateVersionTool(userId: string): AgentTool<typeof createVersionSchema> {
  return {
    name: 'create_version',
    label: 'Create Version',
    description: 'Create a new version of an existing file from a local file path.',
    parameters: createVersionSchema,
    execute: async (_toolCallId, params) => {
      try {
        const result = await executeAgentToolWorkflow({
          toolName: 'create_version',
          args: params,
          userId,
          assetId: params.parent,
        })
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          details: result,
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating file version: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {},
        }
      }
    },
  }
}
