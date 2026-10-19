#!/usr/bin/env bun
import { bunPluginPino } from 'bun-plugin-pino'
import tailwindPlugin from 'bun-plugin-tailwind'
import { existsSync } from 'fs'
import { rm } from 'fs/promises'

console.log('\n🚀 Starting build process...\n')

const outdir = 'dist'
const target = process.argv[2] || 'all'

if (existsSync(outdir) && target === 'all') {
  console.log(`🗑️ Cleaning previous build at ${outdir}`)
  await rm(outdir, { recursive: true, force: true })
}

if (target === 'all' || target === 'web') {
  await Bun.build({
    entrypoints: ['./apps/web/src/index.ts'],
    root: '.',
    target: 'bun',
    outdir: outdir,
    minify: true,
    splitting: true,
    naming: '[name].[ext]',
    plugins: [tailwindPlugin, bunPluginPino({ transports: ['pino-pretty'] })],
    external: ['@dbos-inc/dbos-sdk', 'pg', 'pdfkit'],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  })
}

const allWorkers = [
  {
    name: 'transcode',
    entrypoint: './apps/transcode/src/index.ts',
    naming: 'transcode-worker.[ext]',
  },
  { name: 'agent', entrypoint: './apps/agent/src/index.ts', naming: 'agent-worker.[ext]' },
]

const workersToBuild = target === 'all' ? allWorkers : allWorkers.filter((w) => w.name === target)

for (const worker of workersToBuild) {
  await Bun.build({
    entrypoints: [worker.entrypoint],
    root: '.',
    target: 'bun',
    outdir: outdir,
    minify: true,
    splitting: false,
    naming: worker.naming,
    plugins: [bunPluginPino({ transports: ['pino-pretty'] })],
    external: ['@dbos-inc/dbos-sdk', 'pg', 'pdfkit'],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  })
}
