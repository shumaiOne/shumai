# Frame-Accurate Video Player & Comment System: Technical Design Document

This document outlines the technical design, mathematical formulas, synchronization loops, and database schemes that guarantee **100% frame-accurate playback, scrubbing, stepping, and comment navigation** in Shumai.

---

## 1. Architectural Overview

Shumai's video player is a decoupled, frame-locked system that coordinates three primary components around a single state coordinator (`useFramePlayer`):

```
                     ┌───────────────────────────┐
                     │    useFramePlayer Hook    │
                     │  (State: currentFrame)    │
                     └──────┬─────────────▲──────┘
                            │             │
        1. Set currentTime  │             │ 2. Sync frame index
        (Frame Center Nudge)│             │ (Floor-with-Epsilon)
                            ▼             │
             ┌────────────────────────────┴──┐
             │   Native HTML5 Video Player   │
             │   (VideoJS Engine Wrapper)    │
             └───────────────────────────────┘
                     ▲                   ▲
                     │                   │
         Stepping /  │                   │ Comment Selection /
         Scrubbing   │                   │ Timestamp Navigation
                     │                   │
             ┌───────┴──────┐     ┌──────┴───────┐
             │   Seekbar    │     │   Comments   │
             │ (Progress)   │     │ (Panel/List) │
             └──────────────┘     └──────────────┘
```

1. **Native HTML5 Video Player (VideoJS Engine Wrapper):** Manages the underlying browser media stream, buffering, audio clock, and presentation.
2. **Seekbar (Scrubber & Progress Bar):** Visualizes playback progress and maps horizontal screen clicks/drags to playhead percentages.
3. **Comment Area (Sidebar):** Renders comment list, displays timestamp labels, captures drawings, and triggers seeks to target frames.

---

## 2. Core Mathematical Foundations

To achieve frame-accurate synchronization across different browsers (which use floating-point double precision for playhead timestamps), we utilize three key mathematical formulas:

### A. Frame-to-Time Boundary Formula
When generating timestamps for external storage (such as database comments), we calculate the exact **start boundary time** of the frame. This avoids carrying floating-point errors into the database:

$$\text{Time}_{\text{boundary}} = \frac{N}{\text{frameRate}}$$

*Where $N$ is the integer frame index ($0$-indexed).*

---

### B. Time-to-Frame Conversion (Floor with 0.45 Offset)
When converting a raw player timestamp ($t$) back to an integer frame index, we use a **Floor with 0.45 Offset** formula to absorb sub-millisecond clock drift, compositor presentation offsets, and V-Sync boundaries:

$$\text{Frame} = \lfloor(t \cdot \text{frameRate}) + 0.45\rfloor$$

* **Compositor Lag Guard:** Since the browser compositor typically presents a frame slightly before the playhead crosses the exact mathematical start time (due to V-Sync ticks and decoding latency), the browser transitions visually around the half-frame mark. An offset of `0.45` shifts the transition boundary to `0.55` frames, matching user perception.
* **Seek Buffer Guard:** When we seek to the safe center of a frame ($N + 0.5$ frames), using a `0.45` offset yields $N + 0.95$, which floors back to the correct frame index $N$ even if the browser has minor floating-point seek target deviations.

---

### C. Safe Seek Time (Half-Frame Offset Center)
Browsers can occasionally render the previous frame if the playhead lands exactly on a frame boundary due to float rounding. To guarantee that seeking always lands squarely inside the target frame's presentation window, we seek to the **center of the frame**:

$$\text{Time}_{\text{center}} = \left(N \cdot T_d\right) + \frac{T_d}{2} = \frac{N}{\text{frameRate}} + \frac{1}{2 \cdot \text{frameRate}}$$

*Where $T_d = \frac{1}{\text{frameRate}}$ is the duration of a single frame.*

---

## 3. Active Playback Loops & Dual-Drive Coordination

When playing, the playhead loop coordinates two mechanisms in parallel to prevent timeline freezes and avoid visual jitter:

```
                            ┌───────────────────┐
                            │ Playback Started  │
                            └─────────┬─────────┘
                                      │
                         ┌────────────┴────────────┐
                         │   Start loops: RAF &    │
                         │   VFC (if supported)    │
                         └────────────┬────────────┘
                                      │
                       ┌──────────────┴──────────────┐
                       │  Is VFC Stalled (> Thresh)? │
                       └─────┬─────────────────┬─────┘
                             │ Yes             │ No
                             ▼                 ▼
                 ┌───────────────────────┐ ┌───────────────────────┐
                 │ Update UI using       │ │ Update UI using       │
                 │ currentTime (RAF)     │ │ mediaTime (VFC)       │
                 └───────────────────────┘ └───────────────────────┘
```

1. **`requestVideoFrameCallback` (rVFC):** The primary driver when the video is actively decoding. It fires only when a new video frame is sent to the compositor, updating the UI frame-accurately based on `metadata.mediaTime`.
2. **`requestAnimationFrame` (RAF):** Runs continuously at 60Hz. It acts as the fallback driver.
3. **Compositor-First Gating & Stall Detection:** `video.currentTime` is the playback (audio) clock, and on some engines (notably Safari/WebKit) it runs *ahead* of the frame actually presented on screen right after playback starts. Trusting it before the compositor catches up would race the playhead forward and then snap it backward when the first rVFC (`mediaTime`) arrives. To prevent this, each `play` resets the per-session sync state, and the playhead is driven from `video.currentTime` **only** when `requestVideoFrameCallback` is unsupported, **or** rVFC has delivered a frame this session and has since stalled beyond the **dynamic stall threshold**:
   $$\text{Threshold} = \max\left(100, \frac{3000}{\text{frameRate}}\right)\text{ ms}$$
   the `requestAnimationFrame` loop may drive playhead updates from `video.currentTime`. As a safety net, this fallback also engages if rVFC never fires within an initial grace window (~1000&nbsp;ms) after play, so the playhead can never freeze permanently. Until the first compositor frame is presented, the playhead follows `mediaTime` (rVFC) exclusively, so it never leads the on-screen image. 
   
   This prevents the timeline from freezing when the video track ends but audio keeps playing (e.g. video track ends at 10s, audio at 15.4s).

---

## 4. Scenario Walkthroughs (User Operations)

### A. Play Video
1. User clicks Play.
2. The `play` event listener resets the per-session sync state and triggers `updateFrameLoop()`.
3. If supported, `requestVideoFrameCallback` is registered. In parallel, `requestAnimationFrame` is scheduled recursively.
4. Until the first rVFC frame is presented, the playhead is driven **only** by `mediaTime`; the `requestAnimationFrame` path does not advance it from `video.currentTime` (see §3), avoiding a forward race on engines whose playback clock leads presentation at startup.
5. Thereafter the UI displays continuous updates aligned with compositor frames.

---

### B. Pause Video
1. User clicks Pause.
2. The `pause` event listener triggers `handlePause()`:
   * Cancels active VFC (`cancelVideoFrameCallback`) and RAF (`cancelAnimationFrame`) loops.
   * Chooses the synchronization time. When rVFC is **fresh** (it delivered a frame within the stall threshold), the last presented compositor time `lastMediaTime` is used — this is the frame actually on screen. Otherwise (rVFC stale or unsupported, e.g. an audio-only tail after the video track ends) it falls back to `video.currentTime`:
     $$\text{syncTime} = \begin{cases} \text{lastMediaTime} & \text{if rVFC is fresh} \\ video.currentTime & \text{otherwise} \end{cases}$$
   * Performs a final playhead synchronization:
     $$\text{clampedFrame} = \max\left(0, \min\left(\lfloor(\text{syncTime} \cdot frameRate) + 0.45\rfloor, \text{totalFrames} - 1\right)\right)$$
   * Calls `setCurrentFrame(clampedFrame)` to lock the UI to the frame the user is actually looking at.
   * **Snaps the browser playhead** to the calculated frame's center time to force the browser compositor to align:
     $$\text{currentTime} = \text{calculateFrameCenterTime}(\text{clampedFrame}, \text{frameRate})$$

> **Frame-accurate tradeoff:** because pause locks to the *presented* frame (which on Safari lags the audio clock), snapping `currentTime` back to that frame's center means the small audio segment between the presented frame and the audio position is replayed on resume. This is intentional and matches other frame-accurate tools (e.g. frame.io): landing on the exact displayed frame takes priority over seamless audio. The effect is proportional to the engine's audio/video presentation offset — negligible on Chrome, ~100–300 ms on Safari.

---

### C. Drag Seekbar Head to a Timestamp
1. User clicks or drags on the seekbar track.
2. The progress bar computes the click horizontal percentage ($P$).
3. The player calculates the target frame:
   $$\text{targetFrame} = \text{Math.round}(P \cdot \text{totalFrames})$$
4. The player calls `seekToFrame(targetFrame)`:
   * Sets `isSeekingRef.current = true` to lock the synchronization loop.
   * Calculates the safe center time: `safeTargetTime = calculateFrameCenterTime(targetFrame, frameRate)`.
   * Sets `video.currentTime = safeTargetTime`.
   * Listens for the browser's native `seeked` event, then resets `isSeekingRef.current = false`.

---

### D. Step Frame-by-Frame (Arrow Keys)
1. User presses `ArrowRight` (Next Frame) or `ArrowLeft` (Prev Frame).
2. The keydown handler intercepts the event, calculates the target frame index ($N \pm 1$), and calls `seekToFrame(targetFrame)`.
3. The video seeks to the safe center time of the adjacent frame, rendering it frame-accurately.

---

### E. Pause Video and Create a Comment
1. User pauses the video (UI locks to integer `currentFrame`, e.g. `120`).
2. User writes a comment and clicks submit.
3. The comment creation form reads the `currentTime` prop, which is computed strictly from the frame index:
   $$\text{currentTime} = \frac{\text{currentFrame}}{\text{frameRate}} = \frac{120}{23.976} = 5.005005\text{s}$$
4. The API saves the exact frame boundary time `5.005005` in the database.

---

### F. Click Comment to Jump to Comment-Timestamp
1. User clicks a comment in the sidebar.
2. The select handler calls:
   ```typescript
   videoRef.current.currentTime(comment.second) // e.g., 5.005005s
   videoRef.current.pause()
   ```
3. The browser seeks the media element. Once finished, it fires the native `seeked` event.
4. The `handleExternalSeeked` listener in `useFramePlayer` triggers because `isSeekingRef.current` is `false`:
    * Maps `video.currentTime` back to the frame index:
      $$\text{finalFrame} = \lfloor(video.currentTime \cdot frameRate) + 0.45\rfloor = \lfloor(5.005005 \cdot 23.976) + 0.45\rfloor = 120$$
    * Computes the safe center time: `safeCenterTime = calculateFrameCenterTime(120, 23.976) = 5.025859s`.
   * Detects if the current time is offset from the center by more than a quarter-frame:
     $$\text{Math.abs}(5.005005 - 5.025859) = 0.020854\text{s} > \frac{0.041708}{4}\text{s}$$
   * Nudges the browser's playhead: `video.currentTime = safeCenterTime` (`5.025859`s). This forces the browser to render Frame 120 cleanly.

---

### G. Switch Resolution
1. User selects a different resolution (e.g. `720p` or `Original`).
2. The player intercepts the click:
   * Captures `wasPlaying = !player.paused()` and the current playhead time: `currentT = player.currentTime()`.
   * Updates the source URL: `player.src({ type: 'video/mp4', src: res.url })`.
3. The player registers a one-shot `loadedmetadata` event listener on the new source:
   * Restores playhead time: `player.currentTime(currentT)`.
   * Restores playback state (`play()` if `wasPlaying` was true) and playback rate.
4. The seek triggered by `player.currentTime(currentT)` fires a `seeked` event, which automatically calls `handleExternalSeeked`, recalculating the frame index and nudging the playhead to the safe frame center on the new media stream.

---

### H. Manual Zoom & Zoom Fit Reset
1. User adjusts zoom manually using the `Zoom In` (+) or `Zoom Out` (-) buttons:
   * Sets `hasManuallyZoomed` to `true`.
   * Sets the new manual scale, overriding any auto-scale layout behavior.
2. User clicks the **Fit** button:
   * Resets `hasManuallyZoomed` to `false`.
   * Triggers the responsive scale recalculation effect, mapping the video scale back to the layout container bounds:
     $$\text{scale} = \min\left(\frac{\text{containerSize.width}}{\text{originalWidth}}, \frac{\text{containerSize.height}}{\text{originalHeight}}\right)$$

---

## 5. Backend Specifications

### A. Transcode & Metadata Extraction
When a video is uploaded, the `@shumai/transcode` worker executes an `ffprobe` command to analyze the source container and streams:
```bash
ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,duration,nb_frames -of default=noprint_wrappers=1:nocaveat=1 input.mp4
```
The extracted metadata details are saved to the `AssetMetadata` table:
* `frameRate` (e.g. `23.976` or `30`)
* `duration` (the absolute container duration, e.g. `15.42`)
* `totalFrames` (the physical number of frames in the video stream, e.g. `240`)

---

### B. Database Schema
Comments are represented in the Prisma database schema by the `Comment` model:

```prisma
model Comment {
  id           String       @id @default(ulid())
  text         String
  second       Decimal?     @db.Decimal(10, 4) // Stores currentFrame / frameRate
  fileId       String
  file         Asset        @relation(fields: [fileId], references: [id], onDelete: Cascade)
  createdAt    DateTime     @default(now())
}
```
* **Precision:** The `second` column uses `Decimal(10, 4)` to store sub-millisecond timestamps accurately without rounding or floating-point truncation.
