import type { AssetInfo } from '@shumai/dtos'
import { cn } from '@/ui/lib/utils'
import { Link } from '@tanstack/react-router'
import React from 'react'
import { FilePreview } from './file-browser/file-preview'

interface SidebarFileCardProps {
  projectId: string
  item: AssetInfo
  isActive: boolean
}

export const SidebarFileCard = React.forwardRef<HTMLDivElement, SidebarFileCardProps>(
  ({ projectId, item, isActive }, ref) => {
    const filePath = `/projects/${projectId}/files/${item.id}`
    return (
      <div ref={ref}>
        <Link
          to={filePath}
          className={cn(
            'flex flex-col overflow-hidden rounded-lg border',
            isActive ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50',
          )}
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/30">
            <FilePreview item={item} />
          </div>
          <div className="p-2">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="truncate text-xs text-muted-foreground">{item.creator?.name}</p>
          </div>
        </Link>
      </div>
    )
  },
)

SidebarFileCard.displayName = 'SidebarFileCard'
