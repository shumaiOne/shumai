import { Skeleton } from '@/ui/components/ui/skeleton'

export function ProjectFolderSkeleton() {
  return (
    <div className="flex flex-1 overflow-hidden bg-background min-h-0">
      {/* Sidebar (Folder tree placeholder) */}
      <div className="w-[240px] border-r p-4 space-y-4 hidden md:block shrink-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="pl-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Mobile: matches MobileFileBrowserContentSkeleton */}
        <div className="block md:hidden">
          <MobileFileBrowserContentSkeleton />
        </div>

        {/* Desktop: file browser toolbar + card grid */}
        <div className="hidden md:block p-6 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-32 rounded" />
            </div>
          </div>
          <FileBrowserContentSkeleton />
        </div>
      </div>
    </div>
  )
}

export function FileDetailSkeleton() {
  return (
    <div className="h-full flex-1 flex flex-col bg-background overflow-hidden">
      {/* Mobile-only view: matches MobileFileDetail */}
      <div className="flex md:hidden flex-col h-full w-full overflow-hidden">
        {/* Mobile File Header placeholder */}
        <div className="h-14 flex items-center justify-between border-b px-4 shrink-0 bg-card">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
        </div>
        {/* Media area placeholder */}
        <div className="flex-1 min-h-0 bg-muted/20 flex items-center justify-center relative p-4">
          <Skeleton className="w-full max-w-sm aspect-video rounded-lg" />
        </div>
        {/* Bottom sheet placeholder */}
        <div className="h-[45%] border-t bg-card rounded-t-xl p-4 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <div className="space-y-3 flex-1">
            <Skeleton className="h-12 w-full rounded" />
            <Skeleton className="h-12 w-full rounded" />
          </div>
        </div>
      </div>

      {/* Desktop view: Left Carousel (96px) + Center Full-Bleed Viewer + Right Sidebar (360px) */}
      <div className="hidden md:flex h-full flex-1 overflow-hidden">
        {/* Left Carousel Skeleton (96px / w-24) */}
        <div className="w-24 bg-gray-100 dark:bg-gray-950 flex flex-col items-center py-4 gap-3 shrink-0 border-r">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="w-[52px] h-[52px] rounded-lg shrink-0" />
          ))}
        </div>

        {/* Center Viewer Area */}
        <div className="flex-1 bg-muted/10 relative flex flex-col min-w-0 justify-between">
          <div className="flex-1 flex items-center justify-center p-8">
            <Skeleton className="w-full max-w-4xl aspect-video rounded-lg shadow-sm" />
          </div>
          {/* Bottom video control bar placeholder */}
          <div className="h-12 border-t px-4 flex items-center justify-between bg-card shrink-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-3 flex-1 mx-6" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-6 w-6 rounded" />
            </div>
          </div>
        </div>

        {/* Right Sidebar Skeleton (360px) */}
        <div className="w-[360px] border-l p-4 hidden lg:flex flex-col gap-6 shrink-0 bg-card">
          {/* Metadata Section */}
          <div className="space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center py-1 border-b">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          </div>

          {/* Comments Section */}
          <div className="flex-1 flex flex-col gap-4">
            <Skeleton className="h-5 w-24" />
            <div className="space-y-3 flex-1 overflow-y-auto">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg border bg-muted/10">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2 w-12" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FileBrowserContentSkeleton({
  displayStyle = 'card',
}: {
  displayStyle?: 'card' | 'list'
}) {
  if (displayStyle === 'list') {
    return (
      <div className="p-4 space-y-2" data-testid="file-browser-loading-skeleton">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2 border-b border-border/40">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-48" />
            <div className="ml-auto flex items-center gap-8">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4" data-testid="file-browser-loading-skeleton">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-col rounded-lg border bg-card p-3 space-y-3">
            <Skeleton className="aspect-square w-full rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MobileFileBrowserContentSkeleton() {
  return (
    <div
      className="p-3 space-y-3 max-w-lg mx-auto w-full"
      data-testid="mobile-file-browser-loading-skeleton"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <Skeleton className="h-10 w-10 rounded-md shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
