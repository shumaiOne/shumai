import type { Locator, Page } from '@playwright/test'

const MODEL_VIDEO_SELECTOR = '[data-testid="model-viewer-surface"] video'

export interface ModelViewerSnapshot {
  degree: number
  currentTime: number
  frameHash: string
}

export class ModelViewerPage {
  readonly page: Page
  readonly stage: Locator
  readonly container: Locator
  readonly surface: Locator
  readonly video: Locator
  readonly playToggle: Locator
  readonly degreeReadout: Locator
  readonly rulerSlider: Locator
  readonly rulerStepMinus: Locator
  readonly rulerStepPlus: Locator
  readonly rulerTooltip: Locator

  constructor(page: Page) {
    this.page = page
    this.stage = page.getByTestId('harness-stage')
    this.container = page.getByTestId('model-viewer-container')
    this.surface = page.getByTestId('model-viewer-surface')
    this.video = page.locator(MODEL_VIDEO_SELECTOR).first()
    this.playToggle = page.getByTestId('play-toggle')
    this.degreeReadout = page.getByTestId('degree-readout')
    this.rulerSlider = page.locator('[role="slider"]')
    this.rulerStepMinus = page.getByTestId('ruler-step-minus')
    this.rulerStepPlus = page.getByTestId('ruler-step-plus')
    this.rulerTooltip = page.getByTestId('ruler-slider-tooltip')
  }

  async goto(): Promise<void> {
    await this.page.goto('/?variant=3d')
    await this.waitUntilReady()
  }

  async waitUntilReady(): Promise<void> {
    await this.video.waitFor({ state: 'attached' })
    await this.page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector) as HTMLVideoElement | null
        return !!el && el.readyState >= 1 && Number.isFinite(el.duration)
      },
      MODEL_VIDEO_SELECTOR,
      { timeout: 15_000 },
    )
    await this.page.waitForFunction(
      () => {
        const readout = document.querySelector('[data-testid="degree-readout"]')
        return !!readout && /\d+°\s*\/\s*360°/.test(readout.textContent ?? '')
      },
      undefined,
      { timeout: 15_000 },
    )
  }

  async getDegree(): Promise<number> {
    const text = (await this.degreeReadout.textContent()) ?? ''
    const match = text.match(/(\d+)°\s*\/\s*360°/)
    return match ? Number.parseInt(match[1], 10) : Number.NaN
  }

  async getCurrentTime(): Promise<number> {
    return this.video.evaluate((el: HTMLVideoElement) => el.currentTime)
  }

  /**
   * Captures a perceptual pixel hash of the video's current rendered frame.
   * Two frames displaying identical visuals yield the identical hash.
   */
  async captureFrameHash(): Promise<string> {
    return this.video.evaluate((el: HTMLVideoElement) => {
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      if (!ctx) return ''
      ctx.drawImage(el, 0, 0, 64, 64)
      const data = ctx.getImageData(0, 0, 64, 64).data
      let hash = 0
      for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash + data[i]) | 0
      }
      return `${hash}_${data[0]}_${data[100]}_${data[500]}_${data[1000]}`
    })
  }

  async snapshot(): Promise<ModelViewerSnapshot> {
    const [degree, currentTime, frameHash] = await Promise.all([
      this.getDegree(),
      this.getCurrentTime(),
      this.captureFrameHash(),
    ])
    return { degree, currentTime, frameHash }
  }

  async stepPlus(): Promise<void> {
    await this.rulerStepPlus.click()
  }

  async stepMinus(): Promise<void> {
    await this.rulerStepMinus.click()
  }

  async pressArrowRight(): Promise<void> {
    await this.page.keyboard.press('ArrowRight')
  }

  async pressArrowLeft(): Promise<void> {
    await this.page.keyboard.press('ArrowLeft')
  }

  async dragSurface(deltaX: number, steps = 5): Promise<void> {
    const box = await this.surface.boundingBox()
    if (!box) throw new Error('Surface bounding box not found')
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    await this.page.mouse.move(startX, startY)
    await this.page.mouse.down()
    await this.page.mouse.move(startX + deltaX, startY, { steps })
    await this.page.mouse.up()
  }

  async dragSlider(deltaX: number, steps = 5): Promise<void> {
    const box = await this.rulerSlider.boundingBox()
    if (!box) throw new Error('Slider bounding box not found')
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    await this.page.mouse.move(startX, startY)
    await this.page.mouse.down()
    await this.page.mouse.move(startX + deltaX, startY, { steps })
    await this.page.mouse.up()
  }
}
