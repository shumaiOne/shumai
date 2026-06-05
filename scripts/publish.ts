import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dryRun = process.argv.includes('--dry-run')
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== '--dry-run')

if (unknownArgs.length > 0) {
  console.error('Usage: bun run scripts/publish.ts [--dry-run]')
  process.exit(1)
}

function commandForPlatform(command: string) {
  return process.platform === 'win32' ? `${command}.cmd` : command
}

function run(command: string, args: string[], options: { cwd?: string; capture?: boolean } = {}) {
  console.log(`$ ${[command, ...args].join(' ')}`)
  const result = spawnSync(commandForPlatform(command), args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  })

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n')
    throw new Error(
      output
        ? `Command failed: ${command} ${args.join(' ')}\n${output}`
        : `Command failed: ${command} ${args.join(' ')}`,
    )
  }

  return result
}

function readPackageJson(directory: string) {
  return JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
}

function assertBuildOutputExists(directory: string) {
  if (!existsSync(directory)) {
    throw new Error(`${directory} does not exist. Run bun run build-npm before publishing.`)
  }
}

function validatePack(directory: string) {
  const result = run('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
    capture: true,
    cwd: directory,
  })
  const packed = JSON.parse(result.stdout)[0]
  console.log(
    `  ${packed.filename}: ${packed.files.length} files, ${packed.size} bytes packed, ${packed.unpackedSize} bytes unpacked`,
  )
}

function isPublished(name: string, version: string) {
  const result = spawnSync(
    commandForPlatform('npm'),
    ['view', `${name}@${version}`, 'version', '--json'],
    {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
    },
  )

  if (result.status === 0 && result.stdout.trim()) {
    return true
  }

  const output = [result.stdout, result.stderr].filter(Boolean).join('\n')
  if (result.status !== 0 && (output.includes('E404') || output.includes('404 Not Found'))) {
    return false
  }

  throw new Error(
    output ? `Failed to query ${name}@${version}\n${output}` : `Failed to query ${name}@${version}`,
  )
}

// 1. Scan the dist folder for all directories containing a package.json
if (!existsSync('dist')) {
  throw new Error('dist directory does not exist. Run bun run build-npm first.')
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

const packageVersions = new Map<string, string>()
for (const pkg of packages) {
  assertBuildOutputExists(pkg.directory)
  const packageJson = readPackageJson(pkg.directory)
  if (packageJson.name !== pkg.name) {
    throw new Error(
      `${pkg.directory}/package.json has name ${packageJson.name}, expected ${pkg.name}`,
    )
  }
  packageVersions.set(pkg.name, packageJson.version)
}

const versions = [...new Set(packageVersions.values())]
if (versions.length !== 1) {
  throw new Error(`Publish packages are not lockstep versioned: ${versions.join(', ')}`)
}

console.log(`Publishing shumai packages at ${versions[0]}${dryRun ? ' (dry run)' : ''}\n`)

for (const pkg of packages) {
  const version = packageVersions.get(pkg.name)!
  const published = isPublished(pkg.name, version)

  if (dryRun) {
    if (published) {
      console.log(`${pkg.name}@${version} is already published; validating package contents only.`)
    } else {
      console.log(
        `${pkg.name}@${version} is not published; validating package contents before publish.`,
      )
    }
    validatePack(pkg.directory)
    console.log()
    continue
  }

  if (published) {
    console.log(`Skipping ${pkg.name}@${version}: already published\n`)
    continue
  }

  run('npm', ['publish', '--access', 'public', '--ignore-scripts'], { cwd: pkg.directory })
  console.log()
}
