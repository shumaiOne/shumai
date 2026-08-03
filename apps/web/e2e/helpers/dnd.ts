import type { Locator, Page } from '@playwright/test'

/**
 * Performs a pointer drag from one card to another. dnd-kit v6 uses a
 * `PointerSensor` with a 10px distance activation constraint, and WebKit only
 * reliably starts the drag when pointer moves are delivered in separate,
 * awaited batches (a single fast `mouse.move(steps)` can be coalesced before
 * the drag activates, losing the drop). Moves are therefore chunked with
 * intermediate waits so the activation and drag move handlers run between
 * batches on every browser.
 */
export async function dragCard(page: Page, source: Locator, target: Locator): Promise<void> {
  const sourceBox = (await source.boundingBox())!
  const targetBox = (await target.boundingBox())!
  if (!sourceBox || !targetBox) {
    throw new Error('Drag source or target has no bounding box')
  }

  const fromX = sourceBox.x + sourceBox.width / 2
  const fromY = sourceBox.y + sourceBox.height / 2
  const toX = targetBox.x + targetBox.width / 2
  const toY = targetBox.y + targetBox.height / 2

  await page.mouse.move(fromX, fromY)
  await page.mouse.down()

  // Move in several chunks so the dnd-kit sensor activates mid-drag
  const chunks = 8
  for (let i = 1; i <= chunks; i++) {
    const x = fromX + ((toX - fromX) * i) / chunks
    const y = fromY + ((toY - fromY) * i) / chunks
    await page.mouse.move(x, y)
    await page.waitForTimeout(15)
  }

  await page.mouse.up()
}
