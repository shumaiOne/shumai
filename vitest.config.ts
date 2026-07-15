import tsconfigPaths from 'vite-tsconfig-paths'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globalSetup: './packages/db/src/test-global-setup.ts',
    globals: false,
    pool: 'forks',
    exclude: [
      ...configDefaults.exclude,
      'packages/webui/e2e/**',
      'apps/web/e2e/**',
      'packages/e2e/**',
    ],
    server: {
      deps: {
        inline: ['zod', '@shumai/workflow-core', '@temporalio/activity'],
      },
    },
  },
})
