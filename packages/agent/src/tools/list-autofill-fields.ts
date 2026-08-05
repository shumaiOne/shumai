import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { executeAgentToolWorkflow } from './utils'

const listAutofillFieldsSchema = Type.Object({
  parent: Type.String({
    description:
      'The parent folder ID whose project autofillable metadata fields to list. This parameter is required.',
  }),
})

export function createListAutofillFieldsTool(
  userId: string,
): AgentTool<typeof listAutofillFieldsSchema> {
  return {
    name: 'list_autofill_fields',
    label: 'List Autofill Fields',
    description:
      'List the AI-autofillable metadata fields defined for the project of a parent folder, including their types and available options. ' +
      'Use this before creating a file or version so you can pass relevant context (e.g. generation source) to create_file/create_version.',
    parameters: listAutofillFieldsSchema,
    execute: async (_toolCallId, params) => {
      const result = await executeAgentToolWorkflow({
        toolName: 'list_autofill_fields',
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
