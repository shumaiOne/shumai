import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

function printUsage() {
  console.log(`Usage: bun run scripts/release-local.ts [options]

Builds and packs the publishable packages, then installs the tarballs into an
isolated directory outside the repository for local release testing.

Options:
  --out <dir>          Output directory. Defaults to a new directory under ${tmpdir()}
  --force              Remove --out first if it already exists
  --skip-check         Do not run bun run check (lint/format/typecheck) before building
  --help               Show this help
`)
}

function parseArgs() {
  const options = { force: false, outDir: '', skipCheck: false }
  const args = process.argv.slice(2)

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help') {
      printUsage()
      process.exit(0)
    }
    if (arg === '--force') {
      options.force = true
      continue
    }
    if (arg === '--skip-check') {
      options.skipCheck = true
      continue
    }
    if (arg === '--out') {
      const value = args[++i]
      if (!value) {
        throw new Error('--out requires a directory')
      }
      options.outDir = value
      continue
    }
    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

function commandForPlatform(command: string) {
  return process.platform === 'win32' ? `${command}.cmd` : command
}

function run(command: string, args: string[], options: { cwd?: string; capture?: boolean } = {}) {
  console.log(`$ ${[command, ...args].join(' ')}`)
  const result = spawnSync(commandForPlatform(command), args, {
    cwd: options.cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: options.capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(`Command failed: ${[command, ...args].join(' ')}`)
  }

  return result.stdout ?? ''
}

function readPackageJson(directory: string) {
  return JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
}

// Check if a directory is inside another directory path
function isInsidePath(child: string, parent: string) {
  const relativePath = relative(parent, child)
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

function prepareOutputDirectory(outDirOpt: string, force: boolean, repoRoot: string) {
  if (!outDirOpt) {
    const randomName = `shumai-local-release-${Math.random().toString(36).substring(2, 10)}`
    return join(tmpdir(), randomName)
  }

  const outDir = resolve(outDirOpt)

  if (isInsidePath(outDir, repoRoot)) {
    throw new Error(`Output directory must be outside the repository: ${outDir}`)
  }

  if (existsSync(outDir)) {
    if (!force) {
      throw new Error(`Output directory already exists. Use --force to replace it: ${outDir}`)
    }
    rmSync(outDir, { force: true, recursive: true })
  }

  mkdirSync(outDir, { recursive: true })
  return outDir
}

function fileSpecifier(fromDirectory: string, file: string) {
  const relativePath = relative(fromDirectory, file).replaceAll('\\', '/')
  return `file:${relativePath.startsWith('.') ? relativePath : `./${relativePath}`}`
}

function packPackage(pkg: { directory: string; name: string }, tarballDirectory: string) {
  const packageJson = readPackageJson(pkg.directory)
  if (packageJson.name !== pkg.name) {
    throw new Error(
      `${pkg.directory}/package.json has name ${packageJson.name}, expected ${pkg.name}`,
    )
  }

  const output = run('npm', ['pack', '--json', '--pack-destination', tarballDirectory], {
    capture: true,
    cwd: pkg.directory,
  })
  const packed = JSON.parse(output)[0]
  return join(tarballDirectory, packed.filename)
}

const options = parseArgs()
const repoRoot = process.cwd()
const rootPackageJson = readPackageJson(repoRoot)

if (rootPackageJson.name !== 'shumai') {
  throw new Error('Run this script from the repository root')
}

const outDir = prepareOutputDirectory(options.outDir, options.force, repoRoot)
const tarballDirectory = join(outDir, 'tarballs')
const nodeInstallDirectory = join(outDir, 'node')
mkdirSync(tarballDirectory, { recursive: true })

if (!options.skipCheck) {
  console.log('🔍 Running code quality checks...')
  run('bun', ['run', 'format'])
  run('bun', ['run', 'lint'])
  run('bun', ['run', 'typecheck'])
}

console.log('🏗️ Building all NPM packages...')
run('bun', ['run', 'build-npm'])

// 1. Scan the dist folder for all directories containing a package.json
if (!existsSync('dist')) {
  throw new Error('dist directory does not exist after build.')
}

const packages = readdirSync('dist', { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => {
    const dir = join('dist', dirent.name)
    try {
      const packageJson = readPackageJson(dir)
      return { directory: dir, name: packageJson.name }
    } catch {
      return null
    }
  })
  .filter((pkg): pkg is { directory: string; name: string } => pkg !== null)

if (packages.length === 0) {
  throw new Error('No package directories found in dist/')
}

const tarballs = new Map<string, string>()
for (const pkg of packages) {
  const tarball = packPackage(pkg, tarballDirectory)
  tarballs.set(pkg.name, tarball)
}

console.log('📦 Creating isolated npm installation...')
mkdirSync(nodeInstallDirectory, { recursive: true })

const wrapperAppNames = [
  '@shumai-one/shumai',
  '@shumai-one/shumai-agent',
  '@shumai-one/shumai-transcode',
  '@shumai-one/shumai-cli',
]
const dependencies = Object.fromEntries(
  packages
    .filter((pkg) => wrapperAppNames.includes(pkg.name))
    .map((pkg) => [pkg.name, fileSpecifier(nodeInstallDirectory, tarballs.get(pkg.name)!)]),
)
const overrides = Object.fromEntries(
  packages.map((pkg) => [pkg.name, fileSpecifier(nodeInstallDirectory, tarballs.get(pkg.name)!)]),
)

const installPackageJson = `${JSON.stringify(
  { private: true, dependencies, overrides },
  undefined,
  '\t',
)}\n`
writeFileSync(join(nodeInstallDirectory, 'package.json'), installPackageJson)

run('npm', ['install', '--omit=dev', '--ignore-scripts'], { cwd: nodeInstallDirectory })

console.log('\n✅ Local release artifacts created successfully!')
console.log(`  Release directory: ${outDir}`)

console.log('\nTarballs generated:')
for (const tarball of tarballs.values()) {
  console.log(`  ${tarball}`)
}

console.log('\nIsolated npm install location:')
console.log(`  ${nodeInstallDirectory}`)

console.log('\nTo run the locally packed CLI apps from outside the repository:')
console.log(`  npx --prefix ${nodeInstallDirectory} shumai`)
console.log(`  npx --prefix ${nodeInstallDirectory} shumai-agent`)
console.log(`  npx --prefix ${nodeInstallDirectory} shumai-transcode`)
console.log(`  npx --prefix ${nodeInstallDirectory} shumai-cli`)
