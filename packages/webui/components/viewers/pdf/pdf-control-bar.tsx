import { ChevronLeft, ChevronRight, Download, Minus, Plus } from 'lucide-react'
import { m } from '@/ui/paraglide/messages.js'

export interface PdfControlBarProps {
  currentPage: number
  totalPages: number
  onPageChange: (newPage: number) => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onDownload: () => void
  canDownload: boolean
  /** When false, hides the download affordance. Defaults to true. */
  allowDownload?: boolean
}

export function PdfControlBar({
  currentPage,
  totalPages,
  onPageChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onDownload,
  canDownload,
  allowDownload = true,
}: PdfControlBarProps) {
  return (
    <div className="relative px-2 py-2 sm:px-4 sm:py-3 bg-card border-t border-gray-200 dark:border-gray-700 z-10 flex items-center justify-between gap-1.5 sm:gap-2 transition-colors duration-200 shrink-0">
      {/* Page Navigation */}
      <div className="flex items-center gap-1 sm:gap-1.5 bg-gray-200/50 dark:bg-white/10 rounded-md p-0.5 shrink-0">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-1 sm:p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-40"
          title={m.previous_page()}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-1 sm:px-2 text-xs font-mono font-medium text-gray-900 dark:text-gray-100 select-none whitespace-nowrap">
          <span className="hidden sm:inline">
            {m.page_of_pages({ current: currentPage, total: totalPages || 1 })}
          </span>
          <span className="inline sm:hidden">
            {currentPage}/{totalPages || 1}
          </span>
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="p-1 sm:p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-40"
          title={m.next_page()}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Zoom & Action Controls */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-200/50 dark:bg-white/10 rounded-md p-0.5">
          <button
            onClick={onZoomOut}
            className="p-1 sm:p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
            title={m.zoom_out()}
          >
            <Minus size={16} />
          </button>
          <span className="w-10 sm:w-12 text-center text-xs font-mono font-medium text-gray-900 dark:text-gray-100 select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            className="p-1 sm:p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
            title={m.zoom_in()}
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          onClick={onFit}
          className="text-xs font-medium px-2 py-1 sm:px-3 sm:py-1.5 rounded bg-gray-200/50 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors border border-transparent"
        >
          {m.fit()}
        </button>
        {allowDownload && (
          <button
            onClick={onDownload}
            disabled={!canDownload}
            className="flex items-center gap-1 text-xs font-medium px-2 py-1 sm:px-3 sm:py-1.5 rounded bg-gray-200/50 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors border border-transparent disabled:opacity-50"
            title={m.download_original_file()}
          >
            <Download size={14} />
            <span className="hidden sm:inline">{m.download()}</span>
          </button>
        )}
      </div>
    </div>
  )
}
