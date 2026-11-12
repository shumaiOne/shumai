import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify, parseArgs } from 'node:util'
import { randomBytes } from 'node:crypto'
import { version } from '../package.json'
import { archiveName, packCliBinary, parseCliTarget, sha256 } from './build-cli'

const execFileAsync = promisify(execFile)

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value))
}

/** Exercises the packaged installer and executable against HTTP, without a runtime on PATH. */
export async function testCliRelease(outdir: string) {
  const windows = process.platform === 'win32'
  const target = parseCliTarget(`${windows ? 'windows' : process.platform}-${process.arch}`)
  const bytes = randomBytes(65536)
  const asset = {
    id: 'file-test',
    name: 'random.bin',
    type: 'file',
    size: bytes.length,
    projectId: 'project-test',
  }
  let transferred = false
  let confirmed = false
  let mode: 'normal' | 'corrupt' | 'missing' | 'ambiguous' = 'normal'
  let fixtureFailure: unknown
  const olderVersion = '0.0.1'
  let olderDirectory = ''
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      try {
        const url = new URL(request.url)
        if (url.pathname.startsWith('/releases/')) {
          const requestedVersion = url.pathname.split('/')[2]?.slice(1)
          assert.ok(
            requestedVersion === version || requestedVersion === olderVersion,
            'Installer must pin the version',
          )
          if (mode === 'missing') return new Response('Missing asset', { status: 404 })
          const name = url.pathname.split('/').at(-1)!
          if (name === 'checksums.txt' && mode === 'ambiguous') {
            const manifest = await readFile(join(outdir, name))
            return new Response(Buffer.concat([manifest, manifest]))
          }
          if (name === archiveName(target) && mode === 'corrupt')
            return new Response('Corrupted archive')
          assert.ok(name === 'checksums.txt' || name === archiveName(target, requestedVersion))
          return new Response(
            Bun.file(join(requestedVersion === olderVersion ? olderDirectory : outdir, name)),
          )
        }
        if (url.pathname === '/upload' && request.method === 'PUT') {
          assert.deepEqual(Buffer.from(await request.arrayBuffer()), bytes)
          assert.equal(Number(request.headers.get('content-length')), bytes.length)
          transferred = true
          return new Response(null, { status: 200 })
        }
        if (url.pathname === '/original') return new Response(bytes)
        if (request.headers.get('authorization') !== 'Bearer fixture-token') {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (url.pathname.startsWith('/api/ops/')) {
          assert.equal(request.method, 'POST')
          const input: unknown = await request.json()
          assertRecord(input)
          switch (url.pathname.slice('/api/ops/'.length)) {
            case 'list_projects':
              return Response.json({
                data: [
                  {
                    id: 'project-test',
                    name: 'Native CLI',
                    teamId: 'team-test',
                    rootFolderId: 'root-test',
                  },
                ],
              })
            case 'create_folder':
              assert.deepEqual(input, { parent: 'root-test', name: 'Uploads' })
              return Response.json({
                id: 'folder-test',
                name: 'Uploads',
                type: 'folder',
                size: 0,
                projectId: 'project-test',
              })
            case 'list_assets':
              assert.equal(input.parent, 'folder-test')
              assert.ok(confirmed)
              return Response.json({
                data: [asset],
                total: 1,
                pageInfo: { hasNextPage: false, endCursor: null },
              })
            case 'download_asset':
              assert.deepEqual(input, { assetIds: ['file-test'], proxy: false })
              return Response.json({
                files: [
                  {
                    assetId: asset.id,
                    name: asset.name,
                    kind: 'original',
                    size: bytes.length,
                    mimeType: 'application/octet-stream',
                    url: `${url.origin}/original`,
                  },
                ],
              })
          }
        }
        if (url.pathname === '/api/folders/folder-test')
          return Response.json({ projectId: 'project-test' })
        if (url.pathname === '/api/projects/project-test')
          return Response.json({ teamId: 'team-test' })
        if (url.pathname === '/api/teams/team-test/upload/tasks' && request.method === 'POST') {
          const input: unknown = await request.json()
          assertRecord(input)
          assert.equal(input.parentId, 'folder-test')
          assert.ok(Array.isArray(input.files))
          const files: unknown[] = input.files
          const file = files[0]
          assertRecord(file)
          assert.equal(file.name, asset.name)
          assert.equal(file.size, bytes.length)
          return Response.json({
            taskId: 'task-test',
            presignedUrls: [{ id: file.id, fileId: asset.id, url: `${url.origin}/upload` }],
            createdAssets: [{ id: asset.id, tempId: file.id }],
          })
        }
        if (
          url.pathname === '/api/teams/team-test/upload/tasks/task-test' &&
          request.method === 'PATCH'
        ) {
          assert.ok(transferred)
          assert.deepEqual(await request.json(), { fileId: asset.id })
          confirmed = true
          return Response.json({ success: true })
        }
        throw new Error(`Unexpected request: ${request.method} ${url.pathname}`)
      } catch (error) {
        fixtureFailure ??= error
        return new Response('Fixture assertion failed', { status: 500 })
      }
    },
  })
  const temporary = await mkdtemp(join(tmpdir(), 'shumai-cli-release-'))
  const installDir = join(temporary, 'installed cli')
  const binary = join(installDir, windows ? 'shumai-cli.exe' : 'shumai-cli')
  const installerEnv = {
    ...process.env,
    SHUMAI_CLI_RELEASE_BASE_URL: `${server.url.origin}/releases`,
  }
  const install = (selectedVersion?: string) => {
    const psQuote = (value: string) => `'${value.replaceAll("'", "''")}'`
    // PSReadLine can shadow RuntimeInformation in Windows PowerShell 5.1.
    const psCommand = `$ErrorActionPreference = 'Stop'; Import-Module PSReadLine; & ${psQuote(join(outdir, 'install.ps1'))} -InstallDir ${psQuote(installDir)} -NoModifyPath ${selectedVersion ? `-Version ${psQuote(selectedVersion)}` : ''}`
    return execFileAsync(
      windows ? 'powershell.exe' : '/bin/sh',
      windows
        ? [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-EncodedCommand',
            Buffer.from(psCommand, 'utf16le').toString('base64'),
          ]
        : [
            join(outdir, 'install.sh'),
            '--install-dir',
            installDir,
            ...(selectedVersion ? ['--version', selectedVersion] : []),
          ],
      { env: installerEnv, timeout: 60000 },
    )
  }
  const cliEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: '',
    HOME: temporary,
    SHUMAI_API_SERVER: server.url.origin,
    SHUMAI_API_KEY: 'fixture-token',
  }
  delete cliEnv.BUN_BE_BUN
  delete cliEnv.BUN_OPTIONS
  const run = async (args: string[], env = cliEnv) => {
    const result = await execFileAsync(binary, args, { cwd: temporary, env, timeout: 30000 })
    if (fixtureFailure) throw fixtureFailure
    return result.stdout
  }
  try {
    await install()
    assert.equal((await run(['--version'])).trim(), version)
    assert.match(await run(['--help']), /Command line interface/)
    const projects = JSON.parse(await run(['--json', 'project', 'ls'])) as {
      data: { id: string }[]
    }
    assert.equal(projects.data[0].id, 'project-test')
    const folder = JSON.parse(await run(['--json', 'mkdir', 'Uploads', '-p', 'root-test'])) as {
      id: string
    }
    assert.equal(folder.id, 'folder-test')
    const file = join(temporary, asset.name)
    await writeFile(file, bytes)
    await run(['upload', file, '-p', folder.id])
    assert.ok(confirmed, 'Upload must transfer and confirm the bytes, not merely exit successfully')
    assert.match(await run(['--json', 'ls', '-p', folder.id]), /random.bin/)
    const downloads = join(temporary, 'downloaded')
    await run(['download', asset.id, '--original', '--out', downloads])
    assert.deepEqual(await readFile(join(downloads, asset.name)), bytes)
    await assert.rejects(
      run(['project', 'ls'], { ...cliEnv, SHUMAI_API_KEY: 'invalid-token' }),
      /Unauthorized/,
    )
    await writeFile(
      join(temporary, '.env'),
      `SHUMAI_API_SERVER=${server.url.origin}\nSHUMAI_API_KEY=fixture-token\n`,
    )
    await assert.rejects(
      run(['project', 'ls'], {
        ...cliEnv,
        SHUMAI_API_SERVER: undefined,
        SHUMAI_API_KEY: undefined,
      }),
      /SHUMAI_API_SERVER/,
    )
    await install() // Reinstall the managed binary, including a path containing spaces.
    // An older compiled fixture exercises replacement and rollback on every platform.
    olderDirectory = join(temporary, 'older')
    const staging = join(olderDirectory, 'binary')
    await mkdir(staging, { recursive: true })
    const olderSource = join(staging, 'older.ts')
    await writeFile(olderSource, `console.log('${olderVersion}')\n`)
    const olderBuild = await Bun.build({
      entrypoints: [olderSource],
      compile: {
        outfile: join(staging, windows ? 'shumai-cli.exe' : 'shumai-cli'),
        autoloadDotenv: false,
        autoloadBunfig: false,
      },
    })
    assert.ok(olderBuild.success)
    const olderArchive = packCliBinary(staging, olderDirectory, target, olderVersion)
    await writeFile(
      join(olderDirectory, 'checksums.txt'),
      `${sha256(await readFile(olderArchive))}  ${archiveName(target, olderVersion)}\n`,
    )
    await install(olderVersion)
    assert.equal((await run(['--version'])).trim(), olderVersion)
    await install(version)
    assert.equal((await run(['--version'])).trim(), version)
    const installedHash = sha256(await readFile(binary))
    for (const failure of ['corrupt', 'missing', 'ambiguous'] as const) {
      mode = failure
      await assert.rejects(install())
      assert.equal(
        sha256(await readFile(binary)),
        installedHash,
        `${failure} must preserve the installed executable`,
      )
    }
    mode = 'normal'
    const marker = join(installDir, '.shumai-cli-install')
    await rm(marker)
    await assert.rejects(install(), /unmanaged installation/)
    assert.equal(sha256(await readFile(binary)), installedHash)
    console.log(
      `PASS ${target}: install, API auth, mkdir, upload/download 65536 bytes, upgrade/rollback, and failure preservation`,
    )
  } finally {
    server.stop(true)
    await rm(temporary, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { out: { type: 'string', default: 'out/cli-release' } } })
  await testCliRelease(resolve(values.out))
}
