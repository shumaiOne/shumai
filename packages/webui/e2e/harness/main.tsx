import { type ReactElement, useCallback, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import type Player from 'video.js/dist/types/player'
import VideoPlayer from '@/ui/components/viewers/video-player'
import { calculateFrameCenterTime } from '@/ui/components/viewers/utils'
import { useUiStore } from '@/ui/stores/ui'
import {
  SAMPLE_FRAME_RATE,
  sampleVideoAsset,
  containerLongerVideoAsset,
  longAudioVideoAsset,
} from './fixture'

/**
 * Backend-free harness page that mounts the *real* VideoPlayer component with a
 * fixture AssetInfo pointing at a locally served sample video. No API/router/
 * query providers are required for playback, so this isolates the frame-accurate
 * player logic (useFramePlayer + ProgressBar + video.js) for UI integration tests.
 *
 * We force the time readout into "frames" mode so specs can parse the exact
 * integer frame index the UI is displaying and assert it against the native
 * <video> clock and the seekbar fill.
 *
 * On top of the bare player, this harness reproduces — with the app's *real*
 * code paths — the comment↔player wiring that production uses
 * (`routes/projects/$projectId/files/$fileId.tsx` + `file-viewer.tsx`):
 *
 *   - `onTimeUpdate` captures the player's current time in seconds. This is the
 *     exact value the app stores as a comment's `second` (see message-input's
 *     `onSendMessage(..., currentTime)`).
 *   - "Create comment" snapshots that `second` and appends a comment. Each
 *     comment renders its derived frame `Math.round(second * fps)`, matching
 *     message-card's timestamp derivation.
 *   - Clicking a comment runs the app's real seek: `player.currentTime(second)`
 *     followed by `player.pause()`, exactly like the route's
 *     `handleCommentSelect`. That raw seek drives useFramePlayer's external
 *     `seeked` handler, which recomputes the frame from the media clock.
 *   - "Reload as user B" remounts the player with a fresh key (starting at
 *     frame 0) to simulate a second user opening the page, while the comment
 *     list persists.
 *
 * All comment controls live OUTSIDE the player's constrained 800x600 box so the
 * player's layout is byte-for-byte identical to what play-pause.spec.ts expects
 * (the box constraint prevents the drawing-canvas ResizeObserver from feeding
 * its width back and growing unbounded).
 */
useUiStore.setState({ videoTimeDisplayMode: 'frames' })

/**
 * Select which fixture asset to mount based on the `?variant=` query param, so
 * specs can exercise different metadata shapes against the same real backing
 * video. Defaults to the canonical sample asset used by the other specs.
 */
function resolveAsset() {
  const variant =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('variant')
      : null
  if (variant === 'container-longer') return containerLongerVideoAsset
  if (variant === 'long-audio') return longAudioVideoAsset
  return sampleVideoAsset
}

const harnessAsset = resolveAsset()

interface HarnessComment {
  id: string
  second: number
  frame: number
}

function Harness(): ReactElement {
  const playerRef = useRef<Player | null>(null)
  // Latest player time (seconds) as reported by the real onTimeUpdate prop.
  const currentTimeRef = useRef<number>(0)
  const seekInputRef = useRef<HTMLInputElement>(null)

  const [comments, setComments] = useState<HarnessComment[]>([])
  // Bumping this key remounts VideoPlayer, simulating a fresh page load (user B).
  const [playerKey, setPlayerKey] = useState<number>(0)

  const handleTimeUpdate = useCallback((time: number) => {
    currentTimeRef.current = time
  }, [])

  // Deterministic setup seek for "user A": land exactly on a target frame using
  // a real external seek to the frame-center time (the same class of seek the
  // timeline/comment paths use). This positions the player without depending on
  // the thing under test (the comment roundtrip).
  const handleSeekToFrame = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    const frame = Number.parseInt(seekInputRef.current?.value ?? '', 10)
    if (Number.isNaN(frame)) return
    player.currentTime(calculateFrameCenterTime(frame, SAMPLE_FRAME_RATE))
    player.pause()
  }, [])

  // "User A" creates a comment: captures the current time in seconds exactly as
  // the app does, then derives the displayed frame the same way message-card does.
  const handleCreateComment = useCallback(() => {
    const second = currentTimeRef.current
    setComments((prev) => [
      ...prev,
      {
        id: `comment-${prev.length}`,
        second,
        frame: Math.round(second * SAMPLE_FRAME_RATE),
      },
    ])
  }, [])

  // "User B" clicks a comment: the app's real seek path.
  const handleCommentClick = useCallback((second: number) => {
    const player = playerRef.current
    if (!player) return
    player.currentTime(second)
    player.pause()
  }, [])

  const handleReloadAsUserB = useCallback(() => {
    setPlayerKey((k) => k + 1)
  }, [])

  return (
    <div>
      {/* Player box: identical constrained container to the real file-viewer. */}
      <div
        data-testid="harness-stage"
        style={{ width: '800px', height: '600px', display: 'flex', overflow: 'hidden' }}
      >
        <div className="flex flex-col flex-1 h-full overflow-hidden relative">
          <VideoPlayer
            key={playerKey}
            data={harnessAsset}
            playerRef={playerRef}
            onTimeUpdate={handleTimeUpdate}
          />
        </div>
      </div>

      {/* Comment controls: kept outside the player box so they cannot affect its
          layout / ResizeObserver behaviour. */}
      <div data-testid="comment-panel">
        <input ref={seekInputRef} data-testid="seek-frame-input" type="number" />
        <button data-testid="seek-frame-go" onClick={handleSeekToFrame}>
          Seek to frame
        </button>
        <button data-testid="create-comment" onClick={handleCreateComment}>
          Create comment
        </button>
        <button data-testid="reload-user-b" onClick={handleReloadAsUserB}>
          Reload as user B
        </button>
        <ul data-testid="comment-list">
          {comments.map((comment, index) => (
            <li
              key={comment.id}
              data-testid="comment-item"
              data-comment-index={index}
              data-comment-frame={comment.frame}
              data-comment-second={comment.second}
              onClick={() => handleCommentClick(comment.second)}
            >
              Frame {comment.frame}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Harness root element not found')
}

ReactDOM.createRoot(rootElement).render(<Harness />)
