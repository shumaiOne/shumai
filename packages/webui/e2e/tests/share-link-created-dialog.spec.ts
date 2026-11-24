import { expect, test, type Locator } from '@playwright/test'

async function assertNoHorizontalOverflow(dialog: Locator, viewportWidth: number) {
  const metrics = await dialog.evaluate((el) => {
    const dialogRect = el.getBoundingClientRect()
    const overflowing: Array<{ tag: string; text: string; right: number; dialogRight: number }> = []
    for (const child of el.querySelectorAll('*')) {
      const rect = child.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.right > dialogRect.right + 1 || rect.left < dialogRect.left - 1) {
        overflowing.push({
          tag: child.tagName.toLowerCase(),
          text: (child.textContent || '').trim().slice(0, 60),
          right: Math.round(rect.right),
          dialogRight: Math.round(dialogRect.right),
        })
      }
    }
    return {
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      dialogWidth: Math.round(dialogRect.width),
      overflowing,
    }
  })

  expect(metrics.dialogWidth).toBeLessThanOrEqual(viewportWidth)
  expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth)
  expect(metrics.overflowing, JSON.stringify(metrics)).toEqual([])
}

test.describe('ShareLinkCreatedDialog layout', () => {
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 375, height: 812 },
  ]) {
    test(`does not overflow horizontally on ${viewport.name} across default, edit, and expanded security states`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/?view=share-dialog')

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Default state with a very long unbroken share name
      await assertNoHorizontalOverflow(dialog, viewport.width)

      // Inline edit mode
      await dialog.getByRole('button', { name: 'Rename Share Link' }).click()
      await expect(dialog.getByRole('textbox', { name: 'Rename Share Link' })).toBeVisible()
      await assertNoHorizontalOverflow(dialog, viewport.width)
      await dialog.getByRole('textbox', { name: 'Rename Share Link' }).press('Escape')

      // Expanded Password and Expiration Date controls
      const switches = dialog.getByRole('switch')
      await switches.nth(0).click()
      await switches.nth(1).click()
      await expect(dialog.getByPlaceholder('Enter password')).toBeVisible()
      await assertNoHorizontalOverflow(dialog, viewport.width)
    })
  }
})
