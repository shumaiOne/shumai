import { expect, test } from '../../fixtures'

test.use({ fileOptions: { mediaType: 'pdf' } })

test('upload a pdf, select its text in view mode, and verify draw mode routes drags to the canvas', async ({
  file,
  prisma,
}) => {
  const { page, projectId, fileId } = file

  // Wait for the background transcode worker to finish (pdf -> pdf proxy)
  await expect
    .poll(
      async () => {
        const asset = await prisma.asset.findUnique({ where: { id: fileId } })
        return asset?.status
      },
      { timeout: 60_000 },
    )
    .toBe('processed')

  await page.goto(`/projects/${projectId}/files/${fileId}`)

  // The viewer renders an invisible, selectable pdf.js text layer over the page
  const textLayer = page.locator('.pdf-text-layer')
  await expect(textLayer.locator('span').first()).toBeVisible({ timeout: 30_000 })

  // Collect the positioned text runs (skip zero-size spans such as
  // `display: contents` marked-content wrappers)
  const spans = textLayer.locator('span')
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = []
  for (let i = 0; i < (await spans.count()); i++) {
    const box = await spans.nth(i).boundingBox()
    if (box && box.width > 0 && box.height > 0) boxes.push(box)
  }
  expect(boxes.length).toBeGreaterThan(0)

  // Left-drag from the first text run to the last one: in view mode (drawing
  // off) this must trigger a native browser text selection
  const firstBox = boxes[0]
  const lastBox = boxes[boxes.length - 1]
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2, {
    steps: 5,
  })
  await page.mouse.up()

  const selectedText = await page.evaluate(() => window.getSelection()?.toString() ?? '')
  expect(selectedText.trim().length).toBeGreaterThan(0)

  // Clear the selection, then switch to draw mode: the same drag must NOT
  // select text anymore, proving the Konva stage (above the text layer)
  // intercepts pointer events while drawing
  await page.evaluate(() => window.getSelection()?.removeAllRanges())

  const drawToggleBtn = page.getByTitle('Toggle Annotation')
  await expect(drawToggleBtn).toBeVisible()
  await drawToggleBtn.click()

  const canvas = page.locator('.konvajs-content canvas').first()
  await expect(canvas).toBeVisible()
  const canvasBox = await canvas.boundingBox()
  expect(canvasBox).not.toBeNull()
  if (canvasBox) {
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.3, canvasBox.y + canvasBox.height * 0.3)
    await page.mouse.down()
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.6, canvasBox.y + canvasBox.height * 0.6, {
      steps: 5,
    })
    await page.mouse.up()
  }

  const selectedAfterDraw = await page.evaluate(() => window.getSelection()?.toString() ?? '')
  expect(selectedAfterDraw.trim().length).toBe(0)
})
