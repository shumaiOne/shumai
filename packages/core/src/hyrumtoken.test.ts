import { describe, expect, it } from 'vitest'
import { marshal, unmarshal } from './hyrumtoken'

const testkey = new Uint8Array([
  24, 12, 15, 90, 143, 133, 171, 28, 34, 75, 185, 194, 102, 93, 165, 183, 235, 96, 135, 135, 165, 1,
  129, 91, 32, 7, 139, 135, 130, 2, 241, 168,
])

describe('hyrumtoken', () => {
  it('encodes and decodes', () => {
    const data = { Foo: 'foo', Bar: 'bar' }
    const encoded = marshal(testkey, data)
    const out = unmarshal(testkey, encoded)
    expect(out).toEqual(data)
  })

  it('unmarshals empty string to null', () => {
    const out = unmarshal(testkey, '')
    expect(out).toBeNull()
  })

  it('unmarshals known string', () => {
    const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAULRUMRVA4GIqe5Y8N_z8B4J7hw'
    const out = unmarshal(testkey, token)
    expect(out).toBe(123)
  })
})
