import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateToolArguments } from '@earendil-works/pi-ai'
import { createCreateFileTool } from './tools/create-file'
import { fieldsToTypeBoxSchema } from './index'
import { s3Service } from '@shumai/core/src/s3/s3'
import { executeAgentToolWorkflow } from './tools/utils'

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    uploadFileToKey: vi.fn(),
    putObject: vi.fn(),
  },
}))

vi.mock('./tools/utils', () => ({
  executeAgentToolWorkflow: vi.fn().mockResolvedValue({ id: 'file-1', name: 'test', type: 'file' }),
}))

/**
 * Reproduce: pi-ai <= 0.82.1 runs its lenient coercion on typebox v1 schemas and
 * converts `null` in a `[string, null]` union into `""` (see
 * coerceWithUnionSchema in @earendil-works/pi-ai/dist/utils/validation.js).
 *
 * When the agent calls create_file with `path: null, data: {...}`, the harness
 * validates first: the `null` path becomes `""`, so the tool's
 * assertExactlyOneSource believes BOTH path and data were provided and throws
 * "Provide exactly one of ..." even though the call is valid.
 *
 * Fixed upstream in pi-ai 0.84.0 (#7328): values that already match a union arm
 * are preserved before coercion. This test should pass once @earendil-works/pi-ai
 * is upgraded to >= 0.84.0.
 */
describe('reproduce null coercion in harness tool validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps path: null when data is provided (no false "exactly one" error)', async () => {
    const tool = createCreateFileTool('user-1')

    const validated = validateToolArguments(
      {
        name: 'create_file',
        description: '',
        parameters: tool.parameters,
      } as Parameters<typeof validateToolArguments>[0],
      {
        type: 'toolCall',
        id: 'call-1',
        name: 'create_file',
        arguments: {
          parent: '01KYKNP52YERGJ6Q4GTPF5FRQF',
          path: null,
          data: { name: 'random_text.txt', content: 'hello' },
        },
      } as Parameters<typeof validateToolArguments>[1],
    ) as { path?: unknown; data?: unknown }

    // The `null` path must survive validation untouched; coercion to "" makes
    // the tool think both path and data were provided.
    expect(validated.path).toBeNull()
    expect(validated.data).toEqual({ name: 'random_text.txt', content: 'hello' })

    // execute must accept the valid call (data-only) without throwing
    const result = await tool.execute('call-1', validated as never)
    expect(result.details).toEqual({ id: 'file-1', name: 'test', type: 'file' })
    expect(s3Service.putObject).toHaveBeenCalledTimes(1)
    expect(executeAgentToolWorkflow).toHaveBeenCalledTimes(1)
  })

  it('keeps null metadata values (the "unknown" sentinel) through validation', () => {
    const tool = createCreateFileTool(
      'user-1',
      fieldsToTypeBoxSchema([{ id: 'prompt', config: { name: 'Prompt', type: 'text' } }]),
    )
    const validated = validateToolArguments(
      {
        name: 'create_file',
        description: '',
        parameters: tool.parameters,
      } as Parameters<typeof validateToolArguments>[0],
      {
        type: 'toolCall',
        id: 'call-1',
        name: 'create_file',
        arguments: {
          parent: 'folder-1',
          path: null,
          data: { name: 'a.md', content: 'x' },
          metadata: { prompt: null },
        },
      } as Parameters<typeof validateToolArguments>[1],
    ) as { metadata?: Record<string, unknown> }

    expect(validated.metadata).toEqual({ prompt: null })
  })
})
