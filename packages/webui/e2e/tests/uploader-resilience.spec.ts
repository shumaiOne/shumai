import { expect, test } from '@playwright/test'

test.describe('Uploader Resilience E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Default route mocks for the isolated harness
    await page.route('**/api/teams/**/upload/tasks/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }),
    )
  })

  test('keeps upload active on network drop and automatically resumes on reconnection', async ({
    page,
  }) => {
    let isOffline = false
    let markFirstSignStarted: () => void = () => {}
    const firstSignStarted = new Promise<void>((resolve) => {
      markFirstSignStarted = resolve
    })
    let releaseSign: () => void = () => {}
    const signGate = new Promise<void>((resolve) => {
      releaseSign = resolve
    })

    let signCalls = 0
    await page.route('**/api/teams/**/upload/sign', async (route) => {
      signCalls++
      if (signCalls === 1) {
        markFirstSignStarted()
        // Wait until the browser is offline before failing the in-flight sign request
        await signGate
      }
      if (isOffline) {
        // Playwright route.fulfill() bypasses context.setOffline(true) in Chromium,
        // so explicitly abort mocked requests while offline to simulate a real network drop.
        await route.abort('internetdisconnected').catch(() => {})
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'http://localhost:5199/mock-upload' }),
      })
    })

    await page.route('**/mock-upload', async (route) => {
      if (isOffline) {
        await route.abort('internetdisconnected').catch(() => {})
        return
      }
      await route.fulfill({
        status: 200,
        headers: { ['ETag']: '"test-etag"' },
      })
    })

    await page.goto('/?view=uploader')
    await expect(page.getByTestId('upload-status')).toHaveText('idle')

    // Start upload and wait until the first sign request is in flight
    await page.getByTestId('start-upload-btn').click()
    await expect(page.getByTestId('upload-status')).toHaveText('uploading')
    await firstSignStarted

    // Simulate cutting the connection
    isOffline = true
    await page.context().setOffline(true)
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false)
    releaseSign()

    // Status remains 'uploading' during offline state and no error toast appears
    await page.waitForTimeout(500)
    await expect(page.getByTestId('upload-status')).toHaveText('uploading')
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0)

    // Reconnect network
    isOffline = false
    await page.context().setOffline(false)

    // Upload automatically resumes and completes
    await expect(page.getByTestId('upload-status')).toHaveText('completed', { timeout: 15_000 })
    expect(signCalls).toBeGreaterThanOrEqual(2)
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0)
  })

  test('retries with backoff on in-flight socket drop and completes when network recovers', async ({
    page,
  }) => {
    let signCalls = 0
    await page.route('**/api/teams/**/upload/sign', (route) => {
      signCalls++
      if (signCalls <= 2) {
        // In-flight connection reset / socket drop
        route.abort('connectionreset')
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: 'http://localhost:5199/mock-upload' }),
        })
      }
    })

    await page.route('**/mock-upload', (route) =>
      route.fulfill({
        status: 200,
        headers: { ['ETag']: '"test-etag"' },
      }),
    )

    await page.goto('/?view=uploader')
    await page.getByTestId('start-upload-btn').click()

    await expect(page.getByTestId('upload-status')).toHaveText('uploading')
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0)

    // After backoff retries, succeeds on attempt 3
    await expect(page.getByTestId('upload-status')).toHaveText('completed', { timeout: 15_000 })
    expect(signCalls).toBeGreaterThanOrEqual(3)
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0)
  })

  test('retries continuously on 502 Bad Gateway and recovers once server returns 200', async ({
    page,
  }) => {
    let signAttempts = 0
    await page.route('**/api/teams/**/upload/sign', (route) => {
      signAttempts++
      if (signAttempts <= 2) {
        // Return 502 Bad Gateway for the first 2 attempts
        route.fulfill({
          status: 502,
          contentType: 'text/html',
          body: '<html><body>502 Bad Gateway</body></html>',
        })
      } else {
        // Server recovers on attempt 3
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: 'http://localhost:5199/mock-upload' }),
        })
      }
    })

    await page.route('**/mock-upload', (route) =>
      route.fulfill({
        status: 200,
        headers: { ['ETag']: '"test-etag"' },
      }),
    )

    await page.goto('/?view=uploader')
    await page.getByTestId('start-upload-btn').click()

    // Verify it stays uploading without failing on 502
    await expect(page.getByTestId('upload-status')).toHaveText('uploading')
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0)

    // Once server recovers, upload completes
    await expect(page.getByTestId('upload-status')).toHaveText('completed', { timeout: 15_000 })
    expect(signAttempts).toBeGreaterThanOrEqual(3)
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0)
  })

  test('halts immediately without retrying on 500 Internal Server Error', async ({ page }) => {
    let signAttempts = 0
    await page.route('**/api/teams/**/upload/sign', (route) => {
      signAttempts++
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      })
    })

    await page.goto('/?view=uploader')
    await page.getByTestId('start-upload-btn').click()

    // Must fail immediately with error toast
    await expect(page.getByTestId('upload-status')).toHaveText('failed', { timeout: 5_000 })
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible({
      timeout: 5_000,
    })
    // 0 retries (attempt count must be 1)
    expect(signAttempts).toBe(1)
  })

  test('halts immediately without retrying on 403 Forbidden', async ({ page }) => {
    let signAttempts = 0
    await page.route('**/api/teams/**/upload/sign', (route) => {
      signAttempts++
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Forbidden' }),
      })
    })

    await page.goto('/?view=uploader')
    await page.getByTestId('start-upload-btn').click()

    // Must fail immediately with error toast
    await expect(page.getByTestId('upload-status')).toHaveText('failed', { timeout: 5_000 })
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible({
      timeout: 5_000,
    })
    // 0 retries (attempt count must be 1)
    expect(signAttempts).toBe(1)
  })
})
