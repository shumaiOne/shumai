import React from 'react'
import { Play, Pause, RotateCcw, Maximize, Minimize, Minus, Plus, Download } from 'lucide-react'
import { RulerSlider } from './ruler-slider'

export interface ModelControlBarProps {
  isPlaying: boolean
  currentDegree: number
  zoom: number
  isFullScreen: boolean
  allowDownload?: boolean
  downloadUrl?: string
  fileName?: string
  togglePlay: () => void
  onSeekDegree: (degree: number) => void
  onResetRotation: () => void
  onZoomChange: (zoom: number) => void
  onZoomReset: () => void
  toggleFullScreen: () => void
}

export const ModelControlBar: React.FC<ModelControlBarProps> = ({
  isPlaying,
  currentDegree,
  zoom,
  isFullScreen,
  allowDownload = true,
  downloadUrl,
  fileName,
  togglePlay,
  onSeekDegree,
  onResetRotation,
  onZoomChange,
  onZoomReset,
  toggleFullScreen,
}) => {
  const handleDownload = () => {
    if (!downloadUrl) return
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = fileName || 'model.glb'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-xl bg-card/90 backdrop-blur-md border border-border/80 shadow-xl w-full max-w-4xl text-foreground">
        {/* Play/Pause & Degree Readout */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <div
            className="text-xs font-mono font-medium tabular-nums min-w-[76px]"
            data-testid="degree-readout"
          >
            {currentDegree}° / 360°
          </div>
        </div>

        {/* Ruler Slider */}
        <div className="flex-1 min-w-[200px]">
          <RulerSlider currentDegree={currentDegree} onChange={onSeekDegree} />
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Reset rotation to 0° */}
          <button
            type="button"
            onClick={onResetRotation}
            title="Reset to 0°"
            aria-label="Reset rotation to 0°"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Zoom controls */}
          <div className="hidden sm:flex items-center gap-1 bg-muted/60 rounded-lg p-0.5 border border-border/40">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(0.2, zoom - 0.2))}
              aria-label="Zoom out"
              className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onZoomReset}
              aria-label="Reset zoom"
              className="px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(5, zoom + 0.2))}
              aria-label="Zoom in"
              className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Download */}
          {allowDownload && downloadUrl && (
            <button
              type="button"
              onClick={handleDownload}
              title="Download asset"
              aria-label="Download asset"
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullScreen}
            title={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {isFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
