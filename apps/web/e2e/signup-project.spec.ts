import { expect, test } from './fixtures'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const tempImgPath = path.resolve(currentDir, 'temp-cover.png')

test.beforeAll(async () => {
  // Create a 1x1 transparent PNG file
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  fs.writeFileSync(tempImgPath, Buffer.from(pngBase64, 'base64'))
})

test.afterAll(async () => {
  if (fs.existsSync(tempImgPath)) {
    fs.unlinkSync(tempImgPath)
  }
})

test('should sign up and create a project with a cover image', async ({ page }) => {
  const email = `test-${Date.now()}@shumai.local`
  const password = 'Password123!'

  // 1. Sign Up Flow
  await page.goto('/signup')
  await expect(page).toHaveURL(/\/signup/)

  // Fill credentials
  await page.fill('#email', email)
  await page.fill('#password', password)

  // Submit sign up
  await page.click('button[type="submit"]')

  // Wait for the automatic redirect to the team page (since only one team exists)
  await expect(page).toHaveURL(/\/teams\/[^/]+/)

  // 2. Create Project Flow
  // Click the "Create Project" button on the dashboard
  await page.click('button:has-text("Create Project")')

  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()

  // Fill project name
  const projectName = `My Project ${Date.now()}`
  await dialog.locator('#name').fill(projectName)

  // Set cover image
  await dialog.locator('input[type="file"]').setInputFiles(tempImgPath)

  // Wait for image upload completion and preview
  await expect(dialog.locator('img[alt="Cover Preview"]')).toBeVisible({ timeout: 15_000 })

  // Click submit in dialog
  await dialog.locator('button[type="submit"]').click()

  // Wait for navigation to the project page
  await expect(page).toHaveURL(/\/projects\/[^/]+/)

  // Verify project name appears in the project view
  await expect(page.locator(`text=${projectName}`).first()).toBeVisible()

  // 3. Verification on Dashboard
  // Navigate back to the dashboard via sidebar
  await page.click('button[aria-label="Dashboard"]')

  // Wait for dashboard URL
  await expect(page).toHaveURL(/\/teams\/[^/]+/)

  // Verify the project card is visible and displays the cover image with project name alt text
  await expect(page.locator(`img[alt="${projectName}"]`)).toBeVisible()
})
