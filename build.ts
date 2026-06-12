#!/usr/bin/env bun
import { bunPluginPino } from 'bun-plugin-pino'
import tailwindPlugin from 'bun-plugin-tailwind'
import { existsSync } from 'fs'
import { rm } from 'fs/promises'
import { temporalWorkflow } from './packages/workflow-core/src/bun-temporal-plugin'

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
  minify: false,
  naming: '[name].[ext]',
  plugins: [
    temporalWorkflow({
      bundleOptions: {},
    }),
    tailwindPlugin,
    bunPluginPino({ transports: ['pino-pretty'] }),
  ],
  external: [
    '@temporalio/activity',
    '@temporalio/client',
    '@temporalio/worker',
    '@temporalio/workflow',
  ],
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
  publicPath: '/',
})
