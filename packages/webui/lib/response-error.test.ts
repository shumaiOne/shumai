import { describe, expect, it } from 'vitest'
import { responseErrorMessage } from './response-error'

const res = (body: string) => ({ text: async () => body })

describe('responseErrorMessage', () => {
  it('returns the plain-text body of an HTTPException such as the 413 message', async () => {
    const message =
      'Too large to upload (limit 20.0 GiB, set by MAX_REQUEST_BODY_SIZE): a.mov (25.0 GiB)'
    expect(await responseErrorMessage(res(message), 'Failed to create upload task')).toBe(message)
  })

  it('reads a JSON error or message field', async () => {
    expect(await responseErrorMessage(res('{"error":"No space"}'), 'x')).toBe('No space')
    expect(await responseErrorMessage(res('{"message":" Nope "}'), 'x')).toBe('Nope')
  })

  it('falls back for empty, HTML, unreadable or field-less bodies', async () => {
    expect(await responseErrorMessage(res(''), 'fallback')).toBe('fallback')
    expect(await responseErrorMessage(res('<html>502</html>'), 'fallback')).toBe('fallback')
    expect(await responseErrorMessage(res('{"ok":false}'), 'fallback')).toBe('fallback')
    expect(await responseErrorMessage(res('{broken'), 'fallback')).toBe('fallback')
    const broken = {
      text: async () => {
        throw new Error('stream closed')
      },
    }
    expect(await responseErrorMessage(broken, 'fallback')).toBe('fallback')
  })

  it('caps very long bodies', async () => {
    expect((await responseErrorMessage(res('a'.repeat(1000)), 'x')).length).toBe(300)
  })
})
