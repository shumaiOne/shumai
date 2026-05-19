#!/usr/bin/env bun
import { temporalWorkflow } from './src/workflow/bun-temporal-plugin'
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
  entrypoints: ['./src/index.ts'],
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
          config.resolve.alias['@'] = resolve(process.cwd(), 'src')
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
