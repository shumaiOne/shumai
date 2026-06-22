import type { UserInfo } from '@shumai/dtos'
import { ChevronDown, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import type { FieldProps } from './field-types'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { useMemberStore } from '@/ui/stores/members'
import { useTeamId } from '@/ui/hooks/use-team-id'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'

const UserField: React.FC<FieldProps<string>> = ({ value, onSave, readOnly }) => {
  const teamId = useTeamId()
  const { members, fetchMembers } = useMemberStore()
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (teamId) {
      fetchMembers(teamId)
    }
  }, [teamId, fetchMembers])

  const selectedUser = members.find((m) => m.id === value)

  const handleStartEdit = () => {
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const handleSelect = (userId: string) => {
    onSave(userId)
    setIsEditing(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (readOnly) return
    setIsEditing(open)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  const renderUserBadge = (user: UserInfo | undefined) => {
    if (!user) return <span className="text-muted-foreground italic text-sm">Select user</span>
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border h-[22px]">
        <Avatar className="w-4 h-4">
          <AvatarImage src={user.image} alt={user.name} className="object-cover" />
          <AvatarFallback className="text-[8px] bg-rose-400 text-black font-semibold">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate max-w-[120px]">{user.name}</span>
      </span>
    )
  }

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <Popover open={!readOnly && isEditing} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <div
            onClick={handleStartEdit}
            className={`flex items-center justify-between w-full min-h-[28px] px-2 py-1 rounded border border-transparent transition-colors ${
              !readOnly ? 'cursor-pointer hover:bg-accent hover:border-border group' : ''
            }`}
          >
            {renderUserBadge(selectedUser)}
            {!readOnly && (
              <ChevronDown className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="p-1 w-[--radix-popover-trigger-width] min-w-[200px] max-h-60 overflow-auto bg-popover border border-border rounded-lg shadow-lg"
          align="start"
        >
          <div
            onClick={() => handleSelect('')}
            className="px-3 py-2 text-sm text-muted-foreground hover:bg-accent cursor-pointer flex items-center gap-2 rounded-sm"
          >
            <X className="w-3 h-3" /> Clear
          </div>
          {members.map((user) => (
            <div
              key={user.id}
              onClick={() => handleSelect(user.id)}
              className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center gap-2 rounded-sm"
            >
              <Avatar className="w-5 h-5">
                <AvatarImage src={user.image} alt={user.name} className="object-cover" />
                <AvatarFallback className="text-[10px] bg-rose-400 text-black font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">{user.name}</span>
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default UserField
