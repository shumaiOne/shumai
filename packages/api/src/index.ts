import { loadEnvConfig } from '@shumai/core/src/env-loader'
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

const command = process.argv[2]

if (command === 'worker') {
  const { run } = await import('./worker')
  run().catch((err) => {
    console.error(err)
    process.exit(1)
  })
} else {
  // Default or 'serve' command
  const { run } = await import('./serve')
  run().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

// Re-export AppType for frontend client.ts usage (type-only)
export type { AppType } from './serve'
