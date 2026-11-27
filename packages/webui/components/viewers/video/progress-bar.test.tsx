// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProgressBar from './progress-bar'

const TOTAL_FRAMES = 1000

function renderBar(onSeek = vi.fn()) {
  render(
    <ProgressBar
      totalFrames={TOTAL_FRAMES}
      currentFrame={0}
      fps={25}
      previewUrl="https://example.test/preview.mp4"
      onSeek={onSeek}
    />,
  )
  const bar = screen.getByTestId('seekbar')
  vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 100,
    top: 0,
    bottom: 10,
    width: 100,
    height: 10,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
  return { bar, onSeek }
}

function touchEvent(type: string, clientX: number, list: 'touches' | 'changedTouches') {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: list === 'touches' ? [{ clientX, clientY: 5 }] : [],
  })
  Object.defineProperty(event, 'changedTouches', {
    value: list === 'changedTouches' ? [{ clientX, clientY: 5 }] : [],
  })
  return event
}

describe('ProgressBar seeking', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('seeks once for a plain click', () => {
    const { bar, onSeek } = renderBar()

    fireEvent.mouseDown(bar, { button: 0, clientX: 40 })
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 5 }))
    })

    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek).toHaveBeenLastCalledWith(400)
  })

  it('seeks again on release after a real drag', () => {
    const { bar, onSeek } = renderBar()

    fireEvent.mouseDown(bar, { button: 0, clientX: 40 })
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 60 }))
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 60, clientY: 5 }))
    })

    expect(onSeek.mock.calls.map(([frame]) => frame)).toEqual([400, 600, 600])
  })

  it('seeks once for a plain tap and ignores the synthetic mouse events that follow', () => {
    const { bar, onSeek } = renderBar()

    act(() => {
      bar.dispatchEvent(touchEvent('touchstart', 30, 'touches'))
    })
    act(() => {
      window.dispatchEvent(touchEvent('touchend', 30, 'changedTouches'))
    })
    vi.setSystemTime(new Date('2026-01-01T00:00:00.300Z'))
    fireEvent.mouseDown(bar, { button: 0, clientX: 30 })

    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek).toHaveBeenLastCalledWith(300)
  })

  it('accepts a mouse click again once the touch suppression window has passed', () => {
    const { bar, onSeek } = renderBar()

    act(() => {
      bar.dispatchEvent(touchEvent('touchstart', 30, 'touches'))
    })
    act(() => {
      window.dispatchEvent(touchEvent('touchend', 30, 'changedTouches'))
    })
    vi.setSystemTime(new Date('2026-01-01T00:00:01Z'))
    fireEvent.mouseDown(bar, { button: 0, clientX: 70 })

    expect(onSeek.mock.calls.map(([frame]) => frame)).toEqual([300, 700])
  })

  it('resets the drag without seeking when the touch is cancelled', () => {
    const { bar, onSeek } = renderBar()

    act(() => {
      bar.dispatchEvent(touchEvent('touchstart', 30, 'touches'))
    })
    act(() => {
      window.dispatchEvent(touchEvent('touchmove', 50, 'touches'))
    })
    act(() => {
      window.dispatchEvent(new Event('touchcancel'))
    })
    act(() => {
      window.dispatchEvent(touchEvent('touchmove', 80, 'touches'))
    })

    expect(onSeek.mock.calls.map(([frame]) => frame)).toEqual([300, 500])
  })

  it('loads only metadata for the hidden seek preview video', () => {
    renderBar()

    const preview = document.querySelector('video.hidden')
    expect(preview).not.toBeNull()
    expect(preview?.getAttribute('preload')).toBe('metadata')
  })
})
