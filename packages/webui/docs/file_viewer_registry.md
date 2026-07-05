# File Viewer Registry System

The **File Viewer Registry** is a modular, type-safe system that makes it easy for developers to add support for new file types (e.g., audio, markdown, pdf, images, and videos) in Shumai's WebUI.

By registering a file type, the detail pages (`FileViewer`), split-screen comparison interfaces (`CompareViewer`), and sidebars automatically adapt to the content, control schemes, and comment features of that file type.

---

## 1. Core Architecture

The system is located under `packages/webui/components/viewers/` and is divided into:
* **Types Definition (`types.ts`)**: Outlines the standard props and imperative controllers every viewer must share.
* **Central Registry (`registry.ts`)**: Matches files dynamically using file metadata (mime-types, extensions, etc.) to load the correct viewer configuration.
* **Viewer Modules**: Self-contained directories containing components, control bars, styles, and tests for each file type (e.g. `video/`, `image/`).

```text
packages/webui/components/viewers/
├── types.ts                    # Shared types (MediaController, FileViewerProps)
├── registry.ts                 # Registry definition & matcher helpers
├── video/                      # Video viewer module
│   ├── index.tsx               # Video type definition export
│   ├── video-viewer.tsx        # Content viewer (forwardRef)
│   ├── video-control-bar.tsx   
│   └── compare-video-pane.tsx  # Comparison pane
├── image/                      # Image viewer module
│   ├── index.tsx               # Image type definition export
│   ├── image-viewer.tsx        
│   └── compare-image-pane.tsx  
└── default/                    # Fallback for unsupported types
    ├── index.tsx
    └── default-viewer.tsx
```

---

## 2. Shared Interfaces (`types.ts`)

To ensure type safety across all file types, the registry enforces strict TypeScript definitions.

### `MediaController`
Abstracts time-based media control (e.g., seeking, playing, pausing) from outer layout and comments components:
```typescript
export interface MediaController {
  play: () => void
  pause: () => void
  seekTo: (second: number) => void
  getCurrentTime?: () => number
  getDuration?: () => number
}
```

### `FileTypeDefinition`
The schema that every registered file type configuration must satisfy:
```typescript
export interface FileTypeDefinition {
  id: string; // Unique ID (e.g., 'video', 'image')
  name: string;
  match: (file: AssetInfo) => boolean;
  
  // Renders the main content & control bar, forwarding MediaController ref
  viewer: React.ForwardRefExoticComponent<
    FileViewerProps & React.RefAttributes<MediaController>
  >;
  
  // Optional split-screen comparison pane
  comparePane?: React.ForwardRefExoticComponent<
    ComparePaneProps & React.RefAttributes<ComparePaneHandle>
  >;
  
  // Configuration for comments and sidebar features
  commentsConfig?: {
    hasTimestamp?: boolean;   // Enables timestamped comments
    hasAnnotations?: boolean; // Enables annotation drawing canvas
    hasAiBots?: boolean;       // Enables metadata/autofill AI bots
  };
}
```

---

## 3. How to Add a New File Type (Step-by-Step)

To add support for a new file type (e.g., **Audio**):

### Step 1: Create the Folder Structure
Create a new folder under `packages/webui/components/viewers/audio/`.

### Step 2: Implement the Viewer Component
Create `audio-viewer.tsx`. This component handles the content viewport (e.g. waveform display) and the play controls. It **must** forward its ref as a `MediaController`:

```typescript
import React, { useImperativeHandle, useRef } from 'react'
import { FileViewerProps, MediaController } from '../types'

export const AudioViewer = React.forwardRef<MediaController, FileViewerProps>(
  ({ file, children, onPlay, onTimeUpdate }, ref) => {
    const audioEl = useRef<HTMLAudioElement | null>(null)

    // Expose control actions to the parent pages/comment areas
    useImperativeHandle(ref, () => ({
      play: () => audioEl.current?.play(),
      pause: () => audioEl.current?.pause(),
      seekTo: (second: number) => {
        if (audioEl.current) audioEl.current.currentTime = second
      },
      getCurrentTime: () => audioEl.current?.currentTime || 0,
      getDuration: () => audioEl.current?.duration || 0,
    }))

    return (
      <div className="flex flex-col flex-1 h-full bg-background relative">
        {/* Render Carousel/LeftSidebar if present */}
        {children}
        
        <div className="flex-1 flex items-center justify-center">
          <audio 
            ref={audioEl} 
            src={file.media?.original?.downloadUrl} 
            onPlay={onPlay}
            onTimeUpdate={(e) => onTimeUpdate?.((e.target as HTMLAudioElement).currentTime)}
            controls 
          />
        </div>
      </div>
    )
  }
)
```

### Step 3: (Optional) Implement the Compare Pane Component
If your file type supports comparison mode, create `compare-audio-pane.tsx`. It must forward a `ComparePaneHandle` ref:

```typescript
import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { ComparePaneProps } from '../types'
import { ComparePaneHandle } from '../../compare/types'

export const CompareAudioPane = forwardRef<ComparePaneHandle, CompareAudioPaneProps>(
  ({ file, isActive, onStateChange, onActivate }, ref) => {
    const audioEl = useRef<HTMLAudioElement | null>(null)

    useImperativeHandle(ref, () => ({
      getKind: () => 'audio',
      play: () => audioEl.current?.play(),
      pause: () => audioEl.current?.pause(),
      // ... implement remaining ComparePaneHandle methods
    }))

    return (
      <div onClick={onActivate} className="flex-1 flex flex-col items-center justify-center">
        <audio ref={audioEl} src={file.media?.original?.downloadUrl} />
      </div>
    )
  }
)
```

### Step 4: Create the Module Entrypoint
Create `index.tsx` inside your folder and define the `FileTypeDefinition`:

```typescript
import { FileTypeDefinition } from '../types'
import { AudioViewer } from './audio-viewer'
import { CompareAudioPane } from './compare-audio-pane'

export const audioTypeDefinition: FileTypeDefinition = {
  id: 'audio',
  name: 'Audio',
  match: (file) => !!file.mediaType?.startsWith('audio/'),
  viewer: AudioViewer,
  comparePane: CompareAudioPane,
  commentsConfig: {
    hasTimestamp: true,
    hasAnnotations: false,
    hasAiBots: false,
  },
}
```

### Step 5: Register the File Type
Add the definition import and reference to the `registry` array in `packages/webui/components/viewers/registry.ts`:

```typescript
import { videoTypeDefinition } from './video'
import { imageTypeDefinition } from './image'
import { audioTypeDefinition } from './audio' // 1. Import

const registry: FileTypeDefinition[] = [
  videoTypeDefinition,
  imageTypeDefinition,
  audioTypeDefinition, // 2. Add to registry
]
```

That's it! The detail page, sidebars, and comparison layout will now dynamically resolve and support your new file type.
