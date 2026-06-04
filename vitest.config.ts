import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**'],
    globalSetup: './packages/db/src/test-global-setup.ts',
    globals: false,
    pool: 'forks',
    server: {
      deps: {
        inline: ['zod'],
      },
    },
  },
})
