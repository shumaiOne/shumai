import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import type { MediaController } from '@/ui/components/viewers/types'
import VideoPlayer from '@/ui/components/viewers/video/video-viewer'
import ModelViewer from '@/ui/components/viewers/model/model-viewer'
import { calculateFrameCenterTime } from '@/ui/components/viewers/video/utils'
import { useUiStore } from '@/ui/stores/ui'
import { uploadFilesWithUppy } from '@/ui/lib/uploader'
import { useUploadStore } from '@/ui/stores/upload'
import { Toaster } from 'sonner'
import {
  SAMPLE_FRAME_RATE,
  sampleVideoAsset,
  containerLongerVideoAsset,
  longAudioVideoAsset,
  sampleAudioAsset,
  sampleTurntableAsset,
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
  if (variant === 'audio') return sampleAudioAsset
  if (variant === '3d' || variant === 'turntable') return sampleTurntableAsset
  return sampleVideoAsset
}

const harnessAsset = resolveAsset()

interface HarnessComment {
  id: string
  second: number
  frame: number
}

function Harness(): ReactElement {
  const playerRef = useRef<MediaController | null>(null)
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
    player.seekTo(calculateFrameCenterTime(frame, SAMPLE_FRAME_RATE))
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
    player.seekTo(second)
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
          {harnessAsset.proxyType === '3d' ? (
            <ModelViewer
              key={playerKey}
              file={harnessAsset}
              ref={playerRef}
              onTimeUpdate={handleTimeUpdate}
            />
          ) : (
            <VideoPlayer
              key={playerKey}
              file={harnessAsset}
              ref={playerRef}
              onTimeUpdate={handleTimeUpdate}
            />
          )}
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

function UploaderHarness(): ReactElement {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'completed' | 'failed'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const taskState = useUploadStore((state) => state.tasks['e2e-task-1'])

  useEffect(() => {
    ;(window as unknown as Record<string, number>)['__SHUMAI_UPLOAD_BASE_DELAY__'] = 100
  }, [])

  const startUpload = async (file: File) => {
    setStatus('uploading')
    setErrorMessage(null)

    const taskId = 'e2e-task-1'
    const teamId = 'e2e-team-1'
    const fileId = 'e2e-file-1'

    useUploadStore
      .getState()
      .startTask(taskId, 'e2e-task', [{ fileId, name: file.name, size: file.size }])

    try {
      await uploadFilesWithUppy({
        files: [{ id: 'temp-1', file }],
        taskId,
        teamId,
        storageBackend: 's3',
        createdAssets: [{ tempId: 'temp-1', assetId: fileId, key: `files/${file.name}` }],
      })
      setStatus('completed')
    } catch (err) {
      setStatus('failed')
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void startUpload(file)
    }
  }

  const handleSimulatedStart = () => {
    const mockFile = new File(['mock content for test'], 'test-file.mp4', {
      type: 'video/mp4',
    })
    void startUpload(mockFile)
  }

  const derivedStatus = taskState?.files['e2e-file-1']?.status ?? status

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <Toaster position="top-right" />
      <h2>Uploader Resilience E2E Harness</h2>
      <div style={{ marginBottom: 16 }}>
        <input data-testid="uploader-file-input" type="file" onChange={handleFileChange} />
        <button
          data-testid="start-upload-btn"
          onClick={handleSimulatedStart}
          style={{ marginLeft: 8 }}
        >
          Start Simulated Upload
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div>
          Status: <span data-testid="upload-status">{derivedStatus}</span>
        </div>
        <div>
          Progress:{' '}
          <span data-testid="upload-progress">{taskState?.files['e2e-file-1']?.loaded ?? 0}</span>
        </div>
        {errorMessage && <div data-testid="upload-error">{errorMessage}</div>}
      </div>
    </div>
  )
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Harness root element not found')
}

const currentView =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null

ReactDOM.createRoot(rootElement).render(
  currentView === 'uploader' ? <UploaderHarness /> : <Harness />,
)
