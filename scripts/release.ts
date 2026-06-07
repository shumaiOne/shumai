import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const releaseTarget = process.argv[2]
const bumpTypes = new Set(['major', 'minor', 'patch'])
const semverRe = /^\d+\.\d+\.\d+$/

if (!releaseTarget || (!bumpTypes.has(releaseTarget) && !semverRe.test(releaseTarget))) {
  console.error('Usage: bun run scripts/release.ts <major|minor|patch|x.y.z>')
  process.exit(1)
}

function run(cmd: string, options: { silent?: boolean; ignoreError?: boolean } = {}) {
  console.log(`$ ${cmd}`)
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: options.silent ? 'pipe' : 'inherit' })
  } catch {
    if (!options.ignoreError) {
      console.error(`Command failed: ${cmd}`)
      process.exit(1)
    }
    return null
  }
}

function parseSemver(v: string) {
  const match = v.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) {
    throw new Error(`Invalid version format: ${v}`)
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  }
}

function incrementVersion(version: string, type: 'major' | 'minor' | 'patch') {
  const { major, minor, patch } = parseSemver(version)
  if (type === 'major') {
    return `${major + 1}.0.0`
  }
  if (type === 'minor') {
    return `${major}.${minor + 1}.0`
  }
  return `${major}.${minor}.${patch + 1}`
}

function compareVersions(a: string, b: string) {
  const av = parseSemver(a)
  const bv = parseSemver(b)
  if (av.major !== bv.major) return av.major - bv.major
  if (av.minor !== bv.minor) return av.minor - bv.minor
  return av.patch - bv.patch
}

function getPackageJsonFiles() {
  const files: string[] = ['package.json']

  // Find in packages/
  if (existsSync('packages')) {
    const packages = readdirSync('packages')
    for (const pkg of packages) {
      const p = join('packages', pkg, 'package.json')
      if (existsSync(p)) {
        files.push(p)
      }
    }
  }

  // Find in apps/
  if (existsSync('apps')) {
    const apps = readdirSync('apps')
    for (const app of apps) {
      const p = join('apps', app, 'package.json')
      if (existsSync(p)) {
        files.push(p)
      }
    }
  }

  return files
}

function updateVersions(newVersion: string) {
  const files = getPackageJsonFiles()
  for (const file of files) {
    const content = JSON.parse(readFileSync(file, 'utf-8'))
    content.version = newVersion
    writeFileSync(file, JSON.stringify(content, null, 2) + '\n', 'utf-8')
    console.log(`  Updated version in ${file}`)
  }
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function stageChangedFiles() {
  const output = run('git ls-files -m -o -d --exclude-standard', { silent: true })
  const paths = [
    ...new Set(
      (output || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ]
  if (paths.length === 0) {
    return
  }
  run(`git add -- ${paths.map(shellQuote).join(' ')}`)
}

// Main Flow
console.log('\n=== Release Script ===\n')

// 1. Check for uncommitted changes
console.log('Checking for uncommitted changes...')
const status = run('git status --porcelain', { silent: true })
if (status && status.trim()) {
  console.error('Error: Uncommitted changes detected. Commit or stash first.')
  console.error(status)
  process.exit(1)
}
console.log('  Working directory clean\n')

// 2. Determine version
const rootPkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const currentVersion = rootPkg.version || '0.1.0'
let newVersion: string

if (bumpTypes.has(releaseTarget)) {
  newVersion = incrementVersion(currentVersion, releaseTarget as 'major' | 'minor' | 'patch')
} else {
  newVersion = releaseTarget
  if (compareVersions(newVersion, currentVersion) <= 0) {
    console.error(
      `Error: explicit version ${newVersion} must be greater than current version ${currentVersion}.`,
    )
    process.exit(1)
  }
}

console.log(`Bumping version from ${currentVersion} to ${newVersion}...`)
updateVersions(newVersion)
console.log()

// 3. Update bun.lock
console.log('Refreshing lockfile...')
run('bun install')
console.log()

// 4. Run build and checks
console.log('Running build and checks...')
run('bun run prepublishOnly')
console.log()

// 5. Commit and tag
console.log('Committing and tagging release...')
stageChangedFiles()
run(`git commit -m "Release v${newVersion}"`)
run(`git tag v${newVersion}`)
console.log()

// 6. Push to remote
console.log('Pushing to remote...')
run('git push origin main')
run(`git push origin v${newVersion}`)
console.log()

console.log(`=== Prepared release v${newVersion}; tag pushed successfully ===`)
