import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { executeAgentToolWorkflow } from './utils'

const createFileSchema = Type.Object({
  parent: Type.String({
    description: 'The parent folder ID under which to create the file. This parameter is required.',
  }),
  path: Type.String({
    description:
      'The absolute or relative local path to the file on disk. This parameter is required.',
  }),
})

export function createCreateFileTool(userId: string): AgentTool<typeof createFileSchema> {
  return {
    name: 'create_file',
    label: 'Create File',
    description: 'Create a new file in a specified parent folder from a local file path.',
    parameters: createFileSchema,
    execute: async (_toolCallId, params) => {
      try {
        const result = await executeAgentToolWorkflow({
          toolName: 'create_file',
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
              text: `Error creating file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {},
        }
      }
    },
  }
}
