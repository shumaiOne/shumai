import { execFileSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { version } from '../package.json'
import { repoRoot } from './build-cli'

describe.skipIf(process.platform === 'win32')('Unix installer preflight', () => {
  let temporary: string
  let bin: string
  const command = async (name: string, body: string) => {
    const file = join(bin, name)
    await writeFile(file, `#!/bin/sh\n${body}\n`)
    await chmod(file, 0o755)
  }
  const install = () => {
    try {
      execFileSync(
        '/bin/sh',
        [
          join(repoRoot, 'scripts/install.sh'),
          '--version',
          version,
          '--install-dir',
          join(temporary, 'install'),
        ],
        {
          env: { PATH: bin, HOME: temporary },
          stdio: 'pipe',
        },
      )
      throw new Error('Installer unexpectedly succeeded')
    } catch (error) {
      if (error && typeof error === 'object' && 'stderr' in error && Buffer.isBuffer(error.stderr))
        return error.stderr.toString()
      throw error
    }
  }
  beforeEach(async () => {
    temporary = await mkdtemp(join(tmpdir(), 'shumai-installer-test-'))
    bin = join(temporary, 'bin')
    await mkdir(bin)
    await symlink('/usr/bin/grep', join(bin, 'grep'))
    await command('uname', 'case "$1" in -s) printf Darwin ;; -m) printf x86_64 ;; esac')
    await command('sysctl', 'printf 0')
  })
  afterEach(async () => {
    await rm(temporary, { recursive: true, force: true })
  })

  it('rejects unsupported operating systems and CPU architectures', async () => {
    await command('uname', 'printf FreeBSD')
    expect(install()).toContain('Supported systems')
    await command('uname', 'case "$1" in -s) printf Darwin ;; -m) printf riscv64 ;; esac')
    expect(install()).toContain('Unsupported CPU architecture')
  })

  it('rejects musl instead of downloading a glibc executable', async () => {
    await command('uname', 'case "$1" in -s) printf Linux ;; -m) printf x86_64 ;; esac')
    await command('ldd', 'printf musl')
    expect(install()).toContain('musl/Alpine is not supported')
  })

  it('reports missing extraction, download, and hashing tools before downloading', async () => {
    expect(install()).toContain('tar is required')
    await command('tar', 'exit 0')
    expect(install()).toContain('curl or wget is required')
    await command('curl', 'exit 99')
    expect(install()).toContain('sha256sum or shasum is required')
  })
})
