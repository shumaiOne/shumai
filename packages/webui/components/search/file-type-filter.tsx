import {
  FILE_TYPE_GROUP_PREFIX,
  groupFileTypeCounts,
  isFileTypeFilterActive,
  type FileTypeCount,
  type SearchCondition,
  type FileTypeFilter as FileTypeFilterValue,
  type FileTypeGroup,
} from '@shumai/dtos'
import { useQuery } from '@tanstack/react-query'
import { FileType } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { client } from '@/ui/api/client'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Checkbox } from '@/ui/components/ui/checkbox'
import { Label } from '@/ui/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { Separator } from '@/ui/components/ui/separator'
import { Switch } from '@/ui/components/ui/switch'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { getLocale } from '@/ui/paraglide/runtime.js'
import { useUserMetadataStore } from '@/ui/stores/user-metadata'
import { cleanPersistedFileTypes, formatFileCount } from './file-type-counts'

/** Where the file-type filter is remembered: per user, per project, like the sort order. */
export const fileTypeMetadataKey = (projectId: string) => `project:${projectId}:fileTypes`

const EDITING = `${FILE_TYPE_GROUP_PREFIX}editing`

const GROUPS: Array<{ group: FileTypeGroup; label: () => string }> = [
  { group: 'raw', label: m.file_type_group_raw },
  { group: 'jpeg', label: m.file_type_group_jpeg },
  { group: 'heif', label: m.file_type_group_heif },
  { group: 'video', label: m.file_type_group_video },
  { group: 'editing', label: m.file_type_group_editing },
]

interface FileTypeFilterProps {
  teamId: string
  projectId: string
  folderId: string
  /** Counts follow the listing: the same search conditions and recursion the file list uses. */
  conditions?: SearchCondition[]
  recursively?: boolean
  disabled?: boolean
}

const toggle = (list: string[], token: string) =>
  list.includes(token) ? list.filter((t) => t !== token) : [...list, token]

export function FileTypeFilter({
  teamId,
  projectId,
  folderId,
  conditions = [],
  recursively = false,
  disabled,
}: FileTypeFilterProps) {
  const { metadata, setMetadata } = useUserMetadataStore()
  const [open, setOpen] = useState(false)
  const key = fileTypeMetadataKey(projectId)
  // A remembered filter can hold tokens the server rejects; drop them and heal the stored value.
  const stored = metadata[key]
  const { value, changed } = useMemo(() => cleanPersistedFileTypes(stored), [stored])
  useEffect(() => {
    if (changed) setMetadata(teamId, key, value)
  }, [changed, value, setMetadata, teamId, key])
  const include = value.include ?? []
  const exclude = value.exclude ?? []
  const hideEditing = exclude.includes(EDITING)
  const activeCount = include.length + exclude.length

  const { data: counts } = useQuery({
    queryKey: ['file-types', folderId, recursively, conditions],
    enabled: open && !!folderId,
    queryFn: async (): Promise<FileTypeCount[]> => {
      const res = await client.api.folders[':folderId']['file-types'].$post({
        param: { folderId },
        json: { conditions, recursively },
      })
      if (!res.ok) throw new Error('failed to load file types')
      return (await res.json()).data
    },
  })

  const groupCounts = counts ? groupFileTypeCounts(counts) : undefined
  const locale = getLocale()
  const fmt = (n: number) => formatFileCount(n, locale)

  const save = (next: FileTypeFilterValue) => setMetadata(teamId, key, next)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            'gap-1.5 text-muted-foreground',
            isFileTypeFilterActive(value) && 'text-foreground',
          )}
          aria-label={m.file_type_filter_title()}
        >
          <FileType className="h-4 w-4" />
          <span>{m.file_type_filter()}</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="flex items-start justify-between gap-3 p-3">
          <div className="space-y-0.5">
            <Label htmlFor="file-type-hide-editing" className="text-sm font-medium">
              {m.file_type_hide_editing()}
            </Label>
            <p className="text-xs text-muted-foreground">{m.file_type_hide_editing_hint()}</p>
          </div>
          <Switch
            id="file-type-hide-editing"
            checked={hideEditing}
            onCheckedChange={(on) =>
              save({
                include,
                exclude: on
                  ? [...new Set([...exclude, EDITING])]
                  : exclude.filter((t) => t !== EDITING),
              })
            }
          />
        </div>

        <Separator />

        <div className="p-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {m.file_type_show_only()}
        </div>
        <div className="space-y-1 px-3 pb-3">
          {GROUPS.map(({ group, label }) => {
            const token = `${FILE_TYPE_GROUP_PREFIX}${group}`
            return (
              <label key={token} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                <Checkbox
                  checked={include.includes(token)}
                  onCheckedChange={() => save({ include: toggle(include, token), exclude })}
                />
                <span className="flex-1">{label()}</span>
                {groupCounts && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {fmt(groupCounts[group])}
                  </span>
                )}
              </label>
            )
          })}
        </div>

        {counts && counts.length > 0 && (
          <>
            <Separator />
            <div className="p-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {m.file_type_in_this_folder()}
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto px-3 pb-3">
              {counts.map(({ extension, count }) => (
                <label
                  key={extension || '(none)'}
                  className={cn(
                    'flex items-center gap-2 py-1 text-sm',
                    extension ? 'cursor-pointer' : 'cursor-default opacity-60',
                  )}
                >
                  <Checkbox
                    disabled={!extension}
                    checked={!!extension && include.includes(extension)}
                    onCheckedChange={() => save({ include: toggle(include, extension), exclude })}
                  />
                  <span className="flex-1 font-mono text-xs">
                    {extension ? `.${extension.toUpperCase()}` : m.file_type_no_extension()}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{fmt(count)}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {activeCount > 0 && (
          <>
            <Separator />
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="sm" onClick={() => save({})}>
                {m.file_type_clear()}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
