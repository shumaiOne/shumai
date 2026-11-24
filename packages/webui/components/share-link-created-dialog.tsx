import { client } from '@/ui/api/client'
import { ShareSecuritySettings } from '@/ui/components/share-security-settings'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { copyToClipboard } from '@/ui/lib/clipboard'
import { m } from '@/ui/paraglide/messages.js'
import type { ShareLinkInfo } from '@shumai/dtos'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowUpRight, Check, Copy, Pencil } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface ShareLinkCreatedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shareLink: ShareLinkInfo | null
  projectId: string
}

export function ShareLinkCreatedDialog({
  open,
  onOpenChange,
  shareLink,
  projectId,
}: ShareLinkCreatedDialogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [copied, setCopied] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const cancelEditRef = useRef(false)
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const shareId = shareLink?.id

  const { data: liveShareLink } = useQuery({
    queryKey: ['share', shareId],
    queryFn: async () => {
      if (!shareId) return null
      const res = await client.api.shares[':shareId'].$get({
        param: { shareId },
      })
      if (!res.ok) throw new Error(m.failed_fetch_share_link())
      return (await res.json()) as unknown as ShareLinkInfo
    },
    initialData: shareLink ?? undefined,
    enabled: open && !!shareId,
  })

  const activeShare = liveShareLink ?? shareLink

  useEffect(() => {
    if (!open) {
      setIsEditingName(false)
      setCopied(false)
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current)
        copiedTimeoutRef.current = null
      }
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }
  }, [isEditingName])

  const { mutate: renameShare, isPending: isRenaming } = useMutation({
    mutationFn: async (name: string) => {
      if (!activeShare) throw new Error(m.failed_rename_share_link())
      const res = await client.api.shares[':shareId'].$put({
        param: { shareId: activeShare.id },
        json: { name },
      })
      if (!res.ok) throw new Error(m.failed_rename_share_link())
      return (await res.json()) as unknown as ShareLinkInfo
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['share', updated.id], updated)
      queryClient.invalidateQueries({ queryKey: ['shares', projectId] })
      queryClient.invalidateQueries({ queryKey: ['share', updated.id] })
      toast.success(m.share_link_renamed())
    },
    onError: () => {
      toast.error(m.failed_rename_share_link())
    },
  })

  if (!activeShare) {
    return null
  }

  const shareUrl = `${window.location.origin}/share/${activeShare.id}`

  const startEditingName = () => {
    cancelEditRef.current = false
    setNameInput(activeShare.name)
    setIsEditingName(true)
  }

  const commitRename = () => {
    if (cancelEditRef.current) {
      cancelEditRef.current = false
      return
    }
    const trimmed = nameInput.trim()
    setIsEditingName(false)
    if (!trimmed || trimmed === activeShare.name) {
      return
    }
    renameShare(trimmed)
  }

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(shareUrl)
    if (ok) {
      toast.success(m.copied_to_clipboard())
      setCopied(true)
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current)
      }
      copiedTimeoutRef.current = setTimeout(() => {
        setCopied(false)
        copiedTimeoutRef.current = null
      }, 2000)
    }
  }

  const handleAdvancedSettings = () => {
    onOpenChange(false)
    navigate({
      to: '/projects/$projectId/shares/$shareId',
      params: { projectId, shareId: activeShare.id },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {isEditingName ? (
            <>
              <DialogTitle className="sr-only">{m.rename_share_link()}</DialogTitle>
              <div className="flex items-center gap-1.5 pr-8">
                <Input
                  ref={nameInputRef}
                  value={nameInput}
                  disabled={isRenaming}
                  onChange={(e) => setNameInput(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitRename()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      e.stopPropagation()
                      cancelEditRef.current = true
                      setIsEditingName(false)
                    }
                  }}
                  aria-label={m.rename_share_link()}
                  className="h-8 text-sm font-semibold"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={m.save()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={commitRename}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <DialogTitle className="flex items-center gap-1.5 pr-8 min-w-0">
              <span
                className="truncate cursor-pointer hover:text-foreground/80"
                onClick={startEditingName}
                title={activeShare.name}
              >
                {activeShare.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={m.rename_share_link()}
                onClick={startEditingName}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </DialogTitle>
          )}
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="relative w-full">
            <Input
              value={shareUrl}
              readOnly
              aria-label={m.share_link()}
              className="pr-10 bg-muted/50 text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              aria-label={m.copy_link()}
              onClick={handleCopyLink}
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3.5">
            <ShareSecuritySettings shareLink={activeShare} inDialog />
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={handleAdvancedSettings}
          >
            <span>{m.advanced_settings()}</span>
            <ArrowUpRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleCopyLink} className="gap-2">
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span>{m.copy_link()}</span>
            </Button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              {m.done()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
