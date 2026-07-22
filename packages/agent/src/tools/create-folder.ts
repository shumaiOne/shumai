import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { executeAgentToolWorkflow } from './utils'

const createFolderSchema = Type.Object({
  parent: Type.String({
    description:
      'The parent folder ID under which to create the new folder. This parameter is required.',
  }),
  name: Type.String({
    description: 'The name of the new folder to create. This parameter is required.',
  }),
})

export function createCreateFolderTool(userId: string): AgentTool<typeof createFolderSchema> {
  return {
    name: 'create_folder',
    label: 'Create Folder',
    description: 'Create a new folder in a specified parent folder.',
    parameters: createFolderSchema,
    execute: async (_toolCallId, params) => {
      const result = await executeAgentToolWorkflow({
        toolName: 'create_folder',
        args: params,
        userId,
        assetId: params.parent,
      })
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        details: result,
      }
    },
  }
}
