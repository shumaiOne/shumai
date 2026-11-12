import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { version } from '../package.json'
import {
  archiveName,
  assembleCliRelease,
  cliTargetNames,
  parseCliTarget,
  repoRoot,
  sha256,
  validateCliVersion,
} from './build-cli'

describe('CLI release packaging', () => {
  it('names all six platform archives and rejects invalid targets and versions', () => {
    expect(cliTargetNames).toHaveLength(6)
    for (const target of cliTargetNames) {
      expect(parseCliTarget(target)).toBe(target)
      expect(archiveName(target)).toBe(
        `shumai-cli-v${version}-${target}.${target.startsWith('windows-') ? 'zip' : 'tar.gz'}`,
      )
    }
    for (const value of ['__proto__', 'linux-ia32', '../linux-x64'])
      expect(() => parseCliTarget(value)).toThrow()
    for (const value of ['', '../1.2.3', '1.2.3;echo bad', 'v1.2.3'])
      expect(() => validateCliVersion(value)).toThrow()
    expect(validateCliVersion('1.2.3-rc.1')).toBe('1.2.3-rc.1')
  })

  it('checksums the exact release bytes and pins both installers to the package version', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'shumai-cli-pack-test-'))
    try {
      for (const target of cliTargetNames)
        await writeFile(join(directory, archiveName(target)), target)
      await assembleCliRelease(directory)
      const manifest = await readFile(join(directory, 'checksums.txt'), 'utf8')
      for (const target of cliTargetNames)
        expect(manifest).toContain(`${sha256(target)}  ${archiveName(target)}\n`)
      for (const name of ['install.sh', 'install.ps1']) {
        const script = await readFile(join(directory, name), 'utf8')
        expect(script).toContain(version)
        expect(script).not.toContain('__SHUMAI_CLI_VERSION__')
      }
      await rm(join(directory, archiveName('linux-x64')))
      await expect(assembleCliRelease(directory)).rejects.toThrow()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it.skipIf(process.platform === 'win32')(
    'accepts help and rejects invalid installer arguments before downloading',
    () => {
      const script = join(repoRoot, 'scripts/install.sh')
      expect(execFileSync('/bin/sh', [script, '--help'], { encoding: 'utf8' })).toContain(
        '--install-dir',
      )
      for (const args of [
        ['--unknown'],
        ['--version'],
        ['--version', '../1.2.3'],
        ['--version', version, '--install-dir', 'relative'],
      ]) {
        expect(() => execFileSync('/bin/sh', [script, ...args], { stdio: 'pipe' })).toThrow()
      }
    },
  )
})
