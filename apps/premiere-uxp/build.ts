#!/usr/bin/env bun
import { cp, rm, mkdir } from 'node:fs/promises'
import { existsSync, watch } from 'node:fs'
import { $ } from 'bun'

const isWatch = process.argv.includes('--watch')
const isPackage = process.argv.includes('--package')

async function build(): Promise<boolean> {
  const start = performance.now()
  try {
    if (!existsSync('dist')) {
      await mkdir('dist', { recursive: true })
    }

    // 1. Copy public assets (manifest, index.html, styles, icons)
    await cp('public', 'dist', { recursive: true })

    // 2. Bundle with Bun.build
    const result = await Bun.build({
      entrypoints: ['./src/index.tsx'],
      outdir: './dist',
      naming: 'index.js',
      target: 'browser',
      format: 'cjs',
      sourcemap: 'external',
      minify: false,
      external: ['os', 'premierepro', 'uxp'],
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
    })

    if (!result.success) {
      console.error('❌ Build failed:')
      for (const log of result.logs) {
        console.error(log)
      }
      return false
    }

    const elapsed = (performance.now() - start).toFixed(1)
    console.log(`✅ Build completed in ${elapsed}ms`)

    // 3. Package .ccx if requested
    if (isPackage) {
      console.log('📦 Packaging shumai-premiere.ccx...')
      await $`cd dist && zip -r ../shumai-premiere.ccx . -x '*.map'`
      console.log('✅ Package created.')
    }

    return true
  } catch (err) {
    console.error('❌ Build error:', err)
    return false
  }
}

// Clean and run initial build
if (existsSync('dist')) {
  await rm('dist', { recursive: true, force: true })
}
const success = await build()
if (!success && !isWatch) {
  process.exit(1)
}

// Watch mode
if (isWatch) {
  console.log('👀 Watching src/ and public/ for changes...')
  let building = false
  const triggerRebuild = async (dir: string) => {
    if (building) return
    building = true
    setTimeout(async () => {
      console.log(`\n🔄 Change detected in ${dir}, rebuilding...`)
      await build()
      building = false
    }, 50)
  }

  watch('./src', { recursive: true }, () => triggerRebuild('src'))
  watch('./public', { recursive: true }, () => triggerRebuild('public'))
}
