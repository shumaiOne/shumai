import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '../../fixtures'
import { apiUploadFile, fileCard } from '../../helpers/files'

const BINARY_MIME = 'application/octet-stream'

/** Uploads an empty binary file into the project root through the API. */
async function uploadBinaryFile(
  request: APIRequestContext,
  teamId: string,
  rootFolderId: string,
  name: string,
  size = 0,
): Promise<void> {
  await apiUploadFile(request, teamId, rootFolderId, name, BINARY_MIME, Buffer.alloc(size))
}

test('owner searches the file list by an English name keyword', async ({ project }) => {
  const { page, projectId } = project

  const report2024 = 'quarterly-report-2024'
  const report2025 = 'quarterly-report-2025'
  const budget2024 = 'annual-budget-2024'

  for (const name of [report2024, report2025, budget2024]) {
    await uploadBinaryFile(project.context.request, project.teamId, project.rootFolderId, name)
  }

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, report2024)).toBeVisible()
  await expect(fileCard(page, report2025)).toBeVisible()
  await expect(fileCard(page, budget2024)).toBeVisible()

  // Open the search dialog from the toolbar
  await page.getByRole('button', { name: 'Search' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Keyword-only search (no filter conditions)
  await dialog.getByPlaceholder('Search records by name...').fill('report')
  await dialog.getByRole('button', { name: 'Search' }).click()

  await expect(dialog.getByText(report2024, { exact: true })).toBeVisible()
  await expect(dialog.getByText(report2025, { exact: true })).toBeVisible()
  await expect(dialog.getByText(budget2024, { exact: true })).not.toBeVisible()

  // Apply the search to the file list
  await dialog.getByRole('button', { name: 'Apply and Close' }).click()
  await expect(dialog).not.toBeVisible()

  await expect(fileCard(page, report2024)).toBeVisible()
  await expect(fileCard(page, report2025)).toBeVisible()
  await expect(fileCard(page, budget2024)).not.toBeVisible()
})

test('owner searches the file list by Chinese, Japanese, and Korean name keywords', async ({
  project,
}) => {
  const { page, projectId } = project

  const zhDoc = '产品需求文档-2024'
  const zhDesign = '产品设计文档-2025'
  const jaDoc = '日本語ドキュメント'
  const koDoc = '한국어문서'

  for (const name of [zhDoc, zhDesign, jaDoc, koDoc]) {
    await uploadBinaryFile(project.context.request, project.teamId, project.rootFolderId, name)
  }

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, zhDoc)).toBeVisible()

  const searchByName = async (keyword: string, visible: string[], hidden: string[]) => {
    await page.getByRole('button', { name: 'Search' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByPlaceholder('Search records by name...').fill(keyword)
    await dialog.getByRole('button', { name: 'Search' }).click()
    for (const name of visible) {
      await expect(dialog.getByText(name, { exact: true })).toBeVisible()
    }
    for (const name of hidden) {
      await expect(dialog.getByText(name, { exact: true })).not.toBeVisible()
    }
    await dialog.getByRole('button', { name: 'Apply and Close' }).click()
    await expect(dialog).not.toBeVisible()
  }

  // Chinese keyword
  await searchByName('需求', [zhDoc], [zhDesign, jaDoc, koDoc])
  await expect(fileCard(page, zhDoc)).toBeVisible()
  await expect(fileCard(page, zhDesign)).not.toBeVisible()

  // Japanese keyword
  await searchByName('ドキュメント', [jaDoc], [zhDoc, zhDesign, koDoc])
  await expect(fileCard(page, jaDoc)).toBeVisible()
  await expect(fileCard(page, zhDoc)).not.toBeVisible()

  // Korean keyword
  await searchByName('한국어', [koDoc], [zhDoc, zhDesign, jaDoc])
  await expect(fileCard(page, koDoc)).toBeVisible()
  await expect(fileCard(page, jaDoc)).not.toBeVisible()
})

test('owner searches the file list with a keyword and a filter condition', async ({ project }) => {
  const { page, projectId } = project

  const bigReport = 'quarterly-report-2024'
  const smallReport = 'quarterly-report-2025'

  await uploadBinaryFile(
    project.context.request,
    project.teamId,
    project.rootFolderId,
    bigReport,
    1000,
  )
  await uploadBinaryFile(
    project.context.request,
    project.teamId,
    project.rootFolderId,
    smallReport,
    10,
  )

  await page.goto(`/projects/${projectId}`)
  await expect(fileCard(page, bigReport)).toBeVisible()
  await expect(fileCard(page, smallReport)).toBeVisible()

  // Open the search dialog from the toolbar
  await page.getByRole('button', { name: 'Search' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.getByPlaceholder('Search records by name...').fill('report')

  // Add a "Size > 100" filter condition on top of the keyword
  await dialog.getByRole('button', { name: '+ Add condition' }).click()

  const comboboxes = dialog.getByRole('combobox')
  await comboboxes.first().click()
  await page.getByRole('option', { name: 'Size', exact: true }).click()

  await comboboxes.nth(1).click()
  await page.getByRole('option', { name: '>', exact: true }).click()

  await dialog.locator('input[type="number"]').fill('100')
  // The condition value is applied after the debounced input; the badge
  // confirms the filter became active before we run the search.
  await expect(dialog.getByText('1 active')).toBeVisible()

  await dialog.getByRole('button', { name: 'Search' }).click()
  await expect(dialog.getByText(bigReport, { exact: true })).toBeVisible()
  await expect(dialog.getByText(smallReport, { exact: true })).not.toBeVisible()

  // Apply the keyword + filter to the file list
  await dialog.getByRole('button', { name: 'Apply and Close' }).click()
  await expect(dialog).not.toBeVisible()

  await expect(fileCard(page, bigReport)).toBeVisible()
  await expect(fileCard(page, smallReport)).not.toBeVisible()
})
