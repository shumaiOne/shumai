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

### B. Time-to-Frame Conversion (Floor with Epsilon)
When converting a raw player timestamp ($t$) back to an integer frame index, we use a **Floor with Epsilon** formula to absorb sub-millisecond clock drift and presentation lag without triggering premature frame jumps:

$$\text{Frame} = \lfloor(t \cdot \text{frameRate}) + \epsilon\rfloor$$

*Where $\epsilon = 0.001$ frames.*
* **Start Boundary Guard:** If the browser reports time slightly early due to float precision (e.g. $119.9999$ frames instead of $120.0$), the $+ 0.001$ bumps it to $120.0009$, flooring correctly to Frame `120`.
* **Late Pause Guard:** If the playhead stops very late in the frame (e.g. $120.96$ frames), adding `0.001` yields $120.961$, which still floors correctly to **Frame `120`**, matching what is actually displayed on the screen.

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
3. **Stall Detection:** The playhead tracks when the last rVFC callback was fired. If it has been stalled for longer than the **dynamic stall threshold**:
   $$\text{Threshold} = \max\left(100, \frac{3000}{\text{frameRate}}\right)\text{ ms}$$
   the RAF loop takes over playhead updates using `video.currentTime`. 
   
   This prevents the timeline from freezing when the video track ends but audio keeps playing (e.g. video track ends at 10s, audio at 15.4s).

---

## 4. Scenario Walkthroughs (User Operations)

### A. Play Video
1. User clicks Play.
2. The `play` event listener triggers `updateFrameLoop()`.
3. If supported, `requestVideoFrameCallback` is registered. In parallel, `requestAnimationFrame` is scheduled recursively.
4. UI displays continuous updates aligned with compositor frames.

---

### B. Pause Video
1. User clicks Pause.
2. The `pause` event listener triggers `handlePause()`:
   * Cancels active VFC (`cancelVideoFrameCallback`) and RAF (`cancelAnimationFrame`) loops.
   * Performs a final playhead synchronization:
     $$\text{clampedFrame} = \max\left(0, \min\left(\lfloor(video.currentTime \cdot frameRate) + 0.001\rfloor, \text{totalFrames} - 1\right)\right)$$
   * Calls `setCurrentFrame(clampedFrame)` to lock the UI to the correct frame.

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
     $$\text{finalFrame} = \lfloor(video.currentTime \cdot frameRate) + 0.001\rfloor = \lfloor(5.005005 \cdot 23.976) + 0.001\rfloor = 120$$
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
