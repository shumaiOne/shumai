// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ChunkVideoPreview } from './chunk-video-preview'

const { request, poll } = vi.hoisted(() => ({ request: vi.fn(), poll: vi.fn() }))
vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      files: { ':fileId': { 'chunk-previews': { ':matchId': { $post: request, $get: poll } } } },
    },
  },
}))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('requests a legacy preview on hover and shows its in-range poster when ready', async () => {
  request.mockResolvedValue(Response.json({ status: 'pending' }))
  poll.mockResolvedValue(
    Response.json({
      status: 'ready',
      preview: {
        posterUrl: '/chunk-poster.webp',
        spriteUrl: '/chunk-sprite.webp',
        columns: 2,
        rows: 1,
        frameWidth: 320,
        frameHeight: 180,
        timestamps: [10, 19],
      },
    }),
  )
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <ChunkVideoPreview
        assetId="video-1"
        chunk={{ matchId: 'match-1' }}
        startTime={10}
        endTime={20}
      />
    </QueryClientProvider>,
  )
  expect(request).not.toHaveBeenCalled()
  expect(screen.queryByAltText('Thumbnail')).toBeNull()
  fireEvent.mouseEnter(screen.getByTestId('chunk-video-preview'))
  expect(screen.queryByTestId('sprite-scrubber')).toBeNull()
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
  const poster = await screen.findByAltText('Thumbnail', {}, { timeout: 3000 })
  expect(poster.getAttribute('src')).toBe('/chunk-poster.webp')
  expect(poll).toHaveBeenCalledTimes(1)
})
