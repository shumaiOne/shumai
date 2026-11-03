import { m } from '@/ui/paraglide/messages.js'
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

export interface ArchiveConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'archive' | 'restore'
  onConfirm: () => void
  isPending?: boolean
}

export function ArchiveConfirmDialog({
  open,
  onOpenChange,
  mode,
  onConfirm,
  isPending = false,
}: ArchiveConfirmDialogProps) {
  const isArchive = mode === 'archive'
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="archive-confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isArchive ? m.archive_confirm_title() : m.restore_archive_confirm_title()}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isArchive ? m.archive_confirm_description() : m.restore_archive_confirm_description()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{m.cancel()}</AlertDialogCancel>
          <AlertDialogAction
            data-testid="archive-confirm-submit"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {isArchive ? m.archive() : m.restore_from_archive()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
