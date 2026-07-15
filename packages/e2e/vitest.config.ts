import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globalSetup: './packages/e2e/workflow/test-global-setup.ts',
    globals: false,
    pool: 'forks',
    include: ['packages/e2e/workflow/**/*.test.ts'],
    server: {
      deps: {
        inline: ['zod', '@shumai/workflow-core', '@temporalio/activity'],
      },
    },
  },
})
