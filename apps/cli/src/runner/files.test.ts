import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import yauzl from 'yauzl'
import { RunnerFiles } from './files'

describe('runner workspace file transfers', () => {
  let cwd: string
  let files: RunnerFiles
  let server: Server
  let url: string
  let body: Buffer
  let uploaded: Buffer
  beforeEach(async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'shumai-files-test-'))
    files = new RunnerFiles(cwd)
    body = Buffer.from('download contents')
    uploaded = Buffer.alloc(0)
    server = createServer(async (request, response) => {
      if (request.method === 'PUT') {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        uploaded = Buffer.concat(chunks)
        response.end()
      } else if (request.url === '/slow') {
        const timer = setInterval(() => response.write(Buffer.alloc(65536)), 20)
        response.once('close', () => clearInterval(timer))
      } else if (request.url === '/redirect') {
        response.writeHead(302, { location: '/file' })
        response.end()
      } else response.end(body)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing test HTTP address')
    url = `http://127.0.0.1:${address.port}`
  })
  afterEach(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(cwd, { recursive: true, force: true })
  })

  const signal = () => new AbortController().signal

  it('downloads, checks SHA-256, stats and uploads actual bytes', async () => {
    expect(
      await files.handle(
        {
          type: 'file.download',
          executionId: 'download',
          url,
          destPath: '.pi/input/data.bin',
          expectedHash: createHash('sha256').update(body).digest('hex'),
        },
        signal(),
      ),
    ).toMatchObject({ ok: true, size: body.length })
    expect(await readFile(path.join(cwd, '.pi/input/data.bin'))).toEqual(body)
    expect(
      await files.handle(
        { type: 'file.stat', executionId: 'stat', srcPath: '.pi/input/data.bin' },
        signal(),
      ),
    ).toMatchObject({ ok: true, exists: true, isFile: true, size: body.length })
    expect(
      await files.handle(
        { type: 'file.upload', executionId: 'upload', srcPath: '.pi/input/data.bin', url },
        signal(),
      ),
    ).toMatchObject({ ok: true, size: body.length, name: 'data.bin' })
    expect(uploaded).toEqual(body)
    expect(
      await files.handle(
        { type: 'file.stat', executionId: 'absent', srcPath: '.pi/absent' },
        signal(),
      ),
    ).toMatchObject({ ok: true, exists: false })
  })

  it('does not publish mismatched downloads or follow redirects', async () => {
    expect(
      await files.handle(
        {
          type: 'file.download',
          executionId: 'bad-hash',
          url,
          destPath: '.pi/data',
          expectedHash: 'bad',
        },
        signal(),
      ),
    ).toMatchObject({ ok: false, error: 'Downloaded file hash does not match.' })
    await expect(readFile(path.join(cwd, '.pi/data'))).rejects.toThrow()
    expect(
      await files.handle(
        {
          type: 'file.download',
          executionId: 'redirect',
          url: `${url}/redirect`,
          destPath: '.pi/data',
        },
        signal(),
      ),
    ).toHaveProperty('ok', false)
  })

  it.each([
    '../secret',
    '/etc/passwd',
    '.pi/../secret',
    '.pi/dir/../../secret',
    '.pi\\secret',
    '.pi//file',
    '.pi/a:b',
    '.pi/a\0b',
    '.pi/.. /outside',
    '.pi/folder./file',
    '.pi/CON.txt',
    '.pi/nul .txt',
    '.pi/COM1',
    '.pi/lpt¹.log',
    '.pi/CONOUT$',
  ])('rejects unsafe protocol path %s', async (srcPath) => {
    expect(
      await files.handle({ type: 'file.stat', executionId: 'unsafe', srcPath }, signal()),
    ).toHaveProperty('ok', false)
  })

  it('rejects parent and final symlinks, including a replaced .pi root', async () => {
    await mkdir(path.join(cwd, '.pi'))
    await writeFile(path.join(cwd, 'secret'), 'secret')
    await symlink(cwd, path.join(cwd, '.pi/escape'))
    await symlink(path.join(cwd, 'secret'), path.join(cwd, '.pi/link'))
    for (const srcPath of ['.pi/escape/secret', '.pi/link']) {
      expect(
        await files.handle({ type: 'file.upload', executionId: 'symlink', srcPath, url }, signal()),
      ).toHaveProperty('ok', false)
    }
    await rm(path.join(cwd, '.pi'), { recursive: true })
    await symlink(cwd, path.join(cwd, '.pi'))
    expect(
      await files.handle(
        { type: 'file.download', executionId: 'root', destPath: '.pi/file', url },
        signal(),
      ),
    ).toHaveProperty('ok', false)
  })

  it('extracts skills and safely replaces old contents', async () => {
    const zip = new AdmZip()
    zip.addFile('SKILL.md', Buffer.from('# Test skill'))
    zip.addFile('scripts/run.sh', Buffer.from('echo skill'))
    body = zip.toBuffer()
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(
        await files.handle(
          {
            type: 'file.download',
            executionId: `zip-${attempt}`,
            url,
            destPath: '.pi/skills/test',
            extractZip: true,
          },
          signal(),
        ),
      ).toHaveProperty('ok', true)
    }
    expect(await readFile(path.join(cwd, '.pi/skills/test/SKILL.md'), 'utf8')).toBe('# Test skill')
  })

  it('rejects symlink ZIP entries and zip-slip paths without publishing them', async () => {
    const zip = new AdmZip()
    zip.addFile('link', Buffer.from('/etc/passwd'))
    const entry = zip.getEntry('link')!
    entry.header.attr = (0o120777 << 16) >>> 0
    body = zip.toBuffer()
    expect(
      await files.handle(
        {
          type: 'file.download',
          executionId: 'zip-link',
          url,
          destPath: '.pi/skills/bad',
          extractZip: true,
        },
        signal(),
      ),
    ).toHaveProperty('ok', false)
    const normal = new AdmZip()
    normal.addFile('aa/secret', Buffer.from('escape'))
    body = Buffer.from(
      normal.toBuffer().toString('latin1').replaceAll('aa/secret', '../secret'),
      'latin1',
    )
    expect(
      await files.handle(
        {
          type: 'file.download',
          executionId: 'zip-slip',
          url,
          destPath: '.pi/skills/bad',
          extractZip: true,
        },
        signal(),
      ),
    ).toHaveProperty('ok', false)
    await expect(readFile(path.join(cwd, '.pi/skills/bad/link'))).rejects.toThrow()
  })

  it('preserves executable script permissions and rejects oversized ZIP entries', async () => {
    const zip = new AdmZip()
    zip.addFile('run.sh', Buffer.from('#!/bin/sh\necho executable\n'))
    zip.getEntry('run.sh')!.header.attr = (0o100755 << 16) >>> 0
    body = zip.toBuffer()
    expect(
      await files.handle(
        {
          type: 'file.download',
          executionId: 'exec-zip',
          url,
          destPath: '.pi/skills/executable',
          extractZip: true,
        },
        signal(),
      ),
    ).toHaveProperty('ok', true)
    expect((await stat(path.join(cwd, '.pi/skills/executable/run.sh'))).mode & 0o7777).toBe(0o755)
    const central = body.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
    body.writeUInt32LE(256 * 1024 * 1024 + 1, central + 24)
    expect(
      await files.handle(
        {
          type: 'file.download',
          executionId: 'large-zip',
          url,
          destPath: '.pi/skills/large',
          extractZip: true,
        },
        signal(),
      ),
    ).toMatchObject({ ok: false, error: 'Extracted ZIP exceeds 256 MiB.' })
  })

  it('cancels a streaming download without publishing partial bytes or leaving staging files', async () => {
    await mkdir(path.join(cwd, '.pi/input'), { recursive: true })
    await writeFile(path.join(cwd, '.pi/input/data'), 'original')
    const controller = new AbortController()
    const transfer = files.handle(
      {
        type: 'file.download',
        executionId: 'stream-cancel',
        url: `${url}/slow`,
        destPath: '.pi/input/data',
      },
      controller.signal,
    )
    await vi.waitFor(async () =>
      expect(
        (await readdir(path.join(cwd, '.pi/input'))).some((name) => name.startsWith('.shumai-')),
      ).toBe(true),
    )
    controller.abort()
    expect(await transfer).toHaveProperty('ok', false)
    expect(await readFile(path.join(cwd, '.pi/input/data'), 'utf8')).toBe('original')
    expect(await readdir(path.join(cwd, '.pi/input'))).toEqual(['data'])
  })

  it('cancels extraction without deleting the installed skill or leaving staging trees', async () => {
    await mkdir(path.join(cwd, '.pi/skills/installed'), { recursive: true })
    await writeFile(path.join(cwd, '.pi/skills/installed/SKILL.md'), 'original')
    const zip = new AdmZip()
    for (let index = 0; index < 2000; index++)
      zip.addFile(`file-${index}.txt`, Buffer.alloc(32768, 65))
    body = zip.toBuffer()
    const controller = new AbortController()
    const transfer = files.handle(
      {
        type: 'file.download',
        executionId: 'extract-cancel',
        url,
        destPath: '.pi/skills/installed',
        extractZip: true,
      },
      controller.signal,
    )
    await vi.waitFor(
      async () => {
        const temporary = (await readdir(path.join(cwd, '.pi/skills'))).find((name) =>
          name.startsWith('.shumai-'),
        )
        expect(temporary).toBeDefined()
        expect(
          (await readdir(path.join(cwd, '.pi/skills', temporary!, 'extracted'))).length,
        ).toBeGreaterThan(0)
      },
      { interval: 5, timeout: 5000 },
    )
    controller.abort()
    expect(await transfer).toHaveProperty('ok', false)
    expect(await readFile(path.join(cwd, '.pi/skills/installed/SKILL.md'), 'utf8')).toBe('original')
    expect(await readdir(path.join(cwd, '.pi/skills'))).toEqual(['installed'])
  }, 10000)

  it('waits for an in-flight ZIP entry read before closing on cancellation', async () => {
    const zip = new AdmZip()
    zip.addFile('SKILL.md', Buffer.from('skill'))
    body = zip.toBuffer()
    const controller = new AbortController()
    const pendingRead = Promise.withResolvers<() => void>()
    const readEntry = yauzl.ZipFile.prototype.readEntry
    const read = vi.spyOn(yauzl.ZipFile.prototype, 'readEntry').mockImplementationOnce(function (
      this: yauzl.ZipFile,
    ) {
      pendingRead.resolve(() => readEntry.call(this))
    })
    const close = vi.spyOn(yauzl.ZipFile.prototype, 'close')
    try {
      const transfer = files.handle(
        {
          type: 'file.download',
          executionId: 'zip-entry-cancel',
          url,
          destPath: '.pi/skills/new',
          extractZip: true,
        },
        controller.signal,
      )
      const finishRead = await pendingRead.promise
      controller.abort()
      await new Promise<void>((resolve) => setImmediate(resolve))
      const closedDuringRead = close.mock.calls.length > 0
      if (!closedDuringRead) finishRead()
      expect(await transfer).toHaveProperty('ok', false)
      expect(closedDuringRead).toBe(false)
      expect(await readdir(path.join(cwd, '.pi/skills'))).toEqual([])
    } finally {
      read.mockRestore()
      close.mockRestore()
    }
  })

  it('handles cancelled transfers and refuses uploads of directories', async () => {
    const controller = new AbortController()
    controller.abort()
    expect(
      await files.handle(
        { type: 'file.download', executionId: 'cancelled', url, destPath: '.pi/data' },
        controller.signal,
      ),
    ).toHaveProperty('ok', false)
    expect(
      await files.handle(
        { type: 'file.upload', executionId: 'directory', url, srcPath: '.pi/transfers' },
        signal(),
      ),
    ).toHaveProperty('ok', false)
    expect(uploaded).toHaveLength(0)
  })
})
