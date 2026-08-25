import { client } from '@/ui/api/client'
import { Download } from 'lucide-react'
import React, { useImperativeHandle } from 'react'
import { FileViewerProps, MediaController } from '../types'

export const DefaultViewer = React.forwardRef<MediaController, FileViewerProps>(
  ({ file, shareId, allowDownload = true }, ref) => {
    // Implement no-op media controller
    useImperativeHandle(ref, () => ({
      play: () => {},
      pause: () => {},
      seekTo: () => {},
    }))

    const handleDownload = async () => {
      const key = file.media?.original?.key
      if (!key || !file.id) return
      try {
        const res = shareId
          ? await client.api.shares[':shareId'].files[':fileId']['download-url'].$post({
              param: { shareId, fileId: file.id },
              json: { key },
            })
          : await client.api.files['download-url'].$post({
              json: { key, assetId: file.id },
            })
        if (!res.ok) return
        const { url } = await res.json()
        const link = document.createElement('a')
        link.href = url
        link.download = ''
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } catch {
        // silently fail
      }
    }

    return (
      <div className="flex flex-col flex-1 h-full overflow-hidden bg-gray-100 dark:bg-gray-950 relative">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Preview unavailable</p>
        </div>
        <div className="relative px-4 py-3 bg-card border-t border-gray-200 dark:border-gray-700 z-10 flex items-center justify-end gap-2 transition-colors duration-200">
          {allowDownload && (
            <button
              onClick={handleDownload}
              disabled={!file.media?.original?.key}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded bg-gray-200/50 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors border border-transparent disabled:opacity-50 animate-in fade-in zoom-in-95 duration-200"
              title="Download original file"
            >
              <Download size={14} />
              Download
            </button>
          )}
        </div>
      </div>
    )
  },
)

export default DefaultViewer
