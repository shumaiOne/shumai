import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for the monorepo integration and E2E tests.
 *
 * We support two test projects:
 * 1. harness: pure frontend UI integration tests served on port 5199.
 * 2. app: fullstack end-to-end tests with real backend, pgvector container, and S3 local storage on port 5200.
 */
export default defineConfig({
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  globalTeardown: './apps/web/e2e/global-teardown.ts',

  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },

  projects: [
    /* Harness Integration Projects */
    {
      name: 'harness-chromium',
      testDir: './packages/webui/e2e/tests',
      use: {
        ...devices['Desktop Chrome'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        baseURL: 'http://localhost:5199',
      },
    },
    {
      name: 'harness-firefox',
      testDir: './packages/webui/e2e/tests',
      use: {
        ...devices['Desktop Firefox'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        baseURL: 'http://localhost:5199',
      },
    },
    {
      name: 'harness-webkit',
      testDir: './packages/webui/e2e/tests',
      use: {
        ...devices['Desktop Safari'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        baseURL: 'http://localhost:5199',
      },
    },

    /* Fullstack App E2E Projects */
    {
      name: 'app-chromium',
      testDir: './apps/web/e2e',
      fullyParallel: false, // run sequentially to avoid DB and storage conflicts
      use: {
        ...devices['Desktop Chrome'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        baseURL: 'http://localhost:5200',
      },
    },
    {
      name: 'app-firefox',
      testDir: './apps/web/e2e',
      fullyParallel: false,
      use: {
        ...devices['Desktop Firefox'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        baseURL: 'http://localhost:5200',
      },
    },
    {
      name: 'app-webkit',
      testDir: './apps/web/e2e',
      fullyParallel: false,
      use: {
        ...devices['Desktop Safari'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        baseURL: 'http://localhost:5200',
      },
    },
  ],

  // Launch both the isolated harness server and the fullstack web app server
  webServer: [
    {
      command: 'bun run packages/webui/e2e/harness/serve.ts',
      url: 'http://localhost:5199',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'bun run apps/web/e2e/serve.ts',
      url: 'http://localhost:5200',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
