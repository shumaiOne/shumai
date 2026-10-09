import { test, expect } from '@playwright/test'
import { ModelViewerPage } from '../pages/model-viewer.page'

test.describe('3D Asset Viewer E2E Tests', () => {
  /**
   * ISSUE 1 VERIFICATION:
   * Asserts that all 24 frames across 0° to 345° have completely unique visual scenes.
   * Specifically, verifies that pairs like [0°, 15°], [45°, 60°], [90°, 105°], etc.
   * decode distinct frames instead of showing the same scene.
   */
  test('Issue 1: verifies all 24 degree angles render unique visual frames', async ({ page }) => {
    const viewer = new ModelViewerPage(page)
    await viewer.goto()

    // Step through each of the 24 angles: 0°, 15°, 30°, 45°, ..., 345°
    const snapshots: Array<{ degree: number; currentTime: number; frameHash: string }> = []

    for (let i = 0; i < 24; i++) {
      // Allow video element decoding and frame presentation to settle
      await page.waitForTimeout(100)
      const snap = await viewer.snapshot()
      snapshots.push(snap)

      if (i < 23) {
        await viewer.stepPlus()
      }
    }

    console.log('--- SNAPSHOTS ACROSS ALL 24 STEPS ---')
    for (const snap of snapshots) {
      console.log(
        `Degree: ${snap.degree}°, currentTime: ${snap.currentTime.toFixed(6)}, frameHash: ${snap.frameHash}`,
      )
    }

    // Verify all 24 frames have unique hashes
    const uniqueHashes = new Set(snapshots.map((s) => s.frameHash))
    expect(uniqueHashes.size).toBe(24)

    // Verify all adjacent pairs have distinct scenes
    for (let i = 0; i < 23; i++) {
      const snapA = snapshots[i]
      const snapB = snapshots[i + 1]
      expect(snapA.frameHash).not.toBe(snapB.frameHash)
    }
  })

  /**
   * ISSUE 2 VERIFICATION (Surface):
   * Asserts that at 345°, starting a drag or making small drag movements
   * maintains the 345° position rather than snapping backwards to 330°.
   */
  test('Issue 2: verifies drag-to-rotate on viewer surface at 345 degrees does not jitter', async ({
    page,
  }) => {
    const viewer = new ModelViewerPage(page)
    await viewer.goto()

    // Step backward from 0° -> wraps to 345°
    await viewer.stepMinus()
    await page.waitForTimeout(100)

    const initialSnap = await viewer.snapshot()
    expect(initialSnap.degree).toBe(345)

    const box = await viewer.surface.boundingBox()
    if (!box) throw new Error('Surface box not found')
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2

    // Mouse down at 345°
    await page.mouse.move(startX, startY)
    await page.mouse.down()

    // Small drag of -4px (less than 12px / 2 = 6px threshold for 1 frame)
    await page.mouse.move(startX - 4, startY, { steps: 2 })
    await page.waitForTimeout(50)
    const degreeSmallDrag = await viewer.getDegree()
    // Must remain at 345° (no jitter back to 330°)
    expect(degreeSmallDrag).toBe(345)

    // Drag left by -12px (rotates counterclockwise by 1 frame: 345° -> 0°)
    await page.mouse.move(startX - 12, startY, { steps: 2 })
    await page.waitForTimeout(50)
    const degreeCcw = await viewer.getDegree()
    expect(degreeCcw).toBe(0)

    // Drag back to start position (0px delta relative to start)
    await page.mouse.move(startX, startY, { steps: 2 })
    await page.waitForTimeout(50)
    const degreeBack = await viewer.getDegree()
    expect(degreeBack).toBe(345)

    // Drag right by +12px (rotates clockwise by 1 frame: 345° -> 330°)
    await page.mouse.move(startX + 12, startY, { steps: 2 })
    await page.waitForTimeout(50)
    const degreeCw = await viewer.getDegree()
    expect(degreeCw).toBe(330)

    await page.mouse.up()
  })

  /**
   * ISSUE 2 VERIFICATION (Slider):
   * Asserts that dragging the ruler slider across 345° and 0° scrolls smoothly
   * and transitions between angles cleanly.
   */
  test('Issue 2 (slider): verifies dragging ruler slider across 345° and 0° transitions smoothly', async ({
    page,
  }) => {
    const viewer = new ModelViewerPage(page)
    await viewer.goto()

    // Navigate to 345°
    await viewer.stepMinus()
    await page.waitForTimeout(100)
    expect(await viewer.getDegree()).toBe(345)

    const sliderBox = await viewer.rulerSlider.boundingBox()
    if (!sliderBox) throw new Error('Slider box not found')
    const startX = sliderBox.x + sliderBox.width / 2
    const startY = sliderBox.y + sliderBox.height / 2

    await page.mouse.move(startX, startY)
    await page.mouse.down()

    // Drag slightly left (-12px) across 345° towards 0°
    await page.mouse.move(startX - 12, startY, { steps: 2 })
    await page.waitForTimeout(50)
    const degCross = await viewer.getDegree()
    expect(degCross).toBe(0)

    // Drag further left (-32px) to 15°
    await page.mouse.move(startX - 32, startY, { steps: 2 })
    await page.waitForTimeout(50)
    const degFurther = await viewer.getDegree()
    expect(degFurther).toBe(15)

    // Drag back to 0px
    await page.mouse.move(startX, startY, { steps: 2 })
    await page.waitForTimeout(50)
    const degBack = await viewer.getDegree()
    expect(degBack).toBe(345)

    await page.mouse.up()
  })
})
