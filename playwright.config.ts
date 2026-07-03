import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for the webui UI integration tests.
 *
 * The suite runs against a backend-free harness (packages/webui/e2e) served by
 * Bun's native HTML bundler, so no database, auth or transcode pipeline is
 * required.
 *
 * Browser selection: pass `--project=<name>` to pick an engine, e.g.
 *   bun run test:e2e --project=webkit    # WebKit (Safari engine), used on macOS CI
 *   bun run test:e2e --project=chromium
 *   bun run test:e2e --project=firefox
 */
export default defineConfig({
  testDir: './packages/webui/e2e/tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    // `baseURL` is Playwright's required option key and cannot be renamed.
    // eslint-disable-next-line @typescript-eslint/naming-convention
    baseURL: 'http://localhost:5199',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Launch the isolated harness dev server (Bun's native HTML bundler) before
  // the tests.
  webServer: {
    command: 'bun run packages/webui/e2e/harness/serve.ts',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
