import type { APIRequestContext } from '@playwright/test'
import type { AssetInfo, ImageSearchRequest, SearchRequest } from '@shumai/dtos'
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
  await dialog.getByRole('button', { name: 'Search', exact: true }).click()

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
    await dialog.getByRole('button', { name: 'Search', exact: true }).click()
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

  await dialog.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(dialog.getByText(bigReport, { exact: true })).toBeVisible()
  await expect(dialog.getByText(smallReport, { exact: true })).not.toBeVisible()

  // Apply the keyword + filter to the file list
  await dialog.getByRole('button', { name: 'Apply and Close' }).click()
  await expect(dialog).not.toBeVisible()

  await expect(fileCard(page, bigReport)).toBeVisible()
  await expect(fileCard(page, smallReport)).not.toBeVisible()
})

test.describe('image search', () => {
  test.use({ fileOptions: { mediaType: 'image' } })

  test('owner previews matched video ranges in both search dialogs', async ({ file }) => {
    const { page, teamId, projectId, rootFolderId, fileName } = file
    const video: AssetInfo = {
      id: 'video-result',
      name: 'result.mp4',
      type: 'file',
      sizeByte: 100,
      fileCount: 1,
      status: 'processed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      proxyType: 'video',
      preview: {
        thumbnailUrl: '/test-sprites/poster.svg',
        spriteUrl: '/test-sprites/full.svg',
        originalWidth: 100,
        originalHeight: 40,
      },
      startTime: 0,
      endTime: 30,
      matchedSprite: { url: '/test-sprites/chunk.svg', columns: 5, rows: 2, frameCount: 7 },
    }
    const brokenMatch: AssetInfo = {
      ...video,
      startTime: 25,
      endTime: 40,
      matchedSprite: { url: '/test-sprites/broken.svg', columns: 5, rows: 2, frameCount: 7 },
    }
    await page.route(`**/api/teams/${teamId}/settings`, async (route) => {
      const response = await route.fetch()
      await route.fulfill({
        response,
        json: { ...(await response.json()), semanticSearchEnabled: true },
      })
    })
    const results = { json: { data: [video, brokenMatch], pageInfo: { total: 2 } } }
    await page.route(`**/api/folders/${rootFolderId}/image-search`, (route) =>
      route.fulfill(results),
    )
    await page.route(`**/api/folders/${rootFolderId}/search`, (route) => {
      const request = route.request().postDataJSON() as SearchRequest | null
      return request?.isSemantic ? route.fulfill(results) : route.continue()
    })
    await page.route('**/test-sprites/*.svg', (route) =>
      route.request().url().endsWith('/broken.svg')
        ? route.fulfill({ status: 404 })
        : route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"/>',
          }),
    )

    await page.goto(`/projects/${projectId}`)
    await fileCard(page, fileName).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Find similar' }).click()
    const findSimilar = page.getByRole('dialog', { name: 'Find similar' })
    await findSimilar.getByTestId('sprite-scrubber').nth(0).hover()
    await expect(findSimilar.locator('[style*="/test-sprites/chunk.svg"]')).toHaveCount(1)
    await findSimilar.getByTestId('sprite-scrubber').nth(1).hover()
    await expect(findSimilar.locator('[style*="/test-sprites/full.svg"]')).toHaveCount(1)

    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Search' }).click()
    const semanticSearch = page.getByRole('dialog', { name: 'Search', exact: true })
    await semanticSearch.getByRole('switch', { name: 'Semantic Search' }).click()
    const searchInput = semanticSearch.getByPlaceholder('Search records by content...')
    await searchInput.fill('video scene')
    await searchInput.press('Enter')
    await semanticSearch.getByTestId('sprite-scrubber').nth(0).hover()
    await expect(semanticSearch.locator('[style*="/test-sprites/chunk.svg"]')).toHaveCount(1)
    await semanticSearch.getByTestId('sprite-scrubber').nth(1).hover()
    await expect(semanticSearch.locator('[style*="/test-sprites/full.svg"]')).toHaveCount(1)
  })

  test('owner finds similar media and filters the results by type', async ({ file }) => {
    const { page, teamId, projectId, rootFolderId, fileId, fileName } = file
    const source = fileCard(page, fileName)
    await page.goto(`/projects/${projectId}`)
    await source.click({ button: 'right' })
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Find similar' })).toHaveCount(0)

    await page.route(`**/api/teams/${teamId}/settings`, async (route) => {
      const response = await route.fetch()
      await route.fulfill({
        response,
        json: { ...(await response.json()), semanticSearchEnabled: true },
      })
    })
    const image: AssetInfo = {
      id: 'image-result',
      name: 'result.jpg',
      type: 'file',
      sizeByte: 100,
      fileCount: 1,
      status: 'processed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      proxyType: 'image',
    }
    const video: AssetInfo = {
      ...image,
      id: 'video-result',
      name: 'result.mp4',
      proxyType: 'video',
      startTime: 65,
      endTime: 120,
    }
    const requests: ImageSearchRequest[] = []
    await page.route(`**/api/folders/${rootFolderId}/image-search`, async (route) => {
      const request = route.request().postDataJSON() as ImageSearchRequest
      requests.push(request)
      const data =
        request.mediaType === 'image'
          ? [image]
          : request.mediaType === 'video'
            ? [video]
            : [image, video]
      await route.fulfill({ json: { data, pageInfo: { total: data.length } } })
    })

    const settingsLoaded = page.waitForResponse(`**/api/teams/${teamId}/settings`)
    await page.reload()
    await settingsLoaded
    await source.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Find similar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Find similar' })
    await expect(dialog.getByText(image.name)).toBeVisible()
    await expect(dialog.getByText(video.name)).toBeVisible()
    await expect(dialog.getByTestId('file-preview-matched-duration')).toHaveText('01:05 - 02:00')
    expect(requests.at(-1)).toMatchObject({ sourceAssetId: fileId, first: 20 })

    await dialog.getByText('Videos', { exact: true }).click()
    await expect(dialog.getByText(video.name)).toBeVisible()
    await expect(dialog.getByText(image.name)).toHaveCount(0)
    expect(requests.at(-1)).toMatchObject({ sourceAssetId: fileId, mediaType: 'video' })

    await dialog.getByText('Images', { exact: true }).click()
    await expect(dialog.getByText(image.name)).toBeVisible()
    await expect(dialog.getByText(video.name)).toHaveCount(0)
    expect(requests.at(-1)).toMatchObject({ sourceAssetId: fileId, mediaType: 'image' })
  })

  test('owner submits a resized image with filters and can remove the attachment', async ({
    project,
    browserName,
  }) => {
    const { page, teamId, projectId, rootFolderId } = project
    await page.route(`**/api/teams/${teamId}/settings`, async (route) => {
      const response = await route.fetch()
      await route.fulfill({
        response,
        json: { ...(await response.json()), semanticSearchEnabled: true },
      })
    })
    const requests: ImageSearchRequest[] = []
    await page.route(`**/api/folders/${rootFolderId}/image-search`, async (route) => {
      requests.push(route.request().postDataJSON() as ImageSearchRequest)
      await route.fulfill({ json: { data: [], pageInfo: { total: 0 } } })
    })

    await page.goto(`/projects/${projectId}`)
    await page.getByRole('button', { name: 'Search' }).click()
    const dialog = page.getByRole('dialog', { name: 'Search', exact: true })
    const semantic = dialog.getByRole('switch', { name: 'Semantic Search' })
    await expect(semantic).toBeEnabled()
    await semantic.click()
    await dialog.getByPlaceholder('Search records by content...').fill('text draft')

    await dialog.getByRole('button', { name: '+ Add condition' }).click()
    const comboboxes = dialog.getByRole('combobox')
    await comboboxes.first().click()
    await page.getByRole('option', { name: 'Size', exact: true }).click()
    await comboboxes.nth(1).click()
    await page.getByRole('option', { name: '>', exact: true }).click()
    await dialog.locator('input[type="number"]').fill('100')
    await expect(dialog.getByText('1 active')).toBeVisible()

    await dialog.getByRole('button', { name: 'Attach an image' }).click()
    const picker = page.getByRole('dialog', { name: 'Attach an image' })
    await expect(picker).toBeVisible()
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 2560
      canvas.height = 1440
      return canvas.toDataURL('image/png').split(',')[1]
    })
    const chooser = page.waitForEvent('filechooser')
    await picker.getByRole('button', { name: 'Choose image' }).click()
    await (
      await chooser
    ).setFiles({ name: 'reference.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await expect(dialog.getByText('reference.png')).toBeVisible()
    await expect(dialog.getByPlaceholder('Search records by content...')).toHaveCount(0)
    const thumbnail = dialog.locator('img').first()
    await expect
      .poll(() =>
        thumbnail.evaluate((image: HTMLImageElement) => ({
          width: image.naturalWidth,
          height: image.naturalHeight,
        })),
      )
      .toEqual({ width: 1280, height: 720 })
    expect(requests).toHaveLength(0)

    await dialog.getByRole('button', { name: 'Search', exact: true }).click()
    await expect.poll(() => requests.length).toBe(1)
    expect(requests[0]).toMatchObject({
      image: expect.stringMatching(/^\/9j\//),
      conditions: [{ field: 'sizeByte', operator: 'gt', value: 100 }],
    })
    expect(requests[0]).not.toHaveProperty('query')

    await dialog.getByRole('button', { name: 'Attach an image' }).click()
    const transfer = await page.evaluateHandle(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 720
      canvas.height = 1280
      const png = atob(canvas.toDataURL('image/png').split(',')[1])
      const bytes = Uint8Array.from(png, (byte) => byte.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([bytes], 'dropped.png', { type: 'image/png' }))
      return transfer
    })
    await picker
      .getByRole('button', { name: 'Choose image' })
      .dispatchEvent('drop', { dataTransfer: transfer })
    await transfer.dispose()
    await expect(dialog.getByText('dropped.png')).toBeVisible()

    if (browserName === 'chromium') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
      await page.evaluate(async (base64) => {
        const bytes = Uint8Array.from(atob(base64), (byte) => byte.charCodeAt(0))
        const image = new Blob([bytes], { type: 'image/png' })
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })])
      }, png)
      await dialog.getByRole('button', { name: 'Attach an image' }).click()
      await expect(picker).toBeVisible()
      await page.keyboard.press('ControlOrMeta+V')
      await expect(picker).toBeHidden()
      await expect(dialog.getByText('dropped.png')).toHaveCount(0)
      await expect(thumbnail).toHaveJSProperty('naturalWidth', 1280)
      await expect(thumbnail).toHaveJSProperty('naturalHeight', 720)
      await dialog.getByRole('button', { name: 'Search', exact: true }).click()
      await expect.poll(() => requests.length).toBe(2)
      expect(requests[1]).toMatchObject({
        image: expect.stringMatching(/^\/9j\//),
        conditions: [{ field: 'sizeByte', operator: 'gt', value: 100 }],
      })
    }

    await dialog.getByRole('button', { name: 'Remove image' }).click()
    await expect(dialog.getByPlaceholder('Search records by content...')).toBeVisible()
    await expect(dialog.getByText('1 active')).toBeVisible()
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click()
    await expect(page.getByText('This folder is empty')).toBeVisible()
  })
})
