import {
  isPhotoFilterActive,
  type PhotoFacet,
  type PhotoFacets,
  type PhotoFilter as PhotoFilterValue,
  type SearchCondition,
} from '@shumai/dtos'
import { useQuery } from '@tanstack/react-query'
import { Camera } from 'lucide-react'
import { useState } from 'react'
import { client } from '@/ui/api/client'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Checkbox } from '@/ui/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { Separator } from '@/ui/components/ui/separator'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { useUserMetadataStore } from '@/ui/stores/user-metadata'

/** Where the camera filter is remembered: per user, per project, like the sort order. */
export const photoFilterMetadataKey = (projectId: string) => `project:${projectId}:photoFilter`

const SECTIONS: Array<{ facet: PhotoFacet; label: () => string }> = [
  { facet: 'camera', label: m.photo_filter_camera },
  { facet: 'lens', label: m.photo_filter_lens },
]

interface PhotoFilterProps {
  teamId: string
  projectId: string
  folderId: string
  /** The conditions of the search or collection being viewed; choices are counted within them. */
  conditions?: SearchCondition[]
  disabled?: boolean
}

export function PhotoFilter({
  teamId,
  projectId,
  folderId,
  conditions = [],
  disabled,
}: PhotoFilterProps) {
  const { metadata, setMetadata } = useUserMetadataStore()
  const [open, setOpen] = useState(false)
  const key = photoFilterMetadataKey(projectId)
  const value = (metadata[key] as PhotoFilterValue | undefined) ?? {}
  const activeCount = SECTIONS.reduce((n, s) => n + (value[s.facet]?.length ?? 0), 0)

  const { data: facets, isLoading } = useQuery({
    queryKey: ['photo-facets', folderId, conditions],
    enabled: open && !!folderId,
    queryFn: async (): Promise<PhotoFacets> => {
      // Subfolders count too: picking a value lists matching photos from them (see
      // FileSystemManager), so the choices match what the listing will show.
      const res = await client.api.folders[':folderId']['photo-facets'].$post({
        param: { folderId },
        json: { recursively: true, operator: 'AND', conditions },
      })
      if (!res.ok) throw new Error('failed to load camera details')
      return (await res.json()).data
    },
  })

  const save = (next: PhotoFilterValue) => setMetadata(teamId, key, next)
  const toggle = (facet: PhotoFacet, v: string) => {
    const list = value[facet] ?? []
    save({ ...value, [facet]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] })
  }
  const empty = !!facets && SECTIONS.every((s) => facets[s.facet].length === 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            'gap-1.5 text-muted-foreground',
            isPhotoFilterActive(value) && 'text-foreground',
          )}
          aria-label={m.photo_filter_title()}
        >
          <Camera className="h-4 w-4" />
          <span>{m.photo_filter()}</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {isLoading && <p className="p-3 text-sm text-muted-foreground">{m.loading()}</p>}
        {empty && <p className="p-3 text-sm text-muted-foreground">{m.photo_filter_empty()}</p>}
        {facets && !empty && (
          <p className="px-3 pt-3 text-xs text-muted-foreground">{m.photo_filter_scope()}</p>
        )}
        {facets &&
          SECTIONS.filter((s) => facets[s.facet].length > 0).map((s, i) => (
            <div key={s.facet}>
              {i > 0 && <Separator />}
              <div className="p-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {s.label()}
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto px-3 pb-3">
                {facets[s.facet].map(({ value: v, count }) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                    <Checkbox
                      checked={value[s.facet]?.includes(v) ?? false}
                      onCheckedChange={() => toggle(s.facet, v)}
                    />
                    <span className="flex-1 truncate" title={v}>
                      {v}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        {activeCount > 0 && (
          <>
            <Separator />
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="sm" onClick={() => save({})}>
                {m.photo_filter_clear()}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
