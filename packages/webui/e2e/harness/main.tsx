import ReactDOM from 'react-dom/client'
import VideoPlayer from '@/ui/components/viewers/video-player'
import { useUiStore } from '@/ui/stores/ui'
import { sampleVideoAsset } from './fixture'

/**
 * Backend-free harness page that mounts the *real* VideoPlayer component with a
 * fixture AssetInfo pointing at a locally served sample video. No API/router/
 * query providers are required for playback, so this isolates the frame-accurate
 * player logic (useFramePlayer + ProgressBar + video.js) for UI integration tests.
 *
 * We force the time readout into "frames" mode so specs can parse the exact
 * integer frame index the UI is displaying and assert it against the native
 * <video> clock and the seekbar fill.
 */
useUiStore.setState({ videoTimeDisplayMode: 'frames' })

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Harness root element not found')
}

// Replicate the exact constrained container the real app (file-viewer) mounts
// the player inside: a `flex flex-col flex-1 h-full overflow-hidden` wrapper that
// itself sits in a bounded flex parent. This gives the player root a definite
// 800x600 box and prevents the video area's canvas from feeding its width back
// through the ResizeObserver (which otherwise grows unbounded in a bare stage).
ReactDOM.createRoot(rootElement).render(
  <div
    data-testid="harness-stage"
    style={{ width: '800px', height: '600px', display: 'flex', overflow: 'hidden' }}
  >
    <div className="flex flex-col flex-1 h-full overflow-hidden relative">
      <VideoPlayer data={sampleVideoAsset} />
    </div>
  </div>,
)
