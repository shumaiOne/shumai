#!/usr/bin/env bun
import { temporalWorkflow } from './packages/workflow-core/src/bun-temporal-plugin'
import { bunPluginPino } from 'bun-plugin-pino'
import tailwindPlugin from 'bun-plugin-tailwind'
import { existsSync } from 'fs'
import { rm } from 'fs/promises'
import { resolve } from 'path'

console.log('\n🚀 Starting build process...\n')

const outdir = 'dist'

if (existsSync(outdir)) {
  console.log(`🗑️ Cleaning previous build at ${outdir}`)
  await rm(outdir, { recursive: true, force: true })
}

await Bun.build({
  entrypoints: ['./packages/api/src/index.ts'],
  target: 'bun',
  outdir: outdir,
  minify: false,
  plugins: [
    temporalWorkflow({
      bundleOptions: {
        webpackConfigHook: (config) => {
          if (!config.resolve) config.resolve = {}
          if (!config.resolve.alias) config.resolve.alias = {}
          // @ts-ignore
          config.resolve.alias['@'] = resolve(process.cwd(), 'packages')
          return config
        },
      },
    }),
    tailwindPlugin,
    bunPluginPino({ transports: ['pino-pretty'] }),
  ],
  external: [
    '@temporalio/activity',
    '@temporalio/client',
    '@temporalio/worker',
    '@temporalio/workflow',
    '@shumai/core',
    '@shumai/db',
    '@shumai/dtos',
    '@shumai/workflow-core',
    '@shumai/agent',
    '@shumai/transcode',
    '@shumai/worker-db',
    '@shumai/api',
    '@shumai/webui',
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
