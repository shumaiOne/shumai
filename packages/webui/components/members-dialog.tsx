import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { Button } from '@/ui/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu'
import { Input } from '@/ui/components/ui/input'
import { ChevronDown, Copy, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export interface Member {
  id?: string
  name?: string
  role?: string
  image?: string
}

interface MembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  members: Member[]
  isOwner: boolean
  onInvite?: (role: 'editor' | 'reviewer') => Promise<string>
}

export function MembersDialog({
  open,
  onOpenChange,
  title,
  members,
  isOwner,
  onInvite,
}: MembersDialogProps) {
  const [inviteRole, setInviteRole] = useState<'editor' | 'reviewer'>('editor')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!onInvite) return
    setIsGenerating(true)
    try {
      const code = await onInvite(inviteRole)
      const url = `${window.location.origin}/signup?inviteCode=${code}`
      setInviteLink(url)
    } catch (error) {
      console.error(error)
      toast.error('Failed to generate invite link')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink)
      toast.success('Invite link copied to clipboard')
    }
  }

  // Get initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return '??'
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  // Reset state when closed
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setInviteLink(null)
      setInviteRole('editor')
    }
    onOpenChange(newOpen)
  }

  const safeMembers = Array.isArray(members) ? members : []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {safeMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    {member.image && (
                      <AvatarImage src={member.image} alt={member.name} className="object-cover" />
                    )}
                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{member.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {isOwner && onInvite && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Invite New Member</h4>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-[120px] justify-between">
                        {inviteRole === 'editor' ? 'Editor' : 'Reviewer'}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuRadioGroup
                        value={inviteRole}
                        onValueChange={(v) => setInviteRole(v as 'editor' | 'reviewer')}
                      >
                        <DropdownMenuRadioItem value="editor">Editor</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="reviewer">Reviewer</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={handleGenerate} disabled={isGenerating} className="flex-1">
                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Link
                  </Button>
                </div>

                {inviteLink && (
                  <div className="flex gap-2">
                    <Input value={inviteLink} readOnly />
                    <Button variant="outline" size="icon" onClick={copyToClipboard}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
