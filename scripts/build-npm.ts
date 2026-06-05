import { rm, mkdir, cp, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import tailwindPlugin from 'bun-plugin-tailwind'
import { temporalWorkflow } from '../packages/workflow-core/src/bun-temporal-plugin'

console.log('\n🚀 Starting NPM packaging build process...\n')

const outdir = path.join(process.cwd(), 'dist')

// 1. Clean previous build
if (existsSync(outdir)) {
  console.log(`🗑️ Cleaning previous build at ${outdir}`)
  await rm(outdir, { recursive: true, force: true })
}
await mkdir(outdir, { recursive: true })

// 2. Build & Compile to standalone executable
console.log('📦 Compiling to standalone binary...')
const result = await Bun.build({
  entrypoints: ['./apps/web/src/index.ts'],
  root: '.',
  target: 'bun',
  outdir: outdir,
  minify: true,
  compile: {
    autoloadPackageJson: true,
  },
  plugins: [
    temporalWorkflow({
      bundleOptions: {},
    }),
    tailwindPlugin,
  ],
  external: [
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
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  publicPath: '/',
})

if (!result.success) {
  console.error('❌ Binary compilation failed!')
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

// 3. Rename generated binary to 'shumai'
// Entrypoint './apps/web/src/index.ts' with outdir 'dist' outputs to 'dist/src' (parent folder name of the entrypoint)
const generatedFile = path.join(outdir, 'src')
const finalFile = path.join(outdir, 'shumai')

if (existsSync(generatedFile)) {
  console.log(`➡️ Moving binary to final location: ${finalFile}`)
  await cp(generatedFile, finalFile)
  // Remove the generated source file
  await rm(generatedFile)
} else {
  console.error(`❌ Could not find compiled binary at ${generatedFile}`)
  process.exit(1)
}

// 4. Copy database schema and migrations
console.log('📂 Copying database files...')
const dbDest = path.join(outdir, 'prisma')
await mkdir(dbDest, { recursive: true })
await cp('./packages/db/prisma/schema.prisma', path.join(dbDest, 'schema.prisma'))
if (existsSync('./packages/db/prisma/migrations')) {
  await cp('./packages/db/prisma/migrations', path.join(dbDest, 'migrations'), { recursive: true })
}

// 5. Generate package.json
console.log('📄 Generating package.json...')
const rootPackageJson = JSON.parse(await Bun.file('package.json').text())
const packageJsonContent = {
  name: 'shumai',
  version: rootPackageJson.version || '0.1.0',
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
  path.join(outdir, 'package.json'),
  JSON.stringify(packageJsonContent, null, 2),
  'utf-8',
)

console.log('✅ Build completed successfully!')
