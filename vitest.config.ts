import tsconfigPaths from 'vite-tsconfig-paths'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globalSetup: './packages/db/src/test-global-setup.ts',
    globals: false,
    pool: 'forks',
    // Playwright e2e specs live under packages/webui/e2e and are run by the
    // Playwright runner (bun run test:e2e), not Vitest.
    exclude: [...configDefaults.exclude, 'packages/webui/e2e/**'],
    server: {
      deps: {
        inline: ['zod'],
      },
    },
  },
})
