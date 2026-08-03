import { expect, test } from '../../fixtures'
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

test('owner should create a project with a cover image', async ({ owner, prisma }) => {
  const { page, teamId } = owner
  const projectName = `My Project ${Date.now()}`

  // Open the create project dialog
  await page.getByRole('button', { name: 'Create Project' }).click()
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()

  // Fill in project details and upload a cover image
  await dialog.locator('#name').fill(projectName)
  await dialog.locator('input[type="file"]').setInputFiles(tempImgPath)

  // Wait for image upload completion and preview
  await expect(dialog.locator('img[alt="Cover Preview"]')).toBeVisible({ timeout: 15_000 })

  // Submit and land on the project page
  await dialog.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/projects\/[^/]+/)
  await expect(page.locator(`text=${projectName}`).first()).toBeVisible()

  // Back on the dashboard the new project card is visible with its cover
  await page.click('button[aria-label="Dashboard"]')
  await expect(page).toHaveURL(/\/teams\/[^/]+/)
  await expect(page.locator(`img[alt="${projectName}"]`)).toBeVisible()

  // The project was persisted for the owner's team
  const project = await prisma.project.findFirst({ where: { name: projectName } })
  expect(project).not.toBeNull()
  expect(project?.teamId).toBe(teamId)
})
