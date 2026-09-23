// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VideoControlBar } from './video-control-bar'
import type { AssetInfo } from '@shumai/dtos'
import type { DisplayTranscode, PlayerState } from './video-control-bar'

describe('VideoControlBar', () => {
  afterEach(() => {
    cleanup()
  })

  const mockData: AssetInfo = {
    id: 'video-1',
    name: 'sample.mp4',
    proxyType: 'video',
    media: {
      original: { key: 'files/sample.mp4' },
      metadata: {
        duration: 100,
        frameRate: 25,
      },
    },
  } as AssetInfo

  const defaultState: PlayerState = {
    isPlaying: false,
    progress: 10,
    currentTime: 10,
    duration: 100,
    volume: 1,
    isMuted: false,
    isLooping: false,
    playbackRate: 1,
    isFullScreen: false,
    showFrames: false,
    currentResolution: '1080p',
    isCurrentHdr: false,
  }

  const resolutions: DisplayTranscode[] = [
    {
      key: '1080.mp4',
      width: 1920,
      height: 1080,
      resolution: '1080p',
      hdr: false,
    } as unknown as DisplayTranscode,
    {
      key: '1080-hdr.mp4',
      width: 1920,
      height: 1080,
      resolution: '1080p',
      hdr: true,
    } as unknown as DisplayTranscode,
  ]

  it('renders download menu with HDR badge on HDR download items', async () => {
    const handleDownload = vi.fn()

    render(
      <VideoControlBar
        state={defaultState}
        zoom={1}
        isControlsVisible={true}
        buffered={50}
        data={mockData}
        resolutions={resolutions}
        togglePlay={vi.fn()}
        toggleLoop={vi.fn()}
        toggleMute={vi.fn()}
        handleVolumeChange={vi.fn()}
        changePlaybackRate={vi.fn()}
        changeResolution={vi.fn()}
        handleDownload={handleDownload}
        toggleFullScreen={vi.fn()}
        onZoomChange={vi.fn()}
        onZoomReset={vi.fn()}
        frameRate={25}
        totalFrames={2500}
        currentFrame={250}
        seekToFrame={vi.fn()}
        allowDownload={true}
      />,
    )

    const downloadTrigger = screen.getByTitle(/Download/i)
    expect(downloadTrigger).toBeDefined()
    fireEvent.pointerDown(downloadTrigger, { button: 0, ctrlKey: false })

    const menuItems = await screen.findAllByRole('menuitem')
    // We expect: 1080p SDR, 1080p HDR, and Original
    expect(menuItems.length).toBe(3)

    const sdrItem = menuItems.find(
      (item) => item.textContent?.includes('1080p') && !item.textContent?.includes('HDR'),
    )
    const hdrItem = menuItems.find(
      (item) => item.textContent?.includes('1080p') && item.textContent?.includes('HDR'),
    )

    expect(sdrItem).toBeDefined()
    expect(hdrItem).toBeDefined()

    // Clicking HDR item triggers download with HDR key
    fireEvent.click(hdrItem!)
    expect(handleDownload).toHaveBeenCalledWith('1080-hdr.mp4')
  })
})
