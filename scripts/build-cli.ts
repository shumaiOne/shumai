import { createHash } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { version } from '../package.json'
import { version as cliVersion } from '../apps/cli/package.json'

export const cliTargets = {
  'darwin-arm64': 'bun-darwin-arm64',
  'darwin-x64': 'bun-darwin-x64',
  'linux-arm64': 'bun-linux-arm64',
  'linux-x64': 'bun-linux-x64',
  'windows-arm64': 'bun-windows-arm64',
  'windows-x64': 'bun-windows-x64',
} as const
export type CliTarget = keyof typeof cliTargets
export const cliTargetNames = Object.keys(cliTargets) as CliTarget[]
export const repoRoot = fileURLToPath(new URL('..', import.meta.url))

export function validateCliVersion(value: string): string {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(value)) {
    throw new Error(`Invalid CLI version: ${value}`)
  }
  return value
}

export function parseCliTarget(value: string): CliTarget {
  if (!Object.hasOwn(cliTargets, value)) throw new Error(`Unsupported CLI target: ${value}`)
  return value as CliTarget
}

export function archiveName(target: CliTarget, releaseVersion = version): string {
  validateCliVersion(releaseVersion)
  return `shumai-cli-v${releaseVersion}-${target}.${target.startsWith('windows-') ? 'zip' : 'tar.gz'}`
}

export function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function packCliBinary(
  staging: string,
  outdir: string,
  target: CliTarget,
  releaseVersion = version,
) {
  const executable = target.startsWith('windows-') ? 'shumai-cli.exe' : 'shumai-cli'
  const archive = join(outdir, archiveName(target, releaseVersion))
  const command = target.startsWith('windows-')
    ? process.platform === 'win32'
      ? ['tar', '-a', '-cf', archive, '-C', staging, executable]
      : ['zip', '-j', archive, join(staging, executable)]
    : ['tar', '-czf', archive, '-C', staging, executable]
  const packed = spawnSync(command[0], command.slice(1), { stdio: 'inherit' })
  if (packed.error) throw packed.error
  if (packed.status !== 0) throw new Error(`Failed to archive ${target}`)
  return archive
}

export async function assembleCliRelease(outdir: string, targets = cliTargetNames) {
  validateCliVersion(version)
  if (cliVersion !== version) throw new Error('Root and CLI package versions must match')
  for (const name of ['install.sh', 'install.ps1']) {
    const template = await readFile(join(repoRoot, 'scripts', name), 'utf8')
    await writeFile(join(outdir, name), template.replaceAll('__SHUMAI_CLI_VERSION__', version))
  }
  const names = [
    ...targets.map((target) => archiveName(target)),
    'install.sh',
    'install.ps1',
  ].sort()
  const lines = await Promise.all(
    names.map(async (name) => `${sha256(await readFile(join(outdir, name)))}  ${name}\n`),
  )
  await writeFile(join(outdir, 'checksums.txt'), lines.join(''))
}

export async function buildCliRelease(outdir: string, targets = cliTargetNames) {
  validateCliVersion(version)
  if (cliVersion !== version) throw new Error('Root and CLI package versions must match')
  await mkdir(outdir, { recursive: true })
  const staging = await mkdtemp(join(outdir, '.build-'))
  try {
    for (const target of targets) {
      const executable = target.startsWith('windows-') ? 'shumai-cli.exe' : 'shumai-cli'
      const binary = join(staging, executable)
      const result = await Bun.build({
        entrypoints: [join(repoRoot, 'apps/cli/src/index.ts')],
        target: 'bun',
        minify: true,
        compile: {
          target: cliTargets[target],
          outfile: binary,
          autoloadDotenv: false,
          autoloadBunfig: false,
          autoloadPackageJson: false,
          autoloadTsconfig: false,
        },
        define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      })
      if (!result.success) throw new AggregateError(result.logs, `Failed to compile ${target}`)
      await chmod(binary, 0o755)
      const archive = join(outdir, archiveName(target))
      await rm(archive, { force: true })
      packCliBinary(staging, outdir, target)
      console.log(`Built ${archive}`)
    }
    await assembleCliRelease(outdir, targets)
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      target: { type: 'string' },
      out: { type: 'string', default: 'out/cli-release' },
      assemble: { type: 'boolean', default: false },
    },
  })
  const targets = values.target ? [parseCliTarget(values.target)] : cliTargetNames
  const outdir = resolve(values.out)
  if (values.assemble) await assembleCliRelease(outdir, targets)
  else await buildCliRelease(outdir, targets)
}
