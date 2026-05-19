import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globalSetup: './src/test-global-setup.ts',
    globals: false,
    pool: 'forks',
    server: {
      deps: {
        inline: ['zod'],
      },
    },
  },
})
