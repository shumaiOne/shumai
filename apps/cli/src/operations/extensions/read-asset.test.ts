import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import type { AssetReadOutput } from '@shumai/operations'
import { CliError } from '../errors'
import { downloadImages, imageFileName, readAssetExtension } from './read-asset'

const output: AssetReadOutput = {
  status: 'ready',
  summary: 'Rendered 2 page(s) of "deck.pdf" (Pages 1 to 2):',
  asset: { id: 'doc-1', name: 'deck.pdf', kind: 'document', mediaType: 'application/pdf' },
  details: [],
  images: [
    { label: 'Page 1', mimeType: 'image/webp', url: 'https://files.example/p1' },
    { label: 'Page 2', mimeType: 'image/png', url: 'https://files.example/p2' },
  ],
}

describe('read / render CLI extension', () => {
  let dir: string
  let written: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'shumai-cli-read-'))
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

  it('names files after the asset, position, and label', () => {
    expect(imageFileName('vid-1', 0, { label: 'Frame at 2.5s', mimeType: 'image/webp' })).toBe(
      'vid-1-1-frame-at-2.5s.webp',
    )
    expect(imageFileName('m-1', 3, { label: 'View at 90°', mimeType: 'image/jpeg' })).toBe(
      'm-1-4-view-at-90.jpg',
    )
  })

  it('downloads every image with --out and prints the saved paths', async () => {
    const out = path.join(dir, 'pages')
    await readAssetExtension.present(output, { opts: { out }, json: false, output: o() })

    const first = path.join(out, 'doc-1-1-page-1.webp')
    const second = path.join(out, 'doc-1-2-page-2.png')
    expect(await readFile(first, 'utf8')).toBe('bytes of https://files.example/p1')
    expect(await readFile(second, 'utf8')).toBe('bytes of https://files.example/p2')
    expect(written).toBe(`${output.summary}\n- Page 1: ${first}\n- Page 2: ${second}\n`)
  })

  it('adds the saved path to each image in --json mode', async () => {
    await readAssetExtension.present(output, { opts: { out: dir }, json: true, output: o() })

    const printed = JSON.parse(written) as { images: Array<{ path: string }> }
    expect(printed.images.map((i) => i.path)).toEqual([
      path.join(dir, 'doc-1-1-page-1.webp'),
      path.join(dir, 'doc-1-2-page-2.png'),
    ])
  })

  it('fails clearly when a download fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('gone', { status: 403 })),
    )
    await expect(downloadImages(output, dir)).rejects.toThrow(
      new CliError('Failed to download "Page 1" (status 403).'),
    )
  })

  it('does not download anything for a pending render', async () => {
    await readAssetExtension.present(
      { ...output, status: 'pending', images: [], taskId: 't-1', retryAfterSeconds: 5 },
      { opts: { out: dir }, json: false, output: o() },
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(written).toContain(`shumai-cli render t-1 --out ${JSON.stringify(dir)}`)
  })

  it('maps --no-wait to maxWaitSeconds 0', () => {
    expect(readAssetExtension.toInput!({ assetId: 'a' }, { wait: false })).toEqual({
      assetId: 'a',
      maxWaitSeconds: 0,
    })
    expect(readAssetExtension.toInput!({ assetId: 'a' }, { wait: true })).toEqual({
      assetId: 'a',
    })
  })
})
