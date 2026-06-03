import { Skeleton } from '@/ui/components/ui/skeleton'

export function ProjectFolderSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-background min-h-0">
      {/* Top navigation/breadcrumbs placeholder */}
      <div className="flex h-14 items-center justify-between border-b px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <span className="text-muted-foreground">/</span>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
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

        {/* File Browser area */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* File browser toolbar */}
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

          {/* Cards Grid */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
            </div>
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
        </div>
      </div>
    </div>
  )
}

export function FileDetailSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top navigation */}
      <div className="flex h-14 items-center justify-between border-b px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <span className="text-muted-foreground">/</span>
          <Skeleton className="h-4 w-28" />
          <span className="text-muted-foreground">/</span>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane (Version stack) */}
        <div className="w-[280px] border-r p-4 flex flex-col gap-4 shrink-0 hidden md:flex">
          <Skeleton className="h-5 w-24" />
          <div className="space-y-3 flex-1 overflow-y-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-2 rounded border">
                <Skeleton className="h-12 w-12 rounded bg-muted shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center Pane (Viewer area) */}
        <div className="flex-1 bg-muted/20 p-6 flex flex-col justify-between relative min-w-0">
          <div className="flex-1 flex items-center justify-center">
            <Skeleton className="w-full max-w-4xl aspect-video rounded-lg shadow-lg" />
          </div>
          <div className="mt-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* Right Pane (Metadata and Comments) */}
        <div className="w-[360px] border-l p-4 flex flex-col gap-6 shrink-0 hidden lg:flex bg-card">
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
