import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { Button } from '@/ui/components/ui/button'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { m } from '@/ui/paraglide/messages.js'

export interface TestEmailDialogProps {
  isOpen: boolean
  onClose: () => void
  teamId: string
  defaultFrom?: string
}

export function TestEmailDialog({
  isOpen,
  onClose,
  teamId,
  defaultFrom = '',
}: TestEmailDialogProps) {
  const [fromAddress, setFromAddress] = useState(defaultFrom)

  useEffect(() => {
    if (isOpen) {
      setFromAddress(defaultFrom)
    }
  }, [defaultFrom, isOpen])

  const { mutateAsync: sendTestEmail, isPending: isSending } = useMutation({
    mutationFn: async (from: string) => {
      const res = await client.api.teams[':teamId'].notifications.email.test.$post({
        param: { teamId },
        json: { from },
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null
        throw new Error(err?.message || m.failed_to_send_test_email())
      }
      return await res.json()
    },
  })

  const handleSend = async () => {
    if (!fromAddress.trim()) {
      toast.error(m.from_address_required())
      return
    }
    try {
      await sendTestEmail(fromAddress.trim())
      toast.success(m.test_email_sent_successfully())
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.failed_to_send_test_email())
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            <DialogTitle>{m.send_test_email()}</DialogTitle>
          </div>
          <DialogDescription>{m.send_test_email_dialog_description()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label htmlFor="test-dialog-from-input" className="text-sm font-medium text-foreground">
              {m.sender_from()}
            </label>
            <Input
              id="test-dialog-from-input"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              placeholder="Shumai <noreply@example.com>"
              disabled={isSending}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            {m.cancel()}
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {m.send_test_email()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
