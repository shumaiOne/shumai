import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import type { DownloadAssetOutput } from '@shumai/operations'
import { CliError } from '../errors'
import { downloadAssetExtension, safeFileName, uniquePath } from './download-asset'

const output: DownloadAssetOutput = {
  files: [
    {
      assetId: 'a-1',
      name: 'clip.mp4',
      kind: 'proxy',
      size: 2048,
      mimeType: 'video/mp4',
      url: 'https://files.example/a-1',
    },
    {
      assetId: 'a-2',
      name: 'clip.mp4',
      kind: 'original',
      size: 10,
      mimeType: 'video/mp4',
      url: 'https://files.example/a-2',
    },
  ],
}

describe('download CLI extension', () => {
  let dir: string
  let written: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'shumai-cli-download-'))
    written = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => new Response(`bytes of ${url}`, { status: 200 })),
    )
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await rm(dir, { recursive: true, force: true })
  })

  const o = () => ({ out: { write: (s: string) => void (written += s) }, isTty: true, columns: 80 })

  it('saves every file, numbering names that are already taken', async () => {
    await writeFile(path.join(dir, 'clip.mp4'), 'existing')

    await downloadAssetExtension.present(output, { opts: { out: dir }, json: false, output: o() })

    expect((await readdir(dir)).sort()).toEqual(['clip (2).mp4', 'clip (3).mp4', 'clip.mp4'])
    expect(await readFile(path.join(dir, 'clip.mp4'), 'utf8')).toBe('existing')
    expect(await readFile(path.join(dir, 'clip (2).mp4'), 'utf8')).toBe(
      'bytes of https://files.example/a-1',
    )
    expect(written).toBe(
      `Saved ${path.join(dir, 'clip (2).mp4')} (2 KB, proxy)\nSaved ${path.join(dir, 'clip (3).mp4')} (10 B, original)\n`,
    )
  })

  it('creates the folder and prints JSON with the saved paths', async () => {
    const out = path.join(dir, 'nested', 'files')
    await downloadAssetExtension.present(output, { opts: { out }, json: true, output: o() })

    const printed = JSON.parse(written) as { files: Array<{ path: string; url: string }> }
    expect(printed.files.map((f) => f.path)).toEqual([
      path.join(out, 'clip.mp4'),
      path.join(out, 'clip (2).mp4'),
    ])
    expect(printed.files[0].url).toBe('https://files.example/a-1')
  })

  it('fails clearly when a download fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('gone', { status: 403 })),
    )
    await expect(
      downloadAssetExtension.present(output, { opts: { out: dir }, json: false, output: o() }),
    ).rejects.toThrow(new CliError('Failed to download "clip.mp4" (status 403).'))
  })

  it('keeps file names inside the target folder', () => {
    expect(safeFileName('../../etc/passwd')).toBe('_.._etc_passwd')
    expect(safeFileName('a\\b.txt')).toBe('a_b.txt')
    expect(safeFileName('...')).toBe('file')
    const taken = new Set<string>()
    expect(uniquePath(dir, 'notes', taken)).toBe(path.join(dir, 'notes'))
    expect(uniquePath(dir, 'notes', taken)).toBe(path.join(dir, 'notes (2)'))
  })

  it('maps --original to proxy false', () => {
    expect(downloadAssetExtension.toInput!({ assetIds: ['a'] }, { original: true })).toEqual({
      assetIds: ['a'],
      proxy: false,
    })
    expect(downloadAssetExtension.toInput!({ assetIds: ['a'] }, {})).toEqual({ assetIds: ['a'] })
  })
})
