// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FilePreview } from './file-preview'

afterEach(cleanup)

it.each([true, false])('scrubs the full-video sprite with poster available: %s', (hasPoster) => {
  render(
    <FilePreview
      item={{
        preview: {
          proxyType: 'video',
          duration: 1200,
          spriteUrl: '/full-sprite.webp',
          ...(hasPoster && {
            thumbnailUrl: '/full-poster.webp',
            originalWidth: 320,
            originalHeight: 180,
          }),
        },
      }}
      matchDuration={{ startTime: 10, endTime: 20 }}
    />,
  )

  expect(screen.getByTestId('file-preview-matched-duration').textContent).toBe('00:10 - 00:20')
  expect(screen.queryByAltText('Thumbnail')?.getAttribute('src')).toBe(
    hasPoster ? '/full-poster.webp' : undefined,
  )
  const scrubber = screen.getByTestId('sprite-scrubber')
  vi.spyOn(scrubber, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100))
  fireEvent.mouseMove(scrubber, { clientX: 99 })
  expect(scrubber.getAttribute('data-frame')).toBe('99')
})
