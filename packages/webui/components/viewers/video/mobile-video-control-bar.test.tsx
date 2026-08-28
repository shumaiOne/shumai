// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileVideoControlBar } from './mobile-video-control-bar'
import type { AssetInfo } from '@shumai/dtos'

import type { DisplayTranscode } from './video-control-bar'

describe('MobileVideoControlBar', () => {
  afterEach(() => {
    cleanup()
  })

  const mockData: AssetInfo = {
    id: 'video-1',
    name: 'sample.mp4',
    proxyType: 'video',
    media: {
      metadata: {
        duration: 100,
        frameRate: 25,
      },
    },
  } as AssetInfo

  const defaultState = {
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
    currentResolution: '720p',
  }

  it('renders play, mute, timecode readout, settings, and fullscreen buttons', () => {
    const togglePlay = vi.fn()
    const toggleMute = vi.fn()
    const toggleFullScreen = vi.fn()

    render(
      <MobileVideoControlBar
        state={defaultState}
        zoom={1}
        isControlsVisible={true}
        buffered={50}
        data={mockData}
        resolutions={[
          {
            key: '720.mp4',
            width: 1280,
            height: 720,
            resolution: '720p',
          } as unknown as DisplayTranscode,
        ]}
        togglePlay={togglePlay}
        toggleLoop={vi.fn()}
        toggleMute={toggleMute}
        handleVolumeChange={vi.fn()}
        changePlaybackRate={vi.fn()}
        changeResolution={vi.fn()}
        handleDownload={vi.fn()}
        toggleFullScreen={toggleFullScreen}
        onZoomChange={vi.fn()}
        onZoomReset={vi.fn()}
        frameRate={25}
        totalFrames={2500}
        currentFrame={250}
        seekToFrame={vi.fn()}
      />,
    )

    const playBtn = screen.getByTestId('play-toggle')
    expect(playBtn).toBeDefined()
    fireEvent.click(playBtn)
    expect(togglePlay).toHaveBeenCalledTimes(1)

    const muteBtn = screen.getByLabelText(/Mute|Unmute/i)
    expect(muteBtn).toBeDefined()
    fireEvent.click(muteBtn)
    expect(toggleMute).toHaveBeenCalledTimes(1)

    const timeReadout = screen.getByTestId('time-readout')
    expect(timeReadout).toBeDefined()

    const fsBtn = screen.getByTitle(/Fullscreen/i)
    expect(fsBtn).toBeDefined()
    fireEvent.click(fsBtn)
    expect(toggleFullScreen).toHaveBeenCalledTimes(1)
  })
})
