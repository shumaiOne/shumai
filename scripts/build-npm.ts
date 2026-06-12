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
// Function to build main wrapper package
async function buildMainPackage({
  appName,
  description,
  hasPrisma,
  entrypoint,
  plugins = [],
  extraDependencies = {},
}: {
  appName: string
  description: string
  hasPrisma: boolean
  entrypoint: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins?: any[]
  extraDependencies?: Record<string, string>
}) {
  console.log(`\n📄 Packaging wrapper app ${appName}...`)
  const mainOutDir = path.join(distDir, appName)
  const binOutDir = path.join(mainOutDir, 'bin')
  await mkdir(binOutDir, { recursive: true })

  // 1. Bundle the JS application code for wrapper
  console.log(`📦 Bundling JS application code for wrapper ${appName}...`)
  const appJsName = `${appName}-app.js`

  const buildResult = await Bun.build({
    entrypoints: [entrypoint],
    root: '.',
    target: 'bun',
    outdir: binOutDir,
    minify: true,
    naming: `${appName}-app.[ext]`,
    plugins,
    external: commonExternal,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    publicPath: '/',
  })

  if (!buildResult.success) {
    console.error(`❌ JS bundling failed for ${appName}!`)
    for (const log of buildResult.logs) {
      console.error(log)
    }
    process.exit(1)
  }

  // Confirm that the bundle exists
  const finalJsFile = path.join(binOutDir, appJsName)
  if (!existsSync(finalJsFile)) {
    console.error(`❌ Could not find compiled JS bundle at ${finalJsFile}`)
    process.exit(1)
  }

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
  join(__dirname, '..', 'node_modules', pkgName, 'bin', binaryName), // Nested node_modules
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

const appJsPath = join(__dirname, '${appName}-app.js')

const child = spawn(binaryPath, ['run', appJsPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    BUN_BE_BUN: '1',
  },
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
const shumaiPlugins = [
  temporalWorkflow({
    bundleOptions: {},
  }),
  tailwindPlugin,
]
await buildPlatformPackages('shumai', './apps/web/src/index.ts', shumaiPlugins)
await buildMainPackage({
  appName: 'shumai',
  description: 'A fullstack AI-powered media workspace and workflow engine',
  hasPrisma: true,
  entrypoint: './apps/web/src/index.ts',
  plugins: shumaiPlugins,
})

// 3. Build shumai-agent (Agent app & platform binaries)
const agentPlugins = [
  temporalWorkflow({
    bundleOptions: {},
  }),
]
await buildPlatformPackages('shumai-agent', './apps/agent/src/index.ts', agentPlugins)
await buildMainPackage({
  appName: 'shumai-agent',
  description: 'AI worker agent for the shumai media workspace',
  hasPrisma: false,
  entrypoint: './apps/agent/src/index.ts',
  plugins: agentPlugins,
})

// 4. Build shumai-transcode (Transcode app & platform binaries)
const transcodePlugins = [
  temporalWorkflow({
    bundleOptions: {},
  }),
]
await buildPlatformPackages('shumai-transcode', './apps/transcode/src/index.ts', transcodePlugins)
await buildMainPackage({
  appName: 'shumai-transcode',
  description: 'Media transcoding worker for the shumai media workspace',
  hasPrisma: false,
  entrypoint: './apps/transcode/src/index.ts',
  plugins: transcodePlugins,
})

console.log('\n✅ All applications and platform binaries built and packaged successfully!')
