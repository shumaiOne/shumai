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
import { ChevronDown, Copy, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { copyToClipboard as copyTextToClipboard } from '@/ui/lib/clipboard'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/ui/components/ui/tooltip'
import { m } from '@/ui/paraglide/messages.js'

export interface Member {
  id?: string
  name?: string
  role?: string
  image?: string
  scope?: 'team' | 'project'
  hasCustomRole?: boolean
}

interface MembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  members: Member[]
  isOwner: boolean
  onInvite?: (role: 'editor' | 'reviewer') => Promise<string>
  onUpdateRole?: (memberId: string, role: 'editor' | 'reviewer') => Promise<void>
  onRemoveMember?: (memberId: string) => Promise<void>
  currentUserId?: string
  availableMembersToAdd?: Member[]
  onAddMember?: (userId: string, role: 'editor' | 'reviewer') => Promise<void>
  type?: 'project' | 'team'
}

export function MembersDialog({
  open,
  onOpenChange,
  title,
  members,
  isOwner,
  onInvite,
  onUpdateRole,
  onRemoveMember,
  currentUserId,
  availableMembersToAdd,
  onAddMember,
  type = 'team',
}: MembersDialogProps) {
  const [inviteRole, setInviteRole] = useState<'editor' | 'reviewer'>('editor')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)
  const [rolesToAdd, setRolesToAdd] = useState<Record<string, 'editor' | 'reviewer'>>({})
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null)

  const localizeRole = (role?: string) => {
    if (!role) return ''
    switch (role.toLowerCase()) {
      case 'owner':
        return m.owner()
      case 'editor':
        return m.editor()
      case 'reviewer':
        return m.reviewer()
      default:
        return role
    }
  }

  const setRoleToAdd = (memberId: string, role: 'editor' | 'reviewer') => {
    setRolesToAdd((prev) => ({ ...prev, [memberId]: role }))
  }

  const handleUpdateRole = async (memberId: string, role: 'editor' | 'reviewer') => {
    if (!onUpdateRole) return
    setUpdatingMemberId(memberId)
    try {
      await onUpdateRole(memberId, role)
      toast.success(m.member_role_updated())
    } catch (error) {
      console.error(error)
      toast.error(m.failed_to_update_member_role())
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const handleRemoveMember = async () => {
    if (!onRemoveMember || !memberToRemove?.id) return
    setUpdatingMemberId(memberToRemove.id)
    try {
      await onRemoveMember(memberToRemove.id)
      toast.success(m.member_removed())
      setMemberToRemove(null)
    } catch (error) {
      console.error(error)
      toast.error(m.failed_to_remove_member())
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const handleGenerate = async () => {
    if (!onInvite) return
    setIsGenerating(true)
    try {
      const code = await onInvite(inviteRole)
      const url = `${window.location.origin}/signup?inviteCode=${code}`
      setInviteLink(url)
    } catch (error) {
      console.error(error)
      toast.error(m.failed_to_generate_invite_link())
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    if (inviteLink) {
      const ok = await copyTextToClipboard(inviteLink)
      if (ok) {
        toast.success(m.invite_link_copied())
      }
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
      setRolesToAdd({})
      setAddingMemberId(null)
    }
    onOpenChange(newOpen)
  }

  const safeMembers = Array.isArray(members) ? members : []
  const safeAvailableMembers = Array.isArray(availableMembersToAdd) ? availableMembersToAdd : []

  const topMembers =
    type === 'project' && isOwner
      ? safeMembers.filter((m) => m.role === 'owner' || m.scope === 'project' || m.hasCustomRole)
      : safeMembers

  const teamMembersToCustomize =
    type === 'project' && isOwner
      ? safeMembers.filter((m) => m.scope === 'team' && m.role !== 'owner' && !m.hasCustomRole)
      : []

  const otherProjectMembersToAdd =
    type === 'project' && isOwner ? safeAvailableMembers.filter((m) => m.scope === 'project') : []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {topMembers.map((member) => {
              const isProjectScopedInTeamView = type === 'team' && member.scope === 'project'
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {member.image && (
                        <AvatarImage
                          src={member.image}
                          alt={member.name}
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{member.name}</span>
                      <div className="flex items-center gap-2">
                        {!isProjectScopedInTeamView && (
                          <span className="text-xs text-muted-foreground capitalize">
                            {localizeRole(member.role)}
                          </span>
                        )}
                        {member.scope && (
                          <>
                            {!isProjectScopedInTeamView && (
                              <span className="text-[10px] text-muted-foreground/70">•</span>
                            )}
                            <span className="text-xs text-muted-foreground capitalize">
                              {member.scope === 'team' ? m.team_member() : m.project_member()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isOwner && member.role !== 'owner' && member.id !== currentUserId && (
                    <div className="flex items-center gap-2">
                      {isProjectScopedInTeamView ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2 text-xs capitalize w-26 justify-between"
                                  disabled
                                >
                                  <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">{m.project_member_role_tooltip()}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs capitalize w-26"
                              disabled={updatingMemberId === member.id}
                            >
                              {localizeRole(member.role)}
                              <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuRadioGroup
                              value={member.role}
                              onValueChange={(v) =>
                                handleUpdateRole(member.id!, v as 'editor' | 'reviewer')
                              }
                            >
                              <DropdownMenuRadioItem value="editor" className="text-xs">
                                {m.editor()}
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="reviewer" className="text-xs">
                                {m.reviewer()}
                              </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setMemberToRemove(member)}
                        disabled={updatingMemberId === member.id}
                      >
                        {updatingMemberId === member.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <AlertDialog
            open={!!memberToRemove}
            onOpenChange={(open) => !open && setMemberToRemove(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{m.remove_member()}</AlertDialogTitle>
                <AlertDialogDescription>
                  {m.remove_member_confirmation({
                    name: memberToRemove?.name || '',
                    type: type === 'project' ? m.project() : m.team(),
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRemoveMember}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {m.remove()}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>{' '}
          {isOwner && onAddMember && teamMembersToCustomize.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-1">{m.add_team_member_to_project()}</h4>
              <p className="text-xs text-muted-foreground mb-3 font-normal">
                {m.add_team_member_to_project_hint()}
              </p>
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                {teamMembersToCustomize.map((member) => {
                  const currentRole = rolesToAdd[member.id!] || 'editor'
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {member.image && (
                            <AvatarImage
                              src={member.image}
                              alt={member.name}
                              className="object-cover"
                            />
                          )}
                          <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{member.name}</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {member.scope === 'team' ? m.team_member() : m.project_member()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs capitalize w-26"
                              disabled={addingMemberId === member.id}
                            >
                              {localizeRole(currentRole)}
                              <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuRadioGroup
                              value={currentRole}
                              onValueChange={(v) =>
                                setRoleToAdd(member.id!, v as 'editor' | 'reviewer')
                              }
                            >
                              <DropdownMenuRadioItem value="editor" className="text-xs">
                                {m.editor()}
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="reviewer" className="text-xs">
                                {m.reviewer()}
                              </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                          onClick={async () => {
                            setAddingMemberId(member.id!)
                            try {
                              await onAddMember(member.id!, currentRole)
                              toast.success(
                                m.added_member_successfully({ name: member.name || '' }),
                              )
                            } catch (error) {
                              console.error(error)
                              toast.error(m.failed_to_add_member({ name: member.name || '' }))
                            } finally {
                              setAddingMemberId(null)
                            }
                          }}
                          disabled={addingMemberId !== null}
                          size="sm"
                          className="h-8 text-xs px-3"
                        >
                          {addingMemberId === member.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            m.set_role()
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {isOwner && onAddMember && otherProjectMembersToAdd.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-1">{m.add_members_from_other_projects()}</h4>
              <p className="text-xs text-muted-foreground mb-3 font-normal">
                {m.add_members_from_other_projects_hint()}
              </p>
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                {otherProjectMembersToAdd.map((member) => {
                  const currentRole = rolesToAdd[member.id!] || 'editor'
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {member.image && (
                            <AvatarImage
                              src={member.image}
                              alt={member.name}
                              className="object-cover"
                            />
                          )}
                          <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{member.name}</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {member.scope === 'team' ? m.team_member() : m.project_member()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs capitalize w-26"
                              disabled={addingMemberId === member.id}
                            >
                              {localizeRole(currentRole)}
                              <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuRadioGroup
                              value={currentRole}
                              onValueChange={(v) =>
                                setRoleToAdd(member.id!, v as 'editor' | 'reviewer')
                              }
                            >
                              <DropdownMenuRadioItem value="editor" className="text-xs">
                                {m.editor()}
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="reviewer" className="text-xs">
                                {m.reviewer()}
                              </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                          onClick={async () => {
                            setAddingMemberId(member.id!)
                            try {
                              await onAddMember(member.id!, currentRole)
                              toast.success(
                                m.added_member_successfully({ name: member.name || '' }),
                              )
                            } catch (error) {
                              console.error(error)
                              toast.error(m.failed_to_add_member({ name: member.name || '' }))
                            } finally {
                              setAddingMemberId(null)
                            }
                          }}
                          disabled={addingMemberId !== null}
                          size="sm"
                          className="h-8 text-xs px-3"
                        >
                          {addingMemberId === member.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            m.add_to_project()
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {isOwner && onInvite && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">{m.invite_new_member()}</h4>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-[120px] justify-between">
                        {inviteRole === 'editor' ? m.editor() : m.reviewer()}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuRadioGroup
                        value={inviteRole}
                        onValueChange={(v) => setInviteRole(v as 'editor' | 'reviewer')}
                      >
                        <DropdownMenuRadioItem value="editor">{m.editor()}</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="reviewer">
                          {m.reviewer()}
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={handleGenerate} disabled={isGenerating} className="flex-1">
                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {m.generate_link()}
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
