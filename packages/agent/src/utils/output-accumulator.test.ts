import { describe, expect, it } from 'vitest'
import { OutputAccumulator } from './output-accumulator'

describe('OutputAccumulator', () => {
  it('does not accumulate rawChunks in memory when disableTempFile is true', () => {
    const acc = new OutputAccumulator({
      maxBytes: 1024,
      maxLines: 50,
      disableTempFile: true,
    })

    const chunk = Buffer.from(`${'x'.repeat(2047)}\n`, 'utf-8')
    for (let i = 0; i < 256; i++) {
      acc.append(chunk)
    }
    acc.finish()

    const internal = acc as unknown as { rawChunks: Buffer[]; tailBytes: number }
    expect(internal.rawChunks).toEqual([])
    expect(internal.tailBytes).toBeLessThanOrEqual(1024 * 4)

    const snapshot = acc.snapshot({ persistIfTruncated: false })
    expect(snapshot.truncation.truncated).toBe(true)
    expect(snapshot.fullOutputPath).toBeUndefined()
    expect(Buffer.byteLength(snapshot.content, 'utf-8')).toBeLessThanOrEqual(1024)
  })
})
