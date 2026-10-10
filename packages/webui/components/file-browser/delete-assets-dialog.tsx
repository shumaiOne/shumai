import type { AssetInfo } from '@shumai/dtos'
import { AlertTriangle, Layers } from 'lucide-react'
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
import { Checkbox } from '@/ui/components/ui/checkbox'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { isStacked } from '@/ui/lib/stack-utils'
import { m } from '@/ui/paraglide/messages.js'

interface DeleteAssetsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: AssetInfo[]
  /** Ticked files of the stacked cards in `items`. */
  stackSelection: ReadonlySet<string>
  onStackSelectionChange: (next: Set<string>) => void
  onConfirm: () => void
}

/**
 * The delete confirmation. When a stacked card (Stack on) is being deleted, it warns that the card
 * stands for several files and lists each one with its own checkbox, so every file is confirmed
 * before it goes to Recently Deleted.
 */
export function DeleteAssetsDialog({
  open,
  onOpenChange,
  items,
  stackSelection,
  onStackSelectionChange,
  onConfirm,
}: DeleteAssetsDialogProps) {
  const stacks = items.filter(isStacked)
  const plainCount = items.length - stacks.length
  const stackFileCount = stacks.reduce((n, s) => n + s.stack!.members.length, 0)
  const selectedCount = stacks.reduce(
    (n, s) => n + s.stack!.members.filter((f) => stackSelection.has(f.id)).length,
    0,
  )
  const total = plainCount + selectedCount

  const toggle = (id: string) => {
    const next = new Set(stackSelection)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onStackSelectionChange(next)
  }
  const setAll = (ids: string[], on: boolean) => {
    const next = new Set(stackSelection)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    onStackSelectionChange(next)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={stacks.length > 0 ? 'max-w-lg' : undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {stacks.length > 0 ? m.stack_delete_title() : m.delete_asset_title()}
          </AlertDialogTitle>
          <AlertDialogDescription>{m.delete_asset_description()}</AlertDialogDescription>
        </AlertDialogHeader>

        {stacks.length > 0 && (
          <div className="space-y-3" data-testid="stack-delete-list">
            <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>{m.stack_delete_warning({ count: stackFileCount })}</span>
            </div>
            <ScrollArea className="max-h-72 [&>[data-slot=scroll-area-viewport]]:max-h-72">
              <div className="space-y-3 pr-3">
                {stacks.map((item) => {
                  const ids = item.stack!.members.map((f) => f.id)
                  const allOn = ids.every((id) => stackSelection.has(id))
                  return (
                    <div key={item.id} className="rounded-md border p-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <Checkbox
                          checked={
                            allOn
                              ? true
                              : ids.some((id) => stackSelection.has(id))
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={() => setAll(ids, !allOn)}
                        />
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{item.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {m.stack_files({ count: ids.length })}
                        </span>
                      </label>
                      <div className="mt-1 space-y-1 pl-6">
                        {item.stack!.members.map((f) => (
                          <label
                            key={f.id}
                            className="flex cursor-pointer items-center gap-2 font-mono text-xs"
                          >
                            <Checkbox
                              checked={stackSelection.has(f.id)}
                              onCheckedChange={() => toggle(f.id)}
                            />
                            <span className="truncate">{f.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
          <AlertDialogAction
            disabled={total === 0}
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {stacks.length > 0 ? m.stack_delete_confirm({ count: total }) : m.delete()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
