import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { version } from '../package.json'
import { archiveName, assembleCliRelease, cliTargetNames, sha256 } from './build-cli'
import {
  cliReleaseFiles,
  parseChecksums,
  publishCliRelease,
  validateReleaseSource,
} from './publish-cli-release'

describe('CLI release publication', () => {
  let directory: string
  let manifest: string
  let assets: { name: string; digest: string }[]
  let draft: boolean | undefined
  let source = 'release-commit'
  const calls: string[][] = []
  const run = vi.fn((command: string, args: string[]): string => {
    calls.push([command, ...args])
    if (command === 'git') return args[1] === 'HEAD' ? source : 'release-commit'
    if (args[0] === 'api') {
      if (draft === undefined) throw new Error('gh: Not Found (HTTP 404)')
      return JSON.stringify({ draft, assets })
    }
    if (args[1] === 'create') draft = true
    if (args[1] === 'download') return manifest
    if (args.includes('--draft=false')) draft = false
    return ''
  })
  const context = () => ({
    tag: `v${version}`,
    repository: 'shumaiOne/shumai',
    outdir: directory,
    notes: join(directory, 'notes.md'),
  })

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'shumai-publish-test-'))
    for (const target of cliTargetNames)
      await writeFile(join(directory, archiveName(target)), target)
    await assembleCliRelease(directory)
    manifest = await readFile(join(directory, 'checksums.txt'), 'utf8')
    assets = await Promise.all(
      cliReleaseFiles().map(async (name) => ({
        name,
        digest: `sha256:${sha256(await readFile(join(directory, name)))}`,
      })),
    )
    await writeFile(join(directory, 'notes.md'), 'Test release notes')
    draft = undefined
    source = 'release-commit'
    calls.length = 0
    run.mockClear()
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('stages all assets in a draft, can resume staging, and only publishes in the final step', async () => {
    await publishCliRelease('stage', context(), run)
    expect(draft).toBe(true)
    expect(calls.some((call) => call.includes('--verify-tag') && call.includes('--draft'))).toBe(
      true,
    )
    const upload = calls.find((call) => call[2] === 'upload')!
    for (const name of cliReleaseFiles()) expect(upload).toContain(join(directory, name))
    expect(upload).toContain('--clobber')
    await publishCliRelease('stage', context(), run)
    expect(calls.filter((call) => call[2] === 'create')).toHaveLength(1)
    expect(draft).toBe(true)
    await publishCliRelease('publish', context(), run)
    expect(draft).toBe(false)
    expect(calls.at(-1)).toContain('--latest=true')
  })

  it('validates published artifacts without replacing them, even when a rebuild differs', async () => {
    draft = false
    await writeFile(join(directory, archiveName('linux-x64')), 'different archive timestamp')
    await assembleCliRelease(directory)
    await publishCliRelease('stage', context(), run)
    await publishCliRelease('publish', context(), run)
    expect(
      calls
        .filter((call) => call[0] === 'gh')
        .every((call) => call[1] === 'api' || call[2] === 'download'),
    ).toBe(true)
  })

  it('rejects a source/tag mismatch before making any GitHub changes', async () => {
    source = 'another-commit'
    await expect(publishCliRelease('stage', context(), run)).rejects.toThrow('Source ref')
    expect(calls.every((call) => call[0] === 'git')).toBe(true)
    expect(() => validateReleaseSource('v99.0.0', run)).toThrow('package version')
    expect(() => validateReleaseSource(`v${version}`, run, true)).not.toThrow()
  })

  it('rejects tampered local archives before accessing GitHub', async () => {
    await writeFile(join(directory, archiveName('linux-x64')), 'tampered')
    await expect(publishCliRelease('stage', context(), run)).rejects.toThrow(
      'Local checksum mismatch',
    )
    expect(calls.every((call) => call[0] === 'git')).toBe(true)
  })

  it.each([true, false])(
    'does not publish or modify incomplete releases (draft=%s)',
    async (isDraft) => {
      draft = isDraft
      assets = assets.filter((asset) => asset.name !== 'install.ps1')
      await expect(publishCliRelease('publish', context(), run)).rejects.toThrow(
        'Missing or invalid GitHub release asset',
      )
      expect(calls.some((call) => call.includes('--draft=false') || call[2] === 'upload')).toBe(
        false,
      )
    },
  )

  it('rejects mismatched remote digests and duplicate or missing checksum entries', async () => {
    draft = true
    assets[0].digest = `sha256:${'0'.repeat(64)}`
    await expect(publishCliRelease('publish', context(), run)).rejects.toThrow(
      'Missing or invalid GitHub release asset',
    )
    const names = cliReleaseFiles().filter((name) => name !== 'checksums.txt')
    expect(() => parseChecksums(manifest + manifest, names)).toThrow('Duplicate')
    expect(() => parseChecksums(manifest.split('\n').slice(1).join('\n'), names)).toThrow(
      'incomplete',
    )
    expect(() => parseChecksums('bad manifest', names)).toThrow('Invalid')
  })

  it('does not interpret network errors as missing releases or create an unstaged release', async () => {
    run
      .mockImplementationOnce(() => 'release-commit')
      .mockImplementationOnce(() => 'release-commit')
      .mockImplementationOnce(() => {
        throw new Error('Network unavailable')
      })
    await expect(publishCliRelease('stage', context(), run)).rejects.toThrow('Network unavailable')
    expect(calls.some((call) => call[2] === 'create')).toBe(false)
    await expect(publishCliRelease('publish', context(), run)).rejects.toThrow(
      'staged before publishing',
    )
  })
})
