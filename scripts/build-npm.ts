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

// Function to compile a single application
async function compileApp({
  name,
  entrypoint,
  outdir,
  binaryName,
  plugins = [],
  external = commonExternal,
}: {
  name: string
  entrypoint: string
  outdir: string
  binaryName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins?: any[]
  external?: string[]
}) {
  console.log(`\n📦 Building ${name}...`)
  await mkdir(outdir, { recursive: true })

  const result = await Bun.build({
    entrypoints: [entrypoint],
    root: '.',
    target: 'bun',
    outdir: outdir,
    minify: true,
    compile: {
      autoloadPackageJson: true,
    },
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
  // For './apps/web/src/index.ts', './apps/agent/src/index.ts', './apps/transcode/src/index.ts', the parent is 'src'
  const generatedFile = path.join(outdir, 'src')
  const finalFile = path.join(outdir, binaryName)

  if (existsSync(generatedFile)) {
    console.log(`➡️ Moving binary to final location: ${finalFile}`)
    await cp(generatedFile, finalFile)
    await rm(generatedFile)
  } else {
    console.error(`❌ Could not find compiled binary at ${generatedFile}`)
    process.exit(1)
  }
}

// 2. Build Main App (shumai)
const shumaiOutDir = path.join(distDir, 'shumai')
await compileApp({
  name: 'shumai',
  entrypoint: './apps/web/src/index.ts',
  outdir: shumaiOutDir,
  binaryName: 'shumai',
  plugins: [
    temporalWorkflow({
      bundleOptions: {},
    }),
    tailwindPlugin,
  ],
})

// Copy database schema and migrations for main app
console.log('📂 Copying database files for shumai...')
const dbDest = path.join(shumaiOutDir, 'prisma')
await mkdir(dbDest, { recursive: true })
await cp('./packages/db/prisma/schema.prisma', path.join(dbDest, 'schema.prisma'))
if (existsSync('./packages/db/prisma/migrations')) {
  await cp('./packages/db/prisma/migrations', path.join(dbDest, 'migrations'), { recursive: true })
}

// Generate package.json for main app
console.log('📄 Generating package.json for shumai...')
const shumaiPackageJson = {
  name: 'shumai',
  version,
  description: 'A fullstack AI-powered media workspace and workflow engine',
  type: 'module',
  bin: {
    shumai: './shumai',
  },
  files: ['shumai', 'prisma'],
  dependencies: {
    '@prisma/client': '^7.7.0',
    '@prisma/adapter-pg': '^7.7.0',
    pg: '^8.20.0',
    sharp: '^0.34.5',
    pino: '^10.3.1',
    'pino-pretty': '^13.1.3',
    '@temporalio/activity': '^1.16.1',
    '@temporalio/client': '^1.16.1',
    '@temporalio/worker': '^1.16.1',
    '@temporalio/workflow': '^1.16.1',
    prisma: '^7.7.0',
  },
}
await writeFile(
  path.join(shumaiOutDir, 'package.json'),
  JSON.stringify(shumaiPackageJson, null, 2),
  'utf-8',
)

// 3. Build Agent App (shumai-agent)
const agentOutDir = path.join(distDir, 'shumai-agent')
await compileApp({
  name: 'shumai-agent',
  entrypoint: './apps/agent/src/index.ts',
  outdir: agentOutDir,
  binaryName: 'shumai-agent',
  plugins: [
    temporalWorkflow({
      bundleOptions: {},
    }),
  ],
})

// Generate package.json for agent app
console.log('📄 Generating package.json for shumai-agent...')
const agentPackageJson = {
  name: 'shumai-agent',
  version,
  description: 'AI worker agent for the shumai media workspace',
  type: 'module',
  bin: {
    'shumai-agent': './shumai-agent',
  },
  files: ['shumai-agent'],
  dependencies: {
    '@prisma/client': '^7.7.0',
    '@prisma/adapter-pg': '^7.7.0',
    pg: '^8.20.0',
    sharp: '^0.34.5',
    pino: '^10.3.1',
    'pino-pretty': '^13.1.3',
    '@temporalio/activity': '^1.16.1',
    '@temporalio/client': '^1.16.1',
    '@temporalio/worker': '^1.16.1',
    '@temporalio/workflow': '^1.16.1',
    prisma: '^7.7.0',
  },
}
await writeFile(
  path.join(agentOutDir, 'package.json'),
  JSON.stringify(agentPackageJson, null, 2),
  'utf-8',
)

// 4. Build Transcode App (shumai-transcode)
const transcodeOutDir = path.join(distDir, 'shumai-transcode')
await compileApp({
  name: 'shumai-transcode',
  entrypoint: './apps/transcode/src/index.ts',
  outdir: transcodeOutDir,
  binaryName: 'shumai-transcode',
  plugins: [
    temporalWorkflow({
      bundleOptions: {},
    }),
  ],
})

// Generate package.json for transcode app
console.log('📄 Generating package.json for shumai-transcode...')
const transcodePackageJson = {
  name: 'shumai-transcode',
  version,
  description: 'Media transcoding worker for the shumai media workspace',
  type: 'module',
  bin: {
    'shumai-transcode': './shumai-transcode',
  },
  files: ['shumai-transcode'],
  dependencies: {
    '@prisma/client': '^7.7.0',
    '@prisma/adapter-pg': '^7.7.0',
    pg: '^8.20.0',
    sharp: '^0.34.5',
    pino: '^10.3.1',
    'pino-pretty': '^13.1.3',
    '@temporalio/activity': '^1.16.1',
    '@temporalio/client': '^1.16.1',
    '@temporalio/worker': '^1.16.1',
    '@temporalio/workflow': '^1.16.1',
    prisma: '^7.7.0',
  },
}
await writeFile(
  path.join(transcodeOutDir, 'package.json'),
  JSON.stringify(transcodePackageJson, null, 2),
  'utf-8',
)

console.log('\n✅ All applications built and packaged successfully!')
