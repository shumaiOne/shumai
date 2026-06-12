import { rm, mkdir, cp, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import tailwindPlugin from 'bun-plugin-tailwind'
import { temporalWorkflow } from '../packages/workflow-core/src/bun-temporal-plugin'

console.log('\n🚀 Starting NPM packaging build process for all applications...\n')

const rootDir = process.cwd()
const distDir = path.join(rootDir, 'dist')

// 1. Clean previous build
if (existsSync(distDir)) {
  console.log(`🗑️ Cleaning previous build at ${distDir}`)
  await rm(distDir, { recursive: true, force: true })
}
await mkdir(distDir, { recursive: true })

const rootPackageJson = JSON.parse(await Bun.file('package.json').text())
const version = rootPackageJson.version || '0.1.0'

const commonExternal = [
  '@prisma/client',
  '@prisma/adapter-pg',
  'pg',
  'sharp',
  'pino',
  'pino-pretty',
  '@temporalio/activity',
  '@temporalio/client',
  '@temporalio/worker',
  '@temporalio/workflow',
  'prisma',
]

// Extract exact dependency versions from workspace
console.log('🔍 Extracting exact dependency versions for runtime packages...')
const lsOutput = Bun.spawnSync(['bun', 'pm', 'ls', '--all']).stdout.toString()
const dependencyVersions: Record<string, string> = {}

for (const dep of commonExternal) {
  const escapedDep = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(?:^|\\s)${escapedDep}@(\\d+\\.\\d+\\.\\d+[^\\s]*)`, 'g')
  const match = regex.exec(lsOutput)
  if (match && match[1]) {
    dependencyVersions[dep] = match[1]
    console.log(`  ✅ Found ${dep}@${match[1]}`)
  } else {
    console.warn(`  ⚠️ Warning: Could not find exact version for ${dep}`)
  }
}

const targets = [
  { platform: 'darwin', arch: 'arm64', bunTarget: 'bun-darwin-arm64', suffix: '' },
  { platform: 'darwin', arch: 'x64', bunTarget: 'bun-darwin-x64', suffix: '' },
  { platform: 'linux', arch: 'arm64', bunTarget: 'bun-linux-arm64', suffix: '' },
  { platform: 'linux', arch: 'x64', bunTarget: 'bun-linux-x64', suffix: '' },
  { platform: 'win32', arch: 'arm64', bunTarget: 'bun-windows-arm64', suffix: '.exe' },
  { platform: 'win32', arch: 'x64', bunTarget: 'bun-windows-x64', suffix: '.exe' },
]

// Function to compile a single application binary
async function compileApp({
  name,
  entrypoint,
  outdir,
  binaryName,
  bunTarget,
  plugins = [],
  external = commonExternal,
}: {
  name: string
  entrypoint: string
  outdir: string
  binaryName: string
  bunTarget?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins?: any[]
  external?: string[]
}) {
  console.log(`\n📦 Building binary for ${name}${bunTarget ? ` (${bunTarget})` : ''}...`)
  await mkdir(outdir, { recursive: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compileOptions: Record<string, any> = {
    autoloadPackageJson: true,
  }
  if (bunTarget) {
    compileOptions.target = bunTarget
  }

  const result = await Bun.build({
    entrypoints: [entrypoint],
    root: '.',
    target: 'bun',
    outdir: outdir,
    minify: true,
    compile: compileOptions,
    plugins,
    external,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    publicPath: '/',
  })

  if (!result.success) {
    console.error(`❌ Binary compilation failed for ${name}!`)
    for (const log of result.logs) {
      console.error(log)
    }
    process.exit(1)
  }

  // Rename generated binary (usually Bun names it 'src' or the folder name of the entrypoint)
  const generatedFile = path.join(outdir, 'src')
  const generatedFileExe = path.join(outdir, 'src.exe')
  const finalFile = path.join(outdir, binaryName)

  if (existsSync(generatedFile)) {
    console.log(`➡️ Moving binary to final location: ${finalFile}`)
    await cp(generatedFile, finalFile)
    await rm(generatedFile)
  } else if (existsSync(generatedFileExe)) {
    console.log(`➡️ Moving binary to final location: ${finalFile}`)
    await cp(generatedFileExe, finalFile)
    await rm(generatedFileExe)
  } else {
    console.error(`❌ Could not find compiled binary at ${generatedFile} or ${generatedFileExe}`)
    process.exit(1)
  }
}

// Function to build platform-specific sub-packages for an application
async function buildPlatformPackages(
  appName: string,
  entrypoint: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: any[] = [],
) {
  for (const target of targets) {
    const dirName = `${appName}-${target.platform}-${target.arch}`
    const npmName = `@shumai-one/${appName}-${target.platform}-${target.arch}`
    const pkgOutDir = path.join(distDir, dirName)
    const binOutDir = path.join(pkgOutDir, 'bin')
    const binaryName = appName + target.suffix

    await compileApp({
      name: dirName,
      entrypoint,
      outdir: binOutDir,
      binaryName,
      bunTarget: target.bunTarget,
      plugins,
    })

    // Generate package.json for platform-specific package
    const platformPackageJson = {
      name: npmName,
      version,
      description: `${target.platform} ${target.arch} binary for ${appName}`,
      os: [target.platform],
      cpu: [target.arch],
      repository: rootPackageJson.repository,
    }

    await writeFile(
      path.join(pkgOutDir, 'package.json'),
      JSON.stringify(platformPackageJson, null, 2),
      'utf-8',
    )
  }
}

// Function to build main wrapper package
async function buildMainPackage(
  appName: string,
  description: string,
  hasPrisma: boolean,
  extraDependencies: Record<string, string> = {},
) {
  console.log(`\n📄 Packaging wrapper app ${appName}...`)
  const mainOutDir = path.join(distDir, appName)
  const binOutDir = path.join(mainOutDir, 'bin')
  await mkdir(binOutDir, { recursive: true })

  // Write JS wrapper script
  const wrapperContent = `#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const platform = process.platform
const arch = process.arch

let pkgName = ''
let binaryName = ''

if (platform === 'darwin' && arch === 'arm64') {
  pkgName = '@shumai-one/${appName}-darwin-arm64'
  binaryName = '${appName}'
} else if (platform === 'darwin' && arch === 'x64') {
  pkgName = '@shumai-one/${appName}-darwin-x64'
  binaryName = '${appName}'
} else if (platform === 'linux' && arch === 'arm64') {
  pkgName = '@shumai-one/${appName}-linux-arm64'
  binaryName = '${appName}'
} else if (platform === 'linux' && arch === 'x64') {
  pkgName = '@shumai-one/${appName}-linux-x64'
  binaryName = '${appName}'
} else if (platform === 'win32' && arch === 'arm64') {
  pkgName = '@shumai-one/${appName}-win32-arm64'
  binaryName = '${appName}.exe'
} else if (platform === 'win32' && arch === 'x64') {
  pkgName = '@shumai-one/${appName}-win32-x64'
  binaryName = '${appName}.exe'
} else {
  console.error(\`Unsupported platform/architecture: \${platform}/\${arch}\`)
  process.exit(1)
}

const pathsToTry = [
  join(__dirname, '..', '..', '..', pkgName, 'bin', binaryName), // Flat node_modules
  join(__dirname, '..', '..', 'node_modules', pkgName, 'bin', binaryName), // Nested node_modules
]

let binaryPath = ''
for (const p of pathsToTry) {
  if (existsSync(p)) {
    binaryPath = p
    break
  }
}

if (!binaryPath) {
  console.error(\`Could not find binary for platform package "\${pkgName}". Please ensure optional dependencies are installed.\`)
  process.exit(1)
}

const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
})

child.on('close', (code) => {
  process.exit(code ?? 0)
})

child.on('error', (err) => {
  console.error(\`Failed to start child process:\`, err)
  process.exit(1)
})
`

  const wrapperPath = path.join(binOutDir, `${appName}.js`)
  await writeFile(wrapperPath, wrapperContent, { encoding: 'utf-8', mode: 0o755 })

  // Copy prisma directory if needed
  if (hasPrisma) {
    console.log(`📂 Copying database files for ${appName}...`)
    const dbDest = path.join(mainOutDir, 'prisma')
    await mkdir(dbDest, { recursive: true })
    await cp('./packages/db/prisma/schema.prisma', path.join(dbDest, 'schema.prisma'))
    if (existsSync('./packages/db/prisma/migrations')) {
      await cp('./packages/db/prisma/migrations', path.join(dbDest, 'migrations'), {
        recursive: true,
      })
    }
  }

  // Generate package.json
  const optionalDependencies = Object.fromEntries(
    targets.map((t) => [`@shumai-one/${appName}-${t.platform}-${t.arch}`, version]),
  )

  const dependencies = {
    ...dependencyVersions,
    ...extraDependencies,
  }

  const packageJson = {
    name: `@shumai-one/${appName}`,
    version,
    description,
    type: 'module',
    bin: {
      [appName]: `./bin/${appName}.js`,
    },
    files: ['bin', ...(hasPrisma ? ['prisma'] : [])],
    dependencies,
    optionalDependencies,
    repository: rootPackageJson.repository,
  }

  await writeFile(
    path.join(mainOutDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
    'utf-8',
  )
}

// 2. Build shumai (Main app & platform binaries)
await buildPlatformPackages('shumai', './apps/web/src/index.ts', [
  temporalWorkflow({
    bundleOptions: {},
  }),
  tailwindPlugin,
])
await buildMainPackage('shumai', 'A fullstack AI-powered media workspace and workflow engine', true)

// 3. Build shumai-agent (Agent app & platform binaries)
await buildPlatformPackages('shumai-agent', './apps/agent/src/index.ts', [
  temporalWorkflow({
    bundleOptions: {},
  }),
])
await buildMainPackage('shumai-agent', 'AI worker agent for the shumai media workspace', false)

// 4. Build shumai-transcode (Transcode app & platform binaries)
await buildPlatformPackages('shumai-transcode', './apps/transcode/src/index.ts', [
  temporalWorkflow({
    bundleOptions: {},
  }),
])
await buildMainPackage(
  'shumai-transcode',
  'Media transcoding worker for the shumai media workspace',
  false,
)

console.log('\n✅ All applications and platform binaries built and packaged successfully!')
