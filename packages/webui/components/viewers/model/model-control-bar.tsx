import React from 'react'
import { Play, Pause, RotateCcw, Maximize, Minimize, Minus, Plus, Download } from 'lucide-react'
import { cn } from '@/ui/lib/utils'
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
    <div
      className={cn(
        'transition-all duration-300 ease-in-out z-20 text-foreground',
        isFullScreen
          ? 'absolute bottom-0 left-0 right-0 px-4 py-3 bg-card/90 backdrop-blur-md border-t border-border'
          : 'relative w-full bg-card border-t border-border px-4 py-3 z-10 transition-colors duration-200',
      )}
    >
      {/* Top: Ruler Slider across full width */}
      <div className="mb-3 px-1">
        <RulerSlider currentDegree={currentDegree} onChange={onSeekDegree} />
      </div>

      {/* Bottom: Lower Controls Row */}
      <div className="flex items-center justify-between text-foreground">
        {/* Left Side: Play/Pause, Degree Readout, Reset Rotation */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="hover:text-primary transition-colors"
            data-testid="play-toggle"
            data-playing={isPlaying}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current" />
            )}
          </button>

          <div
            className="flex items-center gap-1 text-sm font-medium tabular-nums select-none min-w-[90px]"
            data-testid="degree-readout"
          >
            <span className="text-muted-foreground font-mono">{currentDegree}° / 360°</span>
          </div>

          <button
            type="button"
            onClick={onResetRotation}
            title="Reset to 0°"
            aria-label="Reset rotation to 0°"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Right Side: Zoom controls, Download, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5 border border-border/40">
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
