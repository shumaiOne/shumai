import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createListAutofillFieldsTool } from './list-autofill-fields'
import { executeAgentToolWorkflow } from './utils'

vi.mock('./utils', () => ({
  executeAgentToolWorkflow: vi.fn().mockResolvedValue({
    fields: [{ id: 'source', name: 'Source', type: 'select', options: [] }],
  }),
}))

describe('createListAutofillFieldsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should list autofill fields for the parent folder via the agent tool workflow', async () => {
    const tool = createListAutofillFieldsTool('user-1')
    const result = await tool.execute('call-1', { parent: 'folder-1' })

    expect(executeAgentToolWorkflow).toHaveBeenCalledWith({
      toolName: 'list_autofill_fields',
      args: { parent: 'folder-1' },
      userId: 'user-1',
      assetId: 'folder-1',
    })

    expect(result.details).toEqual({
      fields: [{ id: 'source', name: 'Source', type: 'select', options: [] }],
    })
  })
})
