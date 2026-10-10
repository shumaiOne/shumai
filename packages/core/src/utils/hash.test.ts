import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { sha256OfFile, sha256OfStream } from './hash'

const HELLO_SHA256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

describe('sha256OfStream', () => {
  it('hashes a stream split into several chunks the same as one buffer', async () => {
    const stream = Readable.from([Buffer.from('he'), Buffer.from('l'), Buffer.from('lo')])
    expect(await sha256OfStream(stream)).toBe(HELLO_SHA256)
  })

  it('hashes an empty stream', async () => {
    expect(await sha256OfStream(Readable.from([]))).toBe(EMPTY_SHA256)
  })

  it('returns lowercase hex of 64 characters', async () => {
    const out = await sha256OfStream(Readable.from([Buffer.from('anything')]))
    expect(out).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('sha256OfFile', () => {
  it('streams a local file and matches the known digest', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hash-test-'))
    const file = path.join(dir, 'a.txt')
    fs.writeFileSync(file, 'hello')
    try {
      expect(await sha256OfFile(file)).toBe(HELLO_SHA256)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects when the file does not exist', async () => {
    await expect(sha256OfFile(path.join(os.tmpdir(), 'does-not-exist-xyz.bin'))).rejects.toThrow()
  })
})
