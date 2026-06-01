#!/usr/bin/env bun
import { temporalWorkflow } from './src/workflow/bun-temporal-plugin'
import { resolve } from 'path'

console.log('\n🚀 Starting agent build process...\n')

await Bun.build({
  entrypoints: ['./src/agent-worker-bin.ts'],
  target: 'bun',
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
  ],
  external: [
    '@temporalio/activity',
    '@temporalio/client',
    '@temporalio/worker',
    '@temporalio/workflow',
  ],
  compile: {
    outfile: 'shumai-agent',
    autoloadBunfig: true,
    autoloadDotenv: true,
    autoloadTsconfig: true,
    autoloadPackageJson: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})

console.log('\n✅ Agent binary compiled successfully as shumai-agent!\n')
