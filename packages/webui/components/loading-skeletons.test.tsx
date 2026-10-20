// @vitest-environment happy-dom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  FileDetailSkeleton,
  MobileFileBrowserContentSkeleton,
  ProjectFolderSkeleton,
} from './loading-skeletons'

describe('loading-skeletons', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders MobileFileBrowserContentSkeleton with card layout', () => {
    render(<MobileFileBrowserContentSkeleton />)
    const skeleton = screen.getByTestId('mobile-file-browser-loading-skeleton')
    expect(skeleton).toBeDefined()

    // Assert cards with aspect-square are rendered
    const aspectSquareElements = skeleton.querySelectorAll('.aspect-square')
    expect(aspectSquareElements.length).toBe(3)
  })

  it('renders ProjectFolderSkeleton containing desktop and mobile layouts', () => {
    const { container } = render(<ProjectFolderSkeleton />)
    expect(screen.getByTestId('mobile-file-browser-loading-skeleton')).toBeDefined()
    expect(container.querySelector('[data-testid="file-browser-loading-skeleton"]')).toBeDefined()
  })

  it('renders FileDetailSkeleton without top nav duplicate', () => {
    const { container } = render(<FileDetailSkeleton />)
    // Left sidebar carousel skeleton should exist on desktop
    const carouselCards = container.querySelectorAll('.w-24 .rounded-lg')
    expect(carouselCards.length).toBe(6)
  })
})
