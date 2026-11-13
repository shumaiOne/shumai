import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { version } from '../package.json'
import { archiveName, cliTargetNames, sha256, validateCliVersion } from './build-cli'

type Runner = (command: string, args: string[]) => string
interface ReleaseAsset {
  name: string
  digest: string | null
}
interface Release {
  isDraft: boolean
  assets: ReleaseAsset[]
}

export function cliReleaseFiles() {
  return [
    ...cliTargetNames.map((target) => archiveName(target)),
    'install.sh',
    'install.ps1',
    'checksums.txt',
  ]
}

export function parseChecksums(text: string, names: string[]): Map<string, string> {
  const hashes = new Map<string, string>()
  for (const line of text.trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64}) {2}([a-zA-Z0-9.-]+)$/.exec(line)
    assert.ok(match && names.includes(match[2]), 'Invalid release checksum entry')
    assert.ok(!hashes.has(match[2]), 'Duplicate release checksum entry')
    hashes.set(match[2], match[1])
  }
  assert.equal(hashes.size, names.length, 'Release checksum entries are incomplete')
  return hashes
}

export function validateReleaseSource(tag: string, run: Runner, validationOnly = false) {
  validateCliVersion(version)
  assert.equal(tag, `v${version}`, 'Release tag must match the package version')
  if (validationOnly) return
  assert.equal(
    run('git', ['rev-parse', 'HEAD']).trim(),
    run('git', ['rev-parse', `${tag}^{commit}`]).trim(),
    'Source ref must point to the release tag commit',
  )
}

function parseRelease(value: unknown): Release {
  assert.ok(
    value && typeof value === 'object' && 'draft' in value && typeof value.draft === 'boolean',
  )
  assert.ok('assets' in value && Array.isArray(value.assets))
  const assets: unknown[] = value.assets
  return {
    isDraft: value.draft,
    assets: assets.map((asset) => {
      assert.ok(
        asset && typeof asset === 'object' && 'name' in asset && typeof asset.name === 'string',
      )
      const digest = 'digest' in asset && typeof asset.digest === 'string' ? asset.digest : null
      return { name: asset.name, digest }
    }),
  }
}

function findRelease(repository: string, tag: string, run: Runner): Release | undefined {
  try {
    return parseRelease(JSON.parse(run('gh', ['api', `repos/${repository}/releases/tags/${tag}`])))
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('HTTP 404')) throw error
  }

  // The tag endpoint only returns published releases. Authenticated release lists include drafts.
  const pages: unknown = JSON.parse(
    run('gh', ['api', '--paginate', '--slurp', `repos/${repository}/releases?per_page=100`]),
  )
  assert.ok(Array.isArray(pages), 'Invalid GitHub release list')
  let release: Release | undefined
  for (const page of pages) {
    assert.ok(Array.isArray(page), 'Invalid GitHub release list page')
    for (const entry of page as unknown[]) {
      assert.ok(
        entry &&
          typeof entry === 'object' &&
          'tag_name' in entry &&
          typeof entry.tag_name === 'string',
        'Invalid GitHub release list entry',
      )
      if (entry.tag_name !== tag) continue
      assert.ok(!release, 'Multiple GitHub releases found for the release tag')
      release = parseRelease(entry)
    }
  }
  return release
}

export async function publishCliRelease(
  mode: 'stage' | 'publish',
  context: { tag: string; repository: string; outdir: string; notes: string },
  run: Runner,
) {
  validateReleaseSource(context.tag, run)
  assert.match(context.repository, /^[\w.-]+\/[\w.-]+$/)
  const names = cliReleaseFiles()
  const checksummed = names.filter((name) => name !== 'checksums.txt')
  const localHashes = parseChecksums(
    await readFile(join(context.outdir, 'checksums.txt'), 'utf8'),
    checksummed,
  )
  for (const name of checksummed)
    assert.equal(
      sha256(await readFile(join(context.outdir, name))),
      localHashes.get(name),
      `Local checksum mismatch: ${name}`,
    )

  let release = findRelease(context.repository, context.tag, run)
  if (!release) {
    assert.equal(mode, 'stage', 'Release must be staged before publishing')
    run('gh', [
      'release',
      'create',
      context.tag,
      '--verify-tag',
      '--draft',
      '--title',
      context.tag,
      '--notes-file',
      context.notes,
    ])
    release = { isDraft: true, assets: [] }
  }

  if (mode === 'stage' && release.isDraft) {
    run('gh', [
      'release',
      'edit',
      context.tag,
      '--title',
      context.tag,
      '--notes-file',
      context.notes,
    ])
    // Only draft assets may be replaced when resuming a failed build/publication.
    run('gh', [
      'release',
      'upload',
      context.tag,
      ...names.map((name) => join(context.outdir, name)),
      '--clobber',
    ])
    return
  }

  // A successful rerun validates the existing published bytes instead of replacing them
  // with a rebuild whose archive timestamps can differ.
  const manifest = run('gh', [
    'release',
    'download',
    context.tag,
    '--pattern',
    'checksums.txt',
    '--output',
    '-',
  ])
  const remoteHashes = parseChecksums(manifest, checksummed)
  remoteHashes.set('checksums.txt', sha256(manifest))
  for (const name of names) {
    const asset: ReleaseAsset | undefined = release.assets.find((entry) => entry.name === name)
    assert.equal(
      asset?.digest,
      `sha256:${remoteHashes.get(name)}`,
      `Missing or invalid GitHub release asset: ${name}`,
    )
  }
  if (mode === 'publish' && release.isDraft) {
    const prerelease = version.includes('-')
    run('gh', [
      'release',
      'edit',
      context.tag,
      '--draft=false',
      `--prerelease=${prerelease}`,
      `--latest=${!prerelease}`,
    ])
  }
}

if (import.meta.main) {
  const run: Runner = (command, args) => {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
    })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}: ${result.stderr}`)
    return result.stdout
  }
  const tag = process.env.RELEASE_TAG ?? ''
  const mode = process.argv[2]
  if (mode === 'validate' || mode === 'validate-only')
    validateReleaseSource(tag, run, mode === 'validate-only')
  else {
    assert.ok(
      mode === 'stage' || mode === 'publish',
      'Usage: publish-cli-release.ts <validate|stage|publish>',
    )
    await publishCliRelease(
      mode,
      {
        tag,
        repository: process.env.GITHUB_REPOSITORY ?? 'shumaiOne/shumai',
        outdir: 'out/cli-release',
        notes: '/tmp/release-notes.md',
      },
      run,
    )
  }
}
