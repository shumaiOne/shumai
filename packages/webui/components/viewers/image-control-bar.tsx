import { Check, Copy, Download, Maximize, Minimize, Minus, Plus } from 'lucide-react'

export interface ImageControlBarProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onDownload: () => void
  canDownload: boolean
  onCopy?: () => void
  copied?: boolean
  canCopy?: boolean
  /** When provided, renders a fullscreen toggle (used by compare mode). */
  fullscreen?: { isFullScreen: boolean; onToggle: () => void }
}

export function ImageControlBar({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onDownload,
  canDownload,
  onCopy,
  copied = false,
  canCopy = true,
  fullscreen,
}: ImageControlBarProps) {
  return (
    <div className="relative px-4 py-3 bg-card border-t border-gray-200 dark:border-gray-700 z-10 flex items-center justify-end gap-2 transition-colors duration-200">
      <div className="flex items-center gap-1 bg-gray-200/50 dark:bg-white/10 rounded-md p-0.5 mr-auto">
        <button
          onClick={onZoomOut}
          className="p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
          title="Zoom Out"
        >
          <Minus size={16} />
        </button>
        <span className="w-12 text-center text-xs font-mono font-medium text-gray-900 dark:text-gray-100 select-none">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          className="p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
          title="Zoom In"
        >
          <Plus size={16} />
        </button>
      </div>
      <button
        onClick={onFit}
        className="text-xs font-medium px-3 py-1.5 rounded bg-gray-200/50 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors border border-transparent animate-in fade-in zoom-in-95 duration-200"
      >
        Fit
      </button>
      {onCopy && (
        <button
          onClick={onCopy}
          disabled={!canCopy}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded bg-gray-200/50 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors border border-transparent disabled:opacity-50 animate-in fade-in zoom-in-95 duration-200"
          title="Copy optimized image to clipboard"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
      <button
        onClick={onDownload}
        disabled={!canDownload}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded bg-gray-200/50 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors border border-transparent disabled:opacity-50 animate-in fade-in zoom-in-95 duration-200"
        title="Download original image"
      >
        <Download size={14} />
        Download
      </button>
      {fullscreen && (
        <button
          onClick={fullscreen.onToggle}
          className="p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
          title="Fullscreen"
        >
          {fullscreen.isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      )}
    </div>
  )
}
