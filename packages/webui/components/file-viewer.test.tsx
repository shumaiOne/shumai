// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import React, { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FileViewer } from './file-viewer'
import type { AssetInfo } from '@shumai/dtos'

const MockViewer = React.forwardRef<unknown, { file: AssetInfo; children?: React.ReactNode }>(
  ({ file, children }, ref) => {
    React.useImperativeHandle(ref, () => ({}))
    return (
      <div>
        <div data-testid={`viewer-${file.id}`}>{file.name}</div>
        {children}
      </div>
    )
  },
)

// Mock registry so getViewerForFile returns a simple test viewer
vi.mock('./viewers/registry', () => ({
  getViewerForFile: () => ({
    id: 'test-viewer',
    name: 'Test Viewer',
    match: () => true,
    viewer: MockViewer,
  }),
}))

describe('FileViewer', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders children alongside viewer and preserves children state across file changes', () => {
    let mountCount = 0

    const StatefulChild = () => {
      const [count, setCount] = useState(0)
      useEffect(() => {
        mountCount++
      }, [])

      return (
        <div data-testid="sidebar-child">
          <span data-testid="child-count">{count}</span>
          <button data-testid="child-btn" onClick={() => setCount((c) => c + 1)}>
            Increment
          </button>
        </div>
      )
    }

    const fileA: AssetInfo = {
      id: 'file-a',
      name: 'File A.png',
      proxyType: 'image',
    } as AssetInfo

    const fileB: AssetInfo = {
      id: 'file-b',
      name: 'File B.png',
      proxyType: 'image',
    } as AssetInfo

    const { getByTestId, rerender } = render(
      <FileViewer file={fileA}>
        <StatefulChild />
      </FileViewer>,
    )

    expect(getByTestId('viewer-file-a')).toBeDefined()
    expect(getByTestId('child-count').textContent).toBe('0')
    expect(mountCount).toBe(1)

    // Increment count inside child
    fireEvent.click(getByTestId('child-btn'))
    expect(getByTestId('child-count').textContent).toBe('1')

    // Rerender with new file (fileB)
    rerender(
      <FileViewer file={fileB}>
        <StatefulChild />
      </FileViewer>,
    )

    // Viewer component changed to file B
    expect(getByTestId('viewer-file-b')).toBeDefined()

    // Child component remained mounted without remounting or resetting state
    expect(mountCount).toBe(1)
    expect(getByTestId('child-count').textContent).toBe('1')
  })
})
