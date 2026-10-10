import { client } from '@/ui/api/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/ui/alert-dialog'
import { Button } from '@/ui/components/ui/button'
import { Checkbox } from '@/ui/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { formatSize } from '@/ui/lib/format'
import {
  buildResolveRequests,
  pruneSelection,
  selectedBytes,
  selectExtraCopies,
  selectionRemovesAllCopies,
} from '@/ui/lib/duplicates'
import { m } from '@/ui/paraglide/messages.js'
import type { ResolveDuplicatesRequest } from '@shumai/dtos'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

interface DuplicatesDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const GROUP_LIMIT = 50

/** The server refused a group because it no longer matches what was listed (HTTP 409). */
class DuplicatesChangedError extends Error {}

export function DuplicatesDialog({ projectId, open, onOpenChange }: DuplicatesDialogProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)

  const queryKey = ['projects', projectId, 'duplicates']
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].duplicates.$get({
        param: { projectId },
        query: { limit: String(GROUP_LIMIT) },
      })
      if (!res.ok) throw new Error(m.duplicates_failed_load())
      return await res.json()
    },
    enabled: open,
  })

  const groups = useMemo(() => data?.groups ?? [], [data])
  const wastedBytes = groups.reduce((sum, g) => sum + g.wastedBytes, 0)
  const removesAll = selectionRemovesAllCopies(groups, selected)

  useEffect(() => {
    setSelected((prev) => pruneSelection(groups, prev))
  }, [groups])

  // One request per group. The server checks that every file to delete is an exact copy of the one
  // kept (same hash and size, live, in this project) and refuses the whole group otherwise.
  const { mutate: deleteSelected, isPending } = useMutation({
    mutationFn: async (requests: ResolveDuplicatesRequest[]) => {
      let deleted = 0
      for (const json of requests) {
        const res = await client.api.projects[':projectId'].duplicates.resolve.$post({
          param: { projectId },
          json,
        })
        if (res.status === 409) throw new DuplicatesChangedError()
        if (!res.ok) throw new Error('Failed to delete')
        deleted += (await res.json()).deletedIds.length
      }
      return deleted
    },
    onSuccess: (count) => {
      toast.success(m.duplicates_deleted({ count }))
      setSelected(new Set())
      setConfirmOpen(false)
    },
    onError: (err) => {
      toast.error(
        err instanceof DuplicatesChangedError
          ? m.duplicates_group_changed()
          : `Error: ${err.message}`,
      )
      setConfirmOpen(false)
    },
    // Some groups may already have been resolved, so refresh the list on success and on failure.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'recently-deleted'] })
    },
  })

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl" data-testid="duplicates-dialog">
          <DialogHeader>
            <DialogTitle>{m.duplicates()}</DialogTitle>
            <DialogDescription>{m.duplicates_description()}</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <p className="py-6 text-sm text-destructive">{m.duplicates_failed_load()}</p>
          ) : groups.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">
              <p>{m.duplicates_none()}</p>
              <p className="mt-1 text-xs">{m.duplicates_not_hashed_hint()}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {m.duplicates_summary({ groups: groups.length, size: formatSize(wastedBytes) })}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(selectExtraCopies(groups))}
                  >
                    {m.duplicates_select_extra()}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={selected.size === 0}
                    onClick={() => setSelected(new Set())}
                  >
                    {m.duplicates_clear_selection()}
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[50vh] pr-3">
                <div className="space-y-4">
                  {groups.map((group) => (
                    <section key={group.contentHash} className="rounded-md border p-3">
                      <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                        {m.duplicates_copies({
                          count: group.count,
                          size: formatSize(group.sizeByte),
                        })}
                      </h4>
                      <ul className="space-y-1">
                        {group.assets.map((asset) => (
                          <li key={asset.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selected.has(asset.id)}
                              onCheckedChange={(v) => toggle(asset.id, v === true)}
                              aria-label={asset.name}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              <span className="font-medium">{asset.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {asset.path || m.duplicates_root_path()}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {new Date(asset.createdAt).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </ScrollArea>
              {data?.truncated && (
                <p className="text-xs text-muted-foreground">{m.duplicates_truncated()}</p>
              )}
            </>
          )}

          <DialogFooter className="items-center gap-2">
            {removesAll && (
              <span className="mr-auto text-xs text-destructive">{m.duplicates_keep_one()}</span>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {m.close()}
            </Button>
            <Button
              variant="destructive"
              disabled={selected.size === 0 || removesAll || isPending}
              onClick={() => setConfirmOpen(true)}
            >
              {m.duplicates_delete_selected({ count: selected.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.duplicates_confirm_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.duplicates_confirm_description({
                count: selected.size,
                size: formatSize(selectedBytes(groups, selected)),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault()
                deleteSelected(buildResolveRequests(groups, selected))
              }}
            >
              {m.delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
