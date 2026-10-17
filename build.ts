#!/usr/bin/env bun
import { bunPluginPino } from 'bun-plugin-pino'
import tailwindPlugin from 'bun-plugin-tailwind'
import { existsSync } from 'fs'
import { rm } from 'fs/promises'

console.log('\n🚀 Starting build process...\n')

const outdir = 'dist'

if (existsSync(outdir)) {
  console.log(`🗑️ Cleaning previous build at ${outdir}`)
  await rm(outdir, { recursive: true, force: true })
}

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
  // compile: {
  //   outfile: 'Shumai',
  //   autoloadBunfig: true,
  //   autoloadDotenv: true,
  //   autoloadTsconfig: true,
  //   autoloadPackageJson: true,
  // },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})

for (const worker of [
  { entrypoint: './apps/transcode/src/index.ts', naming: 'transcode-worker.[ext]' },
  { entrypoint: './apps/agent/src/index.ts', naming: 'agent-worker.[ext]' },
]) {
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
